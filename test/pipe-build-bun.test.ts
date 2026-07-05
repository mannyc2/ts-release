import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import { buildPipe } from "../src/pipes/build.js"
import type { BunCompileTarget, Operation, StageAction } from "../src/pipeline/operation.js"
import type { PlatformTarget } from "../src/pipeline/platform.js"
import { emptyReleaseState, ReleaseIdentity } from "../src/pipeline/state.js"

const identity = ReleaseIdentity.make({
  name: "release",
  normalizedName: "release",
  version: "0.1.0",
  commit: "abc123",
  shortCommit: "abc123",
  tag: "v0.1.0",
  versionSource: "config",
  snapshot: false
})

type StageOperation = Operation & { readonly action: StageAction }

const plannedCompileTarget = Effect.fn("pipe-build-bun-test.plannedCompileTarget")(function*(
  target: PlatformTarget,
  cpu?: "baseline" | "modern" | undefined
) {
  const config = yield* parseReleaseIntent(JSON.stringify({
    project: {
      name: "release",
      version: "0.1.0",
      commit: "abc123",
      tag: "v0.1.0"
    },
    builds: [{
      builder: "bun",
      entry: "src/cli.ts",
      targets: [target],
      ...(cpu === undefined ? {} : { cpu })
    }],
    publish: {}
  }))
  const section = buildPipe.section(config)
  expect(section).toBeDefined()
  if (section === undefined) {
    return undefined
  }

  const contribution = yield* buildPipe.plan(buildPipe.defaults?.(section, identity) ?? section, emptyReleaseState(identity))
  const operation = contribution.operations.find(isStageArtifactOperation)
  const intent = operation?.action.intent
  return intent?._tag === "bun-compile" ? intent.compileTarget : undefined
})

const isStageArtifactOperation = (operation: unknown): operation is StageOperation =>
  typeof operation === "object"
  && operation !== null
  && "action" in operation
  && typeof operation.action === "object"
  && operation.action !== null
  && "_tag" in operation.action
  && operation.action._tag === "stage"

describe("Bun build pipe", () => {
  it.effect("emits a Bun compile staging operation", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        builds: [{
          builder: "bun",
          entry: "src/cli.ts",
          targets: ["linux-x64"],
          cpu: "baseline"
        }],
        publish: {}
      }))
      const section = buildPipe.section(config)
      expect(section).toBeDefined()
      if (section === undefined) {
        return
      }

      const contribution = yield* buildPipe.plan(buildPipe.defaults?.(section, identity) ?? section, emptyReleaseState(identity))
      const operation = contribution.operations.find(isStageArtifactOperation)

      expect(operation?.action.intent).toMatchObject({
        _tag: "bun-compile",
        target: "linux-x64",
        compileTarget: "bun-linux-x64-baseline"
      })
    }))

  it.effect("renders default artifact names with distribution tokens", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        builds: [{
          builder: "bun",
          entry: "src/cli.ts",
          targets: ["linux-x64-musl", "windows-x64"]
        }],
        publish: {}
      }))
      const section = buildPipe.section(config)
      expect(section).toBeDefined()
      if (section === undefined) {
        return
      }

      const contribution = yield* buildPipe.plan(buildPipe.defaults?.(section, identity) ?? section, emptyReleaseState(identity))

      expect(contribution.artifacts.map((artifact) => artifact.id)).toEqual([
        "cli-linux-x64-musl",
        "cli-windows-x64"
      ])
      expect(contribution.artifacts.map((artifact) => artifact.path)).toEqual([
        ".release/artifacts/release_0.1.0_linux_amd64_musl",
        ".release/artifacts/release_0.1.0_windows_amd64.exe"
      ])
    }))

  it.effect("maps Bun target CPU variants", () =>
    Effect.gen(function*() {
      const cases: ReadonlyArray<{
        readonly target: PlatformTarget
        readonly cpu?: "baseline" | "modern" | undefined
        readonly compileTarget: BunCompileTarget
      }> = [
        { target: "linux-x64", compileTarget: "bun-linux-x64" },
        { target: "linux-x64", cpu: "baseline", compileTarget: "bun-linux-x64-baseline" },
        { target: "linux-x64", cpu: "modern", compileTarget: "bun-linux-x64-modern" },
        { target: "linux-x64-musl", compileTarget: "bun-linux-x64-musl" },
        { target: "linux-x64-musl", cpu: "baseline", compileTarget: "bun-linux-x64-baseline-musl" },
        { target: "linux-x64-musl", cpu: "modern", compileTarget: "bun-linux-x64-modern-musl" },
        { target: "linux-arm64", compileTarget: "bun-linux-arm64" },
        { target: "linux-arm64", cpu: "baseline", compileTarget: "bun-linux-arm64-baseline" },
        { target: "linux-arm64", cpu: "modern", compileTarget: "bun-linux-arm64-modern" },
        { target: "linux-arm64-musl", compileTarget: "bun-linux-arm64-musl" },
        { target: "linux-arm64-musl", cpu: "baseline", compileTarget: "bun-linux-arm64-baseline-musl" },
        { target: "linux-arm64-musl", cpu: "modern", compileTarget: "bun-linux-arm64-modern-musl" },
        { target: "darwin-x64", compileTarget: "bun-darwin-x64" },
        { target: "darwin-x64", cpu: "baseline", compileTarget: "bun-darwin-x64-baseline" },
        { target: "darwin-x64", cpu: "modern", compileTarget: "bun-darwin-x64-modern" },
        { target: "darwin-arm64", compileTarget: "bun-darwin-arm64" },
        { target: "darwin-arm64", cpu: "baseline", compileTarget: "bun-darwin-arm64-baseline" },
        { target: "darwin-arm64", cpu: "modern", compileTarget: "bun-darwin-arm64-modern" },
        { target: "windows-x64", compileTarget: "bun-windows-x64" },
        { target: "windows-x64", cpu: "baseline", compileTarget: "bun-windows-x64-baseline" },
        { target: "windows-x64", cpu: "modern", compileTarget: "bun-windows-x64-modern" },
        { target: "windows-arm64", compileTarget: "bun-windows-arm64" }
      ]

      for (const item of cases) {
        const compileTarget = yield* plannedCompileTarget(item.target, item.cpu)
        expect(compileTarget).toBe(item.compileTarget)
      }
    }))

  it.effect("rejects windows arm64 CPU suffixes", () =>
    Effect.gen(function*() {
      const error = yield* plannedCompileTarget("windows-arm64", "baseline").pipe(Effect.flip)

      expect(error).toMatchObject({
        field: "builds[].cpu",
        reason: "Bun windows-arm64 does not support baseline or modern CPU suffixes."
      })
    }))
})
