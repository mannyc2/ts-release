import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { parseReleaseIntent } from "../src/config/load.js"
import { buildPlanner, resolveBuilds } from "../src/pipes/build.js"
import type { BunCompileTarget, Operation, StageAction } from "../src/pipeline/operation.js"
import type { PlatformTarget } from "../src/pipeline/platform.js"
import { emptyPlanAccumulator } from "../src/pipeline/runner.js"
import { makePipelineIdentity, releaseConfig } from "./helpers.js"

const identity = makePipelineIdentity()

type StageOperation = Operation & { readonly action: StageAction }

const planBuild = (build: Record<string, unknown>) =>
  Effect.gen(function*() {
    const config = yield* parseReleaseIntent(releaseConfig({ artifacts: [], builds: [build] }))
    return yield* Option.match(resolveBuilds(config.builds), {
      onNone: () => Effect.die("Expected a resolved build section."),
      onSome: (section) => buildPlanner.plan(section, emptyPlanAccumulator(identity))
    })
  })

const plannedCompileTarget = Effect.fn("pipe-build-bun-test.plannedCompileTarget")(function*(
  target: PlatformTarget,
  cpu?: "baseline" | "modern" | undefined
) {
  const contribution = yield* planBuild({
      builder: "bun",
      entry: "src/cli.ts",
      targets: [target],
      ...(cpu === undefined ? {} : { cpu })
  })
  const operation = contribution.operations.find(isStageArtifactOperation)
  const intent = operation?.action.intent
  return intent?._tag === "bun-compile" ? intent.compileTarget : undefined
})

const isStageArtifactOperation = (operation: Operation): operation is StageOperation =>
  operation.action._tag === "stage"

describe("Bun build pipe", () => {
  it.effect("emits a Bun compile staging operation", () =>
    Effect.gen(function*() {
      const contribution = yield* planBuild({
          builder: "bun",
          entry: "src/cli.ts",
          targets: ["linux-x64"],
          cpu: "baseline"
      })
      const operation = contribution.operations.find(isStageArtifactOperation)

      expect(operation?.action.intent).toMatchObject({
        _tag: "bun-compile",
        target: "linux-x64",
        compileTarget: "bun-linux-x64-baseline"
      })
    }))

  it.effect("renders default artifact names with distribution tokens", () =>
    Effect.gen(function*() {
      const contribution = yield* planBuild({
          builder: "bun",
          entry: "src/cli.ts",
          targets: ["linux-x64-musl", "windows-x64"]
      })

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
