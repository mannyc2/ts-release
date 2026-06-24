import { describe, expect, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  type ActionArtifactClient,
  ActionArtifactUploadError,
  type ActionIo,
  formatActionError,
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
import { makeTestReleaseHttpLayer } from "../src/host/http.js"
import { commandKey } from "../src/host/test.js"
import { renderEvidenceJson } from "../src/planner/evidence-recorder.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import {
  homebrewConfig,
  makeObservableCommandRunnerLayer,
  minimalConfig,
  noOpConfig,
  partialWorkflowConfig,
  reconcileConfig
} from "./helpers.js"

interface ActionOptionsOverrides {
  readonly command?: ActionCommand
  readonly config?: string
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

const actionOptions = (root: string, overrides: ActionOptionsOverrides = {}): ActionOptions =>
  ActionOptions.make({
    root,
    command: overrides.command ?? "plan",
    config: overrides.config ?? "release.config.json",
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

const intentFilesConfig = JSON.stringify({
  identity: {
    name: "@scope/pkg",
    version: "1.2.3",
    commit: "abc123",
    tag: "v1.2.3"
  },
  releaseDecision: {
    _tag: "IntentFilesReleaseDecision",
    directory: ".release/intents",
    packagePath: "package.json",
    tagTemplate: "v{version}",
    requireIntent: true
  },
  artifacts: [],
  targets: [],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

describe("ts-release action", () => {
  test("declares Node action metadata inputs and outputs", async () => {
    const metadata = await readFile("apps/ts-release-action/action.yml", "utf8")
    expect(metadata).toContain("runs:")
    expect(metadata).toContain("using: node20")
    expect(metadata).toContain("main: dist/index.js")
    expect(metadata).toContain("check-intent")
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
      "should_release:",
      "eligibility_status:",
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

  test("eligibility command exposes skipped decisions as successful outputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-eligibility-"))
    try {
      await writeFile(join(root, "release.config.json"), JSON.stringify({
        identity: {
          name: "@scope/pkg",
          version: "1.2.3",
          commit: "abc123",
          tag: "v1.2.3"
        },
        releaseDecision: {
          _tag: "ConventionalCommitsReleaseDecision",
          packagePath: "package.json",
          tagTemplate: "v{version}"
        },
        artifacts: [],
        targets: [
          {
            _tag: "NpmRegistryTarget",
            id: "npm",
            registry: "https://registry.npmjs.org",
            packageName: "@scope/pkg",
            packagePath: ".",
            tokenEnv: "NPM_TOKEN",
            dryRunSupport: "native",
            mutability: "immutable",
            recovery: "publish-new-version"
          },
          {
            _tag: "GitHubReleaseTarget",
            id: "github",
            repository: "owner/repo",
            tokenEnv: "GH_TOKEN",
            draft: false,
            dryRunSupport: "simulated",
            mutability: "mutable-release",
            recovery: "delete-and-recreate"
          }
        ],
        strict: true,
        evidenceDirectory: ".release/evidence"
      }))
      await writeFile(join(root, "package.json"), JSON.stringify({
        name: "@scope/pkg",
        version: "1.2.3"
      }))
      const gitListTags = CommandSpec.make({
        executable: "git",
        args: ["tag", "--list", "--merged", "HEAD"],
        requiredEnv: [],
        redactedEnv: []
      })
      const gitLog = CommandSpec.make({
        executable: "git",
        args: ["log", "--format=%B%x1e"],
        requiredEnv: [],
        redactedEnv: []
      })
      const io = makeFakeActionIo()
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map([
            [commandKey(gitListTags), {
              exitCode: 0,
              stdout: "",
              stderr: ""
            }],
            [commandKey(gitLog), {
              exitCode: 0,
              stdout: "docs: update readme\x1e",
              stderr: ""
            }]
          ])
        }),
        LiveTargetRegistryLayer,
        makeTestReleaseHttpLayer({ responses: new Map() }),
        BunServices.layer
      )

      await runAction(
        actionOptions(root, { command: "eligibility", format: "json" }),
        io,
        layer
      )

      expect(io.outputs.get("status")).toBe("passed")
      expect(io.outputs.get("should_release")).toBe("false")
      expect(io.outputs.get("eligibility_status")).toBe("skipped")
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

  test("rejects unsafe config paths before planning, writing files, or uploading evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-unsafe-config-"))
    const outside = await mkdtemp(join(tmpdir(), "ts-release-action-outside-config-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      await writeFile(join(outside, "release.config.json"), minimalConfig)
      for (const config of ["../release.config.json", "", join(outside, "release.config.json")]) {
        const io = makeFakeActionIo()
        const artifact = makeArtifactClient()

        await runAction(
          actionOptions(root, { config, uploadEvidence: true }),
          io,
          makeNodeReleaseWorkflowRuntimeLayer({ root }),
          artifact.client
        )

        expect(io.outputs.get("status")).toBe("failed")
        expect(io.failures.join("\n")).toContain("config")
        expect(io.files.size).toBe(0)
        expect(artifact.uploads).toHaveLength(0)
      }
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
    }
  })

  test("accepts absolute config paths inside the action workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-absolute-config-"))
    try {
      const config = join(root, "release.config.json")
      await writeFile(config, noOpConfig)
      const io = makeFakeActionIo()
      const artifact = makeArtifactClient()

      await runAction(
        actionOptions(root, {
          command: "validate",
          config,
          uploadEvidence: true
        }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root }),
        artifact.client
      )

      expect(io.outputs.get("status")).toBe("passed")
      expect(artifact.uploads).toHaveLength(1)
      expect(artifact.uploads[0]?.rootDirectory).toBe(join(root, ".release", "evidence"))
      expect(artifact.uploads[0]?.files.some((file) => file.endsWith("validation.json"))).toBe(true)
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

  test("whitespace-only config input fails through action outputs", async () => {
    const io = makeFakeActionIo()

    await runActionFromInputs(
      {
        getInput: (name) => name === "config" ? "   " : ""
      },
      io,
      process.cwd(),
      makeNodeReleaseWorkflowRuntimeLayer({ root: process.cwd() }),
      NoopActionArtifactClient
    )

    expect(io.outputs.get("status")).toBe("failed")
    expect(io.failures.join("\n")).toContain("ActionInputError")
    expect(io.failures.join("\n")).toContain("config")
  })

  test("check-intent fails when required intent files are missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-check-intent-missing-"))
    try {
      await writeFile(join(root, "release.config.json"), intentFilesConfig)
      await writeFile(join(root, "package.json"), JSON.stringify({
        name: "@scope/pkg",
        version: "1.2.3"
      }))
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root, { command: "check-intent", format: "text" }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("ReleaseEligibilityCheckError")
      expect(io.failures.join("\n")).toContain("release intent files are required")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("check-intent passes explicit empty and release-requesting intent files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-check-intent-"))
    try {
      await writeFile(join(root, "release.config.json"), intentFilesConfig)
      await writeFile(join(root, "package.json"), JSON.stringify({
        name: "@scope/pkg",
        version: "1.2.3"
      }))
      await mkdir(join(root, ".release", "intents"), { recursive: true })

      await writeFile(join(root, ".release", "intents", "empty.json"), JSON.stringify({
        package: "@scope/pkg",
        release: "none",
        summary: "No release needed.",
        empty: true
      }))
      const emptyIo = makeFakeActionIo()
      await runAction(
        actionOptions(root, { command: "check-intent", format: "json" }),
        emptyIo,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      expect(emptyIo.outputs.get("status")).toBe("passed")
      expect(emptyIo.outputs.get("release_name")).toBe("@scope/pkg")
      expect(emptyIo.outputs.get("should_release")).toBe("false")
      expect(emptyIo.outputs.get("eligibility_status")).toBe("skipped")
      expect(emptyIo.summaries.join("\n")).toContain("\"shouldRelease\": false")

      await writeFile(join(root, ".release", "intents", "feature.json"), JSON.stringify({
        package: "@scope/pkg",
        release: "minor",
        summary: "Add an action command."
      }))
      const releaseIo = makeFakeActionIo()
      await runAction(
        actionOptions(root, { command: "check-intent", format: "text" }),
        releaseIo,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      expect(releaseIo.outputs.get("status")).toBe("passed")
      expect(releaseIo.outputs.get("release_name")).toBe("@scope/pkg")
      expect(releaseIo.outputs.get("should_release")).toBe("true")
      expect(releaseIo.outputs.get("eligibility_status")).toBe("ready")
      expect(releaseIo.summaries.join("\n")).toContain("request a minor release")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("artifact upload errors preserve compact foreign causes", () => {
    const cause = new Error("artifact service unavailable")
    const error = ActionArtifactUploadError.make({
      reason: "upload failed",
      cause
    })

    expect(error.cause).toBe(cause)
    expect(formatActionError(error)).toBe(
      "ActionArtifactUploadError: upload failed (cause: artifact service unavailable)"
    )
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
