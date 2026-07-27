import { describe, expect, test } from "@effect/bun-test"
import {
  mintExecutionReceipt, executionReviewId
} from "../../src/apply/approval.js"
import { createLedger } from "../../src/apply/ledger.js"
import {
  executionTopologyHash, partition, registerTopology
} from "../../src/apply/partition.js"
import {
  attestLedger, authorizationNonce, exportWorkerKey, generateWorkerKey,
  signAuthorization, verifyAuthorization, verifyLedgerAttestation
} from "../../src/apply/trust.js"
import {
  ApprovalNonce, AttemptId, Digest, OperationHash, RunId
} from "../../src/model/primitives.js"
import { RunLedger } from "../../src/model/run.js"
import { acceptedRunPlan } from "../rewrite/run-fixture.js"

const fixture = async () => {
  const plan = await acceptedRunPlan()
  const pair = await generateWorkerKey()
  const scope = partition(plan, [{
    workerId: "worker", operationIds: ["trusted", "upload", "forge"]
  }])[0]!
  const topology = registerTopology(plan, [scope], {
    worker: await exportWorkerKey(pair.publicKey)
  })
  const topologyHash = executionTopologyHash(topology)
  const receipt = mintExecutionReceipt(plan, scope, topologyHash, {
    reviewId: executionReviewId(plan, scope, topologyHash),
    runId: RunId.make("run-distributed"), reviewer: "reviewer",
    approvalNonce: ApprovalNonce.make("execution-nonce"),
    approvedAt: "2026-07-26T00:00:00.000Z"
  })
  const ledger = createLedger(plan, {
    runId: receipt.runId, logicalRunId: receipt.logicalRunId,
    scope, frontier: "build", topologyHash, topology, receipt
  })
  return { plan, pair, scope, topologyHash, receipt, ledger }
}

describe("signed distributed ledger trust", () => {
  test("authenticates whole-ledger bytes and rejects unsigned or changed state", async () => {
    const { pair, ledger } = await fixture()
    const signed = await attestLedger(ledger, "worker", pair.privateKey)
    await expect(verifyLedgerAttestation(signed)).resolves.toBeUndefined()
    await expect(verifyLedgerAttestation(ledger)).rejects.toThrow()
    await expect(verifyLedgerAttestation(RunLedger.make({
      ...signed, revision: signed.revision + 1
    }))).rejects.toThrow()
  })

  test("binds authorization to worker, run, scope, topology, operation, attempt, and purpose", async () => {
    const { pair, scope, topologyHash, receipt, plan } = await fixture()
    const operationHash = OperationHash.make(plan.operationHashes[2]!.hash)
    const signed = await signAuthorization({
      signerWorkerId: scope.workerId!, planId: plan.planId,
      logicalRunId: receipt.logicalRunId, scopeHash: scope.scopeHash!,
      topologyHash, operationHash, attemptId: AttemptId.make("attempt-1"),
      purpose: "execute", reviewer: "reviewer", reviewChallengeId: receipt.reviewId,
      nonce: authorizationNonce("attempt-nonce"),
      issuedAt: "2026-07-26T00:00:00.000Z",
      materialBindingHashes: [Digest.make("material")]
    }, pair.privateKey)
    await expect(verifyAuthorization(signed, pair.publicKey)).resolves.toBeUndefined()
    await expect(verifyAuthorization({
      ...signed, purpose: "publish"
    }, pair.publicKey)).rejects.toThrow()
    const foreign = await generateWorkerKey()
    await expect(verifyAuthorization(signed, foreign.publicKey)).rejects.toThrow()
  })
})
