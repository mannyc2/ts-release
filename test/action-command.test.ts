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
import {
  makeNodeReleaseWorkflowRuntimeLayer,
  UnsupportedNodeArtifactRecipeRegistryLayer
} from "../apps/ts-release-action/src/runtime/node.js"
import { CommandSpec } from "../src/domain/operation.js"
import { makeTestReleaseHttpLayer } from "../src/host/http.js"
import { commandKey } from "../src/host/test.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import {
  homebrewConfig,
  makeObservableCommandRunnerLayer,
  minimalConfig,
  noOpConfig,
  partialWorkflowConfig,
  TestGitHubApiLayer,
} from "./helpers.js"

interface ActionOptionsOverrides {
  readonly command?: ActionCommand
  readonly config?: string
  readonly format?: ActionFormat
  readonly writeStepSummary?: boolean
  readonly planPath?: string
  readonly failOnWarnings?: boolean
  readonly target?: string
  readonly runtime?: ActionRuntime
  readonly execute?: boolean
  readonly approvePublish?: boolean
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
    runtime: overrides.runtime ?? "bundled",
    execute: overrides.execute ?? false,
    approvePublish: overrides.approvePublish ?? false,
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

describe("ts-release action", () => {
  test("declares Node action metadata inputs and outputs", async () => {
    const metadata = await readFile("apps/ts-release-action/action.yml", "utf8")
    expect(metadata).toContain("runs:")
    expect(metadata).toContain("using: node20")
    expect(metadata).toContain("main: dist/index.js")
    expect(metadata).not.toContain("check-intent")
    expect(metadata).not.toContain("eligibility")
    for (const input of [
      "command:",
      "config:",
      "format:",
      "write-step-summary:",
      "plan-path:",
      "fail-on-warnings:",
      "target:",
      "runtime:",
      "execute:",
      "approve-publish:",
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
      expect(io.outputs.get("operation_count")).toBe("8")
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
          command: "verify",
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
      expect(artifact.uploads[0]?.files.some((file) => file.endsWith("verification.json"))).toBe(true)
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
        UnsupportedNodeArtifactRecipeRegistryLayer,
        LiveTargetRegistryLayer,
        TestGitHubApiLayer,
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

  test("fail-on-warnings leaves informational diagnostics non-fatal", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-info-diagnostics-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)
      const io = makeFakeActionIo()
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map(),
          commands: new Map()
        }),
        UnsupportedNodeArtifactRecipeRegistryLayer,
        LiveTargetRegistryLayer,
        TestGitHubApiLayer,
        makeTestReleaseHttpLayer({ responses: new Map() }),
        BunServices.layer
      )

      await runAction(
        actionOptions(root, {
          command: "doctor",
          format: "text",
          failOnWarnings: true
        }),
        io,
        layer
      )

      expect(io.outputs.get("status")).toBe("passed")
      expect(io.summaries.join("\n")).toContain("info")
      expect(io.failures).toEqual([])
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

  test("build stages artifacts with the bundled action runtime", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-build-"))
    try {
      await writeFile(join(root, "release.config.json"), noOpConfig)
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root, {
          command: "build",
          format: "text"
        }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      expect(io.outputs.get("status")).toBe("passed")
      expect(io.outputs.get("release_name")).toBe("release")
      expect(io.summaries.join("\n")).toContain("staged artifact recipes: 0")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("verify writes verification evidence and can upload it through a fake artifact client", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-verify-"))
    try {
      await writeFile(join(root, "release.config.json"), noOpConfig)
      const io = makeFakeActionIo()
      const artifact = makeArtifactClient()

      await runAction(
        actionOptions(root, {
          command: "verify",
          uploadEvidence: true,
          evidenceArtifactName: "audit-evidence"
        }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root }),
        artifact.client
      )

      const evidence = await readFile(join(root, ".release", "evidence", "verification.json"), "utf8")
      expect(evidence).toContain("\"releaseName\": \"release\"")
      expect(io.outputs.get("status")).toBe("passed")
      expect(artifact.uploads).toHaveLength(1)
      expect(artifact.uploads[0]?.name).toBe("audit-evidence")
      expect(artifact.uploads[0]?.files.some((file) => file.endsWith("verification.json"))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("release without execute fails without approval", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-release-approval-"))
    try {
      await writeFile(join(root, "release.config.json"), homebrewConfig())
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(join(root, "artifacts", "release-0.1.0.tgz"), "fake archive")
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root, { command: "release" }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("ExecutionApprovalError")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("release with a no-target config writes one workflow evidence file", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-action-release-noop-"))
    try {
      await writeFile(join(root, "release.config.json"), noOpConfig)
      const io = makeFakeActionIo()

      await runAction(
        actionOptions(root, {
          command: "release",
          execute: true,
          approvePublish: true
        }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )

      const evidence = await readFile(join(root, ".release", "evidence", "evidence.json"), "utf8")
      expect(evidence).toContain("\"releaseName\": \"release\"")
      expect(evidence).toContain("\"records\": []")
      expect(io.outputs.get("status")).toBe("passed")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("release writes partial workflow evidence on validation failure", async () => {
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
        UnsupportedNodeArtifactRecipeRegistryLayer,
        LiveTargetRegistryLayer,
        TestGitHubApiLayer,
        makeTestReleaseHttpLayer({ responses: new Map() }),
        BunServices.layer
      )
      const io = makeFakeActionIo()
      const artifact = makeArtifactClient()

      await runAction(
        actionOptions(root, {
          command: "release",
          execute: true,
          approvePublish: true,
          uploadEvidence: true
        }),
        io,
        layer,
        artifact.client
      )

      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("OperationFailedError")
      expect(artifact.uploads).toHaveLength(1)
      expect(artifact.uploads[0]?.files.some((file) => file.endsWith("evidence.json"))).toBe(true)
      const evidence = await readFile(join(root, ".release", "evidence", "evidence.json"), "utf8")
      expect(evidence).toContain("homebrew:homebrew-render-formula:execution")
      expect(evidence).toContain("npm:npm-version:command")
      expect(evidence).toContain("\"phase\": \"render\"")
      expect(evidence).toContain("\"phase\": \"validation\"")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

})
