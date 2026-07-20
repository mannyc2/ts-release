import { describe, expect, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type ActionArtifactClient,
  ActionArtifactUploadError,
  type ActionIo,
  formatActionError,
  NoopActionArtifactClient,
  runAction
} from "../apps/ts-release-action/src/action.js"
import { ActionOptions, readActionOptions } from "../apps/ts-release-action/src/input.js"
import { runActionFromInputs } from "../apps/ts-release-action/src/main.js"
import { makeNodeReleaseWorkflowRuntimeLayer } from "../apps/ts-release-action/src/runtime/node.js"
import { CommandSpec } from "../src/grammar/operation.js"
import { UnsupportedArtifactStagerLayer } from "../src/pack/stager.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import { commandKey } from "./host-fakes.js"
import {
  homebrewConfig,
  makeObservableCommandRunnerLayer,
  minimalConfig,
  noOpConfig,
  partialWorkflowConfig,
  TestGitHubApiLayer,
  withTempDirectoryPromise,
} from "./helpers.js"
type ActionOptionsOverrides = Partial<Omit<ActionOptions, "root">>
type FakeActionIo = ActionIo & {
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
    snapshot: overrides.snapshot ?? false,
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
const doctorLayer = (env: ReadonlyMap<string, string> = new Map()) => Layer.mergeAll(
  makeObservableCommandRunnerLayer({ env, commands: new Map() }),
  UnsupportedArtifactStagerLayer,
  TestGitHubApiLayer,
  makeTestReleaseHttpLayer({ responses: new Map() }),
  BunServices.layer
)
const runInputCase = async (name: string, value: string) => {
  const root = process.cwd()
  const io = makeFakeActionIo()
  await runActionFromInputs(
    { getInput: (input) => input === name ? value : "" },
    io,
    root,
    makeNodeReleaseWorkflowRuntimeLayer({ root }),
    NoopActionArtifactClient
  )
  return io
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
      "snapshot:",
      "execute:",
      "approve-publish:",
      "upload-evidence:",
      "evidence-artifact-name:"
    ]) {
      expect(metadata).toContain(input)
    }
    expect(metadata).not.toContain("\n  runtime:")
    for (const output of [
      "release_name:",
      "release_version:",
      "operation_count:",
      "irreversible_operation_count:",
      "surface_count:",
      "evidence_directory:",
      "plan_path:",
      "status:"
    ]) {
      expect(metadata).toContain(output)
    }
  })
  test("plan writes a plan file, step summary, and structured outputs", async () => {
    await withTempDirectoryPromise("ts-release-action-plan-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const io = makeFakeActionIo()
      await runAction(
        actionOptions(root),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )
      expect(io.outputs.get("release_name")).toBe("release")
      expect(io.outputs.get("release_version")).toBe("0.1.0")
      expect(io.outputs.get("operation_count")).toBe("7")
      expect(io.outputs.get("irreversible_operation_count")).toBe("1")
      expect(io.outputs.get("surface_count")).toBe("2")
      expect(io.outputs.get("evidence_directory")).toBe(".release/evidence")
      expect(io.outputs.get("plan_path")).toBe("release-plan.md")
      expect(io.outputs.get("status")).toBe("passed")
      expect([...io.files.values()][0]).toContain("# Release Plan release@0.1.0")
      expect(io.summaries.join("\n")).toContain("npm:npm-publish")
      expect(io.failures).toEqual([])
    })
  })
  test("plan supports snapshot mode", async () => {
    await withTempDirectoryPromise("ts-release-action-plan-snapshot-", async (root) => {
      await writeFile(join(root, "release.config.json"), noOpConfig)
      const io = makeFakeActionIo()
      await runAction(
        actionOptions(root, { snapshot: true }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )
      expect(io.outputs.get("release_version")).toBe("0.1.0-SNAPSHOT-abc123")
      expect([...io.files.values()][0]).toContain("release@0.1.0-SNAPSHOT-abc123")
    })
  })
  test("plan operation_count includes build-phase import checks", async () => {
    await withTempDirectoryPromise("ts-release-action-complete-plan-", async (root) => {
      await writeFile(join(root, "release.config.json"), partialWorkflowConfig)
      const io = makeFakeActionIo()
      await runAction(
        actionOptions(root),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )
      expect(io.outputs.get("operation_count")).toBe("9")
      expect(io.outputs.get("surface_count")).toBe("3")
      expect(io.summaries.join("\n")).toContain("import-artifacts:archive:exists")
    })
  })
  test("plan rejects unsafe plan paths without writing files", async () => {
    await withTempDirectoryPromise("ts-release-action-unsafe-plan-path-", async (root) => {
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
    })
  })
  test("rejects unsafe config paths before planning, writing files, or uploading evidence", async () => {
    await withTempDirectoryPromise("ts-release-action-unsafe-config-", (root) =>
      withTempDirectoryPromise("ts-release-action-outside-config-", async (outside) => {
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
      }))
  })
  test("accepts absolute config paths inside the action workspace", async () => {
    await withTempDirectoryPromise("ts-release-action-absolute-config-", async (root) => {
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
    })
  })
  test("diagnostics fail without leaking secret values", async () => {
    await withTempDirectoryPromise("ts-release-action-diagnostics-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const io = makeFakeActionIo()
      await runAction(
        actionOptions(root, { command: "doctor", format: "markdown" }),
        io,
        doctorLayer(new Map([["NPM_TOKEN", "npm_secret"]]))
      )
      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("Diagnostics reported failing checks")
      const serialized = `${io.summaries.join("\n")}\n${io.failures.join("\n")}`
      expect(serialized).toContain("NPM_TOKEN")
      expect(serialized).toContain("GH_TOKEN")
      expect(serialized).not.toContain("npm_secret")
    })
  })
  test("fail-on-warnings leaves informational diagnostics non-fatal", async () => {
    await withTempDirectoryPromise("ts-release-action-info-diagnostics-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)
      const io = makeFakeActionIo()
      await runAction(
        actionOptions(root, {
          command: "doctor",
          format: "text",
          failOnWarnings: true
        }),
        io,
        doctorLayer()
      )
      expect(io.outputs.get("status")).toBe("passed")
      expect(io.summaries.join("\n")).toContain("info")
      expect(io.failures).toEqual([])
    })
  })
  test("does not read the removed runtime input", () => {
    const reads: Array<string> = []
    const options = readActionOptions({
      getInput: (name) => {
        reads.push(name)
        return name === "runtime" ? "workspace" : ""
      }
    }, process.cwd())

    expect(reads).not.toContain("runtime")
    expect("runtime" in options).toBe(false)
  })
  for (const [label, name, value, reason] of [
    ["invalid action inputs fail through action outputs", "execute", "yes", "Expected true or false"],
    ["whitespace-only config input fails through action outputs", "config", "   ", "config"]
  ] as const) {
    test(label, async () => {
      const io = await runInputCase(name, value)
      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("ActionInputError")
      expect(io.failures.join("\n")).toContain(reason)
    })
  }
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
    await withTempDirectoryPromise("ts-release-action-build-", async (root) => {
      await writeFile(join(root, "release.config.json"), noOpConfig)
      const io = makeFakeActionIo()
      const artifact = makeArtifactClient()
      await runAction(
        actionOptions(root, {
          command: "build",
          format: "text",
          uploadEvidence: true
        }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root }),
        artifact.client
      )
      const evidence = await readFile(join(root, ".release", "evidence", "build.json"), "utf8")
      expect(io.outputs.get("status")).toBe("passed")
      expect(io.outputs.get("release_name")).toBe("release")
      expect(io.summaries.join("\n")).toContain("staged artifact operations: 0")
      expect(evidence).toContain('"records": []')
      expect(artifact.uploads[0]?.files.some((file) => file.endsWith("build.json"))).toBe(true)
    })
  })
  test("failed build uploads its persisted evidence", async () => {
    await withTempDirectoryPromise("ts-release-action-build-failure-", async (root) => {
      await writeFile(join(root, "release.config.json"), JSON.stringify({
        project: { name: "release", version: "0.1.0", commit: "abc123", tag: "v0.1.0" },
        builds: [{
          builder: "bun",
          id: "release-cli",
          entry: "src/cli.ts",
          targets: ["linux-x64"],
          output: "dist/release-{version}-{targetTriple}"
        }],
        publish: {},
        evidence: ".release/evidence"
      }))
      const io = makeFakeActionIo()
      const artifact = makeArtifactClient()
      await runAction(
        actionOptions(root, { command: "build", uploadEvidence: true }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root }),
        artifact.client
      )
      const evidence = await readFile(join(root, ".release", "evidence", "build.json"), "utf8")
      expect(io.outputs.get("status")).toBe("failed")
      expect(io.failures.join("\n")).toContain("OperationFailedError")
      expect(evidence).toContain('"status": "failed"')
      expect(artifact.uploads[0]?.files.some((file) => file.endsWith("build.json"))).toBe(true)
    })
  })
  test("verify writes verification evidence and can upload it through a fake artifact client", async () => {
    await withTempDirectoryPromise("ts-release-action-verify-", async (root) => {
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
    })
  })
  test("release without execute plans without workflow evidence", async () => {
    await withTempDirectoryPromise("ts-release-action-release-approval-", async (root) => {
      await writeFile(join(root, "release.config.json"), homebrewConfig())
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(join(root, "artifacts", "release-0.1.0.tgz"), "fake archive")
      const io = makeFakeActionIo()
      await runAction(
        actionOptions(root, { command: "release" }),
        io,
        makeNodeReleaseWorkflowRuntimeLayer({ root })
      )
      expect(io.outputs.get("status")).toBe("passed")
      expect(io.outputs.get("release_version")).toBe("0.1.0")
      expect(io.summaries.join("\n")).toContain("release planned only")
      expect(io.failures).toEqual([])
      await expect(access(join(root, ".release", "evidence", "evidence.json"))).rejects.toThrow()
    })
  })
  test("release with a no-target config writes one workflow evidence file", async () => {
    await withTempDirectoryPromise("ts-release-action-release-noop-", async (root) => {
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
    })
  })
  test("release writes partial workflow evidence on validation failure", async () => {
    await withTempDirectoryPromise("ts-release-action-partial-evidence-", async (root) => {
      await writeFile(join(root, "release.config.json"), partialWorkflowConfig)
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(join(root, "artifacts", "release-0.1.0.tgz"), "fake archive")
      const npmWhoamiCommand = CommandSpec.make({
        executable: "npm",
        args: ["whoami", "--registry", "https://registry.npmjs.org"],
        requiredEnv: ["NPM_TOKEN"],
        redactedEnv: ["NPM_TOKEN"]
      })
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map([
            [commandKey(npmWhoamiCommand), {
              exitCode: 1,
              stdout: "",
              stderr: "npm unavailable"
            }]
          ])
        }),
        UnsupportedArtifactStagerLayer,
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
      expect(evidence).toContain("\"operationId\": \"catalog:homebrew:render\"")
      expect(evidence).toContain("\"operationId\": \"npm:npm-whoami\"")
      expect(evidence).toContain("\"phase\": \"catalog\"")
      expect(evidence).toContain("\"phase\": \"publish\"")
    })
  })
})
