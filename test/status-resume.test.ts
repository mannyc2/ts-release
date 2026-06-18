import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ArtifactInventoryItem } from "../src/domain/artifact.js"
import {
  CommandEvidence,
  EvidenceBundle,
  ExecutionEvidence
} from "../src/domain/evidence.js"
import {
  CommandSpec,
  executeGate,
  irreversibleGate,
  noApprovalGate,
  PublishCommandOperation,
  RenderFileOperation,
  ValidateCommandOperation,
  VerifyRemoteOperation
} from "../src/domain/operation.js"
import {
  PlannerMetadata,
  ReleaseIdentity,
  ReleasePlan,
  SourceMetadata
} from "../src/domain/release.js"
import { GitHubReleaseTarget } from "../src/domain/target.js"
import { httpRequestKey, makeTestReleaseHttpLayer } from "../src/host/http.js"
import { commandKey, makeTestCommandRunnerLayer } from "../src/host/test.js"
import { renderEvidenceJson } from "../src/planner/evidence-recorder.js"
import {
  reconcileReleasePlan,
  ReleaseReconcileOptions
} from "../src/planner/reconcile.js"
import {
  ReleaseResumeOptions,
  resumeApprovedReleaseWorkflow,
  statusReleasePlan,
  summarizeReleaseStatus
} from "../src/planner/status.js"
import { runEffect } from "./helpers.js"

const renderCommand = CommandSpec.make({
  executable: "tool",
  args: ["render"],
  requiredEnv: [],
  redactedEnv: []
})

const validateCommand = CommandSpec.make({
  executable: "tool",
  args: ["validate"],
  requiredEnv: [],
  redactedEnv: []
})

const npmPublishCommand = CommandSpec.make({
  executable: "tool",
  args: ["publish", "npm"],
  requiredEnv: [],
  redactedEnv: []
})

const githubPublishCommand = CommandSpec.make({
  executable: "tool",
  args: ["publish", "github"],
  requiredEnv: [],
  redactedEnv: []
})

const verifyCommand = CommandSpec.make({
  executable: "tool",
  args: ["verify"],
  requiredEnv: [],
  redactedEnv: []
})

const renderOperation = RenderFileOperation.make({
  id: "workflow-render",
  description: "Render workflow file.",
  risk: "writes-local",
  gate: executeGate("Rendering writes a local file."),
  path: ".release/generated/workflow.txt",
  contents: "workflow\n"
})

const validationOperation = ValidateCommandOperation.make({
  id: "workflow-validate",
  description: "Validate workflow.",
  risk: "read-only",
  gate: noApprovalGate("Validation is read-only."),
  command: validateCommand
})

const npmPublishOperation = PublishCommandOperation.make({
  id: "npm:npm-publish",
  targetId: "npm",
  description: "Publish to npm.",
  risk: "irreversible",
  gate: irreversibleGate("npm versions are immutable."),
  command: npmPublishCommand
})

const githubPublishOperation = PublishCommandOperation.make({
  id: "github:gh-release-create",
  targetId: "github",
  description: "Create GitHub release.",
  risk: "externally-visible",
  gate: executeGate("GitHub releases are externally visible."),
  command: githubPublishCommand
})

const githubTarget = GitHubReleaseTarget.make({
  id: "github",
  repository: "owner/repo",
  tokenEnv: "GH_TOKEN",
  draft: false,
  prerelease: false,
  dryRunSupport: "simulated",
  mutability: "mutable-release",
  recovery: "delete-and-recreate"
})

const githubArtifact = ArtifactInventoryItem.make({
  id: "github-asset",
  path: "dist/release.tgz",
  format: "tarball",
  consumers: ["github"],
  sizeBytes: 12
})

const githubDraftEditCommand = CommandSpec.make({
  executable: "gh",
  args: ["release", "edit", "v0.1.0", "--repo", "owner/repo", "--draft=false"],
  requiredEnv: ["GH_TOKEN"],
  redactedEnv: ["GH_TOKEN"]
})

