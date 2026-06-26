import { describe, expect, layer } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  CommandSpec,
  ExecutionApproval,
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
import { expectTaggedError, minimalConfig } from "./helpers.js"

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
        path: ".release/generated/workflow.txt",
        contents: "workflow\n"
      }),
      ValidateCommandOperation.make({
        id: "workflow-validate",
        description: "Validate workflow.",
        risk: "read-only",
        command: workflowValidateCommand
      }),
      PublishCommandOperation.make({
        id: "workflow-publish",
        targetId: "npm",
        description: "Publish workflow.",
        risk: "irreversible",
        command: workflowPublishCommand
      }),
      VerifyRemoteOperation.make({
        id: "workflow-verify",
        targetId: "npm",
        description: "Verify workflow.",
        risk: "read-only",
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
        command: npmVersionVerifyCommand
      })
    ]
  })
})

describe("execution approval", () => {
  layer(TestLayer)((it) => {
    it.effect("runs validation without publish approval", () =>
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        const plan = yield* createReleasePlan(intent)
        const evidence = yield* validatePlan(plan)

        expect(evidence.records.length).toBeGreaterThan(0)
        expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
      }))

    it.effect("blocks publish without execute approval", () =>
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        const plan = yield* createReleasePlan(intent)
        const error = yield* executePlan(plan, ExecutionApproval.none).pipe(Effect.flip)

        expectTaggedError(error, "ExecutionApprovalError")
      }))

    it.effect("blocks irreversible publish without irreversible approval", () =>
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        const plan = yield* createReleasePlan(intent)
        const error = yield* executePlan(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: false })
        ).pipe(Effect.flip)

        expectTaggedError(error, "ExecutionApprovalError")
      }))

    it.effect("blocks render operations without execute approval", () =>
      Effect.gen(function*() {
        const plan = yield* planWithRenderAndPublish
        const error = yield* renderPlan(plan, ExecutionApproval.none).pipe(Effect.flip)

        expectTaggedError(error, "ExecutionApprovalError")
      }))

    it.effect("runs render operations with execute approval", () =>
      Effect.gen(function*() {
        const plan = yield* planWithRenderAndPublish
        const evidence = yield* renderPlan(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: false })
        )

        expect(evidence.records.map((record) => record.id)).toEqual(["local:render-file:execution"])
      }))

    it.effect("does not run render operations during publish execution", () =>
      Effect.gen(function*() {
        const plan = yield* planWithRenderAndPublish
        const evidence = yield* executePlan(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: true })
        )

        expect(evidence.records.filter((record) => "operationId" in record).map((record) => record.operationId)).not.toContain(
          "local:render-file"
        )
        expect(evidence.records.every((record) => record.id !== "local:render-file:execution")).toBe(true)
      }))

    it.effect("runs approved release workflow in stage order", () =>
      Effect.gen(function*() {
        const plan = yield* planWithFullWorkflow
        const evidence = yield* runApprovedReleaseWorkflow(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: true })
        )

        expect(evidence.records.map((record) => record.id)).toEqual([
          "workflow-render:execution",
          "workflow-validate:command",
          "workflow-publish:command",
          "workflow-verify:command"
        ])
        expect(evidence.records.map((record) => record.phase)).toEqual([
          "render",
          "validation",
          "execution",
          "verification"
        ])
      }))

    it.effect("workflow fails before publishing without execute approval", () =>
      Effect.gen(function*() {
        const plan = yield* planWithFullWorkflow
        const error = yield* runApprovedReleaseWorkflow(plan, ExecutionApproval.none).pipe(Effect.flip)

        expectTaggedError(error, "ExecutionApprovalError")
      }))
  })

  layer(makeTestCommandRunnerLayer())((it) => {
    it.effect("blocks irreversible publish operations based on risk", () =>
      Effect.gen(function*() {
        const command = CommandSpec.make({
          executable: "npm",
          args: ["publish"],
          requiredEnv: [],
          redactedEnv: []
        })
        const operation = PublishCommandOperation.make({
          id: "malformed-publish",
          targetId: "npm",
          description: "Publish operation",
          risk: "irreversible",
          command
        })
        const error = yield* runOperation(operation, ExecutionApproval.none).pipe(Effect.flip)

        expectTaggedError(error, "ExecutionApprovalError")
      }))
  })

  layer(makeTestCommandRunnerLayer({
    commands: new Map([
      [commandKey(CommandSpec.make({
        executable: "tool",
        args: ["fail"],
        requiredEnv: [],
        redactedEnv: []
      })), {
        exitCode: 1,
        stdout: "",
        stderr: "failed"
      }]
    ])
  }))((it) => {
    it.effect("fails when a command exits nonzero", () =>
      Effect.gen(function*() {
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
          command
        })
        const error = yield* runOperation(operation, ExecutionApproval.none).pipe(Effect.flip)

        expectTaggedError(error, "OperationFailedError")
      }))
  })

  {
    let attempts = 0
    const RetryLayer = Layer.mergeAll(
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

    layer(RetryLayer, { excludeTestServices: true })((it) => {
      it.effect("retries npm version verification before recording success", () =>
        Effect.gen(function*() {
          const plan = yield* planWithNpmVersionVerification
          const evidence = yield* verifyPlan(plan)

          expect(attempts).toBe(3)
          expect(evidence.records.map((record) => record.id)).toEqual(["npm:npm-version-verify:command"])
          expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
        }))
    })
  }

  layer(Layer.mergeAll(
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
  ))((it) => {
    it.effect("workflow stops on validation failure before publish", () =>
      Effect.gen(function*() {
        const plan = yield* planWithFullWorkflow
        const error = yield* runApprovedReleaseWorkflow(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: true })
        ).pipe(Effect.flip)

        expect(error._tag).toBe("OperationFailedError")
        if (error._tag === "OperationFailedError") {
          expect(error.operationId).toBe("workflow-validate")
          expect(error.evidence?.records.map((record) => record.id)).toEqual([
            "workflow-render:execution",
            "workflow-validate:command"
          ])
          expect(error.evidence?.records.map((record) => record.phase)).toEqual(["render", "validation"])
        }
      }))
  })

  layer(Layer.mergeAll(
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
  ))((it) => {
    it.effect("workflow preserves render and validation evidence on publish failure", () =>
      Effect.gen(function*() {
        const plan = yield* planWithFullWorkflow
        const error = yield* runApprovedReleaseWorkflow(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: true })
        ).pipe(Effect.flip)

        expect(error._tag).toBe("OperationFailedError")
        if (error._tag === "OperationFailedError") {
          expect(error.operationId).toBe("workflow-publish")
          expect(error.evidence?.records.map((record) => record.id)).toEqual([
            "workflow-render:execution",
            "workflow-validate:command",
            "workflow-publish:command"
          ])
          expect(error.evidence?.records.map((record) => record.phase)).toEqual(["render", "validation", "execution"])
        }
      }))
  })

  layer(Layer.mergeAll(
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
  ))((it) => {
    it.effect("workflow preserves all completed evidence on verification failure", () =>
      Effect.gen(function*() {
        const plan = yield* planWithFullWorkflow
        const error = yield* runApprovedReleaseWorkflow(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: true })
        ).pipe(Effect.flip)

        expect(error._tag).toBe("OperationFailedError")
        if (error._tag === "OperationFailedError") {
          expect(error.operationId).toBe("workflow-verify")
          expect(error.evidence?.records.map((record) => record.id)).toEqual([
            "workflow-render:execution",
            "workflow-validate:command",
            "workflow-publish:command",
            "workflow-verify:command"
          ])
          expect(error.evidence?.records.map((record) => record.phase)).toEqual([
            "render",
            "validation",
            "execution",
            "verification"
          ])
        }
      }))
  })
})
