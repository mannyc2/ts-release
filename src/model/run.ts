import * as Schema from "effect/Schema"
import {
  ApprovalNonce, AttemptId, CheckpointId, Digest, ExecutionReviewId,
  ExecutionScopeHash, ExecutionTopologyHash, LogicalRunId, OperationHash, OperationId, OutputId,
  PlanId, PublishReviewId, ReceiptId, RunId, SnapshotId, WorkerId, WorkerKeyFingerprint
} from "./primitives.js"

const Reason = { reason: Schema.String }
const run = { runId: RunId, logicalRunId: LogicalRunId }
const approval = {
  ...run, receiptId: ReceiptId, reviewer: Schema.NonEmptyString,
  approvalNonce: ApprovalNonce, approvedAt: Schema.NonEmptyString, topologyHash: ExecutionTopologyHash
}
const checkpoint = { checkpointId: CheckpointId }
const progress = { progress: Schema.Array(Schema.suspend(() => CheckpointState)) }
const resolution = {
  operator: Schema.NonEmptyString, reason: Schema.NonEmptyString, timestamp: Schema.NonEmptyString
}

export class ExecutionScope extends Schema.Class<ExecutionScope>("ExecutionScope")({
  operationIds: Schema.Array(OperationId), workerId: Schema.optionalKey(WorkerId),
  scopeHash: Schema.optionalKey(ExecutionScopeHash),
  ownedOperationHashes: Schema.optionalKey(Schema.Array(OperationHash)),
  prerequisiteFactHashes: Schema.optionalKey(Schema.Array(OperationHash))
}) {}
export class WorkerRegistration extends Schema.Class<WorkerRegistration>("WorkerRegistration")({
  workerId: WorkerId, publicKey: Schema.NonEmptyString,
  workerKeyFingerprint: WorkerKeyFingerprint, scopeHash: ExecutionScopeHash,
  ownedOperationHashes: Schema.Array(OperationHash),
  prerequisiteFactHashes: Schema.Array(OperationHash)
}) {}
export class ExecutionTopology extends Schema.Class<ExecutionTopology>("ExecutionTopology")({
  planId: PlanId, partitions: Schema.Array(WorkerRegistration)
}) {}
export class ExecutionApprovalReceipt extends Schema.Class<ExecutionApprovalReceipt>("ExecutionApprovalReceipt")({
  ...approval, reviewId: ExecutionReviewId, newRunReason: Schema.optionalKey(Schema.NonEmptyString)
}) {}
export class PublishApprovalReceipt extends Schema.Class<PublishApprovalReceipt>("PublishApprovalReceipt")({
  ...approval, reviewId: PublishReviewId, executionReceiptId: ReceiptId
}) {}
export class SignedAuthorizationReceipt
  extends Schema.Class<SignedAuthorizationReceipt>("SignedAuthorizationReceipt")({
    signerWorkerId: WorkerId, planId: PlanId, logicalRunId: LogicalRunId,
    scopeHash: ExecutionScopeHash, topologyHash: ExecutionTopologyHash,
    operationHash: OperationHash, attemptId: AttemptId,
    purpose: Schema.Literals(["execute", "publish"]), reviewer: Schema.NonEmptyString,
    reviewChallengeId: Schema.NonEmptyString, nonce: ApprovalNonce,
    issuedAt: Schema.NonEmptyString, materialBindingHashes: Schema.Array(Digest),
    signature: Schema.NonEmptyString
  })
{}
export class MaterializedOutput extends Schema.Class<MaterializedOutput>("MaterializedOutput")({
  outputId: OutputId, snapshotId: SnapshotId, digest: Digest, size: Schema.Number, inode: Schema.Number,
  transmittedDigest: Schema.optionalKey(Digest)
}) {}

export class CheckpointPending extends Schema.TaggedClass<CheckpointPending>()("CheckpointPending", checkpoint) {}
export class CheckpointDispatching extends Schema.TaggedClass<CheckpointDispatching>()(
  "CheckpointDispatching", { ...checkpoint, attemptId: AttemptId,
    clientReconciliationKey: Schema.NonEmptyString }
) {}
export class CheckpointPassed extends Schema.TaggedClass<CheckpointPassed>()(
  "CheckpointPassed", { ...checkpoint, observedOutcome: Schema.String }
) {}
export class CheckpointFailedBeforeCommit extends Schema.TaggedClass<CheckpointFailedBeforeCommit>()(
    "CheckpointFailedBeforeCommit", { ...checkpoint, failure: Schema.String,
      retryable: Schema.Boolean }) {}
