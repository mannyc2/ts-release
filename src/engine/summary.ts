import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Artifact } from "../pipeline/artifact.js"
import type { Operation, OperationRisk } from "../pipeline/operation.js"
import type { ReleasePlan } from "../pipeline/plan.js"
import type { PipeNotice, ReleaseIdentity } from "../pipeline/state.js"
import type { EvidenceBundle } from "./evidence.js"
import { PlanReferenceMismatchError } from "./errors.js"
import type { StagedArtifactOperationResult } from "./stager.js"


export interface ReleaseIdentitySummary {
  readonly name: string
  readonly version: string
  readonly commit: string
  readonly tag: string
}

export type ArtifactSummary = Schema.Codec.Encoded<typeof Artifact>

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

export const artifactSummary = Schema.encodeSync(Artifact)

export const pipeNoticeSummary = (notice: PipeNotice): PipeNoticeSummary => ({
  pipeId: notice.pipeId,
  severity: notice.severity,
  reason: notice.reason
})

type OperationSummaryInput = Pick<
  Operation,
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

export const plannedSummary = (plan: ReleasePlan): ReleasePlanSummary => ({
  identity: identitySummary(plan.identity),
  artifacts: plan.artifacts.map((artifact) => artifactSummary(artifact)),
  operations: plan.operations.map((operation) => operationSummary(operation)),
  notices: plan.notices.map(pipeNoticeSummary)
})

const mismatch = (
  source: "evidence" | "staged-artifact",
  referencedId: string,
  reason: string
): PlanReferenceMismatchError =>
  PlanReferenceMismatchError.make({ source, referencedId, reason })

const exactReference = <Value>(
  source: "evidence" | "staged-artifact",
  referencedId: string,
  kind: string,
  matches: ReadonlyArray<Value>
): Effect.Effect<Value, PlanReferenceMismatchError> => {
  const match = matches[0]
  return matches.length === 1 && match !== undefined
    ? Effect.succeed(match)
    : Effect.fail(mismatch(source, referencedId,
      `${source === "evidence" ? "Evidence" : "Staging"} references ${matches.length === 0 ? "missing" : "duplicate"} ${kind} ${referencedId}.`))
}

const duplicateId = (ids: ReadonlyArray<string>): string | undefined =>
  ids.find((id, index) => ids.indexOf(id) !== index)

export const evidenceOperationStatuses = Effect.fn("engine.summary.evidenceOperationStatuses")(function*(
  plan: ReleasePlan,
  evidence: EvidenceBundle,
  evidencePath?: string | undefined
) {
  const summaries: Array<OperationSummary> = []
  const seen = new Set<string>()
  for (const record of evidence.records) {
    if (seen.has(record.operationId)) return yield* mismatch("evidence", record.operationId,
      `Evidence contains duplicate records for operation ${record.operationId}.`)
    seen.add(record.operationId)
    const operation = yield* exactReference("evidence", record.operationId, "plan operation",
      plan.operations.filter((candidate) => candidate.id === record.operationId))
    const fields = (["pipeId", "phase", "risk"] as const)
      .filter((field) => record[field] !== operation[field])
    if (fields.length > 0) return yield* mismatch("evidence", record.operationId,
      `Evidence metadata does not match plan operation ${record.operationId}: ${fields.join(", ")}.`)
    summaries.push(operationSummary(
      operation,
      record.status === "failed"
        ? "failed"
        : record.status === "refused"
        ? "refused"
        : record.status === "skipped"
        ? "skipped"
        : "executed",
      evidencePath
    ))
  }
  return summaries
})

export const stagedArtifactSummaries = Effect.fn("engine.summary.stagedArtifactSummaries")(function*(
  plan: ReleasePlan,
  stagedOperations: ReadonlyArray<StagedArtifactOperationResult>
) {
  const summaries: Array<ArtifactSummary> = []
  const seenOperationIds = new Set<string>()
  const seenArtifactIds = new Set<string>()
  for (const result of stagedOperations) {
    if (seenOperationIds.has(result.operationId)) return yield* mismatch("staged-artifact", result.operationId,
      `Staging contains duplicate results for operation ${result.operationId}.`)
    seenOperationIds.add(result.operationId)
    const operation = yield* exactReference("staged-artifact", result.operationId, "plan operation",
      plan.operations.filter((candidate) => candidate.id === result.operationId))
    if (operation.action._tag !== "stage") return yield* mismatch("staged-artifact", result.operationId,
      `Staging references non-stage plan operation ${result.operationId}.`)
    if (operation.action.intent._tag !== result.intentTag) return yield* mismatch("staged-artifact", result.operationId,
      `Staging intent ${result.intentTag} does not match plan intent ${operation.action.intent._tag}.`)
    const reportedIds = result.artifacts.map((artifact) => artifact.id)
    const producedIds = operation.action.producesArtifactIds
    const duplicate = duplicateId(reportedIds) ?? duplicateId(producedIds)
    if (duplicate !== undefined) return yield* mismatch("staged-artifact", duplicate,
      `Staging operation ${result.operationId} contains duplicate artifact ID ${duplicate}.`)
    if (reportedIds.length !== producedIds.length || reportedIds.some((id, index) => id !== producedIds[index])) {
      return yield* mismatch("staged-artifact", result.operationId,
        `Staging artifacts do not match the produced artifact IDs for operation ${result.operationId}.`)
    }
    for (const staged of result.artifacts) {
      if (seenArtifactIds.has(staged.id)) return yield* mismatch("staged-artifact", staged.id,
        `Staging contains duplicate results for artifact ${staged.id}.`)
      seenArtifactIds.add(staged.id)
      const artifact = yield* exactReference("staged-artifact", staged.id, "plan artifact",
        plan.artifacts.filter((candidate) => candidate.id === staged.id))
      if (artifact.path !== staged.path) return yield* mismatch("staged-artifact", staged.id,
        `Staged path ${staged.path} does not match plan artifact path ${artifact.path}.`)
      summaries.push(artifactSummary(artifact))
    }
  }
  return summaries
})
