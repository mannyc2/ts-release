import { describe, expect, layer } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { canExecuteOperation, CommandSpec, ExecutionApproval } from "../src/pipeline/operation.js"
import { commandKey, makeTestCommandRunnerLayer } from "./host-fakes.js"
import { PlanError } from "../src/pipeline/errors.js"
import { expectTaggedError, homebrewConfig, minimalConfig, releaseConfig, scoopConfig } from "./helpers.js"
import {
  createTestPlan,
  renderTestPlanJson,
  renderTestPlanMarkdown,
  renderTestPlanSummary
} from "./plan-helpers.js"
import type { TestPlan } from "./plan-helpers.js"

interface VariantCriteria {
  readonly os?: string | undefined
  readonly arch?: string | undefined
  readonly libc?: string | undefined
  readonly targetTriple?: string | undefined
}

const platformMatches = (
  platform: NonNullable<TestPlan["artifacts"][number]["platform"]> | undefined,
  criteria: VariantCriteria
): boolean =>
  platform !== undefined &&
  (criteria.os === undefined || platform.os === criteria.os) &&
  (criteria.arch === undefined || platform.arch === criteria.arch) &&
  (criteria.libc === undefined || platform.libc === criteria.libc) &&
  (criteria.targetTriple === undefined || platform.targetTriple === criteria.targetTriple)

const findArtifactsByVariant = (
  plan: TestPlan,
  criteria: VariantCriteria
): ReadonlyArray<TestPlan["artifacts"][number]> =>
  plan.artifacts.filter((artifact) => platformMatches(artifact.platform, criteria))

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

