import { describe, expect, test } from "bun:test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  CommandSpec,
  executeGate,
  ExecutionApproval,
  irreversibleGate,
  noApprovalGate,
  PublishCommandOperation,
  RenderFileOperation,
  ValidateCommandOperation,
  VerifyRemoteOperation
} from "../src/domain/operation.js"
import { ReleasePlan } from "../src/domain/release.js"
import { CommandResult, ReleaseCommandRunnerTestLayer } from "../src/host/host.js"
import { makeTestReleaseHttpLayer } from "../src/host/http.js"
import { commandKey, makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import {
  executePlan,
  renderPlan,
  runApprovedReleaseWorkflow,
  runOperation,
  validatePlan,
  verifyPlan
} from "../src/planner/executor.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { minimalConfig, runEffect } from "./helpers.js"

const TestLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    directories: new Set(["."]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  }),
  makeTestReleaseHttpLayer(),
  LiveTargetRegistryLayer,
  BunServices.layer
)

const planWithRenderAndPublish = Effect.gen(function*() {
  const intent = yield* parseReleaseIntent(minimalConfig)
  const plan = yield* createReleasePlan(intent)
  const publish = plan.operations.find((operation) => operation._tag === "PublishCommandOperation")
  if (publish?._tag !== "PublishCommandOperation") {
    return yield* Effect.die("expected publish operation in minimal config")
  }
  return ReleasePlan.make({
    schemaVersion: plan.schemaVersion,
    identity: plan.identity,
    source: plan.source,
    artifacts: plan.artifacts,
    targets: plan.targets,
    targetCapabilities: plan.targetCapabilities,
    evidenceDirectory: plan.evidenceDirectory,
    metadata: plan.metadata,
    operations: [
      RenderFileOperation.make({
        id: "local:render-file",
        description: "Render generated file.",
        risk: "writes-local",
        gate: executeGate("Rendering writes a local generated file."),
        path: ".release/generated/file.txt",
        contents: "generated\n"
      }),
      publish
    ]
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

const planWithFullWorkflow = Effect.gen(function*() {
  const intent = yield* parseReleaseIntent(minimalConfig)
  const plan = yield* createReleasePlan(intent)
  return ReleasePlan.make({
    schemaVersion: plan.schemaVersion,
    identity: plan.identity,
    source: plan.source,
    artifacts: plan.artifacts,
    targets: plan.targets,
    targetCapabilities: plan.targetCapabilities,
    evidenceDirectory: plan.evidenceDirectory,
    metadata: plan.metadata,
    operations: [
      RenderFileOperation.make({
        id: "workflow-render",
        description: "Render workflow file.",
        risk: "writes-local",
        gate: executeGate("Rendering writes a local generated file."),
        path: ".release/generated/workflow.txt",
        contents: "workflow\n"
      }),
      ValidateCommandOperation.make({
        id: "workflow-validate",
        description: "Validate workflow.",
        risk: "read-only",
        gate: noApprovalGate("read-only"),
        command: workflowValidateCommand
      }),
      PublishCommandOperation.make({
        id: "workflow-publish",
        targetId: "npm",
        description: "Publish workflow.",
        risk: "irreversible",
        gate: irreversibleGate("irreversible"),
        command: workflowPublishCommand
      }),
      VerifyRemoteOperation.make({
        id: "workflow-verify",
        targetId: "npm",
        description: "Verify workflow.",
        risk: "read-only",
        gate: noApprovalGate("read-only"),
        command: workflowVerifyCommand
      })
    ]
  })
})

const planWithNpmVersionVerification = Effect.gen(function*() {
  const intent = yield* parseReleaseIntent(minimalConfig)
  const plan = yield* createReleasePlan(intent)
  return ReleasePlan.make({
    schemaVersion: plan.schemaVersion,
    identity: plan.identity,
    source: plan.source,
    artifacts: plan.artifacts,
    targets: plan.targets,
    targetCapabilities: plan.targetCapabilities,
    evidenceDirectory: plan.evidenceDirectory,
    metadata: plan.metadata,
    operations: [
      VerifyRemoteOperation.make({
        id: "npm:npm-version-verify",
        targetId: "npm",
        description: "Verify npm package version.",
        risk: "read-only",
        gate: noApprovalGate("read-only"),
        command: npmVersionVerifyCommand
      })
    ]
  })
})

describe("execution gates", () => {
  test("runs validation without publish approval", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        const plan = yield* createReleasePlan(intent)
        return yield* validatePlan(plan)
      }),
      TestLayer
    )

    expect(evidence.records.length).toBeGreaterThan(0)
    expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
  })

  test("blocks publish without execute approval", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        const plan = yield* createReleasePlan(intent)
        return yield* executePlan(plan, ExecutionApproval.none)
      }).pipe(Effect.provide(TestLayer))
    )

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ExecutionApprovalError")
    }
  })

  test("blocks irreversible publish without irreversible approval", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        const plan = yield* createReleasePlan(intent)
        return yield* executePlan(plan, ExecutionApproval.make({ execute: true, approveIrreversible: false }))
      }).pipe(Effect.provide(TestLayer))
    )

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ExecutionApprovalError")
    }
  })

  test("blocks malformed publish operations even when the gate is too weak", async () => {
    const command = CommandSpec.make({
      executable: "npm",
      args: ["publish"],
      requiredEnv: [],
      redactedEnv: []
    })
    const operation = PublishCommandOperation.make({
      id: "malformed-publish",
      targetId: "npm",
      description: "Malformed publish",
      risk: "irreversible",
      gate: noApprovalGate("bad adapter metadata"),
      command
    })
    const exit = await Effect.runPromiseExit(
      runOperation(operation, ExecutionApproval.none).pipe(
        Effect.provide(makeTestCommandRunnerLayer())
      )
    )
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ExecutionApprovalError")
    }
  })

  test("blocks render operations without execute approval", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function*() {
        const plan = yield* planWithRenderAndPublish
        return yield* renderPlan(plan, ExecutionApproval.none)
      }).pipe(Effect.provide(TestLayer))
    )
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ExecutionApprovalError")
    }
  })

  test("runs render operations with execute approval", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* planWithRenderAndPublish
        return yield* renderPlan(plan, ExecutionApproval.make({ execute: true, approveIrreversible: false }))
      }),
      TestLayer
    )

    expect(evidence.records.map((record) => record.id)).toEqual(["local:render-file:execution"])
  })

  test("does not run render operations during publish execution", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* planWithRenderAndPublish
        return yield* executePlan(plan, ExecutionApproval.make({ execute: true, approveIrreversible: true }))
      }),
      TestLayer
    )

    expect(evidence.records.filter((record) => "operationId" in record).map((record) => record.operationId)).not.toContain(
      "local:render-file"
    )
    expect(evidence.records.every((record) => record.id !== "local:render-file:execution")).toBe(true)
  })

  test("fails when a command exits nonzero", async () => {
    const command = CommandSpec.make({
      executable: "tool",
      args: ["fail"],
      requiredEnv: [],
      redactedEnv: []
    })
    const operation = ValidateCommandOperation.make({
      id: "validate-fail",
      description: "Failing validator",
      risk: "read-only",
      gate: noApprovalGate("read-only"),
      command
    })
    const exit = await Effect.runPromiseExit(
      runOperation(operation, ExecutionApproval.none).pipe(
        Effect.provide(makeTestCommandRunnerLayer({
          commands: new Map([
            [commandKey(command), {
              exitCode: 1,
              stdout: "",
              stderr: "failed"
            }]
          ])
        }))
      )
    )
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("OperationFailedError")
    }
  })

  test("runs approved release workflow in stage order", async () => {
    const layer = Layer.mergeAll(
      makeTestCommandRunnerLayer({
        directories: new Set(["."]),
        env: new Map([
          ["NPM_TOKEN", "npm_secret"],
          ["GH_TOKEN", "gh_secret"]
        ])
      }),
      makeTestReleaseHttpLayer(),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* planWithFullWorkflow
        return yield* runApprovedReleaseWorkflow(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: true })
        )
      }),
      layer
    )

    expect(evidence.render.records.map((record) => record.id)).toEqual(["workflow-render:execution"])
    expect(evidence.validation.records.map((record) => record.id)).toEqual(["workflow-validate:command"])
    expect(evidence.execution.records.map((record) => record.id)).toEqual(["workflow-publish:command"])
    expect(evidence.verification.records.map((record) => record.id)).toEqual(["workflow-verify:command"])
  })

  test("retries npm version verification before recording success", async () => {
    let attempts = 0
    const layer = Layer.mergeAll(
      ReleaseCommandRunnerTestLayer({
        runCommand: (command) =>
          Effect.sync(() => {
            const isNpmVersionVerify = commandKey(command) === commandKey(npmVersionVerifyCommand)
            if (isNpmVersionVerify) {
              attempts += 1
            }
            const failed = isNpmVersionVerify && attempts < 3
            return CommandResult.make({
              command,
              exitCode: failed ? 1 : 0,
              stdout: failed ? "" : "0.1.0\n",
              stderr: failed ? "npm ERR! code E404\nnpm ERR! No match found for version 0.1.0" : "",
              startedAt: `2026-06-16T00:00:0${attempts}.000Z`,
              endedAt: `2026-06-16T00:00:0${attempts}.000Z`,
              durationMillis: 0
            })
          })
      }),
      makeTestReleaseHttpLayer(),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* planWithNpmVersionVerification
        return yield* verifyPlan(plan)
      }),
      layer
    )

    expect(attempts).toBe(3)
    expect(evidence.records.map((record) => record.id)).toEqual(["npm:npm-version-verify:command"])
    expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
  })

  test("workflow fails before publishing without execute approval", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function*() {
        const plan = yield* planWithFullWorkflow
        return yield* runApprovedReleaseWorkflow(plan, ExecutionApproval.none)
      }).pipe(Effect.provide(TestLayer))
    )

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ExecutionApprovalError")
    }
  })

  test("workflow stops on validation failure before publish", async () => {
    const layer = Layer.mergeAll(
      makeTestCommandRunnerLayer({
        directories: new Set(["."]),
        env: new Map([
          ["NPM_TOKEN", "npm_secret"],
          ["GH_TOKEN", "gh_secret"]
        ]),
        commands: new Map([
          [commandKey(workflowValidateCommand), {
            exitCode: 1,
            stdout: "",
            stderr: "validation failed"
          }],
          [commandKey(workflowPublishCommand), {
            exitCode: 1,
            stdout: "",
            stderr: "publish should not run"
          }]
        ])
      }),
      makeTestReleaseHttpLayer(),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    const error = await runEffect(
      Effect.gen(function*() {
        const plan = yield* planWithFullWorkflow
        return yield* runApprovedReleaseWorkflow(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: true })
        )
      }).pipe(Effect.flip),
      layer
    )

    expect(error._tag).toBe("OperationFailedError")
    if (error._tag === "OperationFailedError") {
      expect(error.operationId).toBe("workflow-validate")
      expect(error.evidence?.records.map((record) => record.id)).toEqual(["workflow-validate:command"])
      expect(error.workflowEvidence?.render?.records.map((record) => record.id)).toEqual(["workflow-render:execution"])
      expect(error.workflowEvidence?.validation?.records.map((record) => record.id)).toEqual([
        "workflow-validate:command"
      ])
      expect(error.workflowEvidence?.execution).toBeUndefined()
      expect(error.workflowEvidence?.verification).toBeUndefined()
    }
  })

  test("workflow preserves render and validation evidence on publish failure", async () => {
    const layer = Layer.mergeAll(
      makeTestCommandRunnerLayer({
        directories: new Set(["."]),
        env: new Map([
          ["NPM_TOKEN", "npm_secret"],
          ["GH_TOKEN", "gh_secret"]
        ]),
        commands: new Map([
          [commandKey(workflowPublishCommand), {
            exitCode: 1,
            stdout: "",
            stderr: "publish failed"
          }],
          [commandKey(workflowVerifyCommand), {
            exitCode: 1,
            stdout: "",
            stderr: "verify should not run"
          }]
        ])
      }),
      makeTestReleaseHttpLayer(),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    const error = await runEffect(
      Effect.gen(function*() {
        const plan = yield* planWithFullWorkflow
        return yield* runApprovedReleaseWorkflow(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: true })
        )
      }).pipe(Effect.flip),
      layer
    )

    expect(error._tag).toBe("OperationFailedError")
    if (error._tag === "OperationFailedError") {
      expect(error.operationId).toBe("workflow-publish")
      expect(error.evidence?.records.map((record) => record.id)).toEqual(["workflow-publish:command"])
      expect(error.workflowEvidence?.render?.records.map((record) => record.id)).toEqual(["workflow-render:execution"])
      expect(error.workflowEvidence?.validation?.records.map((record) => record.id)).toEqual([
        "workflow-validate:command"
      ])
      expect(error.workflowEvidence?.execution?.records.map((record) => record.id)).toEqual([
        "workflow-publish:command"
      ])
      expect(error.workflowEvidence?.verification).toBeUndefined()
    }
  })

  test("workflow preserves all completed evidence on verification failure", async () => {
    const layer = Layer.mergeAll(
      makeTestCommandRunnerLayer({
        directories: new Set(["."]),
        env: new Map([
          ["NPM_TOKEN", "npm_secret"],
          ["GH_TOKEN", "gh_secret"]
        ]),
        commands: new Map([
          [commandKey(workflowVerifyCommand), {
            exitCode: 1,
            stdout: "",
            stderr: "verify failed"
          }]
        ])
      }),
      makeTestReleaseHttpLayer(),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    const error = await runEffect(
      Effect.gen(function*() {
        const plan = yield* planWithFullWorkflow
        return yield* runApprovedReleaseWorkflow(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: true })
        )
      }).pipe(Effect.flip),
      layer
    )

    expect(error._tag).toBe("OperationFailedError")
    if (error._tag === "OperationFailedError") {
      expect(error.operationId).toBe("workflow-verify")
      expect(error.evidence?.records.map((record) => record.id)).toEqual(["workflow-verify:command"])
      expect(error.workflowEvidence?.render?.records.map((record) => record.id)).toEqual(["workflow-render:execution"])
      expect(error.workflowEvidence?.validation?.records.map((record) => record.id)).toEqual([
        "workflow-validate:command"
      ])
      expect(error.workflowEvidence?.execution?.records.map((record) => record.id)).toEqual([
        "workflow-publish:command"
      ])
      expect(error.workflowEvidence?.verification?.records.map((record) => record.id)).toEqual([
        "workflow-verify:command"
      ])
    }
  })
})
