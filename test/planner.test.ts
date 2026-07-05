import { describe, expect, layer } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { canExecuteOperation, CommandSpec, ExecutionApproval } from "../src/pipeline/operation.js"
import { commandKey, makeTestCommandRunnerLayer } from "./host-fakes.js"
import { PlanError } from "../src/pipeline/errors.js"
import { expectTaggedError, homebrewConfig, minimalConfig, releaseConfig, scoopConfig } from "./helpers.js"
import {
  createTestPlan,
  renderTestPlanJson,
  renderTestPlanMarkdown,
  renderTestPlanOperationExplanation,
  renderTestPlanSummary
} from "./plan-helpers.js"
import type { TestPlan } from "./plan-helpers.js"

interface VariantCriteria {
  readonly os?: string | undefined
  readonly arch?: string | undefined
  readonly libc?: string | undefined
  readonly targetTriple?: string | undefined
}

const variantMatches = (
  variant: NonNullable<TestPlan["artifacts"][number]["variant"]> | undefined,
  criteria: VariantCriteria
): boolean =>
  variant !== undefined &&
  (criteria.os === undefined || variant.os === criteria.os) &&
  (criteria.arch === undefined || variant.arch === criteria.arch) &&
  (criteria.libc === undefined || variant.libc === criteria.libc) &&
  (criteria.targetTriple === undefined || variant.targetTriple === criteria.targetTriple)

const findArtifactsByVariant = (
  plan: TestPlan,
  criteria: VariantCriteria
): ReadonlyArray<TestPlan["artifacts"][number]> =>
  plan.artifacts.filter((artifact) => variantMatches(artifact.variant, criteria))

const findRequiredArtifactVariant = (
  plan: TestPlan,
  criteria: VariantCriteria,
  missingReason: string
) => {
  const artifacts = findArtifactsByVariant(plan, criteria)
  const artifact = artifacts[0]
  return artifacts.length === 1 && artifact !== undefined
    ? Effect.succeed(artifact)
    : Effect.fail(PlanError.make({
      pipeId: "test",
      field: "artifacts",
      reason: missingReason
    }))
}

const TestLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    directories: new Set(["."]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  }),
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
    artifacts: [
      {
        id: "archive",
        path: "artifacts/archive.tgz",
        format: "tarball",
        checksum
      }
    ],
    publish: {},
    evidence: ".release/evidence"
  })

const bunExecutableBuild = (overrides: Record<string, unknown> = {}) => ({
  builder: "bun",
  id: "release-cli",
  entry: "src/cli.ts",
  cpu: "baseline",
  targets: ["linux-x64"],
  output: "dist/release-{version}-{targetTriple}",
  ...overrides
})

const ChecksumLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    files: new Map([["artifacts/archive.tgz", "manual archive"]]),
    directories: new Set(["."])
  }),
)

const createPlan = (config: string) =>
  createTestPlan(config)

