import { describe, expect, test } from "bun:test"
import {
  CommandSpec,
  ExecutionApproval,
  noApprovalGate,
  ValidateCommandOperation
} from "../src/domain/operation.js"
import { commandKey, makeTestReleaseHostLayer } from "../src/host/test.js"
import { redactText } from "../src/planner/evidence-recorder.js"
import { runOperation } from "../src/planner/executor.js"
import { runEffect } from "./helpers.js"

describe("evidence recorder", () => {
  test("redacts known secret values", () => {
    expect(redactText("token npm_secret leaked", ["npm_secret"])).toBe("token [REDACTED] leaked")
  })

  test("does not alter text when the secret is empty", () => {
    expect(redactText("plain output", [""])).toBe("plain output")
  })

  test("redacts command output through the shared executor", async () => {
    const command = CommandSpec.make({
      executable: "tool",
      args: ["validate"],
      requiredEnv: ["TOKEN"],
      redactedEnv: ["TOKEN"]
    })
    const operation = ValidateCommandOperation.make({
      id: "validate-token",
      description: "Validate token handling.",
      risk: "read-only",
      gate: noApprovalGate("read-only"),
      command
    })
    const layer = makeTestReleaseHostLayer({
      env: new Map([["TOKEN", "super_secret"]]),
      commands: new Map([
        [commandKey(command), {
          exitCode: 0,
          stdout: "stdout super_secret",
          stderr: "stderr super_secret"
        }]
      ])
    })

    const evidence = await runEffect(runOperation(operation, ExecutionApproval.none), layer)
    expect("stdout" in evidence && "stderr" in evidence).toBe(true)
    if ("stdout" in evidence && "stderr" in evidence) {
      expect(evidence.stdout).toBe("stdout [REDACTED]")
      expect(evidence.stderr).toBe("stderr [REDACTED]")
    }
  })
})
