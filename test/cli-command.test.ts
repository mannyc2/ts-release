import { describe, expect, test } from "bun:test"
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
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
} from "../src/api.js"
import { LiveReleaseApiLayer } from "../src/api/live.js"
import { cli } from "../src/cli/command.js"
import { CommandEvidence, EvidenceBundle } from "../src/domain/evidence.js"
import { CommandSpec } from "../src/domain/operation.js"
import { CommandResult, CommandRunnerError, ReleaseCommandRunnerTestLayer } from "../src/host/host.js"
import { makePlatformCommandRunnerLayer } from "../src/host/platform.js"
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
      "execute",
      "plan",
      "print",
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

  test("renders release configs through the TypeScript API", async () => {
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
          Effect.provide(
            Layer.mergeAll(
              makePlatformCommandRunnerLayer({ root }).pipe(Layer.provideMerge(BunServices.layer)),
              LiveTargetRegistryLayer
            )
          )
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
          Effect.provide(
            Layer.mergeAll(
              makePlatformCommandRunnerLayer({ root }).pipe(Layer.provideMerge(BunServices.layer)),
              LiveTargetRegistryLayer
            )
          )
        )
      )

      expect(plan.identity.name).toBe("release")
      expect(plan.source.root).toBe(root)
      expect(plan.source.configPath).toBe("release.config.json")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("supports platform-neutral API layer composition", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-api-platform-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const layer = LiveReleaseApiLayer.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            makePlatformCommandRunnerLayer({ root }).pipe(Layer.provideMerge(BunServices.layer)),
            BunHttpClient.layer
          )
        )
      )

      const plan = await Effect.runPromise(
        planReleaseConfig(PlanReleaseConfigOptions.make({ root, configPath: "release.config.json" })).pipe(
          Effect.provide(layer)
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
          Effect.provide(
            Layer.mergeAll(
              makePlatformCommandRunnerLayer({ root }).pipe(Layer.provideMerge(BunServices.layer)),
              LiveTargetRegistryLayer,
              BunServices.layer
            )
          )
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
          Effect.provide(
            Layer.mergeAll(
              makePlatformCommandRunnerLayer({ root }).pipe(Layer.provideMerge(BunServices.layer)),
              LiveTargetRegistryLayer,
              BunServices.layer
            )
          )
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
          Effect.provide(
            Layer.mergeAll(
              makePlatformCommandRunnerLayer({ root }).pipe(Layer.provideMerge(BunServices.layer)),
              LiveTargetRegistryLayer,
              BunServices.layer
            )
          )
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
      const layer = Layer.mergeAll(
        makePlatformCommandRunnerLayer({ root }).pipe(Layer.provideMerge(BunServices.layer)),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

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
