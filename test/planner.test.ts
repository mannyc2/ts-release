import { describe, expect, layer } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { canExecuteOperation, CommandSpec, ExecutionApproval } from "../src/domain/operation.js"
import { commandKey, makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import {
  renderPlanJson,
  renderPlanMarkdown,
  renderPlanOperationExplanation,
  renderPlanSummary
} from "../src/planner/render-plan.js"
import {
  findArtifactsByVariant,
  findRequiredArtifactVariant
} from "../src/targets/adapter-helpers.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { expectTaggedError, homebrewConfig, minimalConfig, releaseConfig, scoopConfig } from "./helpers.js"

const TestLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    directories: new Set(["."]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  }),
  LiveTargetRegistryLayer
)

const gitHeadCommand = CommandSpec.make({
  executable: "git",
  args: ["rev-parse", "--short", "HEAD"],
  requiredEnv: [],
  redactedEnv: []
})

const manualChecksumConfig = (checksum: { readonly algorithm: "sha256" | "sha512"; readonly value: string }) =>
  JSON.stringify({
    project: {
      name: "release",
      version: "0.1.0",
      commit: "abc123",
      tag: "v0.1.0"
    },
    build: {
      artifacts: [
        {
          id: "archive",
          path: "artifacts/archive.tgz",
          format: "tarball",
          consumers: [],
          checksum
        }
      ]
    },
    publish: {},
    strict: true,
    evidence: ".release/evidence"
  })

const bunExecutableRecipe = (overrides: Record<string, unknown> = {}) => ({
  _tag: "BunExecutableArtifactRecipe",
  id: "release-cli",
  entrypoint: "src/cli.ts",
  outputs: [
    {
      id: "cli-linux-x64",
      target: "bun-linux-x64-baseline",
      path: "dist/release-{version}-linux-x64",
      consumers: ["github"]
    }
  ],
  ...overrides
})

const ChecksumLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    files: new Map([["artifacts/archive.tgz", "manual archive"]]),
    directories: new Set(["."])
  }),
  LiveTargetRegistryLayer
)

const createPlan = (config: string) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(config)
    return yield* createReleasePlan(intent)
  })

