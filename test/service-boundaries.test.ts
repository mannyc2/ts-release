import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import {
  ArtifactStager,
  type ArtifactStagerShape,
  makeArtifactStagerLayer,
  type StageOperation,
  UnsupportedArtifactStagerLayer
} from "../src/pack/stager.js"
import { type GitHubApiShape } from "../src/github/github.js"
import { type ReleaseCommandRunnerShape } from "../src/host/host.js"
import { type ReleaseHttpShape } from "../src/host/http.js"
import { resolveGitTagIdentity, resolveManifestIdentity } from "../src/resolve/resolved-release.js"
import { Operation, StageAction } from "../src/grammar/operation.js"
import { ArchiveIntent } from "../src/grammar/intent.js"
import { makePipelineIdentity } from "./helpers.js"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ?
  (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false

const artifactStageMethodIsClosed: Equal<
  Effect.Services<ReturnType<ArtifactStagerShape["stage"]>>,
  never
> = true
const commandMethodIsClosed: Equal<
  Effect.Services<ReturnType<ReleaseCommandRunnerShape["runCommand"]>>,
  never
> = true
const httpMethodIsClosed: Equal<
  Effect.Services<ReturnType<ReleaseHttpShape["runJson"]>>,
  never
> = true
const githubCreateMethodIsClosed: Equal<
  Effect.Services<ReturnType<GitHubApiShape["createRelease"]>>,
  never
> = true
const githubInspectMethodIsClosed: Equal<
  Effect.Services<ReturnType<GitHubApiShape["inspectRelease"]>>,
  never
> = true
const liveStagerRequiresNativeServices: Equal<
  Layer.Services<ReturnType<typeof makeArtifactStagerLayer>>,
  FileSystem.FileSystem | Path.Path
> = true
const unsupportedStagerIsDependencyFree: Equal<
  Layer.Services<typeof UnsupportedArtifactStagerLayer>,
  never
> = true
const manifestSourceUsesEffectServices: Equal<
  Effect.Services<ReturnType<typeof resolveManifestIdentity>>,
  FileSystem.FileSystem | Path.Path | import("../src/host/host.js").ReleaseCommandRunner
> = true
const gitTagSourceUsesEffectServices: Equal<
  Effect.Services<ReturnType<typeof resolveGitTagIdentity>>,
  FileSystem.FileSystem | Path.Path | import("../src/host/host.js").ReleaseCommandRunner
> = true

const action = StageAction.make({
  intent: ArchiveIntent.make({
    outfile: "dist/test.zip",
    format: "zip",
    artifacts: [],
    files: []
  }),
  producesArtifactIds: ["test-artifact"]
})
const operation = {
  ...Operation.make({
    id: "build:test",
    pipeId: "build",
    phase: "build",
    risk: "writes-local",
    description: "Stage a test artifact.",
    action
  }),
  action
} satisfies StageOperation

const TestArtifactStagerLayer: Layer.Layer<ArtifactStager> = Layer.succeed(ArtifactStager)({
  stage: () => Effect.void
})

describe("custom service boundaries", () => {
  it("keeps capability method environments closed and native requirements on live layers", () => {
    expect([
      artifactStageMethodIsClosed,
      commandMethodIsClosed,
      httpMethodIsClosed,
      githubCreateMethodIsClosed,
      githubInspectMethodIsClosed,
      liveStagerRequiresNativeServices,
      unsupportedStagerIsDependencyFree,
      manifestSourceUsesEffectServices,
      gitTagSourceUsesEffectServices
    ]).toEqual([true, true, true, true, true, true, true, true, true])
  })

  it.effect("substitutes an ArtifactStager layer without native service leakage", () =>
    Effect.gen(function*() {
      const result = yield* (yield* ArtifactStager).stage(operation, {
        root: "/workspace",
        identity: makePipelineIdentity()
      })
      expect(result).toBeUndefined()
    }).pipe(Effect.provide(TestArtifactStagerLayer)))

  it.effect("keeps unsupported staging typed and dependency-free", () =>
    Effect.gen(function*() {
      const error = yield* (yield* ArtifactStager).stage(operation, {
        root: "/workspace",
        identity: makePipelineIdentity()
      }).pipe(Effect.flip)
      expect(error).toMatchObject({
        _tag: "ArtifactStageError",
        operationId: "build:test",
        intentTag: "archive"
      })
    }).pipe(Effect.provide(UnsupportedArtifactStagerLayer)))
})
