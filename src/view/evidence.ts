import type { OperationId, PlanId, RunId } from "../model/primitives.js"
import type { RunLedger, Stage } from "../model/run.js"

export interface EvidenceProjection {
  readonly schemaVersion: "evidence-projection/v1", readonly planId: PlanId
  readonly runId: RunId, readonly frontier: Stage
  readonly operations: ReadonlyArray<{ readonly operationId: OperationId, readonly status: string }>
}

export const projectEvidence = (ledger: RunLedger): EvidenceProjection => ({
  schemaVersion: "evidence-projection/v1",
  planId: ledger.planId,
  runId: ledger.runId,
  frontier: ledger.frontier,
  operations: ledger.operations.map((record) => ({
    operationId: record.operationId,
    status: record.attempts.at(-1)?.state._tag ?? "Missing"
  }))
})
