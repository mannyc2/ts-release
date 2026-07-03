import { describe, expect, it, layer } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { makeArtifactStagerLayer, type BunExecutableBuildInput } from "../apps/release-ts/src/runtime.js"
import { parseReleaseIntent } from "../src/config/load.js"
import { CommandSpec } from "../src/domain/operation.js"
import { stageArtifactOperations } from "../src/engine/stager.js"
import { buildPipe } from "../src/pipes/build.js"
import { StageArtifactOperation } from "../src/pipeline/operation.js"
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

const state = emptyReleaseState(identity, true)

const portablePath = (path: string): string =>
  path.replaceAll("\\", "/")

const isStageArtifactOperation = (operation: unknown): operation is StageArtifactOperation =>
  typeof operation === "object"
  && operation !== null
  && "_tag" in operation
  && operation._tag === "StageArtifactOperation"

const planBuild = (config: string) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(config)
    const section = buildPipe.section(intent)
    expect(section).toBeDefined()
    if (section === undefined) {
      return {
        artifacts: [],
        operations: [],
        notices: []
      }
    }
    const defaulted = buildPipe.defaults === undefined ? section : buildPipe.defaults(section, identity)
    return yield* buildPipe.plan(defaulted, state)
  })

describe("build pipe", () => {
  const calls: Array<BunExecutableBuildInput> = []
  const TestLayer = Layer.mergeAll(
    makeArtifactStagerLayer(async (input) => {
      calls.push(input)
      return { success: true, logs: [] }
    }),
    BunServices.layer
  )

  layer(TestLayer)((it) => {
    it.effect("plans Bun compile intents and stages them through the artifact stager", () =>
      Effect.gen(function*() {
        calls.length = 0
        const contribution = yield* planBuild(JSON.stringify({
          project: {
            name: "release",
            version: "0.1.0",
            commit: "abc123",
            tag: "v0.1.0"
          },
          builds: [
            {
              builder: "bun",
              id: "release-cli",
              entry: "src/cli.ts",
              cpu: "baseline",
              outputs: [
                {
                  id: "cli-linux-x64",
                  target: "linux-x64",
                  path: "dist/release-{version}-linux-x64",
                  consumers: ["github"]
                }
              ]
            }
          ],
          publish: {}
        }))

        expect(contribution.artifacts).toHaveLength(1)
        expect(contribution.artifacts[0]).toMatchObject({
          id: "cli-linux-x64",
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
        expect(operations[0]?.intent).toMatchObject({
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
        const contribution = yield* planBuild(JSON.stringify({
          project: {
            name: "release",
            version: "0.1.0",
            commit: "abc123",
            tag: "v0.1.0"
          },
          builds: [
            {
              builder: "bun",
              id: "release-cli",
              entry: "src/cli.ts",
              outputs: [
                {
                  id: "cli-linux-x64",
                  target: "linux-x64",
                  path: "../dist/release-linux-x64",
                  consumers: ["github"]
                }
              ]
            }
          ],
          publish: {}
        }))

        const operations = contribution.operations.filter(isStageArtifactOperation)
        const error = yield* stageArtifactOperations(operations, {
          root: "/workspace",
          identity,
          configPath: "release.config.json"
        }).pipe(Effect.flip)

        expect(error._tag).toBe("ArtifactStageError")
        if (error._tag === "ArtifactStageError") {
          expect(error.artifactId).toBe("cli-linux-x64")
          expect(error.path).toBe("../dist/release-linux-x64")
        }
        expect(calls).toHaveLength(0)
      }))
  })

  layer(Layer.mergeAll(
    makeArtifactStagerLayer(async () => ({
      success: false,
      logs: ["compile failed"]
    })),
    BunServices.layer
  ))((it) => {
    it.effect("preserves Bun build log text on failed builds", () =>
      Effect.gen(function*() {
        const contribution = yield* planBuild(JSON.stringify({
          project: {
            name: "release",
            version: "0.1.0",
            commit: "abc123",
            tag: "v0.1.0"
          },
          builds: [
            {
              builder: "bun",
              id: "release-cli",
              entry: "src/cli.ts",
              outputs: [
                {
                  id: "cli-linux-x64",
                  target: "linux-x64",
                  path: "dist/release-linux-x64",
                  consumers: ["github"]
                }
              ]
            }
          ],
          publish: {}
        }))
        const operations = contribution.operations.filter(isStageArtifactOperation)
        const error = yield* stageArtifactOperations(operations, {
          root: "/workspace",
          identity
        }).pipe(Effect.flip)

        expect(error._tag).toBe("ArtifactStageError")
        if (error._tag === "ArtifactStageError") {
          expect(error.operationId).toBe("build:bun:cli-linux-x64")
          expect(error.artifactId).toBe("cli-linux-x64")
          expect(error.reason).toBe("compile failed")
        }
      }))
  })

  it.effect("plans command builder outputs as explicit command operations", () =>
    Effect.gen(function*() {
      const contribution = yield* planBuild(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        builds: [
          {
            builder: "command",
            id: "make-cli",
            targets: ["darwin-arm64"],
            run: ["bun", "run", "build:{os}:{arch}"],
            output: "dist/{binary}-{targetTriple}",
            binary: "release"
          }
        ],
        publish: {}
      }))

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
        _tag: "ValidateCommandOperation",
        id: "build:command:make-cli-darwin-arm64",
        risk: "writes-local",
        command: CommandSpec.make({
          executable: "bun",
          args: ["run", "build:darwin:arm64"],
          requiredEnv: [],
          redactedEnv: []
        })
      })
    }))

  it.effect("plans prebuilt builder outputs with read-only existence checks", () =>
    Effect.gen(function*() {
      const contribution = yield* planBuild(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        builds: [
          {
            builder: "prebuilt",
            id: "dist-cli",
            targets: ["windows-x64"],
            output: "dist/{binary}-{targetTriple}.exe",
            binary: "release"
          }
        ],
        publish: {}
      }))

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
        _tag: "ValidateCommandOperation",
        id: "build:prebuilt:dist-cli-windows-x64:exists",
        risk: "read-only",
        command: CommandSpec.make({
          executable: "test",
          args: ["-f", "dist/release-windows-x64.exe"],
          requiredEnv: [],
          redactedEnv: []
        })
      })
    }))

  it.effect("accepts canonical self-release platform target strings in config", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        builds: [
          {
            builder: "bun",
            id: "release-cli",
            entry: "src/cli.ts",
            outputs: [
              {
                id: "cli-linux-x64",
                target: "linux-x64",
                path: "dist/release-linux-x64",
                consumers: ["github"]
              },
              {
                id: "cli-linux-arm64",
                target: "linux-arm64",
                path: "dist/release-linux-arm64",
                consumers: ["github"]
              },
              {
                id: "cli-darwin-x64",
                target: "darwin-x64",
                path: "dist/release-darwin-x64",
                consumers: ["github"]
              },
              {
                id: "cli-darwin-arm64",
                target: "darwin-arm64",
                path: "dist/release-darwin-arm64",
                consumers: ["github"]
              },
              {
                id: "cli-windows-x64",
                target: "windows-x64",
                path: "dist/release-windows-x64.exe",
                consumers: ["github"],
                variant: {
                  binaryName: "release",
                  installPath: "bin/release"
                }
              }
            ]
          }
        ],
        publish: {}
      }))

      const build = intent.builds?.[0]
      expect(build?.builder).toBe("bun")
      if (build?.builder === "bun") {
        expect(build.id).toBe("release-cli")
        expect(build.outputs?.[4]?.target).toBe("windows-x64")
        expect(build.outputs?.[4]?.variant?.binaryName).toBe("release")
      }
    }))
})
