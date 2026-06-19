import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  EvidenceBundle,
  ExecutionEvidence
} from "../src/domain/evidence.js"
import {
  CommandSpec,
  executeGate,
  ExecutionApproval,
  HttpEnvHeader,
  HttpHeader,
  HttpJsonArrayObjectFieldEqualsCheck,
  HttpJsonEqualsCheck,
  HttpRequestSpec,
  noApprovalGate,
  operationFingerprint,
  RenderFileOperation,
  ValidateCommandOperation,
  ValidationNoteOperation,
  VerifyHttpOperation
} from "../src/domain/operation.js"
import {
  PlannerMetadata,
  ReleaseIdentity,
  ReleasePlan,
  SourceMetadata
} from "../src/domain/release.js"
import { httpRequestKey, makeTestReleaseHttpLayer } from "../src/host/http.js"
import { commandKey, makeTestCommandRunnerLayer } from "../src/host/test.js"
import {
  mergeEvidenceBundles,
  readEvidenceBundle,
  redactText,
  renderEvidenceJson,
  tryReadEvidenceBundle,
  writeEvidenceBundle
} from "../src/planner/evidence-recorder.js"
import { runOperation } from "../src/planner/executor.js"
import { runEffect } from "./helpers.js"

const makePlan = (name: string = "release", version: string = "0.1.0"): ReleasePlan =>
  ReleasePlan.make({
    schemaVersion: "release-plan/v1",
    identity: ReleaseIdentity.make({
      name,
      version,
      commit: "abc123"
    }),
    source: SourceMetadata.make({
      root: "."
    }),
    artifacts: [],
    targets: [],
    targetCapabilities: [],
    operations: [],
    evidenceDirectory: ".release/evidence",
    metadata: PlannerMetadata.make({
      createdBy: "test",
      planSchemaVersion: "release-plan/v1"
    })
  })

const evidenceRecord = (operationId: string) =>
  ExecutionEvidence.make({
    id: `${operationId}:execution`,
    operationId,
    operationFingerprint: `${operationId}:fingerprint`,
    status: "passed",
    severity: "info",
    message: "ok",
    timestamp: "2026-06-17T00:00:00.000Z"
  })

