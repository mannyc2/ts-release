import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { EvidenceBundle, EvidenceRecord, ReleaseWorkflowEvidence, ReleaseWorkflowFailureEvidence } from "../domain/evidence.js"
import { ExecutionApproval, Operation, operationFingerprint } from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"
import {
  ReleaseOperationStatus,
  ReleaseOperationStatusRecord,
  ReleaseOverallStatus,
  ReleasePhaseStatusRecord,
  ReleaseResumeAction,
  ReleaseStatusReport,
  ReleaseWorkflowPhase
} from "../domain/status.js"
import {
  emptyEvidenceBundle,
  mergeEvidenceBundles,
  tryReadEvidenceBundle
} from "./evidence-recorder.js"
import { workflowPhases } from "../internal/workflow-phases.js"
import {
  publishOperations,
  renderOperations,
  runOperations,
  validationOperations,
  verificationOperations
} from "./executor.js"
import { EvidenceReadError, OperationFailedError, ResumeBlockedError } from "./errors.js"

export type * from "../types/effect-internal.js"

export interface WorkflowEvidencePaths {
  readonly render: string
  readonly validation: string
  readonly execution: string
  readonly verification: string
}

export interface OptionalWorkflowEvidence {
  readonly render?: EvidenceBundle
  readonly validation?: EvidenceBundle
  readonly execution?: EvidenceBundle
  readonly verification?: EvidenceBundle
}

export class ReleaseResumeOptions extends Schema.Class<ReleaseResumeOptions>("ReleaseResumeOptions")({
  execute: Schema.Boolean,
  approveIrreversible: Schema.Boolean
}) {}

export const workflowEvidencePaths = (plan: ReleasePlan): WorkflowEvidencePaths => ({
  render: `${plan.evidenceDirectory}/render.json`,
  validation: `${plan.evidenceDirectory}/validation.json`,
  execution: `${plan.evidenceDirectory}/execution.json`,
  verification: `${plan.evidenceDirectory}/verification.json`
})

const ensureBundleMatchesPlan = (
  plan: ReleasePlan,
  pathName: string,
  bundle: EvidenceBundle | undefined
): Effect.Effect<void, EvidenceReadError> => {
  if (bundle === undefined) {
    return Effect.void
  }
  if (bundle.releaseName === plan.identity.name && bundle.releaseVersion === plan.identity.version) {
    return Effect.void
  }
  return Effect.fail(
    EvidenceReadError.make({
      path: pathName,
      reason:
        `Evidence bundle is for ${bundle.releaseName}@${bundle.releaseVersion}, expected ${plan.identity.name}@${plan.identity.version}.`
    })
  )
}

export const loadWorkflowEvidence = Effect.fn("loadWorkflowEvidence")(function*(plan: ReleasePlan) {
  const paths = workflowEvidencePaths(plan)
  const evidence: {
    render?: EvidenceBundle
    validation?: EvidenceBundle
    execution?: EvidenceBundle
    verification?: EvidenceBundle
  } = {}
  for (const phase of workflowPhases) {
    const bundle = yield* tryReadEvidenceBundle(paths[phase], plan.source.root)
    yield* ensureBundleMatchesPlan(plan, paths[phase], bundle)
    if (bundle !== undefined) {
      evidence[phase] = bundle
    }
  }

  return evidence satisfies OptionalWorkflowEvidence
})

export const phaseOperations = (plan: ReleasePlan, phase: ReleaseWorkflowPhase): ReadonlyArray<Operation> => {
  switch (phase) {
    case "render":
      return renderOperations(plan)
    case "validation":
      return validationOperations(plan)
    case "execution":
      return publishOperations(plan)
    case "verification":
      return verificationOperations(plan)
  }
}

const recordOperationId = (record: EvidenceRecord): string | undefined =>
  "operationId" in record ? record.operationId : undefined

