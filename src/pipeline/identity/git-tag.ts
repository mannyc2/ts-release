import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { IdentityError } from "../errors.js"
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

const gitTagError = (field: string, reason: string, cause?: unknown) =>
  identityError("git-tag", field, reason, cause)

const runGit = (
  root: string,
  args: ReadonlyArray<string>,
  field: string
) => runWorkspaceGit(root, args, { source: "git-tag", field })

const resolveName = Effect.fn("pipeline.identity.gitTag.resolveName")(function*(
  options: GitTagIdentityOptions
) {
  const explicit = projectPackageName(options.project)
  if (explicit !== undefined && explicit.trim().length > 0) {
    return explicit
  }
  const manifest = yield* readPackageManifestJson(
    options.root,
    projectManifestPath(options.project.packagePath),
    decodePackageManifest,
    { source: "git-tag", field: "project.name", requirement: "name" }
  )
  return manifest.name
})

const resolveCommit = Effect.fn("pipeline.identity.gitTag.resolveCommit")(function*(
  options: GitTagIdentityOptions
) {
  const explicit = options.project.commit
  if (explicit !== undefined && explicit.trim().length > 0 && explicit !== "HEAD") {
    return explicit
  }
  const result = yield* runGit(options.root, ["rev-parse", "--short", "HEAD"], "project.commit").pipe(
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
  return yield* Effect.fail(gitTagError("project.commit", "Unable to resolve Git HEAD."))
})

const firstNonEmptyLine = (value: string): string | undefined =>
  value.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0)

const tagFrom = Effect.fn("pipeline.identity.gitTag.tagFrom")(function*(
  options: GitTagIdentityOptions,
  args: ReadonlyArray<string>
) {
  const result = yield* runGit(options.root, args, "versionFrom")
  return result.exitCode === 0 ? firstNonEmptyLine(result.stdout) : undefined
})

const discoverTag = Effect.fn("pipeline.identity.gitTag.discoverTag")(function*(
  options: GitTagIdentityOptions
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
  const headTag = yield* tagFrom(options, ["tag", "--points-at", "HEAD", "--sort=-version:refname"]).pipe(
    Effect.catch(() => Effect.succeed(undefined))
  )
  if (headTag !== undefined) {
    return headTag
  }
  return yield* tagFrom(options, ["describe", "--tags", "--abbrev=0"]).pipe(
    Effect.catch(() => Effect.succeed(undefined))
  )
})

const versionFromTag = (tag: string): Effect.Effect<string, IdentityError> => {
  const stripped = tag.startsWith("v") ? tag.slice(1) : tag
  const parsed = parseSemverVersion(stripped)
  return parsed === undefined
    ? Effect.fail(gitTagError("versionFrom", `Git tag ${tag} is not a valid semver version.`))
    : Effect.succeed(parsed)
}

export const gitTagSource: VersionSource<GitTagIdentityOptions> = {
  id: "git-tag",
  resolve: Effect.fn("pipeline.identity.gitTag.resolve")(function*(
    options
  ) {
    const name = yield* resolveName(options)
    const commit = yield* resolveCommit(options)
    const tag = yield* discoverTag(options)
    if (tag === undefined) {
      if (options.snapshot) {
        return ResolvedIdentity.make({
          name,
          version: "0.0.0",
          commit,
          tag: "v0.0.0",
          notes: options.project.notes,
          sourceId: "git-tag"
        })
      }
      return yield* Effect.fail(
        gitTagError("versionFrom", "No git tag found for versionFrom git-tag; use --snapshot to build a snapshot.")
      )
    }
    const version = yield* versionFromTag(tag)
    return ResolvedIdentity.make({
      name,
      version,
      commit,
      tag,
      notes: options.project.notes,
      sourceId: "git-tag"
    })
  })
}
