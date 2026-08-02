import {
  AttemptRecord, OperationRunRecord, Pending, RunLedger, TransitionError,
  type AttemptState, type CheckpointState, type ExecutionApprovalReceipt, type ExecutionScope, type Stage
} from "../model/run.js"
import { AttemptId, CheckpointId, OperationHash, OperationId } from "../model/primitives.js"
import type { Operation } from "../model/operation.js"
import { operationEntries } from "../model/validate.js"
import type { AcceptedPlan } from "../plan/accepted.js"

const supplyCheckpoints: Readonly<Record<string, ReadonlyArray<string>>> = {
  "supply.registry-image.v1": ["blobs", "manifest"],
  "supply.registry-manifest.v1": ["manifest"], "supply.registry-signature.v1": ["signature"],
  "supply.credentialed-artifact-sign.v1": ["sign"], "supply.quill-notarization.v1": ["sign", "submit", "staple"],
  "supply.apple-native-notarization.v1": ["codesign", "submit", "staple"],
  "supply.remote-attestation.v1": ["attest"]
}
export const fail = (reason: string): TransitionError => TransitionError.make({ reason })
export const attemptId = (index: number): AttemptId => AttemptId.make(`attempt-${index + 1}`)
export const current = (record: OperationRunRecord): AttemptRecord => {
  const attempt = record.attempts.at(-1)
  if (attempt === undefined) throw fail("Operation has no attempt.")
  return attempt
}
export const progress = (state: AttemptState): ReadonlyArray<CheckpointState> =>
  "progress" in state ? state.progress : []
export const operationFor = (accepted: AcceptedPlan, id: string): Operation => {
  const entry = operationEntries(accepted.plan).find(({ operation }) => operation.id === id)
  if (entry === undefined) throw fail(`Unknown operation ${id}.`)
  return entry.operation
}
export const checkpointIds = (operation: Operation): ReadonlyArray<CheckpointId> => {
  switch (operation._tag) {
    case "HttpPublish":
      return [CheckpointId.make("dispatch")]
    case "ForgeRelease":
      return [CheckpointId.make("release"),
        ...operation.inputs.map((id) => CheckpointId.make(`asset:${id}`))]
    case "PackageRegistryRelease":
    case "OpaquePublish":
      return [CheckpointId.make("dispatch")]
    case "PackageStorePublish":
      return (operation.profileId === "package.store-snap.v1" ? ["upload", "release"] : ["push"])
        .map((id) => CheckpointId.make(id))
    case "SupplyChainPublish": {
      const ids = supplyCheckpoints[operation.profileId]
      if (ids === undefined) throw fail(`Unknown supply-chain profile ${operation.profileId}.`)
      return ids.map((id) => CheckpointId.make(id))
    }
    case "ProviderPublish": return operation.checkpoints
    case "AnnouncementPublish": case "SmtpPublish": return [CheckpointId.make("message")]
    // Local operations carry no publish checkpoints; assertProgress
    // early-returns on their empty progress before this list is compared.
    case "Check": case "Write": case "Pack": case "Digest":
    case "Exec": case "HttpRead": case "ReviewedNoteTransform":
      return []
  }
}
export const assertReceipt = (ledger: RunLedger, receipt: ExecutionApprovalReceipt): void => {
  if (receipt.runId !== ledger.runId || receipt.logicalRunId !== ledger.logicalRunId ||
    receipt.topologyHash !== ledger.executionTopologyHash) {
    throw fail("Execution receipt is foreign to this run.")
  }
}
const assertScope = (accepted: AcceptedPlan, scope: ExecutionScope): void => {
  const ids = scope.operationIds.map(String)
  const known = new Set(operationEntries(accepted.plan).map(({ operation }) => String(operation.id)))
  if (new Set(ids).size !== ids.length || ids.some((id) => !known.has(id)))
    throw fail("Execution scope is duplicate or unknown.")
  const selected = new Set(ids)
  if (accepted.dependencies.some((edge) =>
    selected.has(edge.operationId) && !selected.has(edge.producerId)))
    throw fail("Execution scope omits a dependency.")
}
const assertProgress = (operation: Operation, state: AttemptState): void => {
  const actual = progress(state)
  if (actual.length === 0) return
  if (JSON.stringify(actual.map((item) => item.checkpointId)) !==
    JSON.stringify(checkpointIds(operation))) throw fail("Checkpoint topology mismatch.")
  if (state._tag === "Passed" && actual.some((item) => item._tag !== "CheckpointPassed"))
    throw fail("Passed publication has an incomplete checkpoint.")
}
const assertOutputs = (operation: Operation, state: AttemptState): void => {
  if (state._tag !== "Passed") return
  const declared = new Set(operation.outputs.map((output) => String(output.id)))
  const ids = state.materializedOutputs.map((output) => String(output.outputId))
  if (new Set(ids).size !== ids.length || ids.some((id) => !declared.has(id)))
    throw fail("Materialized outputs do not match the operation.")
}
const assertRecord = (accepted: AcceptedPlan, ledger: RunLedger,
  record: OperationRunRecord, index: number): void => {
  const expected = accepted.operationHashes[index]
  if (expected === undefined || record.operationId !== expected.operationId ||
    record.operationHash !== expected.hash || record.attempts.length === 0)
    throw fail("Ledger operation roster mismatch.")
  const operation = operationFor(accepted, record.operationId)
  for (const [attemptIndex, attempt] of record.attempts.entries()) {
    if (attempt.attemptId !== attemptId(attemptIndex)) throw fail("Attempt ids are not monotonic.")
    assertReceipt(ledger, attempt.executionReceipt)
    assertProgress(operation, attempt.state)
    assertOutputs(operation, attempt.state)
  }
}
export const validateLedger = (accepted: AcceptedPlan, ledger: RunLedger): void => {
  if (ledger.planId !== accepted.planId || !Number.isSafeInteger(ledger.revision) ||
    ledger.revision < 0) throw fail("Ledger identity or revision mismatch.")
  assertScope(accepted, ledger.scope)
  const hashes = accepted.operationHashes.map(({ hash }) => hash)
  if (JSON.stringify(ledger.operationHashes) !== JSON.stringify(hashes) ||
    ledger.operations.length !== hashes.length) throw fail("Ledger hash vector mismatch.")
  ledger.operations.forEach((record, index) => assertRecord(accepted, ledger, record, index))
}
export type NewLedger = {
  readonly runId: RunLedger["runId"], readonly logicalRunId: RunLedger["logicalRunId"],
  readonly scope: ExecutionScope, readonly frontier: Stage,
  readonly topologyHash: RunLedger["executionTopologyHash"],
  readonly receipt: ExecutionApprovalReceipt
}
export const createLedger = (accepted: AcceptedPlan, request: NewLedger): RunLedger => {
  const ledger = RunLedger.make({
    schemaVersion: "run-ledger/v1", runId: request.runId,
    logicalRunId: request.logicalRunId, planId: accepted.planId,
    operationHashes: accepted.operationHashes.map(({ hash }) => OperationHash.make(hash)),
    scope: request.scope, frontier: request.frontier,
    executionTopologyHash: request.topologyHash, revision: 0,
    operations: accepted.operationHashes.map(({ operationId, hash }) => OperationRunRecord.make({
      operationId: OperationId.make(operationId), operationHash: OperationHash.make(hash),
      attempts: [AttemptRecord.make({
        attemptId: attemptId(0), executionReceipt: request.receipt, state: Pending.make()
      })]
    }))
  })
  validateLedger(accepted, ledger)
  return ledger
}
