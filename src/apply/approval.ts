import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ApprovalError, ExecutionApprovalReceipt, PublishApprovalReceipt,
  type ExecutionScope, type MaterializedOutput } from "../model/run.js"
import {
  ApprovalNonce, ExecutionReviewId, ExecutionTopologyHash, LogicalRunId, PublishReviewId,
  ReceiptId, RunId, type CheckpointId, type OperationHash } from "../model/primitives.js"
import { encodeCanonicalJson, hashFramed } from "../model/canonical.js"
import { operationEntries } from "../model/validate.js"
import type { AcceptedPlan } from "../plan/accepted.js"
import { ExecutionPermit, PublishPermit } from "../model/permit.js"
import type { PackageStoreTarget } from "../model/operation.js"
export { ExecutionPermit, PublishPermit }

const hash = (domain: string, value: unknown): string =>
  hashFramed(domain, [new TextEncoder().encode(encodeCanonicalJson(value))])
const fail = (reason: string): never => { throw ApprovalError.make({ reason }) }
const checked = <A>(body: () => A) => Effect.try({
  try: body, catch: (cause) => cause instanceof ApprovalError ? cause : ApprovalError.make({ reason: String(cause) })
})
const selected = (accepted: AcceptedPlan, scope: ExecutionScope) => {
  const ids = new Set(scope.operationIds.map(String))
  return accepted.operationHashes.filter(({ operationId }) => ids.has(operationId))
}
export const deriveLogicalRunId = (accepted: AcceptedPlan, scope: ExecutionScope,
  topologyHash: ExecutionTopologyHash, nonce?: string): LogicalRunId =>
  LogicalRunId.make(hash("ts-release/logical-run/v1", {
  planId: accepted.planId, operationIds: [...scope.operationIds].map(String).sort(),
  topologyHash, ...(nonce === undefined ? {} : { nonce }) }))
export const executionReviewId = (
  accepted: AcceptedPlan, scope: ExecutionScope, topologyHash: ExecutionTopologyHash
): ExecutionReviewId => {
  const operations = selected(accepted, scope)
  const ids = new Set(operations.map(({ operationId }) => operationId))
  const trustedExecReviewSet = operationEntries(accepted.plan)
    .filter(({ operation }) => ids.has(operation.id) && operation._tag === "Exec")
    .map(({ operation }) => operation.id).sort()
  const dependencyClosure = accepted.dependencies
    .filter((edge) => ids.has(edge.operationId))
    .map((edge) => edge.producerId).filter((id, index, all) => all.indexOf(id) === index)
    .sort()
  return ExecutionReviewId.make(hash("ts-release/execution-review/v1", {
    planId: accepted.planId, scopeOperationIdsAndHashes: operations,
    dependencyClosure, trustedExecReviewSet,
    executionTopologyHash: topologyHash }))
}
export type ExecutionConfirmation = {
  readonly reviewId: ExecutionReviewId, readonly runId: RunId,
  readonly reviewer: string, readonly approvalNonce: ApprovalNonce,
  readonly approvedAt: string, readonly newRunReason?: string,
  readonly logicalRunId?: LogicalRunId
}
export const mintExecutionReceipt = (accepted: AcceptedPlan, scope: ExecutionScope,
  topologyHash: ExecutionTopologyHash, confirmation: ExecutionConfirmation): ExecutionApprovalReceipt => {
  const reviewId = executionReviewId(accepted, scope, topologyHash)
  if (confirmation.reviewId !== reviewId) fail("Execution confirmation does not match review.")
  if (confirmation.reviewer.length === 0 || confirmation.approvedAt.length === 0)
    fail("Execution confirmation lacks reviewer or time.")
  const logicalRunId = confirmation.logicalRunId ?? deriveLogicalRunId(accepted, scope, topologyHash,
    confirmation.newRunReason === undefined ? undefined : confirmation.approvalNonce)
  const body = {
    reviewId, runId: confirmation.runId, logicalRunId,
    reviewer: confirmation.reviewer, approvalNonce: confirmation.approvalNonce,
    approvedAt: confirmation.approvedAt, topologyHash,
    ...(confirmation.newRunReason === undefined ? {} : { newRunReason: confirmation.newRunReason })
  }
  return ExecutionApprovalReceipt.make({
    ...body, receiptId: ReceiptId.make(hash("ts-release/execution-receipt/v1", body)) })
}
export const publishReviewId = (accepted: AcceptedPlan, executionReview: ExecutionReviewId,
  scope: ExecutionScope, materials: ReadonlyArray<MaterializedOutput>): PublishReviewId => {
  const publishIds = new Set(operationEntries(accepted.plan).filter(({ operation }) =>
    [
      "HttpPublish",
      "ForgeRelease",
      "PackageRegistryRelease",
      "PackageStorePublish",
      "SupplyChainPublish",
      "ProviderPublish",
      "OpaquePublish"
    ].includes(operation._tag))
    .map(({ operation }) => String(operation.id)))
  const operations = selected(accepted, scope)
    .filter(({ operationId }) => publishIds.has(operationId))
  const facts = materials.map((item) => ({
    outputId: item.outputId, snapshotId: item.snapshotId, digest: item.digest, size: item.size
  })).sort((left, right) => String(left.outputId).localeCompare(String(right.outputId)))
  return PublishReviewId.make(hash("ts-release/publish-review/v1", {
    executionReviewId: executionReview, sortedPublishInputFacts: facts,
    selectedPublishOperationIdsAndHashes: operations
  }))
}
export type PublishConfirmation = {
  readonly reviewId: PublishReviewId, readonly reviewer: string,
  readonly approvalNonce: ApprovalNonce, readonly approvedAt: string }
