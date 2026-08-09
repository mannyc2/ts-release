import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { NonEmptyName, SafeRelativePath, Version, WorkspaceRoot } from "../model/primitives.js"

const optional = Schema.optionalKey

export class VerifiedSource extends Schema.Class<VerifiedSource>("VerifiedSource")({
  commit: NonEmptyName,
  tree: NonEmptyName,
  clean: Schema.Literal(true),
  packageManifestPath: SafeRelativePath,
  packageManifestDigest: NonEmptyName,
  repository: optional(Schema.NonEmptyString),
  headTags: Schema.Array(NonEmptyName)
}) {}

export class VerifiedPackage extends Schema.Class<VerifiedPackage>("VerifiedPackage")({
  name: NonEmptyName,
  version: Version,
  path: SafeRelativePath,
  digest: NonEmptyName,
  repository: optional(Schema.NonEmptyString)
}) {}

export class VerifiedReleaseContext extends Schema.Class<VerifiedReleaseContext>("VerifiedReleaseContext")({
  workspace: WorkspaceRoot,
  source: VerifiedSource,
  package: VerifiedPackage
}) {}

export class ReleaseContextError
  extends Schema.TaggedErrorClass<ReleaseContextError>()("ReleaseContextError", {
    field: Schema.String, reason: Schema.String
  }) {}

export interface SourceObserverShape {
  readonly observe: (
    workspace: WorkspaceRoot,
    packageManifestPath: SafeRelativePath,
    expectedCommit?: NonEmptyName
  ) => Effect.Effect<VerifiedReleaseContext, ReleaseContextError>
}

/** Runtime operations are the only imperative seam. The compiler and linker
 * never receive this service; they consume the verified value it returns. */
export interface SourceObserverRuntime {
  readonly canonicalRoot: (workspace: WorkspaceRoot) => Effect.Effect<string, unknown>
  readonly read: (workspace: WorkspaceRoot, path: SafeRelativePath) => Effect.Effect<Uint8Array, unknown>
  readonly command: (workspace: WorkspaceRoot, argv: ReadonlyArray<string>) => Effect.Effect<string, unknown>
  readonly digest: (bytes: Uint8Array) => Effect.Effect<string, unknown>
}

export class SourceObserver extends Context.Service<SourceObserver, SourceObserverShape>()(
  "SourceObserver"
) {}

const runtimeFailure = (field: string, cause: unknown): ReleaseContextError => ReleaseContextError.make({
  field, reason: cause instanceof Error ? cause.message : String(cause)
})

const command = (runtime: SourceObserverRuntime, workspace: WorkspaceRoot, argv: ReadonlyArray<string>, field: string) =>
  runtime.command(workspace, argv).pipe(Effect.mapError((cause) => runtimeFailure(field, cause)))

const repositoryCoordinate = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim().replace(/\.git$/u, "")
  const match = /(?:github\.com[/:]|^)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/u.exec(trimmed)
  return match?.[1]
}

const jsonObject = (bytes: Uint8Array, path: string): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("manifest root must be an object")
    return value as Record<string, unknown>
  } catch (cause) {
    throw new Error(`${path} is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

/** Shared Git/package observation used by both host entrypoints. */
export const makeSourceObserver = (runtime: SourceObserverRuntime): SourceObserverShape => ({
  observe: Effect.fn("observeVerifiedReleaseContext")(function*(workspace, packageManifestPath, expectedCommit) {
    const canonical = yield* runtime.canonicalRoot(workspace).pipe(
      Effect.mapError((cause) => runtimeFailure("workspace", cause))
    )
    const root = WorkspaceRoot.make(canonical)
    const commit = yield* command(runtime, workspace, ["rev-parse", "HEAD"], "source.commit").pipe(
      Effect.map((value) => value.trim())
    )
    const tree = yield* command(runtime, workspace, ["rev-parse", "HEAD^{tree}"], "source.tree").pipe(
      Effect.map((value) => value.trim())
    )
    const status = yield* command(runtime, workspace, ["status", "--porcelain=v1", "--untracked-files=all"], "source.clean")
    if (status.trim().length > 0) return yield* new ReleaseContextError({
      field: "source.clean", reason: "Preparation requires a clean tracked and untracked source tree."
    })
    const bytes = yield* runtime.read(workspace, packageManifestPath).pipe(
      Effect.mapError((cause) => runtimeFailure("package.manifest", cause))
    )
    let manifest: Record<string, unknown>
    try {
      manifest = jsonObject(bytes, packageManifestPath)
    } catch (cause) {
      return yield* new ReleaseContextError({ field: "package.manifest", reason: cause instanceof Error ? cause.message : String(cause) })
    }
    const name = typeof manifest.name === "string" && manifest.name.trim().length > 0 ? manifest.name.trim() : undefined
    const version = typeof manifest.version === "string" && manifest.version.trim().length > 0 ? manifest.version.trim() : undefined
    if (name === undefined) return yield* new ReleaseContextError({ field: "package.name", reason: "Manifest name is missing or empty." })
    if (version === undefined) return yield* new ReleaseContextError({ field: "package.version", reason: "Manifest version is missing or empty." })
    const digest = yield* runtime.digest(bytes).pipe(
      Effect.mapError((cause) => runtimeFailure("package.manifestDigest", cause))
    )
    const tags = yield* command(runtime, workspace, ["tag", "--points-at", "HEAD"], "source.headTags").pipe(
      Effect.map((value) => value.split("\n").map((tag) => tag.trim()).filter((tag) => tag.length > 0).sort((a, b) => a < b ? -1 : a > b ? 1 : 0))
    )
    const remote = yield* command(runtime, workspace, ["remote", "get-url", "origin"], "source.repository").pipe(
      Effect.map((value) => repositoryCoordinate(value))
    ).pipe(Effect.orElseSucceed(() => undefined))
    const manifestRepository = repositoryCoordinate(manifest.repository)
    const repository = remote !== undefined && manifestRepository !== undefined && remote !== manifestRepository
      ? undefined : remote ?? manifestRepository
    const source = VerifiedSource.make({
      commit: NonEmptyName.make(commit), tree: NonEmptyName.make(tree), clean: true,
      packageManifestPath, packageManifestDigest: NonEmptyName.make(digest), headTags: tags.map((tag) => NonEmptyName.make(tag)),
      ...(repository === undefined ? {} : { repository })
    })
    const context = VerifiedReleaseContext.make({
      workspace: root, source,
      package: VerifiedPackage.make({ name: NonEmptyName.make(name), version: Version.make(version),
        path: packageManifestPath, digest: NonEmptyName.make(digest),
        ...(manifestRepository === undefined ? {} : { repository: manifestRepository }) })
    })
    return yield* verifySource(context, expectedCommit)
  })
})

export const verifySource = Effect.fn("verifySource")(function*(
  context: VerifiedReleaseContext,
  expectedCommit?: NonEmptyName
) {
  if (expectedCommit !== undefined && context.source.commit !== expectedCommit) {
    return yield* new ReleaseContextError({
      field: "source.commit",
      reason: `Expected ${expectedCommit}, observed ${context.source.commit}.`
    })
  }
  if (context.source.clean !== true) {
    return yield* new ReleaseContextError({
      field: "source.clean", reason: "Preparation requires a clean verified source."
    })
  }
  return context
})
