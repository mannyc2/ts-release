import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { parseJsonAs } from "../json.js"
import { CommandSpec } from "../operation.js"
import { optionalField } from "../optional-field.js"
import { IdentityError } from "../errors.js"
import { parseSemverVersion } from "../semver.js"
import { ResolvedIdentity, type VersionSource, type WorkspaceServices } from "./source.js"

interface GitTagProjectOptions {
  readonly name?: string | undefined
  readonly package?: string | undefined
  readonly packageName?: string | undefined
  readonly packagePath?: string | undefined
  readonly commit?: string | undefined
  readonly tag?: string | undefined
  readonly notes?: string | undefined
}

export interface GitTagIdentityOptions {
  readonly project: GitTagProjectOptions
  readonly root: string
  readonly snapshot: boolean
}

class ReleasePackageManifest extends Schema.Class<ReleasePackageManifest>("GitTagReleasePackageManifest")({
  name: Schema.NonEmptyString
}) {}

const decodePackageManifest = Schema.decodeUnknownEffect(ReleasePackageManifest)

const identityError = (
  field: string,
  reason: string,
  cause?: unknown
): IdentityError =>
  IdentityError.make({
    source: "git-tag",
    field,
    reason,
    ...optionalField(cause, (errorCause) => ({ cause: errorCause }))
  })

const gitCommand = (root: string, args: ReadonlyArray<string>): CommandSpec =>
  CommandSpec.make({
    executable: "git",
    args: [...args],
    cwd: root,
    requiredEnv: [],
    redactedEnv: []
  })

const runGit = Effect.fn("pipeline.identity.gitTag.runGit")(function*(
  workspace: WorkspaceServices,
  root: string,
  args: ReadonlyArray<string>,
  field: string
) {
  return yield* workspace.commandRunner.runCommand(gitCommand(root, args)).pipe(
    Effect.mapError((error) =>
      identityError(field, error.reason, error)
    )
  )
})

const projectPackageName = (project: GitTagProjectOptions): string | undefined =>
  project.packageName ?? project.package ?? project.name

const projectManifestPath = (project: GitTagProjectOptions): string =>
  project.packagePath === undefined || project.packagePath.endsWith("package.json")
    ? project.packagePath ?? "package.json"
    : `${project.packagePath.replace(/[/\\]+$/, "")}/package.json`

const readPackageName = Effect.fn("pipeline.identity.gitTag.readPackageName")(function*(
  options: GitTagIdentityOptions,
  workspace: WorkspaceServices
) {
  const readPath = workspace.path.resolve(options.root, projectManifestPath(options.project))
  const contents = yield* workspace.fileSystem.readFileString(readPath).pipe(
    Effect.mapError((error) =>
      identityError("project.name", error.message, error)
    )
  )
  const parsed = yield* parseJsonAs(
    Schema.Unknown,
    contents,
    (cause) =>
      identityError("project.name", "Package manifest is not valid JSON.", cause)
  )
  const manifest = yield* decodePackageManifest(parsed).pipe(
    Effect.mapError((error) =>
      identityError(
        "project.name",
        `Package manifest must include name: ${error.message}`
      )
    )
  )
  return manifest.name
})

const resolveName = Effect.fn("pipeline.identity.gitTag.resolveName")(function*(
  options: GitTagIdentityOptions,
  workspace: WorkspaceServices
) {
  const explicit = projectPackageName(options.project)
  if (explicit !== undefined && explicit.trim().length > 0) {
    return explicit
  }
  return yield* readPackageName(options, workspace)
})

const resolveCommit = Effect.fn("pipeline.identity.gitTag.resolveCommit")(function*(
  options: GitTagIdentityOptions,
  workspace: WorkspaceServices
) {
  const explicit = options.project.commit
  if (explicit !== undefined && explicit.trim().length > 0 && explicit !== "HEAD") {
    return explicit
  }
  const result = yield* runGit(workspace, options.root, ["rev-parse", "--short", "HEAD"], "project.commit").pipe(
    Effect.catch((error: IdentityError) =>
      options.snapshot
        ? Effect.succeed({ exitCode: 1, stdout: "", stderr: error.reason })
        : Effect.fail(error)
    )
  )
  const commit = result.stdout.trim()
  if (result.exitCode === 0 && commit.length > 0) {
    return commit
  }
  if (options.snapshot) {
    return "snapshot"
  }
  return yield* Effect.fail(identityError("project.commit", "Unable to resolve Git HEAD."))
})

const firstNonEmptyLine = (value: string): string | undefined =>
  value.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0)

const tagFromHead = Effect.fn("pipeline.identity.gitTag.tagFromHead")(function*(
  options: GitTagIdentityOptions,
  workspace: WorkspaceServices
) {
  const result = yield* runGit(
    workspace,
    options.root,
    ["tag", "--points-at", "HEAD", "--sort=-version:refname"],
    "versionFrom"
  )
  return result.exitCode === 0 ? firstNonEmptyLine(result.stdout) : undefined
})

const tagFromAncestor = Effect.fn("pipeline.identity.gitTag.tagFromAncestor")(function*(
  options: GitTagIdentityOptions,
  workspace: WorkspaceServices
) {
  const result = yield* runGit(
    workspace,
    options.root,
    ["describe", "--tags", "--abbrev=0"],
    "versionFrom"
  )
  return result.exitCode === 0 ? firstNonEmptyLine(result.stdout) : undefined
})

const discoverTag = Effect.fn("pipeline.identity.gitTag.discoverTag")(function*(
  options: GitTagIdentityOptions,
  workspace: WorkspaceServices
) {
  if (options.project.tag !== undefined && options.project.tag.trim().length > 0) {
    return options.project.tag.trim()
  }
  const envTag = yield* Config.string("TS_RELEASE_CURRENT_TAG").pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined)
  )
  if (envTag !== undefined && envTag.trim().length > 0) {
    return envTag.trim()
  }
  const headTag = yield* tagFromHead(options, workspace).pipe(
    Effect.catch(() => Effect.succeed(undefined))
  )
  if (headTag !== undefined) {
    return headTag
  }
  return yield* tagFromAncestor(options, workspace).pipe(
    Effect.catch(() => Effect.succeed(undefined))
  )
})

const versionFromTag = (tag: string): Effect.Effect<string, IdentityError> => {
  const stripped = tag.startsWith("v") ? tag.slice(1) : tag
  const parsed = parseSemverVersion(stripped)
  return parsed === undefined
    ? Effect.fail(identityError("versionFrom", `Git tag ${tag} is not a valid semver version.`))
    : Effect.succeed(parsed)
}

export const gitTagSource: VersionSource<GitTagIdentityOptions> = {
  id: "git-tag",
  resolve: Effect.fn("pipeline.identity.gitTag.resolve")(function*(
    options,
    workspace
  ) {
    const name = yield* resolveName(options, workspace)
    const commit = yield* resolveCommit(options, workspace)
    const tag = yield* discoverTag(options, workspace)
    if (tag === undefined) {
      if (options.snapshot) {
        return ResolvedIdentity.make({
          name,
          version: "0.0.0",
          commit,
          tag: "v0.0.0",
          ...optionalField(options.project.notes, (notes) => ({ notes })),
          sourceId: "git-tag"
        })
      }
      return yield* Effect.fail(
        identityError("versionFrom", "No git tag found for versionFrom git-tag; use --snapshot to build a snapshot.")
      )
    }
    const version = yield* versionFromTag(tag)
    return ResolvedIdentity.make({
      name,
      version,
      commit,
      tag,
      ...optionalField(options.project.notes, (notes) => ({ notes })),
      sourceId: "git-tag"
    })
  })
}