describe("planner", () => {
  layer(TestLayer)((it) => {
    it.effect("creates stable plans with ordered operation phases", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const publishIds = plan.operations
          .filter((operation) => operation.phase === "publish" && operation.risk !== "read-only")
          .map((operation) => operation.id)
        const firstPublishIndex = plan.operations.findIndex((operation) =>
          operation.phase === "publish" && operation.risk !== "read-only"
        )
        const firstVerifyIndex = plan.operations.findIndex((operation) =>
          operation.phase === "verify"
        )

        expect(plan.surfaceIds).toEqual(["github", "npm"])
        expect(publishIds).toEqual(["npm:npm-publish", "github:github-release-create"])
        expect(firstPublishIndex).toBeGreaterThanOrEqual(0)
        expect(firstVerifyIndex).toBeGreaterThan(firstPublishIndex)
        expect(plan.identity.commit).toBe("abc123")
        expect(renderTestPlanJson(plan)).toBe(renderTestPlanJson(plan))
      }))

    it.effect("rejects unsafe package manifest identity paths", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          identity: {
            packagePath: "../package.json",
            commit: "HEAD",
            tagTemplate: "v{version}"
          },
          artifacts: [],
          publish: {}
        })

        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ConfigValidationError")
        if (error._tag === "ConfigValidationError") {
          expect(error.reason).toContain("project.packagePath")
        }
      }))

    it.effect("marks publish operations as approval-required", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const publish = plan.operations.filter((operation) =>
          operation.phase === "publish" && operation.risk !== "read-only"
        )

        expect(publish.length).toBe(2)
        expect(publish.every((operation) => !canExecuteOperation(operation, ExecutionApproval.none))).toBe(true)
      }))

    it.effect("does not attach npm tokens to pack dry-run validation", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const pack = plan.operations.find((operation) => operation.id === "npm:npm-pack-dry-run")
        const publish = plan.operations.find((operation) => operation.id === "npm:npm-publish")

        expect(pack?.action._tag).toBe("command")
        expect(publish?.action._tag).toBe("command")
        if (pack?.action._tag === "command" && publish?.action._tag === "command") {
          expect(pack.action.command.requiredEnv).toEqual([])
          expect(publish.action.command.requiredEnv).toEqual(["NPM_TOKEN"])
        }
      }))

    it.effect("rejects unsafe evidence directory traversal", () =>
      Effect.gen(function*() {
        const unsafeConfig = minimalConfig.replace(
          "\"evidence\":\".release/evidence\"",
          "\"evidence\":\"../outside\""
        )
        const error = yield* createPlan(unsafeConfig).pipe(Effect.flip)

        expectTaggedError(error, "ConfigValidationError")
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
            field: "evidence"
          },
          {
            label: "artifact path",
            config: releaseConfig({
              artifacts: [
                {
                  id: "archive",
                  path: "",
                  format: "tarball"
                }
              ],
              publish: {}
            }),
            field: "artifacts[0].path"
          },
          {
            label: "npm package path",
            config: minimalConfig.replace("\"packagePath\":\".\"", "\"packagePath\":\"\""),
            field: "publish.npm.packagePath"
          },
          {
            label: "Homebrew formula path",
            config: homebrewConfig({ formulaPath: "" }),
            field: "publish.homebrew.formulaPath"
          },
          {
            label: "Scoop manifest path",
            config: scoopConfig({ manifestPath: "" }),
            field: "publish.scoop.manifestPath"
          }
        ]

        for (const item of cases) {
          const error = yield* createPlan(item.config).pipe(Effect.flip)

          expect(error._tag, item.label).toBe("ConfigValidationError")
          if (error._tag === "ConfigValidationError") {
            expect(error.reason).toContain(item.field)
          }
        }
      }))

    it.effect("adds imported artifacts to the artifact inventory", () =>
      Effect.gen(function*() {
        const importedConfig = releaseConfig({
          artifacts: [
            {
              id: "archive",
              path: "artifacts/release.tgz",
              format: "tarball"
            }
          ],
          publish: {}
        })
        const plan = yield* createPlan(importedConfig)

        expect(plan.artifacts.map((artifact) => artifact.id)).toContain("archive")
        expect(plan.operations.map((operation) => operation.id)).not.toContain("import-artifacts:archive:exists")
      }))

    it.effect("renders summary and Markdown review output", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const summary = renderTestPlanSummary(plan)
        const markdown = renderTestPlanMarkdown(plan)

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
        const explanation = yield* renderTestPlanOperationExplanation(plan, "npm:npm-publish")

        expect(explanation).toContain("operation: npm:npm-publish")
        expect(explanation).toContain("risk: irreversible")
        expect(explanation).toContain("execution approval: --execute + --approve-publish")
        expect(explanation).toContain("argv:")
      }))

    it.effect("explaining a missing operation returns a typed error", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(minimalConfig)
        const error = yield* renderTestPlanOperationExplanation(plan, "missing:operation").pipe(Effect.flip)

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
  ))((it) => {
    it.effect("resolves package manifest identity during normalization", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          identity: {
            commit: "HEAD",
            tagTemplate: "v{version}"
          },
          artifacts: [
            {
                  id: "archive",
                  path: "artifacts/{normalizedName}-{version}.tgz",
                  format: "tarball"
                }
              ],
              publish: {}
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
  ))((it) => {
    it.effect("expands artifact path templates before inventory", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [
            {
                  id: "archive",
                  path: "artifacts/{name}-{version}-{normalizedName}.tgz",
                  format: "tarball"
                }
              ],
              publish: {}
        })
        const plan = yield* createPlan(config)

        expect(plan.artifacts[0]?.path).toBe("artifacts/release-0.1.0-release.tgz")
      }))
  })

  layer(Layer.mergeAll(
    makeTestCommandRunnerLayer({
      files: new Map([["dist/release-0.1.0-linux-x64", "compiled binary"]])
    }),
  ))((it) => {
    it.effect("adds build artifacts to the artifact inventory", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [],
          builds: [bunExecutableBuild()],
          publish: {}
        })
        const plan = yield* createPlan(config)
        const artifact = plan.artifacts.find((item) => item.id === "release-cli-linux-x64")

        expect(artifact).toMatchObject({
          id: "release-cli-linux-x64",
          path: "dist/release-0.1.0-linux-x64",
          format: "executable",
          consumers: [],
          sizeBytes: 0,
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
          builds: [bunExecutableBuild()],
          publish: {}
        })
        const plan = yield* createPlan(config)
        const linuxArtifacts = findArtifactsByVariant(plan, {
          os: "linux",
          arch: "x64",
          libc: "glibc"
        })
        const artifact = yield* findRequiredArtifactVariant(
          plan,
          { targetTriple: "bun-linux-x64-baseline" },
          "expected linux binary"
        )

        expect(linuxArtifacts.map((item) => item.id)).toEqual(["release-cli-linux-x64"])
        expect(artifact.id).toBe("release-cli-linux-x64")
      }))
  })

  layer(TestLayer)((it) => {
    it.effect("rejects build output ids that collide with static artifact ids", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [
            {
              id: "release-cli-linux-x64",
                  path: ".",
                  format: "directory"
                }
              ],
              builds: [bunExecutableBuild()],
              publish: {}
        })
        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ReleaseNormalizationError")
        if (error._tag === "ReleaseNormalizationError") {
          expect(error.field).toBe("artifacts.id")
        }
      }))

    it.effect("rejects unsafe build entry paths", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [],
          builds: [bunExecutableBuild({ entry: "../cli.ts" })],
          publish: {}
        })
        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ConfigValidationError")
        if (error._tag === "ConfigValidationError") {
          expect(error.reason).toContain("builds[0].entry")
        }
      }))

    it.effect("rejects unsafe build output paths", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [],
          builds: [
            bunExecutableBuild({
              output: "../dist/release-{version}"
            })
          ],
          publish: {}
        })
        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ConfigValidationError")
        if (error._tag === "ConfigValidationError") {
          expect(error.reason).toContain("builds[0].output")
        }
      }))

    it.effect("rejects removed build output override arrays", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [],
          builds: [
            bunExecutableBuild({
              outputs: [
                {
                  id: "cli-linux-x64",
                  target: "linux-x64",
                  path: "dist/release-{version}",
                  variant: {
                    os: "windows"
                  }
                }
              ]
            })
          ],
          publish: {}
        })
        const error = yield* createPlan(config).pipe(Effect.flip)

        expect(error._tag).toBe("ConfigValidationError")
        if (error._tag === "ConfigValidationError") {
          expect(error.reason).toContain("builds[0].outputs")
        }
      }))
  })

  layer(Layer.mergeAll(
    makeTestCommandRunnerLayer({
      files: new Map([["dist/release-darwin-arm64", "compiled binary"]])
    }),
  ))((it) => {
    it.effect("preserves direct artifact variant metadata", () =>
      Effect.gen(function*() {
        const config = releaseConfig({
          artifacts: [
            {
                  id: "cli-darwin-arm64",
                  path: "dist/release-darwin-arm64",
                  format: "executable",
                  variant: {
                    os: "darwin",
                arch: "arm64",
                binaryName: "release",
                installPath: "bin/release"
              }
            }
          ],
          publish: {}
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
                  variant: {
                    os: "darwin",
                arch: "arm64",
                libc: "musl"
              }
            }
          ],
          publish: {}
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

    it.effect("carries manual checksum data into imported artifacts", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(manualChecksumConfig({ algorithm: "sha256", value: "00" }))

        expect(plan.artifacts[0]?.checksum).toEqual({ algorithm: "sha256", value: "00" })
      }))

    it.effect("preserves manual sha512 checksums on imported artifacts", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(manualChecksumConfig({ algorithm: "sha512", value: "sha512:manual" }))

        expect(plan.artifacts[0]?.checksum).toEqual({ algorithm: "sha512", value: "sha512:manual" })
      }))
  })
})