export class CheckpointUnknown extends Schema.TaggedClass<CheckpointUnknown>()(
  "CheckpointUnknown", { ...checkpoint, clientReconciliationKey: Schema.NonEmptyString,
    observedRemoteId: Schema.optionalKey(Schema.NonEmptyString), failure: Schema.String }) {}
export class CheckpointManualReview extends Schema.TaggedClass<CheckpointManualReview>()(
  "CheckpointManualReview", { ...checkpoint, reason: Schema.String }
) {}
export const CheckpointState = Schema.Union([
  CheckpointPending, CheckpointDispatching, CheckpointPassed,
  CheckpointFailedBeforeCommit, CheckpointUnknown, CheckpointManualReview
])
export type CheckpointState = typeof CheckpointState.Type

export class Pending extends Schema.TaggedClass<Pending>()("Pending", {}) {}
export class RunningStructured extends Schema.TaggedClass<RunningStructured>()(
  "RunningStructured", { startedAt: Schema.NonEmptyString }
) {}
export class RunningTrustedExec extends Schema.TaggedClass<RunningTrustedExec>()(
  "RunningTrustedExec", { startedAt: Schema.NonEmptyString }
) {}
export class DispatchingPublish extends Schema.TaggedClass<DispatchingPublish>()(
  "DispatchingPublish", { attemptId: AttemptId, ...progress }
) {}
export class Passed extends Schema.TaggedClass<Passed>()("Passed", {
  ...progress, outcome: Schema.String,
  materializedOutputs: Schema.Array(MaterializedOutput)
}) {}
export class FailedBeforeCommit extends Schema.TaggedClass<FailedBeforeCommit>()(
  "FailedBeforeCommit", { ...progress, failure: Schema.String, retryable: Schema.Boolean }
) {}
export class CommitUnknown extends Schema.TaggedClass<CommitUnknown>()(
  "CommitUnknown", { ...progress, failure: Schema.String }
) {}
export class ManualReview extends Schema.TaggedClass<ManualReview>()("ManualReview", Reason) {}
export class AssumedCommitted extends Schema.TaggedClass<AssumedCommitted>()("AssumedCommitted", resolution) {}
export class AssumedAbsent extends Schema.TaggedClass<AssumedAbsent>()("AssumedAbsent", resolution) {}
export const AttemptState = Schema.Union([
  Pending, RunningStructured, RunningTrustedExec, DispatchingPublish, Passed,
  FailedBeforeCommit, CommitUnknown, ManualReview, AssumedCommitted, AssumedAbsent
])
export type AttemptState = typeof AttemptState.Type

export class AttemptRecord extends Schema.Class<AttemptRecord>("AttemptRecord")({
  attemptId: AttemptId, executionReceipt: ExecutionApprovalReceipt,
  publishReceipt: Schema.optionalKey(PublishApprovalReceipt),
  authorizationReceipt: Schema.optionalKey(SignedAuthorizationReceipt), state: AttemptState }) {}
export class OperationRunRecord extends Schema.Class<OperationRunRecord>("OperationRunRecord")({
  operationId: OperationId, operationHash: OperationHash, attempts: Schema.Array(AttemptRecord)
}) {}
export class LedgerAttestation extends Schema.Class<LedgerAttestation>("LedgerAttestation")({
  workerId: WorkerId, topologyHash: ExecutionTopologyHash,
  signerFingerprint: WorkerKeyFingerprint, digest: Digest, signature: Schema.NonEmptyString
}) {}
export const Stage = Schema.Literals(
  ["build", "process", "catalog", "validate", "publish", "announce", "verify"])
export type Stage = typeof Stage.Type
export class RunLedger extends Schema.Class<RunLedger>("RunLedger")({
  schemaVersion: Schema.Literal("run-ledger/v1"), ...run, planId: PlanId,
  operationHashes: Schema.Array(OperationHash), scope: ExecutionScope,
  frontier: Stage, executionTopologyHash: ExecutionTopologyHash,
  revision: Schema.Number, operations: Schema.Array(OperationRunRecord),
  topology: Schema.optionalKey(ExecutionTopology),
  attestation: Schema.optionalKey(LedgerAttestation)
}) {}

export class TransitionError extends Schema.TaggedErrorClass<TransitionError>()("TransitionError", Reason) {}
export class RunStoreError extends Schema.TaggedErrorClass<RunStoreError>()("RunStoreError", Reason) {}
export class ApprovalError extends Schema.TaggedErrorClass<ApprovalError>()("ApprovalError", Reason) {}
export class DriverError extends Schema.TaggedErrorClass<DriverError>()("DriverError", {
  reason: Schema.String, commitment: Schema.Literals(["before-commit", "unknown"])
}) {}
