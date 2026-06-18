import { describe, expect, test } from "bun:test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  PlanReleaseConfigOptions,
  planReleaseConfig,
  renderReleaseConfigPlan
} from "../src/workflows/config.js"
import { cli } from "../src/cli/command.js"
import { CommandEvidence, EvidenceBundle } from "../src/domain/evidence.js"
import { CommandSpec } from "../src/domain/operation.js"
import { CommandResult, CommandRunnerError, ReleaseCommandRunnerTestLayer } from "../src/host/host.js"
import { makeTestReleaseHttpLayer } from "../src/host/http.js"
import { makeBunReleaseWorkflowRuntimeLayer } from "../src/runtime/bun.js"
import { commandKey } from "../src/host/test.js"
import { renderEvidenceJson } from "../src/planner/evidence-recorder.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { minimalConfig } from "./helpers.js"

const noOpConfig = JSON.stringify({
  identity: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  artifacts: [],
  targets: [],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

const partialWorkflowConfig = JSON.stringify({
  identity: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  artifacts: [
    {
      id: "package",
      path: ".",
      format: "directory",
      consumers: ["npm"]
    },
    {
      id: "archive",
      path: "artifacts/release-0.1.0.tgz",
      format: "tarball",
      consumers: ["homebrew"]
    }
  ],
  targets: [
    {
      _tag: "HomebrewTapTarget",
      id: "homebrew",
      repository: "owner/homebrew-tap",
      formulaName: "release",
      formulaPath: ".release/generated/release.rb",
      artifactId: "archive",
      dryRunSupport: "simulated",
      mutability: "mutable-index",
      recovery: "manual"
    },
    {
      _tag: "NpmRegistryTarget",
      id: "npm",
      registry: "https://registry.npmjs.org",
      packageName: "release",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN",
      dryRunSupport: "native",
      mutability: "immutable",
      recovery: "publish-new-version"
    }
  ],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

const reconcileConfig = JSON.stringify({
  identity: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  artifacts: [
    {
      id: "github-asset",
      path: "dist/release.tgz",
      format: "tarball",
      consumers: ["github"]
    },
    {
      id: "package",
      path: ".",
      format: "directory",
      consumers: ["npm"]
    }
  ],
  targets: [
    {
      _tag: "GitHubReleaseTarget",
      id: "github",
      repository: "owner/repo",
      tokenEnv: "GH_TOKEN",
      draft: false,
      prerelease: false,
      dryRunSupport: "simulated",
      mutability: "mutable-release",
      recovery: "delete-and-recreate"
    },
    {
      _tag: "NpmRegistryTarget",
      id: "npm",
      registry: "https://registry.npmjs.org",
      packageName: "release",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN",
      dryRunSupport: "native",
      mutability: "immutable",
      recovery: "publish-new-version"
    }
  ],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

interface CliCommandResponse {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const makeObservableCommandRunnerLayer = (options: {
  readonly env: ReadonlyMap<string, string>
  readonly commands: ReadonlyMap<string, CliCommandResponse>
}) => {
  const timestamps = ["2026-06-17T00:00:00.000Z", "2026-06-17T00:00:00.001Z"]
  let timestampIndex = 0
  const nextTimestamp = (): string => {
    const value = timestamps[timestampIndex] ?? timestamps[timestamps.length - 1] ?? "2026-06-17T00:00:00.000Z"
    timestampIndex += 1
    return value
  }

  const envRecord: Record<string, string> = {}
  for (const [name, value] of options.env) {
    envRecord[name] = value
  }

  return Layer.mergeAll(
    ReleaseCommandRunnerTestLayer({
      runCommand: (command) =>
        Effect.gen(function*() {
          const missing: Array<string> = []
          for (const name of command.requiredEnv) {
            if (!options.env.has(name)) {
              missing.push(name)
            }
          }
          if (missing.length > 0) {
            return yield* Effect.fail(
              CommandRunnerError.make({
                operation: "runCommand",
                reason: `Missing required environment variables: ${missing.join(", ")}`
              })
            )
          }
          const startedAt = nextTimestamp()
          const endedAt = nextTimestamp()
          const response = options.commands.get(commandKey(command)) ?? {
            exitCode: 0,
            stdout: "",
            stderr: ""
          }
          return CommandResult.make({
            command,
            exitCode: response.exitCode,
            stdout: response.stdout,
            stderr: response.stderr,
            startedAt,
            endedAt,
            durationMillis: 1
          })
        })
    }),
    ConfigProvider.layer(ConfigProvider.fromEnv({ env: envRecord }))
  )
}

describe("cli command", () => {
  test("exports the root release command", () => {
    expect(cli.name).toBe("release")
    expect(cli.subcommands.flatMap((group) => group.commands.map((command) => command.name)).sort()).toEqual([
      "eligibility",
      "execute",
      "plan",
      "print",
      "reconcile",
      "render",
      "resume",
      "run",
      "status",
      "validate",
      "verify"
    ])
  })

  test("parses plan command with a config path", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-plan-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map()
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "plan",
          "--config",
          configPath,
          "--out",
          join(root, "release-plan.json")
        ]).pipe(Effect.provide(layer))
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("renders release configs through the explicit config workflow", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-root-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const output = await Effect.runPromise(
        renderReleaseConfigPlan(
          PlanReleaseConfigOptions.make({
            root,
            configPath: "release.config.json",
            format: "text"
          })
        ).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(output).toContain("release@0.1.0")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("plans release configs programmatically", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-plan-root-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const plan = await Effect.runPromise(
        planReleaseConfig(PlanReleaseConfigOptions.make({ root })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(plan.identity.name).toBe("release")
      expect(plan.source.root).toBe(root)
      expect(plan.source.configPath).toBe("release.config.json")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("supports named Bun workflow runtime layer composition", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-workflow-runtime-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const plan = await Effect.runPromise(
        planReleaseConfig(PlanReleaseConfigOptions.make({ root, configPath: "release.config.json" })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(plan.identity.name).toBe("release")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("execute command fails without execute approval", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-execute-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map()
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      const exit = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "execute",
          "--config",
          configPath
        ]).pipe(Effect.provide(layer))
      )
      expect(exit._tag).toBe("Failure")
      if (exit._tag === "Failure") {
        expect(String(exit.cause)).toContain("ExecutionApprovalError")
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("run command fails without execute approval", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-run-approval-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map()
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      const exit = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "run",
          "--config",
          configPath
        ]).pipe(Effect.provide(layer))
      )
      expect(exit._tag).toBe("Failure")
      if (exit._tag === "Failure") {
        expect(String(exit.cause)).toContain("ExecutionApprovalError")
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("eligibility command checks remote state through the config workflow", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-eligibility-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      await writeFile(join(root, "package.json"), JSON.stringify({
        name: "release",
        version: "0.1.0"
      }))
      const npmView = CommandSpec.make({
        executable: "npm",
        args: ["view", "release@0.1.0", "version", "--registry", "https://registry.npmjs.org"],
        requiredEnv: [],
        redactedEnv: []
      })
      const ghReleaseView = CommandSpec.make({
        executable: "gh",
        args: [
          "release",
          "view",
          "v0.1.0",
          "--repo",
          "owner/repo",
          "--json",
          "isDraft,tagName,publishedAt"
        ],
        requiredEnv: ["GH_TOKEN"],
        redactedEnv: ["GH_TOKEN"]
      })
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map([
            [commandKey(npmView), {
              exitCode: 1,
              stdout: "",
              stderr: "E404 Not Found"
            }],
            [commandKey(ghReleaseView), {
              exitCode: 1,
              stdout: "",
              stderr: "not found"
            }]
          ])
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "eligibility",
          "--config",
          configPath
        ]).pipe(Effect.provide(layer))
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("run command writes workflow evidence files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-run-root-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "run",
          "--config",
          configPath,
          "--execute",
          "--approve-irreversible"
        ]).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      for (const name of ["render", "validation", "execution", "verification"]) {
        const output = await readFile(join(root, ".release", "evidence", `${name}.json`), "utf8")
        expect(output).toContain("\"releaseName\": \"release\"")
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("status command renders JSON without executing operations", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-status-root-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "status",
          "--config",
          configPath,
          "--format",
          "json"
        ]).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("resume command writes workflow evidence files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-resume-root-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "resume",
          "--config",
          configPath
        ]).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      for (const name of ["render", "validation", "execution", "verification"]) {
        const output = await readFile(join(root, ".release", "evidence", `${name}.json`), "utf8")
        expect(output).toContain("\"releaseName\": \"release\"")
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("resume command blocks on failed publish evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-resume-blocked-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      await mkdir(join(root, ".release", "evidence"), { recursive: true })
      const publishCommand = CommandSpec.make({
        executable: "npm",
        args: ["publish", ".", "--registry", "https://registry.npmjs.org"],
        requiredEnv: ["NPM_TOKEN"],
        redactedEnv: ["NPM_TOKEN"]
      })
      const executionEvidence = EvidenceBundle.make({
        schemaVersion: "release-evidence/v1",
        releaseName: "release",
        releaseVersion: "0.1.0",
        records: [
          CommandEvidence.make({
            id: "npm:npm-publish:command",
            operationId: "npm:npm-publish",
            targetId: "npm",
            status: "failed",
            severity: "error",
            command: publishCommand,
            exitCode: 1,
            stdout: "",
            stderr: "publish failed",
            startedAt: "2026-06-17T00:00:00.000Z",
            endedAt: "2026-06-17T00:00:00.001Z",
            durationMillis: 1
          })
        ]
      })
      await writeFile(join(root, ".release", "evidence", "execution.json"), renderEvidenceJson(executionEvidence))
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map()
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      const exit = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "resume",
          "--config",
          configPath,
          "--execute",
          "--approve-irreversible"
        ]).pipe(Effect.provide(layer))
      )

      expect(exit._tag).toBe("Failure")
      if (exit._tag === "Failure") {
        expect(String(exit.cause)).toContain("ResumeBlockedError")
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("reconcile command publishes a matching GitHub draft with execute approval", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-reconcile-root-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, reconcileConfig)
      await mkdir(join(root, "dist"), { recursive: true })
      await writeFile(join(root, "dist", "release.tgz"), "fake archive text")
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map()
        }),
        makeTestReleaseHttpLayer({
          responses: new Map([
            ["GET\u0000https://api.github.com/repos/owner/repo/releases/tags/v0.1.0", {
              status: 200,
              json: {
                tag_name: "v0.1.0",
                name: "release 0.1.0",
                draft: true,
                prerelease: false,
                assets: [{ name: "release.tgz" }]
              }
            }]
          ])
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "reconcile",
          "--config",
          configPath,
          "--execute"
        ]).pipe(Effect.provide(layer))
      )

      const evidence = await readFile(join(root, ".release", "evidence", "reconciliation.json"), "utf8")
      expect(evidence).toContain("github:gh-release-publish-draft:command")
      expect(evidence).toContain("--draft=false")
      expect(evidence).not.toContain("npm:npm-publish")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("run command writes partial workflow evidence on validation failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-partial-evidence-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, partialWorkflowConfig)
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(join(root, "artifacts", "release-0.1.0.tgz"), "fake archive text")
      const npmVersionCommand = CommandSpec.make({
        executable: "npm",
        args: ["--version"],
        requiredEnv: [],
        redactedEnv: []
      })
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map([
            [commandKey(npmVersionCommand), {
              exitCode: 1,
              stdout: "",
              stderr: "npm unavailable"
            }]
          ])
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      const exit = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "run",
          "--config",
          configPath,
          "--execute",
          "--approve-irreversible"
        ]).pipe(Effect.provide(layer))
      )

      expect(exit._tag).toBe("Failure")
      if (exit._tag === "Failure") {
        expect(String(exit.cause)).toContain("OperationFailedError")
      }
      const renderEvidence = await readFile(join(root, ".release", "evidence", "render.json"), "utf8")
      const validationEvidence = await readFile(join(root, ".release", "evidence", "validation.json"), "utf8")
      expect(renderEvidence).toContain("homebrew:homebrew-render-formula:execution")
      expect(validationEvidence).toContain("npm:npm-version:command")
      await expect(readFile(join(root, ".release", "evidence", "execution.json"), "utf8")).rejects.toThrow()
      await expect(readFile(join(root, ".release", "evidence", "verification.json"), "utf8")).rejects.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("render command succeeds without approval when there is nothing to render", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-render-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      const layer = makeBunReleaseWorkflowRuntimeLayer({ root })

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "render",
          "--config",
          configPath
        ]).pipe(Effect.provide(layer))
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
