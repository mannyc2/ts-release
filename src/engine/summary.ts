import type { ArtifactInventoryItem } from "../pipeline/artifact.js"
import type { OperationRisk } from "../pipeline/operation.js"
import type { PipeNotice, ReleaseIdentity } from "../pipeline/state.js"
import type { EvidenceBundle } from "./evidence.js"
import type { ReleasePlanDocument } from "./plan-document.js"


export interface ReleaseIdentitySummary {
  readonly name: string
  readonly version: string
  readonly commit: string
  readonly tag: string
}

export interface ArtifactSummary {
  readonly id: string
  readonly path: string
  readonly format: string
  readonly sizeBytes?: number | undefined
}

export interface PipeNoticeSummary {
  readonly pipeId: string
  readonly severity: "info" | "warning"
  readonly reason: string
}

export interface OperationSummary {
  readonly id: string
  readonly pipeId: string
  readonly description: string
  readonly risk: OperationRisk
  readonly status: "planned" | "executed" | "skipped" | "failed" | "refused"
  readonly evidencePath?: string | undefined
}

export interface ReleasePlanSummary {
  readonly identity: ReleaseIdentitySummary
  readonly artifacts: ReadonlyArray<ArtifactSummary>
  readonly operations: ReadonlyArray<OperationSummary>
  readonly notices: ReadonlyArray<PipeNoticeSummary>
}

export interface BuildSummary extends ReleasePlanSummary {
  readonly stagedArtifacts: ReadonlyArray<ArtifactSummary>
}

export interface ReleaseSummary extends ReleasePlanSummary {
  readonly executed: ReadonlyArray<OperationSummary>
  readonly refused: ReadonlyArray<OperationSummary>
}

export interface VerifySummary {
  readonly identity: ReleaseIdentitySummary
  readonly checks: ReadonlyArray<OperationSummary>
}

export const identitySummary = (identity: ReleaseIdentity): ReleaseIdentitySummary => ({
  name: identity.name,
  version: identity.version,
  commit: identity.commit,
  tag: identity.tag
})

export const artifactSummary = (artifact: ArtifactInventoryItem): ArtifactSummary => ({
  id: artifact.id,
  path: artifact.path,
  format: artifact.format,
  sizeBytes: artifact.sizeBytes
})

export const pipeNoticeSummary = (notice: PipeNotice): PipeNoticeSummary => ({
  pipeId: notice.pipeId,
  severity: notice.severity,
  reason: notice.reason
})

type OperationSummaryInput = Pick<
  ReleasePlanDocument["state"]["operations"][number],
  "id" | "pipeId" | "description" | "risk"
>

export const operationSummary = (
  operation: OperationSummaryInput,
  status: OperationSummary["status"] = "planned",
  evidencePath?: string | undefined
): OperationSummary => ({
  id: operation.id,
  pipeId: operation.pipeId,
  description: operation.description,
  risk: operation.risk,
  status,
  ...(evidencePath === undefined ? {} : { evidencePath })
})

export const plannedSummary = (plan: ReleasePlanDocument): ReleasePlanSummary => ({
  identity: identitySummary(plan.state.identity),
  artifacts: plan.artifacts.map(artifactSummary),
  operations: plan.state.operations.map((operation) => operationSummary(operation)),
  notices: plan.state.notices.map(pipeNoticeSummary)
})

export const evidenceOperationStatuses = (
  plan: ReleasePlanDocument,
  evidence: EvidenceBundle,
  evidencePath?: string | undefined
): ReadonlyArray<OperationSummary> =>
  evidence.records.map((record) => {
    const operation = plan.state.operations.find((candidate) => candidate.id === record.operationId)
    return operationSummary(
      operation ?? {
        id: record.operationId,
        pipeId: record.pipeId,
        description: record.message,
        risk: record.risk
      },
      record.status === "failed"
        ? "failed"
        : record.status === "refused"
        ? "refused"
        : record.status === "skipped"
        ? "skipped"
        : "executed",
      evidencePath
    )
  })
