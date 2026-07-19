// Invariant: decoding yields one ReleaseIdentity and one totalized release; planners never resolve config.
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import type { ReleaseIntent } from "../config/schema.js"
import { ReleaseCommandRunner } from "../host/host.js"
import { IdentityError } from "../grammar/errors.js"
import { PlanError } from "../grammar/errors.js"
import { parseJsonAs } from "../grammar/json.js"
import { CommandSpec } from "../grammar/operation.js"
import { parseSemverVersion } from "../grammar/semver.js"
import { ReleaseIdentity } from "../grammar/state.js"
import { normalizedName } from "../grammar/template.js"
import type { PyPiPublishSection } from "../features/publish/pypi.js"
import { resolveHomebrew } from "../features/catalog/homebrew.js"
import { resolveScoop } from "../features/catalog/scoop.js"
import { resolveGitHubPublish } from "../features/publish/github.js"
import { resolveNpmPublish } from "../features/publish/npm.js"
import { githubRepository, projectPackageName } from "../features/catalog/shared.js"
import { compactTrustedPublishing } from "../features/publish/trusted-publishing.js"

interface IdentitySeed {
  readonly name: string
  readonly version: string
  readonly commit: string
  readonly tag?: string | undefined
  readonly notes?: string | undefined
  readonly source: "manifest" | "git-tag"
}

interface IdentityProject {
  readonly name?: string | undefined
  readonly packageName?: string | undefined
  readonly version?: string | undefined
  readonly packagePath?: string | undefined
  readonly commit?: string | undefined
  readonly tag?: string | undefined
  readonly tagTemplate?: string | undefined
  readonly notes?: string | undefined
}

class ManifestIdentity extends Schema.Class<ManifestIdentity>("ReleasePackageManifest")({
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString
}) {}
class TaggedIdentity extends Schema.Class<TaggedIdentity>("GitTagReleasePackageManifest")({
  name: Schema.NonEmptyString
}) {}

const identityError = (source: string, field: string, reason: string, cause?: unknown): IdentityError =>
  IdentityError.make({ source, field, reason, cause })

const runGit = Effect.fn("resolve.runGit")(function*(
  root: string,
  args: ReadonlyArray<string>,
  source: "manifest" | "git-tag",
  field: string
) {
  const runner = yield* ReleaseCommandRunner
  const command = CommandSpec.make({
    executable: "git", args: [...args], cwd: root, requiredEnv: [], redactedEnv: []
  })
  return yield* runner.runCommand(command).pipe(
    Effect.mapError((error) => identityError(source, field, error.reason, error))
  )
})

const readManifest = <A>(
  project: IdentityProject,
  root: string,
  decode: (input: unknown) => Effect.Effect<A, { readonly message: string }, never>,
  source: "manifest" | "git-tag",
  field: string,
  requirement: string
): Effect.Effect<A, IdentityError, FileSystem.FileSystem | Path.Path> => Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const packagePath = project.packagePath
    const manifestPath = packagePath === undefined || packagePath.endsWith("package.json")
      ? packagePath ?? "package.json"
      : `${packagePath.replace(/[/\\]+$/, "")}/package.json`
    const contents = yield* fs.readFileString(path.resolve(root, manifestPath)).pipe(
      Effect.mapError((error) => identityError(source, field, error.message, error))
    )
    const parsed = yield* parseJsonAs(
      Schema.Unknown,
      contents,
      (cause) => identityError(source, field, "Package manifest is not valid JSON.", cause)
    )
    return yield* decode(parsed).pipe(Effect.mapError((error) => identityError(
      source,
      field,
      `Package manifest must include ${requirement}: ${error.message}`
    )))
  })

const semver = (
  source: "manifest" | "git-tag",
  field: string,
  value: string
): Effect.Effect<string, IdentityError> => {
  const parsed = parseSemverVersion(value)
  return parsed === undefined
    ? Effect.fail(identityError(source, field, `Version ${value} is not a valid semver version.`))
    : Effect.succeed(parsed)
}

const makeIdentity = (seed: IdentitySeed, snapshot: boolean): ReleaseIdentity => {
  const shortCommit = seed.commit.slice(0, 7)
  const version = snapshot ? `${seed.version}-SNAPSHOT-${shortCommit || "snapshot"}` : seed.version
  return ReleaseIdentity.make({
    name: seed.name,
    normalizedName: normalizedName(seed.name),
    version,
    tag: seed.tag ?? version,
    commit: seed.commit,
    shortCommit,
    notes: seed.notes,
    versionSource: seed.source,
    snapshot
  })
}

