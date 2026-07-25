import { describe, expect, it, layer } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as TestClock from "effect/testing/TestClock"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  CommandAction,
  CommandSpec,
  NoteAction,
  Operation,
  RetryPolicy,
  StageAction,
  WriteFileAction
} from "../src/grammar/operation.js"
import { ArchiveIntent } from "../src/grammar/intent.js"
import { ExecutionApproval } from "../src/grammar/approval.js"
import { CommandRunnerError, type CommandResult } from "../src/host/host.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import { commandKey, makeTestCommandRunnerLayer, ReleaseCommandRunnerTestLayer } from "./host-fakes.js"
import {
  operationsForPass,
  runOperationEvidence,
  type OperationPass
} from "../src/run/executor.js"
import { runEvidenceWorkflow } from "./plan-helpers.js"
import { planRelease } from "../src/engine/engine.js"
import { ArtifactStageError, ArtifactStager, UnsupportedArtifactStagerLayer } from "../src/pack/stager.js"
import { expectTaggedError, minimalConfig, runOperation, TestGitHubApiLayer, makePipelineIdentity } from "./helpers.js"

const releaseIdentity = makePipelineIdentity({ versionSource: "test" })

const context = {
  root: ".",
  identity: releaseIdentity,
  artifacts: []
}

const baseLayer = (
  options: Parameters<typeof makeTestCommandRunnerLayer>[0] = {},
  artifactStagerLayer = UnsupportedArtifactStagerLayer
) =>
  Layer.mergeAll(
    makeTestCommandRunnerLayer(options),
    makeTestReleaseHttpLayer(),
    TestGitHubApiLayer,
    artifactStagerLayer
  )

const TestLayer = baseLayer({
  directories: new Set(["."]),
  env: new Map([
    ["NPM_TOKEN", "npm_secret"],
    ["GH_TOKEN", "gh_secret"]
  ])
})

const planFromConfig = (config: string) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(config)
    return yield* planRelease({ workspace: ".", config: intent })
  })

const commandOperation = (
  id: string,
  phase: "publish" | "verify",
  risk: "read-only" | "irreversible",
  command: CommandSpec
): Operation =>
  Operation.make({
    id,
    pipeId: phase === "verify" ? "verify:test" : "publish:test",
    phase,
    risk,
    description: `${id} operation.`,
    action: CommandAction.make({ command })
  })

const renderOperation = Operation.make({
  id: "workflow-render",
  pipeId: "catalog:test",
  phase: "catalog",
  risk: "writes-local",
  description: "Render workflow file.",
  action: WriteFileAction.make({
    path: ".release/generated/workflow.txt",
    contents: "workflow\n"
  })
})

const workflowValidateCommand = CommandSpec.make({
  executable: "tool",
  args: ["validate"],
  requiredEnv: [],
  redactedEnv: []
})

const workflowPublishCommand = CommandSpec.make({
  executable: "tool",
  args: ["publish"],
  requiredEnv: [],
  redactedEnv: []
})

const workflowVerifyCommand = CommandSpec.make({
  executable: "tool",
  args: ["verify"],
  requiredEnv: [],
  redactedEnv: []
})

const npmVersionVerifyCommand = CommandSpec.make({
  executable: "npm",
  args: ["view", "release@0.1.0", "version", "--registry", "https://registry.npmjs.org"],
  requiredEnv: [],
  redactedEnv: []
})

const workflowOperations = [
  renderOperation,
  commandOperation("workflow-validate", "publish", "read-only", workflowValidateCommand),
  commandOperation("workflow-publish", "publish", "irreversible", workflowPublishCommand),
  commandOperation("workflow-verify", "verify", "read-only", workflowVerifyCommand)
]

const renderAndPublishOperations = [
  Operation.make({
    id: "local:render-file",
    pipeId: "catalog:test",
    phase: "catalog",
    risk: "writes-local",
    description: "Render generated file.",
    action: WriteFileAction.make({
      path: ".release/generated/file.txt",
      contents: "generated\n"
    })
  }),
  commandOperation("workflow-publish", "publish", "irreversible", workflowPublishCommand)
]

const npmVersionVerifyOperation = (attempts?: number): Operation =>
  Operation.make({
    id: "npm:npm-version-verify",
    pipeId: "publish:npm",
    phase: "verify",
    risk: "read-only",
    description: "Verify npm package version.",
    action: CommandAction.make({ command: npmVersionVerifyCommand }),
    ...(attempts === undefined ? {} : { retry: RetryPolicy.make({ attempts, delayMillis: 500 }) })
  })

