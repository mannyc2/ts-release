import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../../src/api/runtime.js"
import { CredentialUnavailable, CredentialProvider, makeCredentialProvider } from "../../src/publication/authority.js"
import { WorkspaceRoot, NonEmptyName, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { VerifiedPackage, VerifiedReleaseContext, VerifiedSource } from "../../src/release/context.js"
import type { RunCommand } from "../../src/drivers/process.js"
import {
  PreparedReleaseStore,
  PreparedStoreError,
  type PreparedReleaseStoreShape
} from "../../src/release/prepared-store.js"
import {
  CredentialPlatformError,
  HttpAuthorizer
} from "../../src/platform/credentials.js"
import type { ReleaseApiLayer } from "../../src/api/types.js"

export const fixtureConfig = {
  project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
  artifacts: [{ id: "payload", path: "payload.txt", format: "file" }],
  publish: {}
} as const

export const contextFor = (workspace: string, commit = "abc123"): VerifiedReleaseContext => VerifiedReleaseContext.make({
  workspace: WorkspaceRoot.make(workspace),
  source: VerifiedSource.make({
    commit: NonEmptyName.make(commit), tree: NonEmptyName.make("tree123"), clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"),
    packageManifestDigest: NonEmptyName.make("sha256:manifest"), headTags: []
  }),
  package: VerifiedPackage.make({
    name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"),
    path: SafeRelativePath.make("package.json"), digest: NonEmptyName.make("sha256:manifest")
  })
})

export const noopRun: RunCommand = () => Effect.succeed({ exitCode: 0, stdout: "", stderr: "" })

const unavailableStore: PreparedReleaseStoreShape = {
  commit: () => Effect.fail(new PreparedStoreError({ reason: "fixture prepared store is unavailable" })),
  load: () => Effect.fail(new PreparedStoreError({ reason: "fixture prepared store is unavailable" }))
}

export const runtimeLayer = (
  observations?: { readonly count: { value: number } },
  preparedStore: PreparedReleaseStoreShape = unavailableStore
): ReleaseApiLayer => {
  const source = {
    observe: (workspace: WorkspaceRoot, _manifest: SafeRelativePath, _expected?: NonEmptyName) => {
      if (observations !== undefined) observations.count.value += 1
      return Effect.succeed(contextFor(workspace.toString()))
    }
  }
  const runtime: ReleaseRuntimeShape = { source, run: noopRun }
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
  return Layer.mergeAll(
    Layer.succeed(ReleaseRuntime, runtime),
    Layer.succeed(PreparedReleaseStore, preparedStore),
    Layer.succeed(CredentialProvider, credentials),
    Layer.succeed(HttpAuthorizer, httpAuthorizer)
  )
}