const resolveManifestCommit = Effect.fn("resolve.manifestCommit")(function*(seed: IdentitySeed, root: string) {
  if (seed.commit !== "HEAD") return seed
  const result = yield* runGit(root, ["rev-parse", "--short", "HEAD"], "manifest", "identity.commit")
  const commit = result.stdout.trim()
  if (result.exitCode === 0 && commit.length > 0) return { ...seed, commit }
  return yield* Effect.fail(identityError(
    "manifest",
    "identity.commit",
    result.exitCode === 0 ? "Git HEAD resolved to an empty commit." : "Unable to resolve Git HEAD."
  ))
})

const manifestTag = (template: string, version: string, field: string): Effect.Effect<string, IdentityError> =>
  template.includes("{name}") || template.includes("{normalizedName}")
    ? Effect.fail(identityError("manifest", field, "Only the {version} placeholder is supported here."))
    : Effect.succeed(template.split("{version}").join(version))

export const resolveManifestIdentity = Effect.fn("resolve.manifest")(function*(options: {
  readonly project: IdentityProject
  readonly root: string
  readonly snapshot?: boolean | undefined
}) {
  const project = options.project
  let seed: IdentitySeed
  if (project.version === undefined) {
    const manifest = yield* readManifest(
      project, options.root, Schema.decodeUnknownEffect(ManifestIdentity),
      "manifest", "identity.packagePath", "name and version"
    )
    const version = yield* semver("manifest", "identity.version", manifest.version)
    const template = project.tagTemplate ?? "v{version}"
    seed = {
      name: manifest.name, version, commit: project.commit ?? "HEAD",
      tag: yield* manifestTag(template, version, "identity.tagTemplate"), notes: project.notes, source: "manifest"
    }
  } else {
    const version = yield* semver("manifest", "project.version", project.version)
    const name = project.name ?? project.packageName
    if (name === undefined || name.trim().length === 0) {
      return yield* Effect.fail(identityError(
        "manifest", "project.name", "Static project identity requires project.name or project.packageName."
      ))
    }
    const template = project.tagTemplate ?? "v{version}"
    const renderedTag = yield* manifestTag(template, version, "project.tagTemplate")
    seed = {
      name, version, commit: project.commit ?? "HEAD",
      tag: project.tag ?? renderedTag,
      notes: project.notes, source: "manifest"
    }
  }
  return makeIdentity(yield* resolveManifestCommit(seed, options.root), options.snapshot ?? false)
})

const tagFrom = Effect.fn("resolve.tagFrom")(function*(root: string, args: ReadonlyArray<string>) {
  const result = yield* runGit(root, args, "git-tag", "versionFrom")
  return result.exitCode === 0
    ? result.stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0)
    : undefined
})

export const resolveGitTagIdentity = Effect.fn("resolve.gitTag")(function*(options: {
  readonly project: IdentityProject
  readonly root: string
  readonly snapshot: boolean
}) {
  const project = options.project
  let name = projectPackageName(project)
  if (name === undefined || name.trim().length === 0) {
    name = (yield* readManifest(
      project, options.root, Schema.decodeUnknownEffect(TaggedIdentity),
      "git-tag", "project.name", "name"
    )).name
  }
  let commit = project.commit
  if (commit === undefined || commit.trim().length === 0 || commit === "HEAD") {
    const result = yield* runGit(options.root, ["rev-parse", "--short", "HEAD"], "git-tag", "project.commit").pipe(
      Effect.catch((error: IdentityError) => options.snapshot
        ? Effect.succeed({ exitCode: 1, stdout: "", stderr: error.reason })
        : Effect.fail(error))
    )
    commit = result.exitCode === 0 && result.stdout.trim().length > 0
      ? result.stdout.trim()
      : options.snapshot ? "snapshot" : yield* Effect.fail(
        identityError("git-tag", "project.commit", "Unable to resolve Git HEAD.")
      )
  }
  const configuredTag = project.tag?.trim()
  const environmentTag = yield* Config.string("TS_RELEASE_CURRENT_TAG").pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined)
  )
  const tag = configuredTag
    || environmentTag?.trim()
    || (yield* tagFrom(options.root, ["tag", "--points-at", "HEAD", "--sort=-version:refname"]).pipe(
      Effect.catch(() => Effect.succeed(undefined))
    ))
    || (yield* tagFrom(options.root, ["describe", "--tags", "--abbrev=0"]).pipe(
      Effect.catch(() => Effect.succeed(undefined))
    ))
  if (tag === undefined) {
    if (!options.snapshot) return yield* Effect.fail(identityError(
      "git-tag", "versionFrom", "No git tag found for versionFrom git-tag; use --snapshot to build a snapshot."
    ))
    return makeIdentity({ name, version: "0.0.0", commit, tag: "v0.0.0", notes: project.notes, source: "git-tag" }, true)
  }
  const version = yield* semver("git-tag", "versionFrom", tag.startsWith("v") ? tag.slice(1) : tag).pipe(
    Effect.mapError(() => identityError("git-tag", "versionFrom", `Git tag ${tag} is not a valid semver version.`))
  )
  return makeIdentity({ name, version, commit, tag, notes: project.notes, source: "git-tag" }, options.snapshot)
})