describe("planner", () => {
  layer(TestLayer)((it) => {
    it.effect("creates stable plans with ordered operation phases", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const publishIds = plan.operations
          .filter((operation) =>
            operation._tag === "PublishCommandOperation" || operation._tag === "PublishGitHubReleaseOperation"
          )
          .map((operation) => operation.id)
        const firstPublishIndex = plan.operations.findIndex((operation) =>
          operation._tag === "PublishCommandOperation" || operation._tag === "PublishGitHubReleaseOperation"
        )
        const firstVerifyIndex = plan.operations.findIndex((operation) =>
          operation._tag === "VerifyRemoteOperation" || operation._tag === "VerifyHttpOperation"
        )

        expect(plan.targets.map((target) => target.id)).toEqual(["github", "npm"])
        expect(publishIds).toEqual(["npm:npm-publish", "github:github-release-create"])
        expect(firstPublishIndex).toBeGreaterThan(
          Math.max(
            ...plan.operations
              .map((operation, index) =>
                operation._tag === "ValidateCommandOperation" || operation._tag === "ValidationNoteOperation" ? index : -1
              )
          )
        )
        expect(firstVerifyIndex).toBeGreaterThan(firstPublishIndex)
        expect(plan.identity.commit).toBe("abc123")
        expect(renderPlanJson(plan)).toBe(renderPlanJson(plan))
      }))

    it.effect("rejects unsafe package manifest identity paths", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          identity: {
            _tag: "PackageManifestReleaseIdentitySource",
            packagePath: "../package.json",
            commit: "HEAD",
            tagTemplate: "v{version}"
          },
          artifacts: [],
          targets: []
        })

        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ReleaseNormalizationError")
        if (error._tag === "ReleaseNormalizationError") {
          expect(error.field).toBe("identity.packagePath")
        }
      }))

    it.effect("marks publish operations as approval-required", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const publish = plan.operations.filter((operation) =>
          operation._tag === "PublishCommandOperation" || operation._tag === "PublishGitHubReleaseOperation"
        )

        expect(publish.length).toBe(2)
        expect(publish.every((operation) => !canExecuteOperation(operation, ExecutionApproval.none))).toBe(true)
      }))

    it.effect("does not attach npm tokens to pack dry-run validation", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const pack = plan.operations.find((operation) => operation.id === "npm:npm-pack-dry-run")
        const publish = plan.operations.find((operation) => operation.id === "npm:npm-publish")

        expect(pack?._tag).toBe("ValidateCommandOperation")
        expect(publish?._tag).toBe("PublishCommandOperation")
        if (pack?._tag === "ValidateCommandOperation" && publish?._tag === "PublishCommandOperation") {
          expect(pack.command.requiredEnv).toEqual([])
          expect(publish.command.requiredEnv).toEqual(["NPM_TOKEN"])
        }
      }))

    it.effect("rejects unsafe evidence directory traversal", () =>
      Effect.gen(function*() {
        const unsafeConfig = minimalConfig.replace(
          "\"evidence\":\".release/evidence\"",
          "\"evidence\":\"../outside\""
        )
        const error = yield* createPlan(unsafeConfig).pipe(Effect.flip)

        expectTaggedError(error, "ReleaseNormalizationError")
      }))

    it.effect("rejects empty path fields during normalization", () =>
      Effect.gen(function*() {
        const cases: ReadonlyArray<{
          readonly label: string
          readonly config: string
          readonly field: string
        }> = [
          {
            label: "evidence directory",
            config: minimalConfig.replace("\"evidence\":\".release/evidence\"", "\"evidence\":\"\""),
            field: "evidenceDirectory"
          },
          {
            label: "artifact path",
            config: releaseConfig({
              artifacts: [
                {
                  id: "archive",
                  path: "",
                  format: "tarball",
                  consumers: []
                }
              ],
              targets: []
            }),
            field: "artifacts.archive.path"
          },
          {
            label: "npm package path",
            config: minimalConfig.replace("\"packagePath\":\".\"", "\"packagePath\":\"\""),
            field: "targets.npm.packagePath"
          },
          {
            label: "Homebrew formula path",
            config: homebrewConfig({ formulaPath: "" }),
            field: "targets.homebrew.formulaPath"
          },
          {
            label: "Scoop manifest path",
            config: scoopConfig({ manifestPath: "" }),
            field: "targets.scoop.manifestPath"
          }
        ]

        for (const item of cases) {
          const error = yield* createPlan(item.config).pipe(Effect.flip)

          expect(error._tag, item.label).toBe("ReleaseNormalizationError")
          if (error._tag === "ReleaseNormalizationError") {
            expect(error.field).toBe(item.field)
          }
        }
      }))

    it.effect("rejects missing artifacts", () =>
      Effect.gen(function*() {
        const missingConfig = minimalConfig.replace("\"path\":\".\"", "\"path\":\"missing.tgz\"")
          .replace("\"format\":\"directory\"", "\"format\":\"tarball\"")
        const error = yield* createPlan(missingConfig).pipe(Effect.flip)

        expectTaggedError(error, "ReleaseNormalizationError")
      }))

    it.effect("renders summary and Markdown review output", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const summary = renderPlanSummary(plan)
        const markdown = renderPlanMarkdown(plan)

        expect(summary).toContain("irreversible approval required")
        expect(summary).toContain("execute required")
        expect(summary).toContain("npm:npm-publish")
        expect(markdown).toContain("# Release Plan release@0.1.0")
        expect(markdown).toContain("### npm:npm-publish")
        expect(markdown).toContain(JSON.stringify(["npm", "publish", ".", "--registry", "https://registry.npmjs.org"], null, 2))
      }))

    it.effect("explains one operation by stable id", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const explanation = yield* renderPlanOperationExplanation(plan, "npm:npm-publish")

        expect(explanation).toContain("operation: npm:npm-publish")
        expect(explanation).toContain("risk: irreversible")
        expect(explanation).toContain("execution approval: --execute + --approve-publish")
        expect(explanation).toContain("argv:")
      }))

    it.effect("explaining a missing operation returns a typed error", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const error = yield* renderPlanOperationExplanation(plan, "missing:operation").pipe(Effect.flip)

        expectTaggedError(error, "PlanOperationNotFoundError")
      }))
  })

  layer(Layer.mergeAll(
    makeTestCommandRunnerLayer({
      directories: new Set(["."]),
      env: new Map([
        ["NPM_TOKEN", "npm_secret"],
        ["GH_TOKEN", "gh_secret"]
      ]),
      commands: new Map([
        [commandKey(gitHeadCommand), {
          exitCode: 0,
          stdout: "81587b5\n",
          stderr: ""
        }]
      ])
    }),
    LiveTargetRegistryLayer
  ))((it) => {
    it.effect("resolves HEAD release identity through the host git command", () =>
      Effect.gen(function*() {
        const headConfig = minimalConfig.replace("\"commit\":\"abc123\"", "\"commit\":\"HEAD\"")
        const plan = yield* createPlan(headConfig)

        expect(plan.identity.commit).toBe("81587b5")
      }))
  })

  layer(Layer.mergeAll(
    makeTestCommandRunnerLayer({
      files: new Map([
        ["package.json", JSON.stringify({ name: "@scope/pkg", version: "1.2.3" })],
        ["artifacts/scope-pkg-1.2.3.tgz", "archive"]
      ]),
      commands: new Map([
        [commandKey(gitHeadCommand), {
          exitCode: 0,
          stdout: "81587b5\n",
          stderr: ""
        }]
      ])
    }),
    LiveTargetRegistryLayer
  ))((it) => {
    it.effect("resolves package manifest identity during normalization", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          identity: {
            _tag: "PackageManifestReleaseIdentitySource",
            commit: "HEAD",
            tagTemplate: "v{version}"
          },
          artifacts: [
            {
              id: "archive",
              path: "artifacts/{normalizedName}-{version}.tgz",
              format: "tarball",
              consumers: []
            }
          ],
          targets: []
        })
        const plan = yield* createPlan(config)

        expect(plan.identity).toMatchObject({
          name: "@scope/pkg",
          version: "1.2.3",
          commit: "81587b5",
          tag: "v1.2.3"
        })
        expect(plan.artifacts[0]?.path).toBe("artifacts/scope-pkg-1.2.3.tgz")
      }))
  })

  layer(Layer.mergeAll(
    makeTestCommandRunnerLayer({
      files: new Map([["artifacts/release-0.1.0-release.tgz", "archive"]])
    }),
    LiveTargetRegistryLayer
  ))((it) => {
    it.effect("expands artifact path templates before inventory", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [
            {
              id: "archive",
              path: "artifacts/{name}-{version}-{normalizedName}.tgz",
              format: "tarball",
              consumers: []
            }
          ],
          targets: []
        })
        const plan = yield* createPlan(config)

        expect(plan.artifacts[0]?.path).toBe("artifacts/release-0.1.0-release.tgz")
      }))
  })

  layer(Layer.mergeAll(
    makeTestCommandRunnerLayer({
      files: new Map([["dist/release-0.1.0-linux-x64", "compiled binary"]])
    }),
    LiveTargetRegistryLayer
  ))((it) => {
    it.effect("adds recipe outputs to the artifact inventory", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [],
          artifactRecipes: [bunExecutableRecipe()],
          targets: []
        })
        const plan = yield* createPlan(config)
        const artifact = plan.artifacts.find((item) => item.id === "cli-linux-x64")

        expect(artifact).toMatchObject({
          id: "cli-linux-x64",
          path: "dist/release-0.1.0-linux-x64",
          format: "executable",
          consumers: ["github"],
          sizeBytes: 15,
          checksum: {
            algorithm: "sha256",
            value: "636f6d70696c65642062696e617279"
          },
          variant: {
            os: "linux",
            arch: "x64",
            libc: "glibc",
            targetTriple: "bun-linux-x64-baseline"
          }
        })
      }))

    it.effect("selects artifact inventory items by installable variant", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [],
          artifactRecipes: [bunExecutableRecipe()],
          targets: []
        })
        const plan = yield* createPlan(config)
        const linuxArtifacts = findArtifactsByVariant(plan, {
          os: "linux",
          arch: "x64",
          libc: "glibc"
        })
        const artifact = yield* findRequiredArtifactVariant(
          plan,
          "github",
          { targetTriple: "bun-linux-x64-baseline" },
          "expected linux binary"
        )

        expect(linuxArtifacts.map((item) => item.id)).toEqual(["cli-linux-x64"])
        expect(artifact.id).toBe("cli-linux-x64")
      }))
  })

  layer(TestLayer)((it) => {
    it.effect("rejects recipe output ids that collide with static artifact ids", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [
            {
              id: "cli-linux-x64",
              path: ".",
              format: "directory",
              consumers: []
            }
          ],
          artifactRecipes: [bunExecutableRecipe()],
          targets: []
        })
        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ReleaseNormalizationError")
        if (error._tag === "ReleaseNormalizationError") {
          expect(error.field).toBe("artifacts.id")
        }
      }))

    it.effect("rejects unsafe recipe entrypoint paths", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [],
          artifactRecipes: [bunExecutableRecipe({ entrypoint: "../cli.ts" })],
          targets: []
        })
        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ReleaseNormalizationError")
        if (error._tag === "ReleaseNormalizationError") {
          expect(error.field).toBe("artifactRecipes.release-cli.entrypoint")
        }
      }))

    it.effect("rejects unsafe recipe output paths", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [],
          artifactRecipes: [
            bunExecutableRecipe({
              outputs: [
                {
                  id: "cli-linux-x64",
                  target: "bun-linux-x64-baseline",
                  path: "../dist/release-{version}",
                  consumers: ["github"]
                }
              ]
            })
          ],
          targets: []
        })
        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ReleaseNormalizationError")
        if (error._tag === "ReleaseNormalizationError") {
          expect(error.field).toBe("artifactRecipes.release-cli.outputs.cli-linux-x64.path")
        }
      }))

    it.effect("rejects recipe variant overrides that contradict the Bun target", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [],
          artifactRecipes: [
            bunExecutableRecipe({
              outputs: [
                {
                  id: "cli-linux-x64",
                  target: "bun-linux-x64-baseline",
                  path: "dist/release-{version}",
                  consumers: ["github"],
                  variant: {
                    os: "windows"
                  }
                }
              ]
            })
          ],
          targets: []
        })
        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ReleaseNormalizationError")
        if (error._tag === "ReleaseNormalizationError") {
          expect(error.field).toBe("artifactRecipes.release-cli.outputs.cli-linux-x64.variant.os")
        }
      }))
  })

  layer(Layer.mergeAll(
    makeTestCommandRunnerLayer({
      files: new Map([["dist/release-darwin-arm64", "compiled binary"]])
    }),
    LiveTargetRegistryLayer
  ))((it) => {
    it.effect("preserves direct artifact variant metadata", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [
            {
              id: "cli-darwin-arm64",
              path: "dist/release-darwin-arm64",
              format: "executable",
              consumers: ["github"],
              variant: {
                os: "darwin",
                arch: "arm64",
                binaryName: "release",
                installPath: "bin/release"
              }
            }
          ],
          targets: []
        })
        const plan = yield* createPlan(config)

        expect(plan.artifacts[0]).toMatchObject({
          id: "cli-darwin-arm64",
          format: "executable",
          variant: {
            os: "darwin",
            arch: "arm64",
            binaryName: "release",
            installPath: "bin/release"
          }
        })
      }))

    it.effect("rejects impossible direct artifact variants", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [
            {
              id: "cli-darwin-arm64",
              path: "dist/release-darwin-arm64",
              format: "executable",
              consumers: ["github"],
              variant: {
                os: "darwin",
                arch: "arm64",
                libc: "musl"
              }
            }
          ],
          targets: []
        })
        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ReleaseNormalizationError")
        if (error._tag === "ReleaseNormalizationError") {
          expect(error.field).toBe("artifacts.cli-darwin-arm64.variant.libc")
        }
      }))
  })

  layer(Layer.mergeAll(
    makeTestCommandRunnerLayer({
      directories: new Set(["."]),
      env: new Map([
        ["NPM_TOKEN", "npm_secret"],
        ["GH_TOKEN", "gh_secret"]
      ]),
      commands: new Map([
        [commandKey(gitHeadCommand), {
          exitCode: 1,
          stdout: "",
          stderr: "not a git checkout"
        }]
      ])
    }),
    LiveTargetRegistryLayer
  ))((it) => {
    it.effect("reports git HEAD resolution failures as normalization errors", () =>
      Effect.gen(function*() {
        const headConfig = minimalConfig.replace("\"commit\":\"abc123\"", "\"commit\":\"HEAD\"")
        const error = yield* createPlan(headConfig).pipe(Effect.flip)

        expectTaggedError(error, "ReleaseNormalizationError")
      }))
  })

  layer(ChecksumLayer)((it) => {
    it.effect("preserves matching manual sha256 checksums", () =>
      Effect.gen(function*() {
        const checksum = "6d616e75616c2061726368697665"
        const plan = yield* createPlan(manualChecksumConfig({ algorithm: "sha256", value: checksum }))

        expect(plan.artifacts[0]?.checksum).toEqual({ algorithm: "sha256", value: checksum })
      }))

    it.effect("rejects mismatched manual sha256 checksums", () =>
      Effect.gen(function*() {
        const error = yield* createPlan(manualChecksumConfig({ algorithm: "sha256", value: "00" })).pipe(Effect.flip)

        expect(error._tag).toBe("ReleaseNormalizationError")
        if (error._tag === "ReleaseNormalizationError") {
          expect(error.field).toBe("artifacts.archive.checksum")
        }
      }))

    it.effect("rejects manual non-sha256 checksums during artifact inventory", () =>
      Effect.gen(function*() {
        const error = yield* createPlan(manualChecksumConfig({ algorithm: "sha512", value: "sha512:manual" })).pipe(Effect.flip)

        expect(error._tag).toBe("ReleaseNormalizationError")
        if (error._tag === "ReleaseNormalizationError") {
          expect(error.field).toBe("artifacts.archive.checksum")
        }
      }))
  })
})