const verificationOperation = VerifyRemoteOperation.make({
  id: "workflow-verify",
  targetId: "npm",
  description: "Verify workflow.",
  risk: "read-only",
  gate: noApprovalGate("Verification is read-only."),
  command: verifyCommand
})

const makePlan = (
  operations = [
    renderOperation,
    validationOperation,
    npmPublishOperation,
    verificationOperation
  ]
): ReleasePlan =>
  ReleasePlan.make({
    schemaVersion: "release-plan/v1",
    identity: ReleaseIdentity.make({
      name: "release",
      version: "0.1.0",
      commit: "abc123",
      tag: "v0.1.0"
    }),
    source: SourceMetadata.make({
      root: ".",
      configPath: "release.config.json"
    }),
    artifacts: [],
    targets: [],
    targetCapabilities: [],
    operations,
    evidenceDirectory: ".release/evidence",
    metadata: PlannerMetadata.make({
      createdBy: "test",
      planSchemaVersion: "release-plan/v1"
    })
  })

const withEvidenceDirectory = (plan: ReleasePlan, evidenceDirectory: string): ReleasePlan =>
  ReleasePlan.make({
    schemaVersion: plan.schemaVersion,
    identity: plan.identity,
    source: plan.source,
    artifacts: plan.artifacts,
    targets: plan.targets,
    targetCapabilities: plan.targetCapabilities,
    operations: plan.operations,
    evidenceDirectory,
    metadata: plan.metadata
  })

const makeGitHubPlan = (): ReleasePlan =>
  ReleasePlan.make({
    schemaVersion: "release-plan/v1",
    identity: ReleaseIdentity.make({
      name: "release",
      version: "0.1.0",
      commit: "abc123",
      tag: "v0.1.0"
    }),
    source: SourceMetadata.make({
      root: ".",
      configPath: "release.config.json"
    }),
    artifacts: [githubArtifact],
    targets: [githubTarget],
    targetCapabilities: [],
    operations: [npmPublishOperation, githubPublishOperation],
    evidenceDirectory: ".release/evidence",
    metadata: PlannerMetadata.make({
      createdBy: "test",
      planSchemaVersion: "release-plan/v1"
    })
  })

const bundle = (plan: ReleasePlan, records: EvidenceBundle["records"]): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: "release-evidence/v1",
    releaseName: plan.identity.name,
    releaseVersion: plan.identity.version,
    records
  })

const renderEvidence = (status: "passed" | "failed" = "passed") =>
  ExecutionEvidence.make({
    id: "workflow-render:execution",
    operationId: "workflow-render",
    status,
    severity: status === "failed" ? "error" : "info",
    message: "Rendered workflow.",
    timestamp: "2026-06-17T00:00:00.000Z"
  })

const commandEvidence = (
  operationId: string,
  command: CommandSpec,
  status: "passed" | "failed" = "passed"
) =>
  CommandEvidence.make({
    id: `${operationId}:command`,
    operationId,
    status,
    severity: status === "failed" ? "error" : "info",
    command,
    exitCode: status === "failed" ? 1 : 0,
    stdout: "",
    stderr: status === "failed" ? "failed" : "",
    startedAt: "2026-06-17T00:00:00.000Z",
    endedAt: "2026-06-17T00:00:00.001Z",
    durationMillis: 1
  })

const approvedResume = ReleaseResumeOptions.make({
  execute: true,
  approveIrreversible: true
})

const testLayer = (options: Parameters<typeof makeTestCommandRunnerLayer>[0] = {}) =>
  Layer.mergeAll(
    makeTestCommandRunnerLayer({
      directories: new Set(["."]),
      ...options
    }),
    makeTestReleaseHttpLayer()
  )

const githubReleaseResponseKey = httpRequestKey({
  method: "GET",
  url: "https://api.github.com/repos/owner/repo/releases/tags/v0.1.0",
  headers: [
    { name: "Accept", value: "application/vnd.github+json" },
    { name: "X-GitHub-Api-Version", value: "2022-11-28" }
  ],
  envHeaders: [{ name: "Authorization", valueEnv: "GH_TOKEN", prefix: "Bearer " }],
  requiredEnv: ["GH_TOKEN"],
  redactedEnv: ["GH_TOKEN"]
})

