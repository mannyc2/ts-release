import { describe, expect, layer, test } from "@effect/bun-test"
import * as BunPath from "@effect/platform-bun/BunPath"
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

const makeWorkspaceTestCommandRunnerLayer = (
  options: Parameters<typeof makeTestCommandRunnerLayer>[0] = {}
) =>
  makeTestCommandRunnerLayer({
    pathLayer: BunPath.layer,
    ...options
  })

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

  {
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

    layer(makeWorkspaceTestCommandRunnerLayer({
      env: new Map([["TOKEN", "super_secret"]]),
      commands: new Map([
        [commandKey(command), {
          exitCode: 0,
          stdout: "stdout super_secret",
          stderr: "stderr super_secret"
        }]
      ])
    }))((it) => {
      it.effect("redacts command output through the shared executor", () =>
        Effect.gen(function*() {
          const evidence = yield* runOperation(operation, ExecutionApproval.none)

          expect("stdout" in evidence && "stderr" in evidence).toBe(true)
          if ("stdout" in evidence && "stderr" in evidence) {
            expect(evidence.stdout).toBe("stdout [REDACTED]")
            expect(evidence.stderr).toBe("stderr [REDACTED]")
            expect(evidence.operationFingerprint).toBe(operationFingerprint(operation))
            expect(evidence.operationFingerprint).not.toContain("super_secret")
          }
        }))
    })
  }

  {
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

    layer(Layer.mergeAll(
      makeWorkspaceTestCommandRunnerLayer({ env: new Map([["TOKEN", "super_secret"]]) }),
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
    ))((it) => {
      it.effect("evaluates HTTP verification evidence through the shared executor", () =>
        Effect.gen(function*() {
          const evidence = yield* runOperation(operation, ExecutionApproval.none)

          expect("responseStatus" in evidence && evidence.responseStatus).toBe(200)
          expect("checks" in evidence && evidence.checks.every((check) => check.passed)).toBe(true)
          expect("operationFingerprint" in evidence && evidence.operationFingerprint).toBe(operationFingerprint(operation))
          expect("responseHeaders" in evidence).toBe(false)
        }))
    })
  }

  layer(makeWorkspaceTestCommandRunnerLayer({ directories: new Set(["."]) }))((it) => {
    it.effect("records fingerprints for render and validation-note evidence", () =>
      Effect.gen(function*() {
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

        const renderEvidence = yield* runOperation(
          renderOperation,
          ExecutionApproval.make({ execute: true, approveIrreversible: false })
        )
        const validationEvidence = yield* runOperation(validationOperation, ExecutionApproval.none)

        expect("operationFingerprint" in renderEvidence && renderEvidence.operationFingerprint).toBe(
          operationFingerprint(renderOperation)
        )
        expect("operationFingerprint" in renderEvidence && renderEvidence.operationFingerprint).not.toContain("# Release")
        expect("operationFingerprint" in renderEvidence && renderEvidence.operationFingerprint).toContain("contentsDigest")
        expect("operationFingerprint" in validationEvidence && validationEvidence.operationFingerprint).toBe(
          operationFingerprint(validationOperation)
        )
      }))

    it.effect("rejects render writes outside the workspace root", () =>
      Effect.gen(function*() {
        const operation = RenderFileOperation.make({
          id: "render-outside",
          description: "Render outside.",
          risk: "writes-local",
          gate: executeGate("Rendering writes a local file."),
          path: "../outside.md",
          contents: "# Release\n"
        })
        const error = yield* runOperation(
          operation,
          ExecutionApproval.make({ execute: true, approveIrreversible: false })
        ).pipe(Effect.flip)

        expect(error._tag).toBe("WorkspaceWriteError")
      }))

    it.effect("rejects evidence writes outside the workspace root", () =>
      Effect.gen(function*() {
        const plan = makePlan()
        const error = yield* writeEvidenceBundle("../outside.json", evidenceBundle(plan), ".").pipe(Effect.flip)

        expect(error._tag).toBe("EvidenceWriteError")
      }))
  })

  {
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

    layer(Layer.mergeAll(
      makeWorkspaceTestCommandRunnerLayer(),
      makeTestReleaseHttpLayer({
        responses: new Map([
          [httpRequestKey(request), {
            status: 200,
            json: { draft: false }
          }]
        ])
      })
    ))((it) => {
      it.effect("fails HTTP verification when JSON checks do not match", () =>
        Effect.gen(function*() {
          const error = yield* runOperation(operation, ExecutionApproval.none).pipe(Effect.flip)

          expect(error._tag).toBe("OperationFailedError")
          if (error._tag === "OperationFailedError") {
            expect(error.responseStatus).toBe(200)
            expect(error.reason).toBe("HTTP verification failed.")
          }
        }))
    })
  }

  {
    const plan = makePlan()
    const bundle = evidenceBundle(plan)
    layer(makeWorkspaceTestCommandRunnerLayer({
      files: new Map([
        [".release/evidence/render.json", renderEvidenceJson(bundle)]
      ])
    }))((it) => {
      it.effect("reads a valid evidence bundle", () =>
        Effect.gen(function*() {
          const read = yield* readEvidenceBundle(".release/evidence/render.json")

          expect(read.releaseName).toBe("release")
          expect(read.records).toEqual([])
        }))
    })
  }

  layer(makeWorkspaceTestCommandRunnerLayer())((it) => {
    it.effect("returns undefined for missing optional evidence", () =>
      Effect.gen(function*() {
        const read = yield* tryReadEvidenceBundle(".release/evidence/render.json")

        expect(read).toBeUndefined()
      }))

    it.effect("merges evidence bundles in order", () =>
      Effect.gen(function*() {
        const plan = makePlan()
        const merged = yield* mergeEvidenceBundles(
          plan,
          evidenceBundle(plan, [evidenceRecord("first")]),
          evidenceBundle(plan, [evidenceRecord("second")])
        )

        expect(merged.records.map((record) => record.id)).toEqual(["first:execution", "second:execution"])
      }))

    it.effect("rejects merging evidence from another release", () =>
      Effect.gen(function*() {
        const plan = makePlan()
        const error = yield* mergeEvidenceBundles(
          plan,
          evidenceBundle(plan),
          evidenceBundle(makePlan("other", "9.9.9"))
        ).pipe(Effect.flip)

        expect(error._tag).toBe("EvidenceReadError")
      }))
  })

  layer(makeWorkspaceTestCommandRunnerLayer({
    files: new Map([
      [".release/evidence/render.json", "{not json"]
    ])
  }))((it) => {
    it.effect("fails invalid evidence JSON with EvidenceReadError", () =>
      Effect.gen(function*() {
        const error = yield* readEvidenceBundle(".release/evidence/render.json").pipe(Effect.flip)

        expect(error._tag).toBe("EvidenceReadError")
        if (error._tag === "EvidenceReadError") {
          expect(error.cause).toBeDefined()
        }
      }))
  })

  layer(makeWorkspaceTestCommandRunnerLayer({
    files: new Map([
      [".release/evidence/render.json", JSON.stringify({ schemaVersion: "wrong" })]
    ])
  }))((it) => {
    it.effect("fails wrong evidence schema with EvidenceReadError", () =>
      Effect.gen(function*() {
        const error = yield* readEvidenceBundle(".release/evidence/render.json").pipe(Effect.flip)

        expect(error._tag).toBe("EvidenceReadError")
      }))
  })

  layer(makeWorkspaceTestCommandRunnerLayer({
    files: new Map([
      [".release/evidence/validation.json", `${JSON.stringify({
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
      })}\n`]
    ])
  }))((it) => {
    it.effect("fails command evidence without operation fingerprints", () =>
      Effect.gen(function*() {
        const error = yield* readEvidenceBundle(".release/evidence/validation.json").pipe(Effect.flip)

        expect(error._tag).toBe("EvidenceReadError")
      }))
  })
})
