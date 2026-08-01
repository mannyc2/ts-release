import { describe, expect, test } from "@effect/bun-test"
import * as Schema from "effect/Schema"
import {
  ExecutionApprovalReceipt,
  ExecutionScope,
  MaterializedOutput,
  PublishApprovalReceipt,
  RunLedger
} from "../../src/model/run.js"
import {
  ApprovalNonce,
  CheckpointId,
  Digest,
  ExecutionReviewId,
  ExecutionTopologyHash,
  LogicalRunId,
  OperationId,
  OutputId,
  PublishReviewId,
  ReceiptId,
  RunId,
  SnapshotId
} from "../../src/model/primitives.js"
import {
  checkpointIds,
  createLedger,
  operationStatus,
  transition,
  validateLedger,
  type TransitionCommand
} from "../../src/apply/transition.js"
import { acceptedRunPlan, supplyChainRunPlan } from "./run-fixture.js"

const topology = ExecutionTopologyHash.make("single-machine/v1")
const runId = RunId.make("run-1")
const logicalRunId = LogicalRunId.make("logical-1")
const executionReceipt = ExecutionApprovalReceipt.make({
  receiptId: ReceiptId.make("execution-receipt"),
  reviewId: ExecutionReviewId.make("execution-review"),
  runId,
  logicalRunId,
  reviewer: "reviewer",
  approvalNonce: ApprovalNonce.make("nonce-1"),
  approvedAt: "2026-07-26T00:00:00.000Z",
  topologyHash: topology
})
const publishReceipt = PublishApprovalReceipt.make({
  receiptId: ReceiptId.make("publish-receipt"),
  reviewId: PublishReviewId.make("publish-review"),
  executionReceiptId: executionReceipt.receiptId,
  runId,
  logicalRunId,
  reviewer: "reviewer",
  approvalNonce: ApprovalNonce.make("nonce-2"),
  approvedAt: "2026-07-26T00:01:00.000Z",
  topologyHash: topology
})
const selected = ["source", "second", "trusted", "upload", "forge"]
  .map((id) => OperationId.make(id))
const apply = (
  accepted: Awaited<ReturnType<typeof acceptedRunPlan>>,
  ledger: RunLedger,
  command: TransitionCommand
): RunLedger => {
  const result = transition(accepted, ledger, command)
  if ("_tag" in result) throw result
  return result
}
const transitionTag = (value: RunLedger | { readonly _tag: string }) =>
  "_tag" in value ? value._tag : undefined
const fresh = async () => {
  const accepted = await acceptedRunPlan()
  const ledger = createLedger(accepted, {
    runId,
    logicalRunId,
    scope: ExecutionScope.make({ operationIds: selected }),
    frontier: "verify",
    topologyHash: topology,
    receipt: executionReceipt
  })
  return { accepted, ledger }
}

