// Invariant: public summaries are JSON-safe projections total over stale evidence and artifact references.
import * as Schema from "effect/Schema"
import { Artifact } from "../grammar/artifact.js"
import type { Operation, OperationRisk, StageAction } from "../grammar/operation.js"
import type { ReleasePlan } from "../grammar/plan.js"
import type { ReleaseIdentity } from "../grammar/state.js"
import type { EvidenceBundle } from "../run/evidence.js"


export type ReleaseIdentitySummary = Pick<ReleaseIdentity, "name" | "version" | "commit" | "tag">

export type ArtifactSummary = Schema.Codec.Encoded<typeof Artifact>

export type OperationSummary = Pick<Operation, "id" | "pipeId" | "description" | "risk"> & {
  readonly status: "planned" | "executed" | "skipped" | "failed" | "refused"
  readonly evidencePath?: string | undefined
}

export interface ReleasePlanSummary {
  readonly identity: ReleaseIdentitySummary
  readonly artifacts: ReadonlyArray<ArtifactSummary>
  readonly operations: ReadonlyArray<OperationSummary>
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

export const operationSummary = (
  operation: Pick<Operation, "id" | "pipeId" | "description" | "risk">,
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
  operations: plan.operations.map((operation) => operationSummary(operation))
})

export const evidenceOperationStatuses = (
  plan: ReleasePlan,
  evidence: EvidenceBundle,
  evidencePath?: string | undefined
): ReadonlyArray<OperationSummary> => evidence.records.map((record) => {
    const operation = plan.operations.find(({ id }) => id === record.operationId) ?? {
      id: record.operationId,
      pipeId: record.pipeId,
      description: "(not in current plan)",
      risk: record.risk
    }
    return operationSummary(
      operation,
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

type StageOperation = Operation & { readonly action: StageAction }

export const stagedOperationsForPlan = (plan: ReleasePlan): ReadonlyArray<StageOperation> =>
  plan.operations.filter((operation): operation is StageOperation =>
    (operation.phase === "build" || operation.phase === "process") && operation.action._tag === "stage")

export const stagedArtifactSummaries = (plan: ReleasePlan): ReadonlyArray<ArtifactSummary> =>
  stagedOperationsForPlan(plan).flatMap((operation) => operation.action.producesArtifactIds.flatMap((id) => {
    const artifact = plan.artifacts.find((artifact) => artifact.id === id)
    return artifact === undefined ? [] : [artifactSummary(artifact)]
  }))
