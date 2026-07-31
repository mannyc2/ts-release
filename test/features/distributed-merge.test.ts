import { createHash } from "node:crypto"
import { describe, expect, test } from "@effect/bun-test"
import {
  executionReviewId, mintExecutionReceipt
} from "../../src/apply/approval.js"
import { createLedger } from "../../src/apply/ledger.js"
import { mergeLedgers } from "../../src/apply/merge.js"
import {
  executionTopologyHash, partition, registerTopology
} from "../../src/apply/partition.js"
import {
  attestLedger, authorizationNonce, exportWorkerKey, generateWorkerKey,
  materialBindingHash, signAuthorization
} from "../../src/apply/trust.js"
import { transition } from "../../src/apply/transition.js"
import {
  ApprovalNonce, AttemptId, Digest, LogicalRunId, OperationHash,
  OperationId, OutputId, RunId, SnapshotId
} from "../../src/model/primitives.js"
import {
  AttemptRecord, ManualReview, OperationRunRecord, RunLedger, SignedAuthorizationReceipt
} from "../../src/model/run.js"
import { acceptedRunPlan } from "../core/run-fixture.js"

const setup = async () => {
  const plan = await acceptedRunPlan()
  const buildKey = await generateWorkerKey()
  const publishKey = await generateWorkerKey()
  const scopes = partition(plan, [
    { workerId: "build", operationIds: ["trusted"] },
    { workerId: "publish", operationIds: ["upload", "forge"] }
  ])
  const topology = registerTopology(plan, scopes, {
    build: await exportWorkerKey(buildKey.publicKey),
    publish: await exportWorkerKey(publishKey.publicKey)
  })
  const topologyHash = executionTopologyHash(topology)
  const logicalRunId = LogicalRunId.make("shared-logical-run")
  const ledger = (index: number) => {
    const scope = scopes[index]!
    const receipt = mintExecutionReceipt(plan, scope, topologyHash, {
      reviewId: executionReviewId(plan, scope, topologyHash),
      runId: RunId.make(`run-${scope.workerId}`), logicalRunId,
      reviewer: "reviewer", approvalNonce: ApprovalNonce.make(`nonce-${scope.workerId}`),
      approvedAt: "2026-07-26T00:00:00.000Z"
    })
    return createLedger(plan, {
      runId: receipt.runId, logicalRunId, scope, frontier: "build",
      topologyHash, topology, receipt
    })
  }
  const bytes = new TextEncoder().encode("merged bytes")
  const digest = createHash("sha256").update(bytes).digest("hex")
  let donor = ledger(0)
  const moved = transition(plan, donor, {
    _tag: "BeginTrustedExec", operationId: OperationId.make("trusted"), at: "now"
  })
  if ("_tag" in moved) throw moved
  const passed = transition(plan, moved, {
    _tag: "Pass", operationId: OperationId.make("trusted"), detail: "built",
    outputs: [{
      outputId: OutputId.make("processed"), snapshotId: SnapshotId.make("snapshot"),
      digest: Digest.make(digest), size: bytes.length, inode: 1
    }]
  })
  if ("_tag" in passed) throw passed
  const index = passed.operations.findIndex((item) => item.operationId === "trusted")
  const record = passed.operations[index]!
  const attempt = record.attempts.at(-1)!
  const authorization = await signAuthorization({
    signerWorkerId: scopes[0]!.workerId!, planId: plan.planId, logicalRunId,
    scopeHash: scopes[0]!.scopeHash!, topologyHash,
    operationHash: OperationHash.make(plan.operationHashes[index]!.hash),
    attemptId: AttemptId.make(attempt.attemptId), purpose: "execute",
    reviewer: "reviewer", reviewChallengeId: attempt.executionReceipt.reviewId,
    nonce: authorizationNonce("attempt-nonce"), issuedAt: "2026-07-26T00:00:00.000Z",
    materialBindingHashes: [materialBindingHash("processed", "dist/processed", bytes.length, digest)]
  }, buildKey.privateKey)
  donor = RunLedger.make({
    ...passed, operations: passed.operations.map((item, itemIndex) => itemIndex === index
      ? OperationRunRecord.make({
          ...record, attempts: [...record.attempts.slice(0, -1), AttemptRecord.make({
            ...attempt, authorizationReceipt: authorization
          })]
        }) : item)
  })
  return {
    plan, donor: await attestLedger(donor, "build", buildKey.privateKey),
    target: await attestLedger(ledger(1), "publish", publishKey.privateKey),
    buildKey, publishKey
  }
}

describe("authenticated run-ledger merge", () => {
  test("imports only registered, authorized terminal owner facts", async () => {
    const { plan, donor, target, publishKey } = await setup()
    const merged = await mergeLedgers(plan, target, [donor, donor], "publish", publishKey.privateKey)
    const attempt = merged.operations.find((item) => item.operationId === "trusted")!.attempts.at(-1)!
    expect(attempt.state._tag).toBe("Passed")
    expect(String(attempt.importedFrom?.workerId)).toBe("build")
    expect(merged.revision).toBe(target.revision + 1)
  })

  test("rejects forged attestation, receipt replay, and nonterminal state", async () => {
    const { plan, donor, target, buildKey, publishKey } = await setup()
    await expect(mergeLedgers(plan, target, [RunLedger.make({
      ...donor, revision: donor.revision + 1
    })], "publish", publishKey.privateKey)).rejects.toThrow()
    const trusted = donor.operations.find((item) => item.operationId === "trusted")!
    const replayed = RunLedger.make({
      ...donor, operations: donor.operations.map((item) => item.operationId === "trusted"
        ? OperationRunRecord.make({
            ...trusted, attempts: [AttemptRecord.make({
              ...trusted.attempts[0]!,
              authorizationReceipt: SignedAuthorizationReceipt.make({
                ...trusted.attempts[0]!.authorizationReceipt!,
                operationHash: OperationHash.make(plan.operationHashes[3]!.hash)
              })
            })]
          }) : item)
    })
    await expect(mergeLedgers(plan, target, [
      await attestLedger(replayed, "build", buildKey.privateKey)
    ], "publish", publishKey.privateKey)).rejects.toThrow()
    const nonterminal = RunLedger.make({
      ...donor, operations: donor.operations.map((item) => item.operationId === "trusted"
        ? OperationRunRecord.make({
            ...trusted, attempts: [AttemptRecord.make({
              ...trusted.attempts[0]!, state: ManualReview.make({ reason: "unknown" })
            })]
          }) : item)
    })
    await expect(mergeLedgers(plan, target, [
      await attestLedger(nonterminal, "build", buildKey.privateKey)
    ], "publish", publishKey.privateKey))
      .rejects.toThrow()
  })
})