describe("run-ledger/v1 reducer", () => {
  test("creates one exact record per operation and strictly decodes", async () => {
    const { accepted, ledger } = await fresh()
    expect(ledger.operations.map((record) => record.operationId)).toEqual(selected)
    expect(ledger.operations.every((record) => record.attempts.length === 1)).toBe(true)
    expect(() => validateLedger(accepted, ledger)).not.toThrow()
    const encoded = Schema.encodeSync(RunLedger)(ledger)
    expect(() => Schema.decodeUnknownSync(RunLedger, {
      onExcessProperty: "error"
    })({ ...encoded, excess: true })).toThrow()
  })

  test("preserves terminal attempts when retrying replay-safe work", async () => {
    const { accepted, ledger: initial } = await fresh()
    let ledger = apply(accepted, initial, {
      _tag: "BeginStructured",
      operationId: OperationId.make("source"),
      at: "now"
    })
    ledger = apply(accepted, ledger, {
      _tag: "FailBeforeCommit",
      operationId: OperationId.make("source"),
      detail: "definite",
      retryable: true
    })
    ledger = apply(accepted, ledger, {
      _tag: "Retry",
      operationId: OperationId.make("source"),
      receipt: executionReceipt
    })
    const attempts = ledger.operations[0]!.attempts
    expect(attempts.map((attempt) => attempt.state._tag)).toEqual([
      "FailedBeforeCommit",
      "Pending"
    ])
    expect(attempts.map((attempt) => String(attempt.attemptId))).toEqual([
      "attempt-1",
      "attempt-2"
    ])
  })

  test("recovers durable publish intent to unknown and never silently replays", async () => {
    const { accepted, ledger: initial } = await fresh()
    const upload = OperationId.make("upload")
    let ledger = apply(accepted, initial, {
      _tag: "BeginPublish",
      operationId: upload,
      receipt: publishReceipt
    })
    ledger = apply(accepted, ledger, {
      _tag: "DispatchCheckpoint",
      operationId: upload,
      checkpointId: CheckpointId.make("dispatch"),
      key: "stable-key"
    })
    ledger = apply(accepted, ledger, { _tag: "Recover" })
    expect(operationStatus(ledger, upload)?._tag).toBe("CommitUnknown")
    expect(transitionTag(transition(accepted, ledger, {
      _tag: "BeginPublish",
      operationId: upload,
      receipt: publishReceipt
    }))).toBe("TransitionError")
    ledger = apply(accepted, ledger, {
      _tag: "Reconcile",
      operationId: upload,
      checkpointId: CheckpointId.make("dispatch"),
      result: "absent",
      detail: "lookup proved absent"
    })
    expect(operationStatus(ledger, upload)?._tag).toBe("FailedBeforeCommit")
  })

  test("persists exact composite checkpoints and requires all before pass", async () => {
    const { accepted, ledger: initial } = await fresh()
    const forgeId = OperationId.make("forge")
    const operation = accepted.plan.stages.publish[1]!
    expect(checkpointIds(operation).map(String)).toEqual([
      "release",
      "asset:source",
      "asset:second"
    ])
    let ledger = apply(accepted, initial, {
      _tag: "BeginPublish",
      operationId: forgeId,
      receipt: publishReceipt
    })
    expect(transitionTag(transition(accepted, ledger, {
      _tag: "Pass",
      operationId: forgeId,
      detail: "incomplete"
    }))).toBe("TransitionError")
    for (const checkpointId of checkpointIds(operation)) {
      ledger = apply(accepted, ledger, {
        _tag: "DispatchCheckpoint",
        operationId: forgeId,
        checkpointId,
        key: `key:${checkpointId}`
      })
      ledger = apply(accepted, ledger, {
        _tag: "PassCheckpoint",
        operationId: forgeId,
        checkpointId,
        detail: `passed:${checkpointId}`
      })
    }
    ledger = apply(accepted, ledger, {
      _tag: "Pass",
      operationId: forgeId,
      detail: "release and assets observed"
    })
    expect(operationStatus(ledger, forgeId)?._tag).toBe("Passed")
  })

  test("an unknown supply-chain profile refuses at publish begin, never passes", async () => {
    const accepted = await supplyChainRunPlan("supply.not-a-profile.v1")
    const supply = OperationId.make("supply")
    const ledger = createLedger(accepted, {
      runId,
      logicalRunId,
      scope: ExecutionScope.make({ operationIds: [supply] }),
      frontier: "publish",
      topologyHash: topology,
      receipt: executionReceipt
    })
    const result = transition(accepted, ledger, {
      _tag: "BeginPublish",
      operationId: supply,
      receipt: publishReceipt
    })
    expect(transitionTag(result)).toBe("TransitionError")
    expect("reason" in result ? result.reason : "")
      .toContain("Unknown supply-chain profile supply.not-a-profile.v1")
  })

  test("trusted exec recovery is manual and identity/frontier rewrites refuse", async () => {
    const { accepted, ledger: initial } = await fresh()
    const trusted = OperationId.make("trusted")
    let ledger = apply(accepted, initial, {
      _tag: "BeginTrustedExec",
      operationId: trusted,
      at: "now"
    })
    ledger = apply(accepted, ledger, { _tag: "Recover" })
    expect(operationStatus(ledger, trusted)?._tag).toBe("ManualReview")
    expect(transitionTag(transition(accepted, ledger, {
      _tag: "AdvanceFrontier",
      frontier: "build"
    }))).toBe("TransitionError")
    const foreign = RunLedger.make({ ...ledger, planId: "foreign" as RunLedger["planId"] })
    expect(transitionTag(transition(accepted, foreign, { _tag: "Recover" })))
      .toBe("TransitionError")
  })

  test("materialized output identity is declaration-bound", async () => {
    const { accepted, ledger: initial } = await fresh()
    let ledger = apply(accepted, initial, {
      _tag: "BeginStructured",
      operationId: OperationId.make("source"),
      at: "now"
    })
    const output = MaterializedOutput.make({
      outputId: OutputId.make("source"),
      snapshotId: SnapshotId.make("snapshot"),
      digest: Digest.make("digest"),
      size: 1,
      inode: 1
    })
    ledger = apply(accepted, ledger, {
      _tag: "Pass",
      operationId: OperationId.make("source"),
      detail: "observed",
      outputs: [output]
    })
    expect(operationStatus(ledger, OperationId.make("source"))?._tag).toBe("Passed")
  })
})
