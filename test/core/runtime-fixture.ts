import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { cpSync, lstatSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../../src/api/runtime.js"
import { parseSha256Hex } from "../../src/model/digest.js"
import { CredentialUnavailable, CredentialProvider, makeCredentialProvider } from "../../src/publication/authority.js"
import { WorkspaceRoot, NonEmptyName, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { SourceMaterializationError, VerifiedPackage, VerifiedReleaseContext, VerifiedSource, type StagingSnapshot } from "../../src/release/context.js"
import type { RunCommand } from "../../src/drivers/process.js"
import { snapshotStaging } from "../../src/release/staging.js"
import {
  PreparedReleaseStore,
  PreparedStoreError,
  type PreparedReleaseStoreShape
} from "../../src/release/prepared-store.js"
import {
  AuthorizedMutationHttp,
  CertifiedPublisherSpawn,
  CredentialPlatformError,
  HttpAuthorizer,
  NpmUserConfigResource
} from "../../src/platform/credentials.js"
import type { ReleaseApiLayer } from "../../src/api/types.js"

export const fixtureConfig = {
  project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
  artifacts: [{ id: "payload", path: "payload.txt", format: "file" }],
  publish: {}
} as const

export const contextFor = (workspace: string, commit = "abc123"): VerifiedReleaseContext => VerifiedReleaseContext.make({
  workspace: WorkspaceRoot.make(workspace),
  source: VerifiedSource.make({
    commit: NonEmptyName.make(commit), tree: NonEmptyName.make("tree123"), clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"),
    packageManifestDigest: parseSha256Hex("a".repeat(64)), headTags: []
  }),
  package: VerifiedPackage.make({
    name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"),
    path: SafeRelativePath.make("package.json"), digest: parseSha256Hex("a".repeat(64))
  })
})

export const noopRun: RunCommand = () => Effect.succeed({ exitCode: 0, stdout: "", stderr: "" })

/** Test-only closed materializer for synthetic, non-Git workspaces. It makes a
 * private copy and never creates a writable alias back to the fixture. */
export const materializeFixtureWorkspace = (
  workspace: WorkspaceRoot,
  _verified: VerifiedSource,
  destination: WorkspaceRoot
): Effect.Effect<StagingSnapshot, SourceMaterializationError> => Effect.try({
  try: () => {
    for (const entry of readdirSync(workspace)) {
      if (entry === ".git" || entry === ".release" || entry === "node_modules" || entry.startsWith("prepared")) continue
      const source = join(workspace, entry)
      if (lstatSync(source).isSymbolicLink()) throw new Error(`Fixture source ${entry} is a symlink.`)
      const target = join(destination, entry)
      cpSync(source, target, { recursive: true, dereference: false })
    }
    return snapshotStaging(destination)
  },
  catch: (cause) => new SourceMaterializationError({
    field: "source.materialization", reason: cause instanceof Error ? cause.message : String(cause)
  })
})

const unavailableStore: PreparedReleaseStoreShape = {
  commit: () => Effect.fail(new PreparedStoreError({ reason: "fixture prepared store is unavailable" })),
  load: () => Effect.fail(new PreparedStoreError({ reason: "fixture prepared store is unavailable" }))
}

export const runtimeLayer = (
  observations?: { readonly count: { value: number } },
  preparedStore: PreparedReleaseStoreShape = unavailableStore,
  run: RunCommand = noopRun
): ReleaseApiLayer => {
  const source = {
    observe: (workspace: WorkspaceRoot, _manifest: SafeRelativePath, _expected?: NonEmptyName) => {
      if (observations !== undefined) observations.count.value += 1
      return Effect.succeed(contextFor(workspace.toString()))
    },
    materialize: materializeFixtureWorkspace
  }
  const runtime: ReleaseRuntimeShape = { source, run }
  const credentials = makeCredentialProvider({
    acquire: (request) => Effect.fail(new CredentialUnavailable({
      subject: request.subject,
      provider: request.provider,
      purpose: request.purpose,
      reason: "fixture credential provider was not expected to be called"
    }))
  })
  const httpAuthorizer = {
    execute: () => Effect.fail(new CredentialPlatformError({
      phase: "observe",
      commitment: "before-dispatch",
      reason: "fixture HTTP authorizer was not expected to be called"
    }))
  }
  const unavailableMutation = () => Effect.fail(new CredentialPlatformError({
    phase: "mutate",
    commitment: "before-dispatch",
    reason: "fixture mutation sink was not expected to be called"
  }))
  return Layer.mergeAll(
    Layer.succeed(ReleaseRuntime, runtime),
    Layer.succeed(PreparedReleaseStore, preparedStore),
    Layer.succeed(CredentialProvider, credentials),
    Layer.succeed(HttpAuthorizer, httpAuthorizer),
    Layer.succeed(AuthorizedMutationHttp, { execute: unavailableMutation }),
    Layer.succeed(NpmUserConfigResource, { acquire: unavailableMutation }),
    Layer.succeed(CertifiedPublisherSpawn, {
      preflightTrustedNpm: unavailableMutation,
      spawn: unavailableMutation
    })
  )
}