const hasOperationIdentity = (operation: Operation, record: EvidenceRecord): boolean => {
  const operationId = recordOperationId(record)
  if (operationId !== undefined) {
    return operationId === operation.id
  }
  return operation._tag === "ValidationNoteOperation" && record.id === `${operation.id}:validation`
}

const matchesOperation = (operation: Operation, record: EvidenceRecord): boolean => {
  if (!hasOperationIdentity(operation, record)) {
    return false
  }
  return record.operationFingerprint === operationFingerprint(operation)
}

const latestEvidenceRecord = (
  operation: Operation,
  bundle: EvidenceBundle | undefined
): EvidenceRecord | undefined => {
  if (bundle === undefined) {
    return undefined
  }
  let latest: EvidenceRecord | undefined
  for (const record of bundle.records) {
    if (matchesOperation(operation, record)) {
      latest = record
    }
  }
  return latest
}

const failedOperationPolicy = (
  operation: Operation
): {
  readonly status: ReleaseOperationStatus
  readonly resumeAction: ReleaseResumeAction
  readonly reason: string
} => {
  switch (operation._tag) {
    case "PublishCommandOperation":
      return {
        status: "blocked",
        resumeAction: "block",
        reason: "Previous publish evidence failed; inspect remote state before retry."
      }
    case "ValidateCommandOperation":
    case "ValidationNoteOperation":
      return {
        status: "failed",
        resumeAction: "retry-read-only",
        reason: "Previous validation evidence failed; resume can rerun this read-only operation."
      }
    case "VerifyRemoteOperation":
    case "VerifyHttpOperation":
      return {
        status: "failed",
        resumeAction: "retry-read-only",
        reason: "Previous verification evidence failed; resume can rerun this read-only operation."
      }
    case "RenderFileOperation":
      return {
        status: "failed",
        resumeAction: "run",
        reason: "Previous render evidence failed; resume can rerun this local render operation."
      }
  }
}

const operationStatusRecord = (
  operation: Operation,
  phase: ReleaseWorkflowPhase,
  bundle: EvidenceBundle | undefined
): ReleaseOperationStatusRecord => {
  const record = latestEvidenceRecord(operation, bundle)
  const base = {
    operationId: operation.id,
    ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
    phase,
    risk: operation.risk
  }
  if (record === undefined) {
    return ReleaseOperationStatusRecord.make({
      ...base,
      status: "pending",
      resumeAction: "run"
    })
  }

  if (record.status === "failed") {
    const policy = failedOperationPolicy(operation)
    return ReleaseOperationStatusRecord.make({
      ...base,
      status: policy.status,
      resumeAction: policy.resumeAction,
      evidenceId: record.id,
      reason: policy.reason
    })
  }

  return ReleaseOperationStatusRecord.make({
    ...base,
    status: record.status,
    resumeAction: "skip",
    evidenceId: record.id
  })
}

const completedOperation = (status: ReleaseOperationStatus): boolean =>
  status === "passed" || status === "warning" || status === "skipped"

const phaseStatus = (records: ReadonlyArray<ReleaseOperationStatusRecord>): ReleaseOperationStatus => {
  if (records.length === 0) {
    return "passed"
  }
  if (records.some((record) => record.status === "blocked")) {
    return "blocked"
  }
  if (records.some((record) => record.status === "failed")) {
    return "failed"
  }
  if (records.some((record) => record.status === "pending")) {
    return "pending"
  }
  if (records.some((record) => record.status === "warning")) {
    return "warning"
  }
  if (records.every((record) => record.status === "skipped")) {
    return "skipped"
  }
  return "passed"
}

const phaseStatusRecord = (
  phase: ReleaseWorkflowPhase,
  records: ReadonlyArray<ReleaseOperationStatusRecord>
): ReleasePhaseStatusRecord =>
  ReleasePhaseStatusRecord.make({
    phase,
    status: phaseStatus(records),
    completed: records.filter((record) => completedOperation(record.status)).length,
    total: records.length
  })