const evidenceDirectory = (intent: ReleaseIntent, identity: ReleaseIdentity): string => {
  const template = typeof intent.evidence === "string"
    ? intent.evidence
    : intent.evidence?.directory ?? ".release/evidence"
  return template.split("{version}").join(identity.version)
}

export const resolveRelease = (intent: ReleaseIntent, identity: ReleaseIdentity) => ({
  identity,
  builds: intent.builds === undefined || intent.builds.length === 0 ? Option.none() : Option.some(intent.builds),
  npmPackage: intent.npmPackage === undefined || intent.npmPackage === false ? Option.none()
    : Option.some(intent.npmPackage === true ? { path: "." } : intent.npmPackage),
  pypiWheels: intent.pypiWheel === undefined ? Option.none()
    : Option.some(Array.isArray(intent.pypiWheel) ? intent.pypiWheel : [intent.pypiWheel]),
  artifacts: Option.fromUndefinedOr(intent.artifacts),
  archives: Option.fromUndefinedOr(intent.archives),
  checksum: Option.fromUndefinedOr(intent.checksum),
  npm: Option.fromUndefinedOr(resolveNpmPublish(intent, identity)),
  pypi: Option.fromUndefinedOr(((): PyPiPublishSection | undefined => {
    const publish = intent.publish.pypi
    if (publish === undefined || publish === false) return undefined
    if (publish === true) return {
      repositoryUrl: "https://upload.pypi.org/legacy/", pythonExecutable: "python",
      usernameEnv: undefined, passwordEnv: undefined, trustedPublishing: undefined, artifactIds: undefined
    }
    return { ...publish, trustedPublishing: compactTrustedPublishing(publish.trustedPublishing) }
  })()),
  github: Option.fromUndefinedOr(resolveGitHubPublish(intent)),
  homebrew: Option.fromUndefinedOr(resolveHomebrew(intent.publish.homebrew, intent)),
  scoop: Option.fromUndefinedOr(resolveScoop(intent.publish.scoop, intent)),
  catalogs: Option.fromUndefinedOr(intent.catalogs?.map((entry) => ({ ...entry, githubRepository: githubRepository(intent) }))),
  evidenceDirectory: evidenceDirectory(intent, identity)
})

export type ResolvedRelease = Readonly<ReturnType<typeof resolveRelease>>

const validateResolvedRelease = (release: ResolvedRelease): Effect.Effect<ResolvedRelease, PlanError> => {
  if (Option.isSome(release.npm) && release.npm.value.trustedPublishing !== undefined
    && release.npm.value.tokenEnv !== undefined) return Effect.fail(PlanError.make({
      pipeId: "publish:npm", field: "publish.npm.tokenEnv",
      reason: "NPM trusted publishing uses CI OIDC and must not also declare tokenEnv."
    }))
  if (Option.isSome(release.pypi)) {
    const { passwordEnv, trustedPublishing, usernameEnv } = release.pypi.value
    const reason = trustedPublishing !== undefined && (usernameEnv !== undefined || passwordEnv !== undefined)
      ? "PyPI trusted publishing uses CI OIDC and must not also declare usernameEnv or passwordEnv."
      : (usernameEnv === undefined) !== (passwordEnv === undefined)
      ? "PyPI token auth must configure both usernameEnv and passwordEnv, or neither."
      : usernameEnv !== undefined && (usernameEnv !== "TWINE_USERNAME" || passwordEnv !== "TWINE_PASSWORD")
      ? "PyPI token auth only supports usernameEnv TWINE_USERNAME and passwordEnv TWINE_PASSWORD because Twine reads those environment variables directly; this adapter keeps secrets out of argv and does not remap env names."
      : undefined
    if (reason !== undefined) return Effect.fail(PlanError.make({
      pipeId: "publish:pypi", field: "publish.pypi", reason
    }))
  }
  if (Option.isSome(release.github) && release.github.value.repository.trim().length === 0) {
    return Effect.fail(PlanError.make({
      pipeId: "publish:github", field: "publish.github.repository",
      reason: "GitHub publishing requires publish.github.repository or project.repository."
    }))
  }
  return Effect.succeed(release)
}

export const resolveReleaseWorkflow = Effect.fn("release.resolve")(function*(
  intent: ReleaseIntent,
  root: string,
  snapshot: boolean
) {
  const identity = intent.versionFrom === "git-tag"
    ? yield* resolveGitTagIdentity({ project: intent.project, root, snapshot })
    : yield* resolveManifestIdentity({ project: intent.project, root, snapshot })
  return yield* validateResolvedRelease(resolveRelease(intent, identity))
})
