import { describe, expect, test } from "bun:test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  type ActionArtifactClient,
  type ActionIo,
  NoopActionArtifactClient,
  runAction
} from "../apps/ts-release-action/src/action.js"
import { ActionOptions, type ActionCommand, type ActionFormat, type ActionRuntime } from "../apps/ts-release-action/src/input.js"
import { runActionFromInputs } from "../apps/ts-release-action/src/main.js"
import { makeNodeReleaseWorkflowRuntimeLayer } from "../apps/ts-release-action/src/runtime/node.js"
import { CommandEvidence, EvidenceBundle } from "../src/domain/evidence.js"
import {
  CommandSpec,
  irreversibleGate,
  operationFingerprint,
  PublishCommandOperation
} from "../src/domain/operation.js"
import { CommandResult, CommandRunnerError, ReleaseCommandRunnerTestLayer } from "../src/host/host.js"
import { makeTestReleaseHttpLayer } from "../src/host/http.js"
import { commandKey } from "../src/host/test.js"
import { renderEvidenceJson } from "../src/planner/evidence-recorder.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { homebrewConfig, minimalConfig } from "./helpers.js"

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

interface ActionOptionsOverrides {
  readonly command?: ActionCommand
  readonly format?: ActionFormat
  readonly writeStepSummary?: boolean
  readonly planPath?: string
  readonly failOnWarnings?: boolean
  readonly target?: string
  readonly workflow?: string
  readonly runtime?: ActionRuntime
  readonly execute?: boolean
  readonly approveIrreversible?: boolean
  readonly uploadEvidence?: boolean
  readonly evidenceArtifactName?: string
}

interface FakeActionIo extends ActionIo {
  readonly outputs: Map<string, string>
  readonly summaries: Array<string>
  readonly files: Map<string, string>
  readonly failures: Array<string>
  readonly infos: Array<string>
}

interface CliCommandResponse {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const actionOptions = (root: string, overrides: ActionOptionsOverrides = {}): ActionOptions =>
  ActionOptions.make({
    root,
    command: overrides.command ?? "plan",
    config: "release.config.json",
    format: overrides.format ?? "markdown",
    writeStepSummary: overrides.writeStepSummary ?? true,
    planPath: overrides.planPath ?? "release-plan.md",
    failOnWarnings: overrides.failOnWarnings ?? false,
    ...(overrides.target === undefined ? {} : { target: overrides.target }),
    ...(overrides.workflow === undefined ? {} : { workflow: overrides.workflow }),
    runtime: overrides.runtime ?? "bundled",
    execute: overrides.execute ?? false,
    approveIrreversible: overrides.approveIrreversible ?? false,
    uploadEvidence: overrides.uploadEvidence ?? false,
    evidenceArtifactName: overrides.evidenceArtifactName ?? "release-evidence"
  })

const makeFakeActionIo = (): FakeActionIo => {
  const outputs = new Map<string, string>()
  const summaries: Array<string> = []
  const files = new Map<string, string>()
  const failures: Array<string> = []
  const infos: Array<string> = []
  return {
    outputs,
    summaries,
    files,
    failures,
    infos,
    setOutput: (name, value) => Effect.sync(() => {
      outputs.set(name, value)
    }),
    setFailed: (message) => Effect.sync(() => {
      failures.push(message)
    }),
    appendSummary: (markdown) => Effect.sync(() => {
      summaries.push(markdown)
    }),
    writeFile: (path, contents) => Effect.sync(() => {
      files.set(path, contents)
    }),
    info: (message) => Effect.sync(() => {
      infos.push(message)
    })
  }
}

const makeArtifactClient = () => {
  const uploads: Array<{
    readonly name: string
    readonly files: ReadonlyArray<string>
    readonly rootDirectory: string
  }> = []
  const client: ActionArtifactClient = {
    uploadArtifact: (name, files, rootDirectory) =>
      Effect.sync(() => {
        uploads.push({ name, files: [...files], rootDirectory })
      })
  }
  return { client, uploads }
}

const makeObservableCommandRunnerLayer = (options: {
  readonly env: ReadonlyMap<string, string>
  readonly commands: ReadonlyMap<string, CliCommandResponse>
}) => {
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
            startedAt: "2026-06-18T00:00:00.000Z",
            endedAt: "2026-06-18T00:00:00.001Z",
            durationMillis: 1
          })
        })
    }),
    ConfigProvider.layer(ConfigProvider.fromEnv({ env: envRecord }))
  )
}

