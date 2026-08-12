import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../../src/api/runtime.js"
import { PublicationError } from "../../src/publication/observation.js"
import { WorkspaceRoot, NonEmptyName, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { VerifiedPackage, VerifiedReleaseContext, VerifiedSource } from "../../src/release/context.js"
import type { RunCommand } from "../../src/drivers/process.js"

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

export const runtimeLayer = (observations?: { readonly count: { value: number } }): Layer.Layer<ReleaseRuntime> => {
  const source = {
    observe: (workspace: WorkspaceRoot, _manifest: SafeRelativePath, _expected?: NonEmptyName) => {
      if (observations !== undefined) observations.count.value += 1
      return Effect.succeed(contextFor(workspace.toString()))
    }
  }
  const unsupported = () => Effect.fail(PublicationError.make({
    phase: "observe", commitment: "before-dispatch", reason: "fixture transport is not used"
  }))
  const shape: ReleaseRuntimeShape = {
    source,
    run: noopRun,
    http: { request: unsupported },
    catalog: { observe: unsupported, write: unsupported }
  }
  return Layer.succeed(ReleaseRuntime, shape)
}
