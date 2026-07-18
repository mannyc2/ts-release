import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { parseSemverVersion } from "../semver.js"
import {
  identityError,
  projectManifestPath,
  projectPackageName,
  readPackageManifestJson,
  ResolvedIdentity,
  runWorkspaceGit,
  type VersionSource
} from "./source.js"


interface ManifestProjectOptions {
  readonly name?: string | undefined
  readonly package?: string | undefined
  readonly packageName?: string | undefined
  readonly version?: string | undefined
  readonly packagePath?: string | undefined
  readonly commit?: string | undefined
  readonly tag?: string | undefined
  readonly tagTemplate?: string | undefined
  readonly notes?: string | undefined
}

export interface ManifestIdentityOptions {
  readonly project: ManifestProjectOptions
  readonly root: string
}

class ReleasePackageManifest extends Schema.Class<ReleasePackageManifest>("ReleasePackageManifest")({
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString
}) {}

const decodePackageManifest = Schema.decodeUnknownEffect(ReleasePackageManifest)

const manifestError = (field: string, reason: string, cause?: unknown) =>
  identityError("manifest", field, reason, cause)

const validateNonEmptySafeRelativePath = (
  field: string,
  value: string
): Effect.Effect<void, ReturnType<typeof manifestError>> => {
  const isEmpty = value.trim().length === 0
  const isAbsolute = value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)
  const hasTraversal = value.split(/[\\/]+/).includes("..")
  if (!isEmpty && !isAbsolute && !hasTraversal) {
    return Effect.void
  }
  return Effect.fail(
    manifestError(
      field,
      "Path must be non-empty, relative, and must not contain parent traversal."
    )
  )
}

const requireSemverVersion = (
  field: string,
  value: string
): Effect.Effect<string, ReturnType<typeof manifestError>> => {
  const parsed = parseSemverVersion(value)
  return parsed === undefined
    ? Effect.fail(manifestError(field, `Version ${value} is not a valid semver version.`))
    : Effect.succeed(parsed)
}

const requireCompactString = (
  field: string,
  value: string | undefined,
  reason: string
): Effect.Effect<string, ReturnType<typeof manifestError>> => {
  if (value !== undefined && value.trim().length > 0) {
    return Effect.succeed(value)
  }
  return Effect.fail(manifestError(field, reason))
}

const templateField = (
  field: string,
  value: string
): Effect.Effect<void, ReturnType<typeof manifestError>> => {
  if (value.includes("{name}") || value.includes("{normalizedName}")) {
    return Effect.fail(
      manifestError(field, "Only the {version} placeholder is supported here.")
    )
  }
  return Effect.void
}

const renderVersionTemplate = (value: string, version: string): string =>
  value.split("{version}").join(version)

const resolveCommit = Effect.fn("pipeline.identity.manifest.resolveCommit")(function*(
  identity: ResolvedIdentity,
  root: string
) {
  if (identity.commit !== "HEAD") {
    return identity
  }

  const result = yield* runWorkspaceGit(root, ["rev-parse", "--short", "HEAD"], {
    source: "manifest",
    field: "identity.commit"
  })
  const commit = result.stdout.trim()
  if (result.exitCode !== 0 || commit.length === 0) {
    return yield* Effect.fail(
      manifestError(
        "identity.commit",
        result.exitCode === 0
          ? "Git HEAD resolved to an empty commit."
          : "Unable to resolve Git HEAD."
      )
    )
  }

  return ResolvedIdentity.make({
    name: identity.name,
    version: identity.version,
    commit,
    tag: identity.tag,
    notes: identity.notes,
    sourceId: identity.sourceId
  })
})

const resolveStaticIdentity = Effect.fn("pipeline.identity.manifest.resolveStaticIdentity")(function*(
  options: ManifestIdentityOptions
) {
  const project = options.project
  const commit = project.commit ?? "HEAD"
  if (project.version === undefined) {
    return yield* Effect.fail(
      manifestError("project.version", "Static project identity requires project.version.")
    )
  }
  const version = yield* requireSemverVersion("project.version", project.version)
  const name = yield* requireCompactString(
    "project.name",
    project.name ?? projectPackageName(project),
    "Static project identity requires project.name or project.packageName."
  )
  const tagTemplate = project.tagTemplate ?? "v{version}"
  yield* templateField("project.tagTemplate", tagTemplate)
  return ResolvedIdentity.make({
    name,
    version,
    commit,
    tag: project.tag ?? renderVersionTemplate(tagTemplate, version),
    notes: project.notes,
    sourceId: "manifest"
  })
})

const resolvePackageManifestIdentity = Effect.fn(
  "pipeline.identity.manifest.resolvePackageManifestIdentity"
)(function*(
  options: ManifestIdentityOptions
) {
  const project = options.project
  const field = "identity.packagePath"
  const packagePath = project.packagePath === undefined
    ? "package.json"
    : projectManifestPath(project.packagePath)
  yield* validateNonEmptySafeRelativePath(field, packagePath)
  const manifest = yield* readPackageManifestJson(
    options.root,
    packagePath,
    decodePackageManifest,
    { source: "manifest", field, requirement: "name and version" }
  )
  const version = yield* requireSemverVersion("identity.version", manifest.version)
  const tagTemplate = project.tagTemplate ?? "v{version}"
  yield* templateField("identity.tagTemplate", tagTemplate)
  return ResolvedIdentity.make({
    name: manifest.name,
    version,
    commit: project.commit ?? "HEAD",
    tag: renderVersionTemplate(tagTemplate, version),
    notes: project.notes,
    sourceId: "manifest"
  })
})

export const manifestSource: VersionSource<ManifestIdentityOptions> = {
  id: "manifest",
  resolve: Effect.fn("pipeline.identity.manifest.resolve")(function*(
    options
  ) {
    const identity = options.project.version === undefined
      ? yield* resolvePackageManifestIdentity(options)
      : yield* resolveStaticIdentity(options)
    return yield* resolveCommit(identity, options.root)
  })
}
