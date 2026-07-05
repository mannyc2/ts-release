import { describe, expect, layer } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  CommandAction,
  CommandSpec,
  ExecutionApproval,
  Operation,
  RetryPolicy,
  WriteFileAction
} from "../src/pipeline/operation.js"
import { ReleaseIdentity } from "../src/pipeline/state.js"
import { CommandResult } from "../src/host/host.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import { commandKey, makeTestCommandRunnerLayer, ReleaseCommandRunnerTestLayer } from "./host-fakes.js"
import {
  executeOperations,
  runApprovedReleaseWorkflow,
  runOperation,
  validateOperations,
  verifyOperations,
  writeRenderFiles
} from "../src/engine/executor.js"
import { planReleaseFromIntent } from "../src/engine/engine.js"
import { UnsupportedArtifactStagerLayer } from "../src/engine/stager.js"
import { expectTaggedError, minimalConfig, TestGitHubApiLayer } from "./helpers.js"

const releaseIdentity = ReleaseIdentity.make({
  name: "release",
  normalizedName: "release",
  version: "0.1.0",
  tag: "v0.1.0",
  commit: "abc123",
  shortCommit: "abc123",
  versionSource: "test",
  snapshot: false
})

const context = {
  root: ".",
  identity: releaseIdentity,
  notices: []
}