const githubDraftResponse = {
  status: 200,
  json: {
    tag_name: "v0.1.0",
    name: "release 0.1.0",
    draft: true,
    prerelease: false,
    assets: [{ name: "release.tgz" }]
  }
}

const githubReconcileLayer = (options: Parameters<typeof makeTestCommandRunnerLayer>[0] = {}) =>
  Layer.mergeAll(
    makeTestCommandRunnerLayer({
      directories: new Set(["."]),
      env: new Map([["GH_TOKEN", "gh_secret"]]),
      ...options
    }),
    makeTestReleaseHttpLayer({
      responses: new Map([
        [githubReleaseResponseKey, githubDraftResponse]
      ])
    })
  )

describe("release status and resume", () => {
  test("reports not-started with pending operations when no evidence exists", () => {
    const plan = makePlan()
    const report = summarizeReleaseStatus(plan, {})

    expect(report.overallStatus).toBe("not-started")
    expect(report.canResume).toBe(true)
    expect(report.operations.every((operation) => operation.status === "pending")).toBe(true)
  })

  test("reports pending execution after completed render and validation evidence", () => {
    const plan = makePlan()
    const report = summarizeReleaseStatus(plan, {
      render: bundle(plan, [renderEvidence()]),
      validation: bundle(plan, [commandEvidence("workflow-validate", validateCommand)])
    })

    expect(report.overallStatus).toBe("in-progress")
    expect(report.canResume).toBe(true)
    expect(report.operations.find((operation) => operation.operationId === "npm:npm-publish")?.status).toBe("pending")
  })

  test("classifies validation failures as retryable read-only work", () => {
    const plan = makePlan()
    const report = summarizeReleaseStatus(plan, {
      validation: bundle(plan, [commandEvidence("workflow-validate", validateCommand, "failed")])
    })
    const validation = report.operations.find((operation) => operation.operationId === "workflow-validate")

    expect(report.overallStatus).toBe("failed")
    expect(report.canResume).toBe(true)
    expect(validation?.resumeAction).toBe("retry-read-only")
  })

  test("blocks resume after failed publish evidence", () => {
    const plan = makePlan()
    const report = summarizeReleaseStatus(plan, {
      execution: bundle(plan, [commandEvidence("npm:npm-publish", npmPublishCommand, "failed")])
    })
    const publish = report.operations.find((operation) => operation.operationId === "npm:npm-publish")

    expect(report.overallStatus).toBe("blocked")
    expect(report.canResume).toBe(false)
    expect(publish?.resumeAction).toBe("block")
  })

  test("does not let unknown old evidence satisfy current operations", () => {
    const plan = makePlan()
    const report = summarizeReleaseStatus(plan, {
      execution: bundle(plan, [commandEvidence("old:npm-publish", npmPublishCommand)])
    })

    expect(report.operations.find((operation) => operation.operationId === "npm:npm-publish")?.status).toBe("pending")
  })

  test("fails status when evidence belongs to another release", async () => {
    const plan = makePlan()
    const wrongRelease = EvidenceBundle.make({
      schemaVersion: "release-evidence/v1",
      releaseName: "other",
      releaseVersion: "9.9.9",
      records: []
    })

    const error = await runEffect(
      statusReleasePlan(plan).pipe(Effect.flip),
      testLayer({
        files: new Map([
          [".release/evidence/render.json", renderEvidenceJson(wrongRelease)]
        ])
      })
    )

    expect(error._tag).toBe("EvidenceReadError")
  })

  test("reads status evidence from a resolved versioned directory", async () => {
    const plan = withEvidenceDirectory(makePlan(), ".release/evidence/0.1.0")
    const report = await runEffect(
      statusReleasePlan(plan),
      testLayer({
        files: new Map([
          [".release/evidence/0.1.0/render.json", renderEvidenceJson(bundle(plan, [renderEvidence()]))]
        ])
      })
    )

    expect(report.evidenceDirectory).toBe(".release/evidence/0.1.0")
    expect(report.operations.find((operation) => operation.operationId === "workflow-render")?.status).toBe("passed")
  })

  test("resumes pending publish and verification after completed render and validation", async () => {
    const plan = makePlan()
    const evidence = await runEffect(
      resumeApprovedReleaseWorkflow(plan, approvedResume),
      testLayer({
        files: new Map([
          [".release/evidence/render.json", renderEvidenceJson(bundle(plan, [renderEvidence()]))],
          [
            ".release/evidence/validation.json",
            renderEvidenceJson(bundle(plan, [commandEvidence("workflow-validate", validateCommand)]))
          ]
        ])
      })
    )

    expect(evidence.render.records.map((record) => record.id)).toEqual(["workflow-render:execution"])
    expect(evidence.validation.records.map((record) => record.id)).toEqual(["workflow-validate:command"])
    expect(evidence.execution.records.map((record) => record.id)).toEqual(["npm:npm-publish:command"])
    expect(evidence.verification.records.map((record) => record.id)).toEqual(["workflow-verify:command"])
  })

  test("does not rerun a successful publish operation during resume", async () => {
    const plan = makePlan([
      renderOperation,
      validationOperation,
      npmPublishOperation,
      githubPublishOperation,
      verificationOperation
    ])

    const evidence = await runEffect(
      resumeApprovedReleaseWorkflow(plan, approvedResume),
      testLayer({
        files: new Map([
          [".release/evidence/render.json", renderEvidenceJson(bundle(plan, [renderEvidence()]))],
          [
            ".release/evidence/validation.json",
            renderEvidenceJson(bundle(plan, [commandEvidence("workflow-validate", validateCommand)]))
          ],
          [
            ".release/evidence/execution.json",
            renderEvidenceJson(bundle(plan, [commandEvidence("npm:npm-publish", npmPublishCommand)]))
          ]
        ])
      })
    )

    expect(evidence.execution.records.map((record) => record.id)).toEqual([
      "npm:npm-publish:command",
      "github:gh-release-create:command"
    ])
  })

  test("reruns failed verification without rerunning publish", async () => {
    const plan = makePlan()
    const evidence = await runEffect(
      resumeApprovedReleaseWorkflow(plan, approvedResume),
      testLayer({
        files: new Map([
          [".release/evidence/render.json", renderEvidenceJson(bundle(plan, [renderEvidence()]))],
          [
            ".release/evidence/validation.json",
            renderEvidenceJson(bundle(plan, [commandEvidence("workflow-validate", validateCommand)]))
          ],
          [
            ".release/evidence/execution.json",
            renderEvidenceJson(bundle(plan, [commandEvidence("npm:npm-publish", npmPublishCommand)]))
          ],
          [
            ".release/evidence/verification.json",
            renderEvidenceJson(bundle(plan, [commandEvidence("workflow-verify", verifyCommand, "failed")]))
          ]
        ])
      })
    )

    expect(evidence.execution.records.map((record) => record.id)).toEqual(["npm:npm-publish:command"])
    expect(evidence.verification.records.map((record) => record.status)).toEqual(["failed", "passed"])
  })

  test("stops before publish when retried validation fails again", async () => {
    const plan = makePlan()
    const error = await runEffect(
      resumeApprovedReleaseWorkflow(plan, approvedResume).pipe(Effect.flip),
      testLayer({
        files: new Map([
          [".release/evidence/render.json", renderEvidenceJson(bundle(plan, [renderEvidence()]))],
          [
            ".release/evidence/validation.json",
            renderEvidenceJson(bundle(plan, [commandEvidence("workflow-validate", validateCommand, "failed")]))
          ]
        ]),
        commands: new Map([
          [commandKey(validateCommand), {
            exitCode: 1,
            stdout: "",
            stderr: "still failing"
          }]
        ])
      })
    )

    expect(error._tag).toBe("OperationFailedError")
    if (error._tag === "OperationFailedError") {
      expect(error.operationId).toBe("workflow-validate")
      expect(error.workflowEvidence?.validation?.records.map((record) => record.status)).toEqual(["failed", "failed"])
      expect(error.workflowEvidence?.execution).toBeUndefined()
    }
  })

  test("fails resume immediately when publish evidence is blocked", async () => {
    const plan = makePlan()
    const error = await runEffect(
      resumeApprovedReleaseWorkflow(plan, approvedResume).pipe(Effect.flip),
      testLayer({
        files: new Map([
          [
            ".release/evidence/execution.json",
            renderEvidenceJson(bundle(plan, [commandEvidence("npm:npm-publish", npmPublishCommand, "failed")]))
          ]
        ])
      })
    )

    expect(error._tag).toBe("ResumeBlockedError")
  })

  test("preserves normal execute approval for pending render operations", async () => {
    const plan = makePlan()
    const error = await runEffect(
      resumeApprovedReleaseWorkflow(
        plan,
        ReleaseResumeOptions.make({
          execute: false,
          approveIrreversible: true
        })
      ).pipe(Effect.flip),
      testLayer()
    )

    expect(error._tag).toBe("ExecutionApprovalError")
  })

  test("preserves irreversible approval for pending irreversible publish operations", async () => {
    const plan = makePlan()
    const error = await runEffect(
      resumeApprovedReleaseWorkflow(
        plan,
        ReleaseResumeOptions.make({
          execute: true,
          approveIrreversible: false
        })
      ).pipe(Effect.flip),
      testLayer({
        files: new Map([
          [".release/evidence/render.json", renderEvidenceJson(bundle(plan, [renderEvidence()]))],
          [
            ".release/evidence/validation.json",
            renderEvidenceJson(bundle(plan, [commandEvidence("workflow-validate", validateCommand)]))
          ]
        ])
      })
    )

    expect(error._tag).toBe("ExecutionApprovalError")
  })

  test("blocks GitHub reconciliation without execute approval", async () => {
    const plan = makeGitHubPlan()
    const error = await runEffect(
      reconcileReleasePlan(
        plan,
        ReleaseReconcileOptions.make({
          execute: false
        })
      ).pipe(Effect.flip),
      githubReconcileLayer()
    )

    expect(error._tag).toBe("ExecutionApprovalError")
  })

  test("publishes a matching GitHub draft without rerunning npm publish", async () => {
    const plan = makeGitHubPlan()
    const evidence = await runEffect(
      reconcileReleasePlan(
        plan,
        ReleaseReconcileOptions.make({
          execute: true
        })
      ),
      githubReconcileLayer()
    )

    expect(evidence.records.map((record) => record.id)).toEqual(["github:gh-release-publish-draft:command"])
    const record = evidence.records[0]
    if (record !== undefined && "command" in record) {
      expect(record.command).toEqual(githubDraftEditCommand)
    }
    expect(evidence.records.some((record) => "operationId" in record && record.operationId === "npm:npm-publish")).toBe(false)
  })

  test("blocks GitHub reconciliation when remote assets differ", async () => {
    const plan = makeGitHubPlan()
    const error = await runEffect(
      reconcileReleasePlan(
        plan,
        ReleaseReconcileOptions.make({
          execute: true
        })
      ).pipe(Effect.flip),
      Layer.mergeAll(
        makeTestCommandRunnerLayer({
          directories: new Set(["."]),
          env: new Map([["GH_TOKEN", "gh_secret"]])
        }),
        makeTestReleaseHttpLayer({
          responses: new Map([
            [githubReleaseResponseKey, {
              status: 200,
              json: {
                tag_name: "v0.1.0",
                name: "release 0.1.0",
                draft: true,
                prerelease: false,
                assets: [{ name: "other.tgz" }]
              }
            }]
          ])
        })
      )
    )

    expect(error._tag).toBe("ReconciliationBlockedError")
  })
})