const retryStageOperation = Operation.make({
  id: "stage:retry-probe",
  pipeId: "build:test",
  phase: "build",
  risk: "writes-local",
  description: "Probe typed stage failures.",
  action: StageAction.make({
    intent: ArchiveIntent.make({ outfile: "dist/probe.zip", format: "zip", artifacts: [], files: [] }),
    producesArtifactIds: ["probe"]
  }),
  retry: RetryPolicy.make({ attempts: 11, delayMillis: 500 })
})

const retryProbeLayer = (times: Array<number>, succeedAt: number) =>
  Layer.mergeAll(
    ReleaseCommandRunnerTestLayer({
      runCommand: (command) =>
        Effect.gen(function*() {
          const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
          times.push(now)
          const failed = times.length < succeedAt
          return {
            command,
            exitCode: failed ? 1 : 0,
            stdout: failed ? "" : "0.1.0\n",
            stderr: failed ? "not found" : "",
            startedAt: new Date(now).toISOString(),
            endedAt: new Date(now).toISOString(),
            durationMillis: 0
          } satisfies CommandResult
        })
    }),
    makeTestReleaseHttpLayer(),
    TestGitHubApiLayer,
    UnsupportedArtifactStagerLayer,
    BunServices.layer
  )

const runRetryProbe = (operation: Operation, succeedAt: number, advanceMillis: number) =>
  Effect.gen(function*() {
    const times: Array<number> = []
    const fiber = yield* runOperationEvidence(operation, ExecutionApproval.none, context).pipe(
      Effect.provide(retryProbeLayer(times, succeedAt)),
      Effect.forkChild({ startImmediately: true })
    )
    yield* TestClock.adjust(advanceMillis)
    return { evidence: yield* Fiber.join(fiber), times }
  })

const runStageRetryProbe = (succeedAt: number, advanceMillis: number) =>
  Effect.gen(function*() {
    const times: Array<number> = []
    const layer = Layer.succeed(ArtifactStager)({
      stage: (operation) => Effect.gen(function*() {
        const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
        times.push(now)
        if (times.length < succeedAt) {
          return yield* Effect.fail(ArtifactStageError.make({
            operationId: operation.id,
            intentTag: operation.action.intent._tag,
            path: operation.action.intent.outfile,
            reason: "typed failure"
          }))
        }
      })
    })
    const fiber = yield* runOperationEvidence(
      retryStageOperation,
      ExecutionApproval.make({ execute: true, approveIrreversible: false }),
      context
    ).pipe(Effect.provide(baseLayer({}, layer)), Effect.forkChild({ startImmediately: true }))
    yield* TestClock.adjust(advanceMillis)
    return { evidence: yield* Fiber.join(fiber), times }
  })

const passPartitionOperation = (
  id: string,
  phase: Operation["phase"],
  risk: Operation["risk"]
): Operation =>
  Operation.make({
    id,
    pipeId: "test:pass-partition",
    phase,
    risk,
    description: `${id} operation.`,
    action: NoteAction.make({ message: id, severity: "info", skipped: false })
  })

describe("operation pass partition", () => {
  const passes: ReadonlyArray<OperationPass> = ["build", "render", "validation", "publish", "verification"]

  it("partitions every feature-produced phase and risk combination", () => {
    const operations = [
      passPartitionOperation("partition-build-read-only", "build", "read-only"),
      passPartitionOperation("partition-process-writes-local", "process", "writes-local"),
      passPartitionOperation("partition-catalog-writes-local", "catalog", "writes-local"),
      passPartitionOperation("partition-publish-read-only", "publish", "read-only"),
      passPartitionOperation("partition-publish-writes-local", "publish", "writes-local"),
      passPartitionOperation("partition-publish-externally-visible", "publish", "externally-visible"),
      passPartitionOperation("partition-publish-irreversible", "publish", "irreversible"),
      passPartitionOperation("partition-verify-read-only", "verify", "read-only")
    ]
    const selected = passes.flatMap((pass) => operationsForPass(operations, pass))

    expect(new Set(selected.map(({ id }) => id)).size).toBe(selected.length)
    expect(selected.map(({ id }) => id).sort()).toEqual(operations.map(({ id }) => id).sort())
  })

  it("classifies a catalog note into the render pass", () => {
    const operation = passPartitionOperation("partition-catalog-note", "catalog", "writes-local")

    expect(operationsForPass([operation], "render")).toEqual([operation])
    expect(passes.filter((pass) => operationsForPass([operation], pass).length > 0)).toEqual(["render"])
  })
})

