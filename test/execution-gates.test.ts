import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  CommandSpec,
  executeGate,
  ExecutionApproval,
  noApprovalGate,
  PublishCommandOperation,
  RenderFileOperation,
  ValidateCommandOperation
} from "../src/domain/operation.js"
import { ReleasePlan } from "../src/domain/release.js"
import { commandKey, makeTestReleaseHostLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { executePlan, renderPlan, runOperation, validatePlan } from "../src/planner/executor.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { minimalConfig, runEffect } from "./helpers.js"

const TestLayer = Layer.mergeAll(
  makeTestReleaseHostLayer({
    directories: new Set(["."]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  }),
  LiveTargetRegistryLayer
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
        Effect.provide(makeTestReleaseHostLayer())
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
        Effect.provide(makeTestReleaseHostLayer({
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
})
