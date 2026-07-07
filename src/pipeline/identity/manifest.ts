import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { parseJsonAs } from "../json.js"
import { CommandSpec } from "../operation.js"
import { optionalField } from "../optional-field.js"
import { IdentityError } from "../errors.js"
import { parseSemverVersion } from "../semver.js"
import { ResolvedIdentity, type VersionSource, type WorkspaceServices } from "./source.js"


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

const identityError = (
  field: string,
  reason: string,
  cause?: unknown
): IdentityError =>
  IdentityError.make({
    source: "manifest",
    field,
    reason,
    ...optionalField(cause, (errorCause) => ({ cause: errorCause }))
  })

const validateNonEmptySafeRelativePath = (
  field: string,
  value: string
): Effect.Effect<void, IdentityError> => {
  const isEmpty = value.trim().length === 0
  const isAbsolute = value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)
  const hasTraversal = value.split(/[\\/]+/).includes("..")
  if (!isEmpty && !isAbsolute && !hasTraversal) {
    return Effect.void
  }
  return Effect.fail(
    identityError(
      field,
      "Path must be non-empty, relative, and must not contain parent traversal."
    )
  )
}

const requireSemverVersion = (
  field: string,
  value: string
): Effect.Effect<string, IdentityError> => {
  const parsed = parseSemverVersion(value)
  return parsed === undefined
    ? Effect.fail(identityError(field, `Version ${value} is not a valid semver version.`))
    : Effect.succeed(parsed)
}

const requireCompactString = (
  field: string,
  value: string | undefined,
  reason: string
): Effect.Effect<string, IdentityError> => {
  if (value !== undefined && value.trim().length > 0) {
    return Effect.succeed(value)
  }
  return Effect.fail(identityError(field, reason))
}

const templateField = (
  field: string,
  value: string
): Effect.Effect<void, IdentityError> => {
  if (value.includes("{name}") || value.includes("{normalizedName}")) {
    return Effect.fail(
      identityError(field, "Only the {version} placeholder is supported here.")
    )
  }
  return Effect.void
}

const renderVersionTemplate = (value: string, version: string): string =>
  value.split("{version}").join(version)

const gitHeadCommand = (root: string): CommandSpec =>
  CommandSpec.make({
    executable: "git",
    args: ["rev-parse", "--short", "HEAD"],
    cwd: root,
    requiredEnv: [],
    redactedEnv: []
  })

const projectPackageName = (project: ManifestProjectOptions): string | undefined =>
  project.packageName ?? project.package ?? project.name

const projectManifestPath = (project: ManifestProjectOptions): string | undefined => {
  const packagePath = project.packagePath
  if (packagePath === undefined || packagePath.endsWith("package.json")) {
    return packagePath
  }
  return `${packagePath.replace(/[/\\]+$/, "")}/package.json`
}

const resolveCommit = Effect.fn("pipeline.identity.manifest.resolveCommit")(function*(
  identity: ResolvedIdentity,
  root: string,
  workspace: WorkspaceServices
) {
  if (identity.commit !== "HEAD") {
    return identity
  }

  const result = yield* workspace.commandRunner.runCommand(gitHeadCommand(root)).pipe(
    Effect.mapError((error) =>
      identityError("identity.commit", error.reason, error)
    )
  )
  const commit = result.stdout.trim()
  if (result.exitCode !== 0 || commit.length === 0) {
    return yield* Effect.fail(
      identityError(
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
    ...optionalField(identity.tag, (tag) => ({ tag })),
    ...optionalField(identity.notes, (notes) => ({ notes })),
    sourceId: identity.sourceId
  })
})

const readPackageManifest = Effect.fn("pipeline.identity.manifest.readPackageManifest")(function*(
  options: ManifestIdentityOptions,
  workspace: WorkspaceServices,
  packagePath: string
) {
  const field = "identity.packagePath"
  yield* validateNonEmptySafeRelativePath(field, packagePath)
  const readPath = workspace.path.resolve(options.root, packagePath)
  const contents = yield* workspace.fileSystem.readFileString(readPath).pipe(
    Effect.mapError((error) =>
      identityError(field, error.message, error)
    )
  )
  const parsed = yield* parseJsonAs(
    Schema.Unknown,
    contents,
    (cause) =>
      identityError(field, "Package manifest is not valid JSON.", cause)
  )
  return yield* decodePackageManifest(parsed).pipe(
    Effect.mapError((error) =>
      identityError(
        field,
        `Package manifest must include name and version: ${error.message}`
      )
    )
  )
})

const resolveStaticIdentity = Effect.fn("pipeline.identity.manifest.resolveStaticIdentity")(function*(
  options: ManifestIdentityOptions
) {
  const project = options.project
  const commit = project.commit ?? "HEAD"
  if (project.version === undefined) {
    return yield* Effect.fail(
      identityError("project.version", "Static project identity requires project.version.")
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
    ...optionalField(project.notes, (notes) => ({ notes })),
    sourceId: "manifest"
  })
})

const resolvePackageManifestIdentity = Effect.fn(
  "pipeline.identity.manifest.resolvePackageManifestIdentity"
)(function*(
  options: ManifestIdentityOptions,
  workspace: WorkspaceServices
) {
  const project = options.project
  const manifest = yield* readPackageManifest(
    options,
    workspace,
    projectManifestPath(project) ?? "package.json"
  )
  const version = yield* requireSemverVersion("identity.version", manifest.version)
  const tagTemplate = project.tagTemplate ?? "v{version}"
  yield* templateField("identity.tagTemplate", tagTemplate)
  return ResolvedIdentity.make({
    name: manifest.name,
    version,
    commit: project.commit ?? "HEAD",
    tag: renderVersionTemplate(tagTemplate, version),
    ...optionalField(project.notes, (notes) => ({ notes })),
    sourceId: "manifest"
  })
})

export const manifestSource: VersionSource<ManifestIdentityOptions> = {
  id: "manifest",
  resolve: Effect.fn("pipeline.identity.manifest.resolve")(function*(
    options,
    workspace
  ) {
    const identity = options.project.version === undefined
      ? yield* resolvePackageManifestIdentity(options, workspace)
      : yield* resolveStaticIdentity(options)
    return yield* resolveCommit(identity, options.root, workspace)
  })
}
