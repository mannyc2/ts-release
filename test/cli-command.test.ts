import { describe, expect, test } from "bun:test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  PlanReleaseConfigOptions,
  planReleaseConfig,
  renderReleaseConfigPlan
} from "../src/workflows/config.js"
import {
  checkAuthReleaseConfig,
  checkCiReleaseConfig,
  ReleaseDiagnosticsOptions
} from "../src/workflows/diagnostics.js"
import {
  planReleaseInit,
  ReleaseInitOptions,
  renderGithubActionsTrustedPublishingWorkflow
} from "../src/workflows/init.js"
import { cli } from "../apps/release-ts/src/cli/command.js"
import { CommandEvidence, EvidenceBundle } from "../src/domain/evidence.js"
import { CommandSpec } from "../src/domain/operation.js"
import { CommandResult, CommandRunnerError, ReleaseCommandRunnerTestLayer } from "../src/host/host.js"
import { makeTestReleaseHttpLayer } from "../src/host/http.js"
import { makeBunReleaseWorkflowRuntimeLayer } from "../apps/release-ts/src/runtime.js"
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

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

describe("cli command", () => {
  test("exports the root release command", () => {
    expect(cli.name).toBe("release")
    expect(cli.subcommands.flatMap((group) => group.commands.map((command) => command.name)).sort()).toEqual([
      "check-auth",
      "check-ci",
      "doctor",
      "eligibility",
      "execute",
      "explain",
      "init",
      "plan",
      "print",
      "reconcile",
      "render",
      "resume",
      "run",
      "schema",
      "status",
      "validate",
      "validate-config",
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

  test("schema command writes parseable JSON Schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-schema-"))
    try {
      const out = join(root, "release-config.schema.json")
      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "schema",
          "--out",
          out
        ]).pipe(Effect.provide(BunServices.layer))
      )

      const parsed: unknown = JSON.parse(await readFile(out, "utf8"))
      expect(typeof parsed).toBe("object")
      expect(JSON.stringify(parsed)).toContain("ReleaseIntent")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("validate-config command checks config shape only", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-validate-config-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "validate-config",
          "--config",
          configPath,
          "--format",
          "json"
        ]).pipe(Effect.provide(BunServices.layer))
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("root cli script preserves caller-relative config paths", async () => {
    const subprocess = Bun.spawn([
      "bun",
      "run",
      "cli",
      "validate-config",
      "--config",
      "apps/release-ts/release.config.json",
      "--format",
      "text"
    ], {
      cwd: process.cwd(),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe"
    })
    const stdout = streamText(subprocess.stdout)
    const stderr = streamText(subprocess.stderr)
    const exitCode = await subprocess.exited

    expect(await stdout).toContain("valid: true")
    expect(await stderr).not.toContain("ConfigReadError")
    expect(exitCode).toBe(0)
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

  test("renders summary and markdown plan formats through the workflow", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-plan-formats-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const summary = await Effect.runPromise(
        renderReleaseConfigPlan(
          PlanReleaseConfigOptions.make({
            root,
            configPath: "release.config.json",
            format: "summary"
          })
        ).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )
      const markdown = await Effect.runPromise(
        renderReleaseConfigPlan(
          PlanReleaseConfigOptions.make({
            root,
            configPath: "release.config.json",
            format: "markdown"
          })
        ).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(summary).toContain("gated operations")
      expect(markdown).toContain("### npm:npm-publish")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("explain command reports one operation without executing it", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-explain-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "explain",
          "npm:npm-publish",
          "--config",
          configPath
        ]).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      const missing = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "explain",
          "missing:operation",
          "--config",
          configPath
        ]).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )
      expect(missing._tag).toBe("Failure")
      if (missing._tag === "Failure") {
        expect(String(missing.cause)).toContain("PlanOperationNotFoundError")
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("init previews without writing and writes only when approved", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-init-"))
    try {
      const configPath = join(root, "release.config.json")

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--template",
          "npm-github",
          "--package",
          "@scope/pkg",
          "--repo",
          "owner/repo",
          "--config",
          configPath
        ]).pipe(Effect.provide(BunServices.layer))
      )
      await expect(readFile(configPath, "utf8")).rejects.toThrow()

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--template",
          "npm-github",
          "--package",
          "@scope/pkg",
          "--repo",
          "owner/repo",
          "--config",
          configPath,
          "--write"
        ]).pipe(Effect.provide(BunServices.layer))
      )
      const config = await readFile(configPath, "utf8")
      expect(config).toContain("\"$schema\"")
      expect(config).toContain("\"repository\": \"owner/repo\"")

      const blocked = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--config",
          configPath,
          "--write"
        ]).pipe(Effect.provide(BunServices.layer))
      )
      expect(blocked._tag).toBe("Failure")
      if (blocked._tag === "Failure") {
        expect(String(blocked.cause)).toContain("ReleaseInitWriteError")
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("init generates schema-valid configs for every template", async () => {
    const templates: ReadonlyArray<"npm-only" | "npm-github" | "multi-target-homebrew" | "multi-target-scoop"> = [
      "npm-only",
      "npm-github",
      "multi-target-homebrew",
      "multi-target-scoop"
    ]
    for (const template of templates) {
      const root = await mkdtemp(join(tmpdir(), `ts-release-cli-init-${template}-`))
      try {
        const plan = await Effect.runPromise(
          planReleaseInit(ReleaseInitOptions.make({
            root,
            template,
            package: "@scope/pkg",
            repo: "owner/repo",
            tap: "owner/homebrew-tap",
            bucket: "owner/scoop-bucket"
          })).pipe(Effect.provide(BunServices.layer))
        )
        const configFile = plan.files.find((file) => file.path === "release.config.json")
        expect(configFile).toBeDefined()
        if (configFile !== undefined) {
          const intent = await Effect.runPromise(parseReleaseIntent(configFile.contents))
          expect(intent.identity.name).toBe("@scope/pkg")
          expect(configFile.contents).toContain("\"$schema\"")
          if (template === "multi-target-homebrew") {
            expect(configFile.contents).toContain("owner/homebrew-tap")
          }
          if (template === "multi-target-scoop") {
            expect(configFile.contents).toContain("owner/scoop-bucket")
          }
        }
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  })

  test("init can include the GitHub Actions trusted-publishing template", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-init-actions-"))
    try {
      const configPath = join(root, "release.config.json")
      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--template",
          "npm-github",
          "--package",
          "@scope/pkg",
          "--repo",
          "owner/repo",
          "--config",
          configPath,
          "--github-actions",
          "--write"
        ]).pipe(Effect.provide(BunServices.layer))
      )

      const workflow = await readFile(join(root, ".github", "workflows", "release.yml"), "utf8")
      expect(workflow).toContain("uses: mannyc2/ts-release-action@v1")
      expect(workflow).toContain("config: release.config.json")
      expect(workflow).not.toContain(configPath)
      expect(workflow).toContain("command: plan")
      expect(workflow).toContain("format: markdown")
      expect(workflow).toContain("command: run")
      expect(workflow).toContain("execute: true")
      expect(workflow).toContain("approve-irreversible: true")
      expect(workflow).toContain("id-token: write")
      expect(workflow).not.toContain("NPM_TOKEN")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("check-auth reports env names without secret values", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-check-auth-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"]
          ]),
          commands: new Map()
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      const report = await Effect.runPromise(
        checkAuthReleaseConfig(ReleaseDiagnosticsOptions.make({
          configPath
        })).pipe(Effect.provide(layer))
      )
      const serialized = JSON.stringify(report)
      expect(serialized).toContain("NPM_TOKEN")
      expect(serialized).toContain("GH_TOKEN")
      expect(serialized).not.toContain("npm_secret")
      expect(report.checks.some((item) => item.status === "fail" && item.message.includes("GH_TOKEN"))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("check-ci accepts the trusted publishing workflow template", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-check-ci-"))
    try {
      const configPath = join(root, "release.config.json")
      const trustedConfig = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\",",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true},"
      )
      await writeFile(configPath, trustedConfig)
      await mkdir(join(root, ".github", "workflows"), { recursive: true })
      await writeFile(
        join(root, ".github", "workflows", "release.yml"),
        renderGithubActionsTrustedPublishingWorkflow("release.config.json")
      )

      const report = await Effect.runPromise(
        checkCiReleaseConfig(ReleaseDiagnosticsOptions.make({
          configPath,
          workflow: ".github/workflows/release.yml"
        })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(report.checks.filter((item) => item.status === "fail")).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("check-ci rejects action execution in the plan job", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-check-ci-plan-exec-"))
    try {
      const configPath = join(root, "release.config.json")
      const trustedConfig = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\",",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true},"
      )
      await writeFile(configPath, trustedConfig)
      await mkdir(join(root, ".github", "workflows"), { recursive: true })
      await writeFile(
        join(root, ".github", "workflows", "release.yml"),
        [
          "name: Release",
          "on:",
          "  workflow_dispatch:",
          "jobs:",
          "  plan:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - uses: mannyc2/ts-release-action@v1",
          "        with:",
          "          command: run",
          "          config: release.config.json",
          "          execute: true",
          "  execute:",
          "    runs-on: ubuntu-latest",
          "    environment: release",
          "    permissions:",
          "      contents: write",
          "      id-token: write",
          "    steps:",
          "      - uses: mannyc2/ts-release-action@v1",
          "        with:",
          "          command: run",
          "          config: release.config.json",
          "          execute: true",
          "          approve-irreversible: true",
          "      - uses: actions/upload-artifact@v4",
          "        if: always()",
          ""
        ].join("\n")
      )

      const report = await Effect.runPromise(
        checkCiReleaseConfig(ReleaseDiagnosticsOptions.make({
          configPath,
          workflow: ".github/workflows/release.yml"
        })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      const planSafety = report.checks.find((item) => item.id === "ci:plan-job-no-execute")
      expect(planSafety?.status).toBe("fail")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("doctor command composes static diagnostics", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-doctor-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "doctor",
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
