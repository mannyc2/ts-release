import { describe, expect, it, layer } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { makeArtifactStagerLayer, type BunExecutableBuildInput } from "../apps/release-ts/src/runtime.js"
import { parseReleaseIntent } from "../src/config/load.js"
import { buildPlanner } from "../src/features/build/build.js"
import type { Operation, StageAction } from "../src/grammar/operation.js"
import { emptyPlanAccumulator } from "../src/grammar/accumulator.js"
import { makePipelineIdentity, releaseConfig, stageArtifactOperations } from "./helpers.js"

const identity = makePipelineIdentity()

const state = emptyPlanAccumulator(identity)

const portablePath = (path: string): string =>
  path.replaceAll("\\", "/")

type StageOperation = Operation & { readonly action: StageAction }

const isStageArtifactOperation = (operation: Operation): operation is StageOperation =>
  operation.action._tag === "stage"

const planBuild = (build: Record<string, unknown>) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(releaseConfig({ artifacts: [], builds: [build] }))
    return yield* buildPlanner(intent.builds!, state)
  })

describe("build pipe", () => {
  const calls: Array<BunExecutableBuildInput> = []
  const TestLayer = makeArtifactStagerLayer(async (input) => {
    calls.push(input)
    return { success: true, logs: [] }
  }).pipe(Layer.provideMerge(BunServices.layer))

  layer(TestLayer)((it) => {
    it.effect("plans Bun compile intents and stages them through the artifact stager", () =>
      Effect.gen(function*() {
        calls.length = 0
        const contribution = yield* planBuild({
          builder: "bun",
          id: "release-cli",
          entry: "src/cli.ts",
          cpu: "baseline",
          targets: ["linux-x64"],
          output: "dist/release-{version}-{targetTriple}"
        })

        expect(contribution.artifacts).toHaveLength(1)
        expect(contribution.artifacts[0]).toMatchObject({
          id: "release-cli-linux-x64",
          kind: "executable",
          path: "dist/release-0.1.0-linux-x64",
          producedBy: "build:bun",
          platform: {
            os: "linux",
            arch: "x64",
            libc: "glibc",
            targetTriple: "bun-linux-x64-baseline"
          }
        })

        const operations = contribution.operations.filter(isStageArtifactOperation)
        expect(operations).toHaveLength(1)
        expect(operations[0]?.action.intent).toMatchObject({
          _tag: "bun-compile",
          target: "linux-x64",
          compileTarget: "bun-linux-x64-baseline",
          outfile: "dist/release-0.1.0-linux-x64"
        })

        const staged = yield* stageArtifactOperations(operations, {
          root: "/workspace",
          identity,
          configPath: "release.config.json"
        })
        expect(staged[0]?.artifacts.map((artifact) => artifact.path)).toEqual([
          "dist/release-0.1.0-linux-x64"
        ])
        expect(calls.map((call) => ({
          entrypoint: portablePath(call.entrypoint),
          target: call.target,
          outfile: portablePath(call.outfile),
          minify: call.minify
        }))).toEqual([
          {
            entrypoint: expect.stringMatching(/\/workspace\/src\/cli\.ts$/),
            target: "bun-linux-x64-baseline",
            outfile: expect.stringMatching(/\/workspace\/dist\/release-0\.1\.0-linux-x64$/),
            minify: undefined
          }
        ])
      }))

    it.effect("rejects unsafe Bun output paths before invoking the builder", () =>
      Effect.gen(function*() {
        calls.length = 0
        const error = yield* planBuild({
          builder: "bun",
          id: "release-cli",
          entry: "src/cli.ts",
          targets: ["linux-x64"],
          output: "../dist/release-{targetTriple}"
        }).pipe(Effect.flip)

        expect(error._tag).toBe("ConfigError")
        if (error._tag === "ConfigError") {
          expect(error.reason).toContain(`["builds"][0]["output"]`)
        }
        expect(calls).toHaveLength(0)
      }))
  })

  layer(makeArtifactStagerLayer(async () => ({
    success: false,
    logs: ["compile failed"]
  })).pipe(Layer.provideMerge(BunServices.layer)))((it) => {
    it.effect("preserves Bun build log text on failed builds", () =>
      Effect.gen(function*() {
        const contribution = yield* planBuild({
          builder: "bun",
          id: "release-cli",
          entry: "src/cli.ts",
          targets: ["linux-x64"],
          output: "dist/release-{targetTriple}"
        })
        const operations = contribution.operations.filter(isStageArtifactOperation)
        const error = yield* stageArtifactOperations(operations, {
          root: "/workspace",
          identity
        }).pipe(Effect.flip)

        expect(error._tag).toBe("ArtifactStageError")
        if (error._tag === "ArtifactStageError") {
          expect(error.operationId).toBe("build:bun:release-cli-linux-x64")
          expect(error.artifactId).toBe("release-cli-linux-x64")
          expect(error.reason).toBe("compile failed")
        }
      }))
  })

  it.effect("plans command builder outputs as explicit command operations", () =>
    Effect.gen(function*() {
      const contribution = yield* planBuild({
        builder: "command",
        id: "make-cli",
        targets: ["darwin-arm64"],
        run: ["bun", "run", "build:{os}:{arch}"],
        output: "dist/{binary}-{targetTriple}",
        binary: "release"
      })

      expect(contribution.artifacts[0]).toMatchObject({
        id: "make-cli-darwin-arm64",
        kind: "executable",
        path: "dist/release-darwin-arm64",
        producedBy: "build:command",
        platform: {
          os: "darwin",
          arch: "arm64",
          targetTriple: "darwin-arm64"
        }
      })
      expect(contribution.operations[0]).toMatchObject({
        id: "build:command:make-cli-darwin-arm64",
        pipeId: "build",
        phase: "build",
        risk: "writes-local",
        action: {
          _tag: "command",
          command: {
            executable: "bun",
            args: ["run", "build:darwin:arm64"],
            requiredEnv: [],
            redactedEnv: []
          }
        }
      })
    }))

  it.effect("plans prebuilt builder outputs with read-only existence checks", () =>
    Effect.gen(function*() {
      const contribution = yield* planBuild({
        builder: "prebuilt",
        id: "dist-cli",
        targets: ["windows-x64"],
        output: "dist/{binary}-{targetTriple}.exe",
        binary: "release"
      })

      expect(contribution.artifacts[0]).toMatchObject({
        id: "dist-cli-windows-x64",
        kind: "executable",
        path: "dist/release-windows-x64.exe",
        producedBy: "build:prebuilt",
        platform: {
          os: "windows",
          arch: "x64",
          executableExtension: ".exe",
          targetTriple: "windows-x64"
        }
      })
      expect(contribution.operations[0]).toMatchObject({
        id: "build:prebuilt:dist-cli-windows-x64:exists",
        pipeId: "build",
        phase: "build",
        risk: "read-only",
        action: {
          _tag: "check-file",
          path: "dist/release-windows-x64.exe"
        }
      })
    }))

  it.effect("accepts canonical self-release platform target strings in config", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(releaseConfig({
        artifacts: [],
        builds: [
          {
            builder: "bun",
            id: "release-cli",
            entry: "src/cli.ts",
            targets: ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"],
            output: "dist/release-{targetTriple}{ext}",
            binaryName: "release",
            installPath: "bin/release"
          }
        ]
      }))

      const build = intent.builds?.[0]
      expect(build?.builder).toBe("bun")
      if (build?.builder === "bun") {
        expect(build.id).toBe("release-cli")
        expect(build.targets?.[4]).toBe("windows-x64")
        expect(build.binaryName).toBe("release")
      }
    }))
})