export const mintPublishReceipt = (receipt: ExecutionApprovalReceipt, expectedReviewId: PublishReviewId,
  confirmation: PublishConfirmation): PublishApprovalReceipt => {
  if (confirmation.reviewId !== expectedReviewId) fail("Publish confirmation does not match bytes.")
  if (confirmation.reviewer === "" || confirmation.approvedAt === "") fail("Publish confirmation lacks identity.")
  const body = {
    reviewId: expectedReviewId, executionReceiptId: receipt.receiptId,
    runId: receipt.runId, logicalRunId: receipt.logicalRunId,
    reviewer: confirmation.reviewer, approvalNonce: confirmation.approvalNonce,
    approvedAt: confirmation.approvedAt, topologyHash: receipt.topologyHash
  }
  return PublishApprovalReceipt.make({
    ...body, receiptId: ReceiptId.make(hash("ts-release/publish-receipt/v1", body)) })
}
export type ApprovalSignerShape = {
  readonly execution: (receipt: ExecutionApprovalReceipt, runId: RunId, reviewId: ExecutionReviewId) =>
    Effect.Effect<ExecutionPermit, ApprovalError>,
  readonly publish: (receipt: PublishApprovalReceipt, execution: ExecutionPermit, reviewId: PublishReviewId) =>
    Effect.Effect<PublishPermit, ApprovalError>
}
export class ApprovalSigner extends Context.Service<ApprovalSigner, ApprovalSignerShape>()("RewriteApprovalSigner") {}
export const LocalApprovalSignerLayer = Layer.succeed(ApprovalSigner)({
  execution: (receipt, runId, reviewId) => checked(() => {
    const { receiptId, ...body } = receipt
    if (receiptId !== hash("ts-release/execution-receipt/v1", body)) fail("Execution receipt identity is invalid.")
    return ExecutionPermit.from(receipt, runId, reviewId)
  }),
  publish: (receipt, execution, reviewId) => checked(() => {
    const { receiptId, ...body } = receipt
    if (receiptId !== hash("ts-release/publish-receipt/v1", body)) fail("Publish receipt identity is invalid.")
    return PublishPermit.from(receipt, execution, reviewId)
  })
})

export const reconciliationKey = (
  planId: string, logicalRunId: string, scope: ExecutionScope, topologyHash: string,
  operationHash: OperationHash, checkpointId: CheckpointId, target: string,
  materials: ReadonlyArray<MaterializedOutput>
): string => hash("ts-release/reconciliation/v1", {
  planId, logicalRunId, operationIds: [...scope.operationIds].map(String).sort(),
  topologyHash, operationHash, checkpointId, target,
  materials: materials.map((item) => [item.outputId, item.digest, item.size])
})
export const packageStoreReconciliationKey = (
  planId: string, logicalRunId: string, scope: ExecutionScope, topologyHash: string,
  operationHash: OperationHash, checkpointId: CheckpointId, profileId: string,
  targetCoordinates: PackageStoreTarget,
  materials: ReadonlyArray<MaterializedOutput>
): string => hash("ts-release/package-store-reconcile/v1", {
  planId, logicalRunId,
  scopeHash: scope.scopeHash ?? hash("ts-release/execution-scope/v1", {
    planId, operationIds: [...scope.operationIds].map(String).sort()
  }),
  executionTopologyHash: topologyHash, operationHash, checkpointId, profileId,
  targetCoordinates: {
    name: targetCoordinates.name,
    ...(targetCoordinates.channel === undefined ? {} : { channel: targetCoordinates.channel }),
    ...(targetCoordinates.version === undefined ? {} : { version: targetCoordinates.version })
  },
  materialBindingHashes: materials.map((item) => item.digest).sort()
})
export const supplyChainReconciliationKey = (
  planId: string, logicalRunId: string, scope: ExecutionScope, topologyHash: string,
  operationHash: OperationHash, checkpointId: CheckpointId, profileId: string,
  targetCoordinates: Readonly<Record<string, string>>, materials: ReadonlyArray<MaterializedOutput>,
  domain: "supply-chain" | "provider" = "supply-chain"
): string => hash(`ts-release/${domain}-reconcile/v1`, {
  planId, logicalRunId,
  scopeHash: scope.scopeHash ?? hash("ts-release/execution-scope/v1", {
    planId, operationIds: [...scope.operationIds].map(String).sort()
  }),
  executionTopologyHash: topologyHash, operationHash, checkpointId, profileId,
  immutableTargetCoordinates: targetCoordinates,
  materialBindingHashes: materials.map((item) => item.digest).sort()
})
