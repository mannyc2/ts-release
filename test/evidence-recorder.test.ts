import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  CommandSpec,
  ExecutionApproval,
  HttpEnvHeader,
  HttpHeader,
  HttpJsonArrayObjectFieldEqualsCheck,
  HttpJsonEqualsCheck,
  HttpRequestSpec,
  noApprovalGate,
  ValidateCommandOperation,
  VerifyHttpOperation
} from "../src/domain/operation.js"
import { httpRequestKey, makeTestReleaseHttpLayer } from "../src/host/http.js"
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

  test("evaluates HTTP verification evidence through the shared executor", async () => {
    const request = HttpRequestSpec.make({
      method: "GET",
      url: "https://api.github.com/repos/owner/repo/releases/tags/v0.1.0",
      headers: [HttpHeader.make({ name: "Accept", value: "application/vnd.github+json" })],
      envHeaders: [HttpEnvHeader.make({ name: "Authorization", valueEnv: "TOKEN", prefix: "Bearer " })],
      requiredEnv: ["TOKEN"],
      redactedEnv: ["TOKEN"]
    })
    const operation = VerifyHttpOperation.make({
      id: "github:github-release-verify-http",
      targetId: "github",
      description: "Verify release.",
      risk: "read-only",
      gate: noApprovalGate("read-only"),
      request,
      expectedStatus: 200,
      checks: [
        HttpJsonEqualsCheck.make({ path: ["tag_name"], expected: "v0.1.0" }),
        HttpJsonArrayObjectFieldEqualsCheck.make({ path: ["assets"], field: "name", expected: "package.tgz" })
      ]
    })
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({ env: new Map([["TOKEN", "super_secret"]]) }),
      makeTestReleaseHttpLayer({
        responses: new Map([
          [httpRequestKey(request), {
            status: 200,
            json: {
              tag_name: "v0.1.0",
              assets: [{ name: "package.tgz" }]
            }
          }]
        ])
      })
    )

    const evidence = await runEffect(runOperation(operation, ExecutionApproval.none), layer)

    expect("responseStatus" in evidence && evidence.responseStatus).toBe(200)
    expect("checks" in evidence && evidence.checks.every((check) => check.passed)).toBe(true)
  })

  test("fails HTTP verification when JSON checks do not match", async () => {
    const request = HttpRequestSpec.make({
      method: "GET",
      url: "https://api.github.com/repos/owner/repo/releases/tags/v0.1.0",
      headers: [],
      envHeaders: [],
      requiredEnv: [],
      redactedEnv: []
    })
    const operation = VerifyHttpOperation.make({
      id: "github:github-release-verify-http",
      targetId: "github",
      description: "Verify release.",
      risk: "read-only",
      gate: noApprovalGate("read-only"),
      request,
      expectedStatus: 200,
      checks: [
        HttpJsonEqualsCheck.make({ path: ["draft"], expected: true })
      ]
    })
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer(),
      makeTestReleaseHttpLayer({
        responses: new Map([
          [httpRequestKey(request), {
            status: 200,
            json: { draft: false }
          }]
        ])
      })
    )

    const error = await runEffect(runOperation(operation, ExecutionApproval.none).pipe(Effect.flip), layer)

    expect(error._tag).toBe("OperationFailedError")
    if (error._tag === "OperationFailedError") {
      expect(error.responseStatus).toBe(200)
      expect(error.reason).toBe("HTTP verification failed.")
    }
  })
})
