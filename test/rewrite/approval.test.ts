import { describe, expect, test } from "@effect/bun-test"
import {
  deriveLogicalRunId,
  executionReviewId,
  mintExecutionReceipt,
  mintPublishReceipt,
  publishReviewId,
  reconciliationKey
} from "../../src/apply/approval.js"
import {
  ExecutionPermit,
  PublishPermit
} from "../../src/model/permit.js"
import {
  ExecutionScope,
  MaterializedOutput
} from "../../src/model/run.js"
import {
  ApprovalNonce,
  CheckpointId,
  Digest,
  ExecutionTopologyHash,
  OperationHash,
  OperationId,
  OutputId,
  RunId,
  SnapshotId
} from "../../src/model/primitives.js"
import { acceptedRunPlan } from "./run-fixture.js"

const topology = ExecutionTopologyHash.make("single-machine/v1")
const alternateTopology = ExecutionTopologyHash.make("other-machine/v1")
const material = (outputId: string, digest: string) => MaterializedOutput.make({
  outputId: OutputId.make(outputId),
  snapshotId: SnapshotId.make(digest),
  digest: Digest.make(digest),
  size: 5,
  inode: 1
})

describe("run-bound review and approval", () => {
  test("execution review binds plan-order scope, closure, trusted exec, and topology", async () => {
    const accepted = await acceptedRunPlan()
    const ids = accepted.operationHashes.map(({ operationId }) =>
      OperationId.make(operationId))
    const full = ExecutionScope.make({ operationIds: ids })
    const reordered = ExecutionScope.make({ operationIds: [...ids].reverse() })
    const review = executionReviewId(accepted, full, topology)
    expect(executionReviewId(accepted, reordered, topology)).toBe(review)
    expect(executionReviewId(accepted, ExecutionScope.make({
      operationIds: ids.filter((id) => id !== "trusted")
    }), topology)).not.toBe(review)
    expect(executionReviewId(accepted, full, alternateTopology)).not.toBe(review)
  })

  test("execution receipts bind run, logical run, reviewer, nonce, time, and explicit rerun reason", async () => {
    const accepted = await acceptedRunPlan()
    const scope = ExecutionScope.make({
      operationIds: accepted.operationHashes.map(({ operationId }) =>
        OperationId.make(operationId))
    })
    const reviewId = executionReviewId(accepted, scope, topology)
    const first = mintExecutionReceipt(accepted, scope, topology, {
      reviewId,
      runId: RunId.make("run-1"),
      reviewer: "reviewer",
      approvalNonce: ApprovalNonce.make("nonce-1"),
      approvedAt: "2026-07-26T00:00:00.000Z"
    })
    const second = mintExecutionReceipt(accepted, scope, topology, {
      reviewId,
      runId: RunId.make("run-2"),
      reviewer: "reviewer",
      approvalNonce: ApprovalNonce.make("nonce-2"),
      approvedAt: "2026-07-26T00:01:00.000Z",
      newRunReason: "explicit independent rerun"
    })
    expect(first.receiptId).not.toBe(second.receiptId)
    expect(first.logicalRunId).toBe(deriveLogicalRunId(accepted, scope, topology))
    expect(second.logicalRunId).not.toBe(first.logicalRunId)
    expect(() => ExecutionPermit.from(first, RunId.make("run-2"))).toThrow()
    expect(() => mintExecutionReceipt(accepted, scope, topology, {
      reviewId: executionReviewId(accepted, scope, alternateTopology),
      runId: RunId.make("run"),
      reviewer: "reviewer",
      approvalNonce: ApprovalNonce.make("nonce"),
      approvedAt: "now"
    })).toThrow()
  })

  test("publish receipts and permits bind exact snapshot facts and execution receipt", async () => {
    const accepted = await acceptedRunPlan()
    const scope = ExecutionScope.make({
      operationIds: accepted.operationHashes.map(({ operationId }) =>
        OperationId.make(operationId))
    })
    const executionReview = executionReviewId(accepted, scope, topology)
    const execution = mintExecutionReceipt(accepted, scope, topology, {
      reviewId: executionReview,
      runId: RunId.make("run-1"),
      reviewer: "reviewer",
      approvalNonce: ApprovalNonce.make("execution-nonce"),
      approvedAt: "now"
    })
    const facts = [material("source", "a".repeat(64)), material("second", "b".repeat(64))]
    const reviewId = publishReviewId(accepted, executionReview, scope, facts)
    const receipt = mintPublishReceipt(execution, reviewId, {
      reviewId,
      reviewer: "reviewer",
      approvalNonce: ApprovalNonce.make("publish-nonce"),
      approvedAt: "later"
    })
    const executionPermit = ExecutionPermit.from(execution, execution.runId)
    expect(PublishPermit.from(receipt, executionPermit, reviewId).receipt).toBe(receipt)
    const changed = publishReviewId(
      accepted,
      executionReview,
      scope,
      [material("source", "c".repeat(64)), facts[1]!]
    )
    expect(changed).not.toBe(reviewId)
    expect(() => PublishPermit.from(receipt, executionPermit, changed)).toThrow()
    expect(() => mintPublishReceipt(execution, changed, {
      reviewId,
      reviewer: "reviewer",
      approvalNonce: ApprovalNonce.make("publish-nonce"),
      approvedAt: "later"
    })).toThrow()
  })

  test("reconciliation identity is stable across attempts and changes with target or bytes", async () => {
    const accepted = await acceptedRunPlan()
    const scope = ExecutionScope.make({
      operationIds: accepted.operationHashes.map(({ operationId }) =>
        OperationId.make(operationId))
    })
    const facts = [material("source", "a".repeat(64))]
    const args = [
      accepted.planId,
      deriveLogicalRunId(accepted, scope, topology),
      scope,
      topology,
      OperationHash.make(accepted.operationHashes[3]!.hash),
      CheckpointId.make("dispatch"),
      "https://example.invalid/upload",
      facts
    ] as const
    const key = reconciliationKey(...args)
    expect(reconciliationKey(...args)).toBe(key)
    expect(reconciliationKey(
      args[0],
      args[1],
      args[2],
      args[3],
      args[4],
      args[5],
      "https://other.invalid/upload",
      facts
    )).not.toBe(key)
  })
})