const baseLayer = (options: Parameters<typeof makeTestCommandRunnerLayer>[0] = {}) =>
  Layer.mergeAll(
    makeTestCommandRunnerLayer(options),
    makeTestReleaseHttpLayer(),
    TestGitHubApiLayer,
    UnsupportedArtifactStagerLayer,
    BunServices.layer
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
    return yield* planReleaseFromIntent(intent, { root: "." })
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

const npmVersionVerifyOperation = Operation.make({
  id: "npm:npm-version-verify",
  pipeId: "publish:npm",
  phase: "verify",
  risk: "read-only",
  description: "Verify npm package version.",
  action: CommandAction.make({ command: npmVersionVerifyCommand }),
  retry: RetryPolicy.make({ attempts: 11, delayMillis: 500 })
})

describe("execution approval", () => {
  layer(TestLayer)((it) => {
    it.effect("runs validation without publish approval", () =>
      Effect.gen(function*() {
        const plan = yield* planFromConfig(minimalConfig)
        const evidence = yield* validateOperations(plan.state.operations, {
          root: plan.source.root,
          identity: plan.state.identity,
          notices: plan.state.notices
        })

        expect(evidence.records.length).toBeGreaterThan(0)
        expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
      }))

    it.effect("blocks publish without execute approval", () =>
      Effect.gen(function*() {
        const plan = yield* planFromConfig(minimalConfig)
        const error = yield* executeOperations(plan.state.operations, ExecutionApproval.none, {
          root: plan.source.root,
          identity: plan.state.identity,
          notices: plan.state.notices
        }).pipe(Effect.flip)

        expectTaggedError(error, "ExecutionApprovalError")
      }))

    it.effect("blocks irreversible publish without irreversible approval", () =>
      Effect.gen(function*() {
        const plan = yield* planFromConfig(minimalConfig)
        const error = yield* executeOperations(
          plan.state.operations,
          ExecutionApproval.make({ execute: true, approveIrreversible: false }),
          {
            root: plan.source.root,
            identity: plan.state.identity,
            notices: plan.state.notices
          }
        ).pipe(Effect.flip)

        expectTaggedError(error, "ExecutionApprovalError")
      }))

    it.effect("blocks render operations without execute approval", () =>
      Effect.gen(function*() {
        const error = yield* writeRenderFiles(renderAndPublishOperations, ExecutionApproval.none, context).pipe(
          Effect.flip
        )

        expectTaggedError(error, "ExecutionApprovalError")
      }))

    it.effect("runs render operations with execute approval", () =>
      Effect.gen(function*() {
        const evidence = yield* writeRenderFiles(
          renderAndPublishOperations,
          ExecutionApproval.make({ execute: true, approveIrreversible: false }),
          context
        )

        expect(evidence.records.map((record) => record.operationId)).toEqual(["local:render-file"])
      }))

    it.effect("does not run render operations during publish execution", () =>
      Effect.gen(function*() {
        const evidence = yield* executeOperations(
          renderAndPublishOperations,
          ExecutionApproval.make({ execute: true, approveIrreversible: true }),
          context
        )

        expect(evidence.records.map((record) => record.operationId)).not.toContain("local:render-file")
      }))

    it.effect("runs approved release workflow in stage order", () =>
      Effect.gen(function*() {
        const evidence = yield* runApprovedReleaseWorkflow(
          workflowOperations,
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

    it.effect("workflow fails before publishing without execute approval", () =>
      Effect.gen(function*() {
        const error = yield* runApprovedReleaseWorkflow(workflowOperations, ExecutionApproval.none, context).pipe(
          Effect.flip
        )

        expectTaggedError(error, "ExecutionApprovalError")
      }))
  })

  layer(baseLayer())((it) => {
    it.effect("blocks irreversible publish operations based on risk", () =>
      Effect.gen(function*() {
        const command = CommandSpec.make({
          executable: "npm",
          args: ["publish"],
          requiredEnv: [],
          redactedEnv: []
        })
        const operation = commandOperation("malformed-publish", "publish", "irreversible", command)
        const error = yield* runOperation(operation, ExecutionApproval.none, context).pipe(Effect.flip)

        expectTaggedError(error, "ExecutionApprovalError")
      }))
  })

  layer(baseLayer({
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
        const operation = commandOperation("validate-fail", "publish", "read-only", command)
        const error = yield* runOperation(operation, ExecutionApproval.none, context).pipe(Effect.flip)

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
      TestGitHubApiLayer,
      UnsupportedArtifactStagerLayer,
      BunServices.layer
    )

    layer(RetryLayer, { excludeTestServices: true })((it) => {
      it.effect("retries npm version verification before recording success", () =>
        Effect.gen(function*() {
          attempts = 0
          const evidence = yield* verifyOperations([npmVersionVerifyOperation], context)

          expect(attempts).toBe(3)
          expect(evidence.records.map((record) => record.operationId)).toEqual(["npm:npm-version-verify"])
          expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
        }))
    })
  }

  layer(baseLayer({
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
  }))((it) => {
    it.effect("workflow stops on validation failure before publish", () =>
      Effect.gen(function*() {
        const error = yield* runApprovedReleaseWorkflow(
          workflowOperations,
          ExecutionApproval.make({ execute: true, approveIrreversible: true }),
          context
        ).pipe(Effect.flip)

        expect(error._tag).toBe("OperationFailedError")
        if (error._tag === "OperationFailedError") {
          expect(error.operationId).toBe("workflow-validate")
          expect(error.evidence?.records.map((record) => record.operationId)).toEqual([
            "workflow-render",
            "workflow-validate"
          ])
          expect(error.evidence?.records.map((record) => record.phase)).toEqual(["catalog", "publish"])
        }
      }))
  })

  layer(baseLayer({
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
  }))((it) => {
    it.effect("workflow preserves render and validation evidence on publish failure", () =>
      Effect.gen(function*() {
        const error = yield* runApprovedReleaseWorkflow(
          workflowOperations,
          ExecutionApproval.make({ execute: true, approveIrreversible: true }),
          context
        ).pipe(Effect.flip)

        expect(error._tag).toBe("OperationFailedError")
        if (error._tag === "OperationFailedError") {
          expect(error.operationId).toBe("workflow-publish")
          expect(error.evidence?.records.map((record) => record.operationId)).toEqual([
            "workflow-render",
            "workflow-validate",
            "workflow-publish"
          ])
          expect(error.evidence?.records.map((record) => record.phase)).toEqual(["catalog", "publish", "publish"])
        }
      }))
  })

  layer(baseLayer({
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
  }))((it) => {
    it.effect("workflow preserves all completed evidence on verification failure", () =>
      Effect.gen(function*() {
        const error = yield* runApprovedReleaseWorkflow(
          workflowOperations,
          ExecutionApproval.make({ execute: true, approveIrreversible: true }),
          context
        ).pipe(Effect.flip)

        expect(error._tag).toBe("OperationFailedError")
        if (error._tag === "OperationFailedError") {
          expect(error.operationId).toBe("workflow-verify")
          expect(error.evidence?.records.map((record) => record.operationId)).toEqual([
            "workflow-render",
            "workflow-validate",
            "workflow-publish",
            "workflow-verify"
          ])
          expect(error.evidence?.records.map((record) => record.phase)).toEqual([
            "catalog",
            "publish",
            "publish",
            "verify"
          ])
        }
      }))
  })
})