describe("ts-release action", () => {
  test("declares Node action metadata inputs and outputs", async () => {
    const metadata = await readFile("apps/ts-release-action/action.yml", "utf8")
    expect(metadata).toContain("runs:")
    expect(metadata).toContain("using: node20")
    expect(metadata).toContain("main: dist/index.js")
    for (const input of [
      "command:",
      "config:",
      "format:",
      "write-step-summary:",
      "plan-path:",
      "fail-on-warnings:",
      "target:",
      "workflow:",
      "runtime:",
      "execute:",
      "approve-irreversible:",
      "upload-evidence:",
      "evidence-artifact-name:"
    ]) {
      expect(metadata).toContain(input)
    }
    for (const output of [
      "release_name:",
      "release_version:",
      "operation_count:",
      "irreversible_operation_count:",
      "target_count:",
      "evidence_directory:",
      "plan_path:",
      "status:"
    ]) {
      expect(metadata).toContain(output)
    }
  })

  test("plan writes a plan file, step summary, and structured outputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-plan-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      expect(io.outputs.get("release_name")).toBe("release")
      expect(io.outputs.get("release_version")).toBe("0.1.0")
      expect(io.outputs.get("operation_count")).toBe("10")
      expect(io.outputs.get("irreversible_operation_count")).toBe("1")
      expect(io.outputs.get("target_count")).toBe("2")
      expect(io.outputs.get("evidence_directory")).toBe(".release/evidence")
      expect(io.outputs.get("plan_path")).toBe("release-plan.md")
      expect(io.outputs.get("status")).toBe("passed")
      expect([...io.files.values()][0]).toContain("# Release Plan release@0.1.0")
      expect(io.summaries.join("\n")).toContain("npm:npm-publish")
      expect(io.failures).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("plan rejects unsafe plan paths without writing files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-unsafe-plan-path-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      for (const planPath of ["../outside.md", ""]) {
        const io = makeFakeActionIo()

        await runAction(
          actionOptions(root, { planPath }),
          io,
          makeNodeReleaseWorkflowRuntimeLayer({ root })
        )

        expect(io.outputs.get("status")).toBe("failed")
        expect(io.failures.join("\n")).toContain("plan-path")
        expect(io.files.size).toBe(0)
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("diagnostics fail without leaking secret values", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-diagnostics-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const io = makeFakeActionIo()
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([["NPM_TOKEN", "npm_secret"]]),
          commands: new Map()
        }),
        LiveTargetRegistryLayer,
        makeTestReleaseHttpLayer({ responses: new Map() }),
        BunServices.layer
      )

      await runAction(
        actionOptions(root, { command: "doctor", format: "markdown" }),
        io,
        layer
      )

      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("Diagnostics reported failing checks")
      const serialized = `${io.summaries.join("\n")}\n${io.failures.join("\n")}`
      expect(serialized).toContain("NPM_TOKEN")
      expect(serialized).toContain("GH_TOKEN")
      expect(serialized).not.toContain("npm_secret")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("fail-on-warnings promotes warning diagnostics to failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-warnings-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
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
          "      - run: bun run cli validate-config --config release.config.json",
          "      - run: bun run cli plan --config release.config.json --format markdown > release-plan.md",
          "  execute:",
          "    runs-on: ubuntu-latest",
          "    environment: release",
          "    permissions:",
          "      contents: write",
          "    steps:",
          "      - run: bun run cli run --config release.config.json --execute --approve-irreversible",
          ""
        ].join("\n")
      )
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root, {
          command: "check-ci",
          format: "text",
          workflow: ".github/workflows/release.yml",
          failOnWarnings: true
        }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("fail-on-warnings")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("workspace runtime mode is rejected with the documented bundled fallback", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-runtime-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root, { runtime: "workspace" }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("runtime: workspace is deferred")
      expect(io.failures.join("\n")).toContain("Use runtime: bundled")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("invalid action inputs fail through action outputs", async () => {
    const io = makeFakeActionIo()

    await runActionFromInputs(
      {
        getInput: (name) => name === "execute" ? "yes" : ""
      },
      io,
      process.cwd(),
      makeNodeReleaseWorkflowRuntimeLayer({ root: process.cwd() }),
      NoopActionArtifactClient
    )

    expect(io.outputs.get("status")).toBe("failed")
    expect(io.failures.join("\n")).toContain("ActionInputError")
    expect(io.failures.join("\n")).toContain("Expected true or false")
  })

  test("validate writes validation evidence and can upload it through a fake artifact client", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-validate-"))
    try {
      await writeFile(join(root, "release.config.json"), noOpConfig)
      const io = makeFakeActionIo()
      const artifact = makeArtifactClient()

      await runAction(
        actionOptions(root, {
          command: "validate",
          uploadEvidence: true,
          evidenceArtifactName: "audit-evidence"
        }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root }),
        artifact.client
      )

      const evidence = await readFile(join(root, ".release", "evidence", "validation.json"), "utf8")
      expect(evidence).toContain("\"releaseName\": \"release\"")
      expect(io.outputs.get("status")).toBe("passed")
      expect(artifact.uploads).toHaveLength(1)
      expect(artifact.uploads[0]?.name).toBe("audit-evidence")
      expect(artifact.uploads[0]?.files.some((file) => file.endsWith("validation.json"))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("run without execute fails at the approval gate", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-run-approval-"))
    try {
      await writeFile(join(root, "release.config.json"), homebrewConfig())
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(join(root, "artifacts", "release-0.1.0.tgz"), "fake archive")
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root, { command: "run" }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("ExecutionApprovalError")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("run with a no-target config writes workflow evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-run-noop-"))
    try {
      await writeFile(join(root, "release.config.json"), noOpConfig)
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root, {
          command: "run",
          execute: true,
          approveIrreversible: true
        }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      for (const name of ["render", "validation", "execution", "verification"]) {
        const evidence = await readFile(join(root, ".release", "evidence", `${name}.json`), "utf8")
        expect(evidence).toContain("\"releaseName\": \"release\"")
      }
      expect(io.outputs.get("status")).toBe("passed")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("run writes partial workflow evidence on validation failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-partial-evidence-"))
    try {
      await writeFile(join(root, "release.config.json"), partialWorkflowConfig)
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(join(root, "artifacts", "release-0.1.0.tgz"), "fake archive")
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
        makeTestReleaseHttpLayer({ responses: new Map() }),
        BunServices.layer
      )
      const io = makeFakeActionIo()
      const artifact = makeArtifactClient()

      await runAction(
        actionOptions(root, {
          command: "run",
          execute: true,
          approveIrreversible: true,
          uploadEvidence: true
        }),
        io,
        layer,
        artifact.client
      )

      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("OperationFailedError")
      expect(artifact.uploads).toHaveLength(1)
      expect(artifact.uploads[0]?.files.some((file) => file.endsWith("render.json"))).toBe(true)
      expect(artifact.uploads[0]?.files.some((file) => file.endsWith("validation.json"))).toBe(true)
      expect(await readFile(join(root, ".release", "evidence", "render.json"), "utf8"))
        .toContain("homebrew:homebrew-render-formula:execution")
      expect(await readFile(join(root, ".release", "evidence", "validation.json"), "utf8"))
        .toContain("npm:npm-version:command")
      await expect(readFile(join(root, ".release", "evidence", "execution.json"), "utf8")).rejects.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("resume blocks on failed publish evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-resume-block-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      await mkdir(join(root, ".release", "evidence"), { recursive: true })
      const publishCommand = CommandSpec.make({
        executable: "npm",
        args: ["publish", ".", "--registry", "https://registry.npmjs.org"],
        requiredEnv: ["NPM_TOKEN"],
        redactedEnv: ["NPM_TOKEN"]
      })
      const publishOperation = PublishCommandOperation.make({
        id: "npm:npm-publish",
        targetId: "npm",
        description: "Publish to npm.",
        risk: "irreversible",
        gate: irreversibleGate("npm versions are immutable."),
        command: publishCommand
      })
      await writeFile(
        join(root, ".release", "evidence", "execution.json"),
        renderEvidenceJson(EvidenceBundle.make({
          schemaVersion: "release-evidence/v1",
          releaseName: "release",
          releaseVersion: "0.1.0",
          records: [
            CommandEvidence.make({
              id: "npm:npm-publish:command",
              operationId: "npm:npm-publish",
              operationFingerprint: operationFingerprint(publishOperation),
              targetId: "npm",
              status: "failed",
              severity: "error",
              command: publishCommand,
              exitCode: 1,
              stdout: "",
              stderr: "publish failed",
              startedAt: "2026-06-18T00:00:00.000Z",
              endedAt: "2026-06-18T00:00:00.001Z",
              durationMillis: 1
            })
          ]
        }))
      )
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map()
        }),
        LiveTargetRegistryLayer,
        makeTestReleaseHttpLayer({ responses: new Map() }),
        BunServices.layer
      )
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root, {
          command: "resume",
          execute: true,
          approveIrreversible: true
        }),
        io,
        layer
      )

      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("ResumeBlockedError")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("reconcile writes reconciliation evidence with fake HTTP state", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-reconcile-"))
    try {
      await writeFile(join(root, "release.config.json"), reconcileConfig)
      await mkdir(join(root, "dist"), { recursive: true })
      await writeFile(join(root, "dist", "release.tgz"), "fake archive")
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
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root, {
          command: "reconcile",
          execute: true
        }),
        io,
        layer
      )

      const evidence = await readFile(join(root, ".release", "evidence", "reconciliation.json"), "utf8")
      expect(evidence).toContain("github:gh-release-publish-draft:command")
      expect(evidence).not.toContain("npm:npm-publish")
      expect(io.outputs.get("status")).toBe("passed")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