describe("execution approval", () => {
  layer(TestLayer)((it) => {
    it.effect("runs validation without publish approval", () =>
      Effect.gen(function*() {
        const plan = yield* planFromConfig(minimalConfig)
        const evidence = yield* runEvidenceWorkflow(plan.operations, "validation", ExecutionApproval.none, {
          root: ".",
          identity: plan.identity,
          artifacts: plan.artifacts
        })

        expect(evidence.records.length).toBeGreaterThan(0)
        expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
      }))

    it.effect("blocks publish without each required approval", () =>
      Effect.gen(function*() {
        const plan = yield* planFromConfig(minimalConfig)
        const planContext = {
          root: ".",
          identity: plan.identity,
          artifacts: plan.artifacts
        }
        for (const approval of [
          ExecutionApproval.none,
          ExecutionApproval.make({ execute: true, approveIrreversible: false })
        ]) {
          expectTaggedError(
            yield* runEvidenceWorkflow(plan.operations, "publish", approval, planContext).pipe(Effect.flip),
            "ExecutionApprovalError"
          )
        }
      }))

    it.effect("blocks render operations without execute approval", () =>
      Effect.gen(function*() {
        const error = yield* runEvidenceWorkflow(
          renderAndPublishOperations,
          "render",
          ExecutionApproval.none,
          context
        ).pipe(
          Effect.flip
        )

        expectTaggedError(error, "ExecutionApprovalError")
      }))

    it.effect("runs render operations with execute approval", () =>
      Effect.gen(function*() {
        const evidence = yield* runEvidenceWorkflow(
          renderAndPublishOperations,
          "render",
          ExecutionApproval.make({ execute: true, approveIrreversible: false }),
          context
        )

        expect(evidence.records.map((record) => record.operationId)).toEqual(["local:render-file"])
      }))

    it.effect("does not run render operations during publish execution", () =>
      Effect.gen(function*() {
        const evidence = yield* runEvidenceWorkflow(
          renderAndPublishOperations,
          "publish",
          ExecutionApproval.make({ execute: true, approveIrreversible: true }),
          context
        )

        expect(evidence.records.map((record) => record.operationId)).not.toContain("local:render-file")
      }))

    it.effect("runs approved release workflow in stage order", () =>
      Effect.gen(function*() {
        const evidence = yield* runEvidenceWorkflow(
          workflowOperations,
          "release",
          ExecutionApproval.make({ execute: true, approveIrreversible: true }),
          context
        )

        expect(evidence.records.map((record) => record.operationId)).toEqual([
          "workflow-render",
          "workflow-validate",
          "workflow-publish",
          "workflow-verify"
        ])
        expect(evidence.records.map((record) => record.phase)).toEqual([
          "catalog",
          "publish",
          "publish",
          "verify"
        ])
      }))

    it.effect("preflights approval before any validation command", () =>
      Effect.gen(function*() {
        for (const approval of [
          ExecutionApproval.none,
          ExecutionApproval.make({ execute: true, approveIrreversible: false })
        ]) {
          const attempts: Array<number> = []
          const error = yield* runEvidenceWorkflow(workflowOperations, "release", approval, context).pipe(
            Effect.provide(retryProbeLayer(attempts, 1)),
            Effect.flip
          )
          expectTaggedError(error, "ExecutionApprovalError")
          expect(attempts).toEqual([])
        }
      }))
  })

  layer(baseLayer())((it) => {
    it.effect("never retries typed command or filesystem failures", () =>
      Effect.gen(function*() {
        let attempts = 0
        const error = yield* runOperationEvidence(npmVersionVerifyOperation(11), ExecutionApproval.none, context).pipe(
          Effect.provide(ReleaseCommandRunnerTestLayer({
            runCommand: () => Effect.gen(function*() {
              attempts += 1
              return yield* Effect.fail(CommandRunnerError.make({ operation: "probe", reason: "typed failure" }))
            })
          })),
          Effect.flip
        )
        expectTaggedError(error, "CommandRunnerError")
        expect(attempts).toBe(1)

        let writes = 0
        const writeError = yield* runOperationEvidence(
          Operation.make({ ...renderOperation, retry: RetryPolicy.make({ attempts: 11, delayMillis: 500 }) }),
          ExecutionApproval.make({ execute: true, approveIrreversible: false }),
          context
        ).pipe(Effect.provide(baseLayer({ directories: new Set(["."]), failWriteFileString: true, onWriteFileString: () => { writes += 1 } })), Effect.flip)
        expectTaggedError(writeError, "WorkspaceWriteError")
        expect(writes).toBe(1)
      }))
  })

  it.effect("retries stage failures and returns one final evidence record", () =>
    Effect.gen(function*() {
      const recovered = yield* runStageRetryProbe(3, 5_000)
      expect(recovered.times).toHaveLength(3)
      expect(recovered.evidence.status).toBe("passed")
      expect(recovered.evidence.outcome).toMatchObject({ _tag: "file", path: "dist/probe.zip" })

      const failed = yield* runStageRetryProbe(Infinity, 5_000)
      expect(failed.times).toHaveLength(11)
      expect(failed.evidence).toMatchObject({
        operationId: "stage:retry-probe",
        status: "failed",
        message: "typed failure",
        outcome: { _tag: "file", path: "dist/probe.zip" }
      })
    }))

  it.effect("maps a final failed attempt to OperationFailedError", () =>
    Effect.gen(function*() {
      const error = yield* runOperation(npmVersionVerifyOperation(1), ExecutionApproval.none, context).pipe(
        Effect.provide(retryProbeLayer([], Infinity)),
        Effect.flip
      )
      expectTaggedError(error, "OperationFailedError")
    }))

  it.effect("uses total attempts with exact 500ms fake Clock delays", () =>
    Effect.gen(function*() {
      for (const [attempts, expected] of [[undefined, 1], [1, 1], [2, 2], [11, 11]] as const) {
        const result = yield* runRetryProbe(npmVersionVerifyOperation(attempts), Infinity, 5_000)
        expect(result.times).toHaveLength(expected)
        expect(result.times.slice(1).map((time, index) => time - result.times[index]!)).toEqual(
          Array.from({ length: expected - 1 }, () => 500)
        )
        expect(result.evidence.status).toBe("failed")
      }
    }))

  it.effect("stops retrying early and records one final outcome", () =>
    Effect.gen(function*() {
      const result = yield* runRetryProbe(npmVersionVerifyOperation(11), 3, 5_000)
      expect(result.times).toHaveLength(3)
      expect(result.evidence.status).toBe("passed")
      const evidence = yield* runEvidenceWorkflow(
        [npmVersionVerifyOperation(1)],
        "verification",
        ExecutionApproval.none,
        context
      ).pipe(
        Effect.provide(retryProbeLayer([], 1))
      )
      expect(evidence.records.map((record) => [record.operationId, record.status])).toEqual([
        ["npm:npm-version-verify", "passed"]
      ])
    }))

  it.effect("preserves the exact accumulated evidence on every failing pass", () =>
    Effect.gen(function*() {
      const cases = [
        [workflowValidateCommand, "workflow-validate", ["workflow-render", "workflow-validate"], ["catalog", "publish"]],
        [workflowPublishCommand, "workflow-publish", ["workflow-render", "workflow-validate", "workflow-publish"], ["catalog", "publish", "publish"]],
        [workflowVerifyCommand, "workflow-verify", ["workflow-render", "workflow-validate", "workflow-publish", "workflow-verify"], ["catalog", "publish", "publish", "verify"]]
      ] as const
      for (const [command, operationId, operationIds, phases] of cases) {
        const error = yield* runEvidenceWorkflow(
          workflowOperations,
          "release",
          ExecutionApproval.make({ execute: true, approveIrreversible: true }),
          context
        ).pipe(
          Effect.provide(baseLayer({
            directories: new Set(["."]),
            commands: new Map([[commandKey(command), { exitCode: 1, stdout: "", stderr: "failed" }]])
          })),
          Effect.flip
        )
        expect(error._tag).toBe("OperationFailedError")
        if (error._tag === "OperationFailedError") {
          expect(error.operationId).toBe(operationId)
          expect(error.evidence?.records.map((record) => record.operationId)).toEqual([...operationIds])
          expect(error.evidence?.records.map((record) => record.phase)).toEqual([...phases])
        }
      }
    }))
})