const TestLayer = makeTestCommandRunnerLayer({
    directories: new Set(["."]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  })

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

const ChecksumLayer = makeTestCommandRunnerLayer({
    files: new Map([["artifacts/archive.tgz", "manual archive"]]),
    directories: new Set(["."])
  })

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

        expect(error._tag).toBe("ConfigError")
        if (error._tag === "ConfigError") {
          expect(error.reason).toContain(`["project"]["packagePath"]`)
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

        expectTaggedError(error, "ConfigError")
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
            field: `["artifacts"][0]["path"]`
          },
          {
            label: "npm package path",
            config: minimalConfig.replace("\"packagePath\":\".\"", "\"packagePath\":\"\""),
            field: `["publish"]["npm"]["packagePath"]`
          },
          {
            label: "Homebrew formula path",
            config: homebrewConfig({ formulaPath: "" }),
            field: `["publish"]["homebrew"]["formulaPath"]`
          },
          {
            label: "Scoop manifest path",
            config: scoopConfig({ manifestPath: "" }),
            field: `["publish"]["scoop"]["manifestPath"]`
          }
        ]

        for (const item of cases) {
          const error = yield* createPlan(item.config).pipe(Effect.flip)

          expect(error._tag, item.label).toBe("ConfigError")
          if (error._tag === "ConfigError") {
            expect(error.reason).toContain(item.field)
          }
        }
      }))

    it.effect("adds imported artifacts and their build checks to the canonical plan", () =>
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
        expect(plan.operations.map((operation) => operation.id)).toEqual(["import-artifacts:archive:exists"])
      }))

    it.effect("flows a neutral archive through checksum and GitHub planning", () =>
      Effect.gen(function*() {
        const plan = yield* createPlan(releaseConfig({ artifacts: [], archives: [{ files: ["docs/**"] }],
          checksum: {}, publish: { github: { repository: "owner/repo" } } }))
        const archive = plan.artifacts.find(({ kind }) => kind === "archive")
        const checksum = plan.artifacts.find(({ kind }) => kind === "checksum-file")
        const github = plan.operations.find(({ id }) => id === "github:github-release-create")
        expect(checksum?.extra).toMatchObject({ _tag: "checksum-file", coversArtifactIds: [archive!.id] })
        expect(github?.action._tag).toBe("github-release-create")
        if (github?.action._tag === "github-release-create")
          expect(github.action.assets.map(({ artifactId }) => artifactId)).toContain(archive!.id)
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
  })

  layer(makeTestCommandRunnerLayer({
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
    }))((it) => {
    it.effect("resolves HEAD release identity through the host git command", () =>
      Effect.gen(function*() {
        const headConfig = minimalConfig.replace("\"commit\":\"abc123\"", "\"commit\":\"HEAD\"")
        const plan = yield* createPlan(headConfig)

        expect(plan.identity.commit).toBe("81587b5")
      }))
  })

  layer(makeTestCommandRunnerLayer({
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
    }))((it) => {
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

  layer(makeTestCommandRunnerLayer({
      files: new Map([["artifacts/release-0.1.0-release.tgz", "archive"]])
    }))((it) => {
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

  layer(makeTestCommandRunnerLayer({
      files: new Map([["dist/release-0.1.0-linux-x64", "compiled binary"]])
    }))((it) => {
    it.effect("adds build artifacts to the canonical plan", () =>
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
          kind: "executable",
          producedBy: "build:bun",
          platform: {
            os: "linux",
            arch: "x64",
            libc: "glibc",
            targetTriple: "bun-linux-x64-baseline"
          },
          extra: {
            _tag: "executable",
            binary: "release",
            extension: "",
            builderId: "bun"
          }
        })
      }))

    it.effect("selects canonical artifacts by installable platform", () =>
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

        expect(error._tag).toBe("PlanError")
        if (error._tag === "PlanError") {
          expect(error.field).toBe("artifacts.id")
        }
      }))

    for (const [label, overrides, reason] of [
      ["rejects unsafe build entry paths", { entry: "../cli.ts" }, `["builds"][0]["entry"]`],
      ["rejects unsafe build output paths", { output: "../dist/release-{version}" }, `["builds"][0]["output"]`],
      ["rejects removed build output override arrays", {
        outputs: [{
          id: "cli-linux-x64",
          target: "linux-x64",
          path: "dist/release-{version}",
          variant: { os: "windows" }
        }]
      }, "builds[0].outputs"]
    ] as const) {
      it.effect(label, () =>
        Effect.gen(function*() {
          const error = yield* createPlan(releaseConfig({
            artifacts: [],
            builds: [bunExecutableBuild(overrides)],
            publish: {}
          })).pipe(Effect.flip)
          expect(error._tag).toBe("ConfigError")
          if (error._tag === "ConfigError") expect(error.reason).toContain(reason)
        }))
    }
  })

  layer(makeTestCommandRunnerLayer({
      files: new Map([["dist/release-darwin-arm64", "compiled binary"]])
    }))((it) => {
    it.effect("preserves direct artifact platform metadata", () =>
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
          kind: "executable",
          producedBy: "import-artifacts",
          platform: {
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

        expect(error._tag).toBe("PlanError")
        if (error._tag === "PlanError") {
          expect(error.field).toBe("artifacts.cli-darwin-arm64.variant.libc")
        }
      }))
  })

  layer(makeTestCommandRunnerLayer({
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
    }))((it) => {
    it.effect("reports git HEAD resolution failures as identity errors", () =>
      Effect.gen(function*() {
        const headConfig = minimalConfig.replace("\"commit\":\"abc123\"", "\"commit\":\"HEAD\"")
        const error = yield* createPlan(headConfig).pipe(Effect.flip)

        expectTaggedError(error, "IdentityError")
      }))
  })

  layer(ChecksumLayer)((it) => {
    for (const [label, checksum] of [
      ["preserves matching manual sha256 checksums", { algorithm: "sha256", value: "6d616e75616c2061726368697665" }],
      ["carries manual checksum data into imported artifacts", { algorithm: "sha256", value: "00" }],
      ["preserves manual sha512 checksums on imported artifacts", { algorithm: "sha512", value: "sha512:manual" }]
    ] as const) {
      it.effect(label, () => Effect.gen(function*() {
        const plan = yield* createPlan(manualChecksumConfig(checksum))
        expect(plan.artifacts[0]?.checksum).toEqual(checksum)
      }))
    }
  })
})