const overallStatus = (
  evidence: OptionalWorkflowEvidence,
  operations: ReadonlyArray<ReleaseOperationStatusRecord>,
  phases: ReadonlyArray<ReleasePhaseStatusRecord>
): ReleaseOverallStatus => {
  const evidenceFilesExist = workflowPhases.some((phase) => evidence[phase] !== undefined)
  const operationEvidenceExists = operations.some((operation) => operation.evidenceId !== undefined)
  if (!evidenceFilesExist && !operationEvidenceExists) {
    return "not-started"
  }
  if (operations.some((operation) => operation.status === "blocked")) {
    return "blocked"
  }
  if (operations.some((operation) => operation.status === "failed")) {
    return "failed"
  }
  if (phases.every((phase) => phase.completed === phase.total)) {
    return "complete"
  }
  return "in-progress"
}

const canResumeReport = (
  overall: ReleaseOverallStatus,
  operations: ReadonlyArray<ReleaseOperationStatusRecord>
): boolean =>
  overall !== "blocked" &&
  overall !== "complete" &&
  operations.some((operation) => operation.resumeAction === "run" || operation.resumeAction === "retry-read-only")

export const summarizeReleaseStatus = (
  plan: ReleasePlan,
  evidence: OptionalWorkflowEvidence
): ReleaseStatusReport => {
  const operations: Array<ReleaseOperationStatusRecord> = []
  const phases: Array<ReleasePhaseStatusRecord> = []
  for (const phase of workflowPhases) {
    const bundle = evidence[phase]
    const records = phaseOperations(plan, phase).map((operation) => operationStatusRecord(operation, phase, bundle))
    operations.push(...records)
    phases.push(phaseStatusRecord(phase, records))
  }
  const overall = overallStatus(evidence, operations, phases)
  return ReleaseStatusReport.make({
    schemaVersion: "release-status/v1",
    releaseName: plan.identity.name,
    releaseVersion: plan.identity.version,
    overallStatus: overall,
    canResume: canResumeReport(overall, operations),
    evidenceDirectory: plan.evidenceDirectory,
    phases,
    operations
  })
}

export const statusReleasePlan = Effect.fn("statusReleasePlan")(function*(plan: ReleasePlan) {
  const evidence = yield* loadWorkflowEvidence(plan)
  return summarizeReleaseStatus(plan, evidence)
})

export const renderReleaseStatusText = (report: ReleaseStatusReport): string => {
  const lines = [
    `${report.releaseName}@${report.releaseVersion} status=${report.overallStatus} can-resume=${report.canResume} evidence=${report.evidenceDirectory}`,
    "",
    "phases:"
  ]
  for (const phase of report.phases) {
    lines.push(`  ${phase.phase}: ${phase.status} ${phase.completed}/${phase.total}`)
  }
  lines.push("", "operations:")
  for (const operation of report.operations) {
    const fields = [
      `  - ${operation.operationId} [${operation.phase}] ${operation.status}`,
      `resume=${operation.resumeAction}`,
      operation.evidenceId === undefined ? "" : `evidence=${operation.evidenceId}`,
      operation.reason === undefined ? "" : `reason=${JSON.stringify(operation.reason)}`
    ].filter((field) => field.length > 0)
    lines.push(fields.join(" "))
  }
  return `${lines.join("\n")}\n`
}

export const renderReleaseStatusJson = (report: ReleaseStatusReport): string =>
  `${JSON.stringify(report, null, 2)}\n`

const approvalForPhase = (
  phase: ReleaseWorkflowPhase,
  options: ReleaseResumeOptions
): ExecutionApproval => {
  switch (phase) {
    case "render":
      return ExecutionApproval.make({
        execute: options.execute,
        approveIrreversible: false
      })
    case "validation":
    case "verification":
      return ExecutionApproval.none
    case "execution":
      return ExecutionApproval.make({
        execute: options.execute,
        approveIrreversible: options.approveIrreversible
      })
  }
}