const evidenceBundle = (
  plan: ReleasePlan,
  records: EvidenceBundle["records"] = []
): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: "release-evidence/v1",
    releaseName: plan.identity.name,
    releaseVersion: plan.identity.version,
    records
  })

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
    const layer = makeTestCommandRunnerLayer({
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
      expect(evidence.operationFingerprint).toBe(operationFingerprint(operation))
      expect(evidence.operationFingerprint).not.toContain("super_secret")
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
      makeTestCommandRunnerLayer({ env: new Map([["TOKEN", "super_secret"]]) }),
      makeTestReleaseHttpLayer({
        responses: new Map([
          [httpRequestKey(request), {
            status: 200,
            responseHeaders: [
              HttpHeader.make({
                name: "Link",
                value: "<https://api.github.com/repos/owner/repo/releases?per_page=100&page=2>; rel=\"next\""
              })
            ],
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
    expect("operationFingerprint" in evidence && evidence.operationFingerprint).toBe(operationFingerprint(operation))
    expect("responseHeaders" in evidence).toBe(false)
  })

  test("records fingerprints for render and validation-note evidence", async () => {
    const renderOperation = RenderFileOperation.make({
      id: "render-readme",
      description: "Render README.",
      risk: "writes-local",
      gate: executeGate("Rendering writes a local file."),
      path: ".release/generated/readme.md",
      contents: "# Release\n"
    })
    const validationOperation = ValidationNoteOperation.make({
      id: "validate-note",
      description: "Record validation note.",
      risk: "read-only",
      gate: noApprovalGate("read-only"),
      message: "No local validation command is configured.",
      skipped: true,
      severity: "info"
    })
    const layer = makeTestCommandRunnerLayer({ directories: new Set(["."]) })

    const renderEvidence = await runEffect(
      runOperation(
        renderOperation,
        ExecutionApproval.make({ execute: true, approveIrreversible: false })
      ),
      layer
    )
    const validationEvidence = await runEffect(
      runOperation(validationOperation, ExecutionApproval.none),
      layer
    )

    expect("operationFingerprint" in renderEvidence && renderEvidence.operationFingerprint).toBe(
      operationFingerprint(renderOperation)
    )
    expect("operationFingerprint" in renderEvidence && renderEvidence.operationFingerprint).not.toContain("# Release")
    expect("operationFingerprint" in renderEvidence && renderEvidence.operationFingerprint).toContain("contentsDigest")
    expect("operationFingerprint" in validationEvidence && validationEvidence.operationFingerprint).toBe(
      operationFingerprint(validationOperation)
    )
  })

  test("rejects render writes outside the workspace root", async () => {
    const operation = RenderFileOperation.make({
      id: "render-outside",
      description: "Render outside.",
      risk: "writes-local",
      gate: executeGate("Rendering writes a local file."),
      path: "../outside.md",
      contents: "# Release\n"
    })
    const error = await runEffect(
      runOperation(
        operation,
        ExecutionApproval.make({ execute: true, approveIrreversible: false })
      ).pipe(Effect.flip),
      makeTestCommandRunnerLayer({ directories: new Set(["."]) })
    )

    expect(error._tag).toBe("WorkspaceWriteError")
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
      makeTestCommandRunnerLayer(),
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

  test("reads a valid evidence bundle", async () => {
    const plan = makePlan()
    const bundle = evidenceBundle(plan)
    const read = await runEffect(
      readEvidenceBundle(".release/evidence/render.json"),
      makeTestCommandRunnerLayer({
        files: new Map([
          [".release/evidence/render.json", renderEvidenceJson(bundle)]
        ])
      })
    )

    expect(read.releaseName).toBe("release")
    expect(read.records).toEqual([])
  })

  test("returns undefined for missing optional evidence", async () => {
    const read = await runEffect(
      tryReadEvidenceBundle(".release/evidence/render.json"),
      makeTestCommandRunnerLayer()
    )

    expect(read).toBeUndefined()
  })

  test("fails invalid evidence JSON with EvidenceReadError", async () => {
    const error = await runEffect(
      readEvidenceBundle(".release/evidence/render.json").pipe(Effect.flip),
      makeTestCommandRunnerLayer({
        files: new Map([
          [".release/evidence/render.json", "{not json"]
        ])
      })
    )

    expect(error._tag).toBe("EvidenceReadError")
  })

  test("fails wrong evidence schema with EvidenceReadError", async () => {
    const error = await runEffect(
      readEvidenceBundle(".release/evidence/render.json").pipe(Effect.flip),
      makeTestCommandRunnerLayer({
        files: new Map([
          [".release/evidence/render.json", JSON.stringify({ schemaVersion: "wrong" })]
        ])
      })
    )

    expect(error._tag).toBe("EvidenceReadError")
  })

  test("fails command evidence without operation fingerprints", async () => {
    const rawEvidence = {
      schemaVersion: "release-evidence/v1",
      releaseName: "release",
      releaseVersion: "0.1.0",
      records: [
        {
          id: "validate-token:command",
          operationId: "validate-token",
          status: "passed",
          severity: "info",
          command: {
            executable: "tool",
            args: ["validate"],
            requiredEnv: [],
            redactedEnv: []
          },
          exitCode: 0,
          stdout: "",
          stderr: "",
          startedAt: "2026-06-17T00:00:00.000Z",
          endedAt: "2026-06-17T00:00:00.001Z",
          durationMillis: 1
        }
      ]
    }
    const error = await runEffect(
      readEvidenceBundle(".release/evidence/validation.json").pipe(Effect.flip),
      makeTestCommandRunnerLayer({
        files: new Map([
          [".release/evidence/validation.json", `${JSON.stringify(rawEvidence)}\n`]
        ])
      })
    )

    expect(error._tag).toBe("EvidenceReadError")
  })

  test("rejects evidence writes outside the workspace root", async () => {
    const plan = makePlan()
    const error = await runEffect(
      writeEvidenceBundle("../outside.json", evidenceBundle(plan), ".").pipe(Effect.flip),
      makeTestCommandRunnerLayer({ directories: new Set(["."]) })
    )

    expect(error._tag).toBe("EvidenceWriteError")
  })

  test("merges evidence bundles in order", async () => {
    const plan = makePlan()
    const merged = await runEffect(
      mergeEvidenceBundles(
        plan,
        evidenceBundle(plan, [evidenceRecord("first")]),
        evidenceBundle(plan, [evidenceRecord("second")])
      ),
      makeTestCommandRunnerLayer()
    )

    expect(merged.records.map((record) => record.id)).toEqual(["first:execution", "second:execution"])
  })

  test("rejects merging evidence from another release", async () => {
    const plan = makePlan()
    const error = await runEffect(
      mergeEvidenceBundles(
        plan,
        evidenceBundle(plan),
        evidenceBundle(makePlan("other", "9.9.9"))
      ).pipe(Effect.flip),
      makeTestCommandRunnerLayer()
    )

    expect(error._tag).toBe("EvidenceReadError")
  })
})