const shouldRunOperation = (
  report: ReleaseStatusReport,
  operation: Operation
): boolean => {
  const status = report.operations.find((record) => record.operationId === operation.id)
  return status?.resumeAction === "run" || status?.resumeAction === "retry-read-only"
}

const failWorkflowOperation = (
  error: OperationFailedError,
  workflowEvidence: ReleaseWorkflowFailureEvidence
): Effect.Effect<never, OperationFailedError> =>
  Effect.fail(
    OperationFailedError.make({
      operationId: error.operationId,
      ...(error.exitCode === undefined ? {} : { exitCode: error.exitCode }),
      ...(error.responseStatus === undefined ? {} : { responseStatus: error.responseStatus }),
      reason: error.reason,
      ...(error.evidence === undefined ? {} : { evidence: error.evidence }),
      workflowEvidence
    })
  )

const workflowFailureEvidence = (
  prefix: OptionalWorkflowEvidence,
  phase: ReleaseWorkflowPhase,
  current: EvidenceBundle | undefined
): ReleaseWorkflowFailureEvidence => {
  const evidence: {
    render?: EvidenceBundle
    validation?: EvidenceBundle
    execution?: EvidenceBundle
    verification?: EvidenceBundle
  } = {}
  for (const evidencePhase of workflowPhases) {
    const bundle = evidencePhase === phase ? current : prefix[evidencePhase]
    if (bundle !== undefined) {
      evidence[evidencePhase] = bundle
    }
  }
  return ReleaseWorkflowFailureEvidence.make(evidence)
}

const resumePhase = Effect.fn("resumePhase")(function*(
  plan: ReleasePlan,
  phase: ReleaseWorkflowPhase,
  existing: EvidenceBundle | undefined,
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  report: ReleaseStatusReport,
  prefix: OptionalWorkflowEvidence
) {
  const runnable = operations.filter((operation) => shouldRunOperation(report, operation))
  if (runnable.length === 0) {
    return existing ?? emptyEvidenceBundle(plan)
  }

  const fresh = yield* runOperations(plan, runnable, approval).pipe(
    Effect.catchTag("OperationFailedError", (error) =>
      Effect.gen(function*() {
        const current = error.evidence === undefined
          ? existing
          : yield* mergeEvidenceBundles(plan, existing, error.evidence)
        return yield* failWorkflowOperation(error, workflowFailureEvidence(prefix, phase, current))
      }))
  )
  return yield* mergeEvidenceBundles(plan, existing, fresh)
})

export const resumeApprovedReleaseWorkflow = Effect.fn("resumeApprovedReleaseWorkflow")(function*(
  plan: ReleasePlan,
  options: ReleaseResumeOptions
) {
  const evidence = yield* loadWorkflowEvidence(plan)
  const report = summarizeReleaseStatus(plan, evidence)
  const blocked = report.operations.find((operation) => operation.resumeAction === "block")
  if (blocked !== undefined) {
    return yield* Effect.fail(
      ResumeBlockedError.make({
        operationId: blocked.operationId,
        reason: blocked.reason ?? "Resume is blocked by previous failed publish evidence."
      })
    )
  }

  const render = yield* resumePhase(
    plan,
    "render",
    evidence.render,
    renderOperations(plan),
    approvalForPhase("render", options),
    report,
    {}
  )
  const validation = yield* resumePhase(
    plan,
    "validation",
    evidence.validation,
    validationOperations(plan),
    approvalForPhase("validation", options),
    report,
    { render }
  )
  const execution = yield* resumePhase(
    plan,
    "execution",
    evidence.execution,
    publishOperations(plan),
    approvalForPhase("execution", options),
    report,
    { render, validation }
  )
  const verification = yield* resumePhase(
    plan,
    "verification",
    evidence.verification,
    verificationOperations(plan),
    approvalForPhase("verification", options),
    report,
    { render, validation, execution }
  )

  return ReleaseWorkflowEvidence.make({
    render,
    validation,
    execution,
    verification
  })
})
