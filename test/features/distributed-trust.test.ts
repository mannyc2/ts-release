import { describe, expect, test } from "@effect/bun-test"
import {
  attestLedger, authorizationNonce, generateWorkerKey,
  signAuthorization, verifyAuthorization, verifyLedgerAttestation
} from "../../src/apply/trust.js"
import {
  AttemptId, Digest, OperationHash
} from "../../src/model/primitives.js"
import { RunLedger } from "../../src/model/run.js"
import { distributedFixture } from "./distributed-fixture.js"

describe("signed distributed ledger trust", () => {
  test("authenticates whole-ledger bytes and rejects unsigned or changed state", async () => {
    const { pair, ledger } = await distributedFixture()
    const signed = await attestLedger(ledger, "worker", pair.privateKey)
    await expect(verifyLedgerAttestation(signed)).resolves.toBeUndefined()
    await expect(verifyLedgerAttestation(ledger)).rejects.toThrow()
    await expect(verifyLedgerAttestation(RunLedger.make({
      ...signed, revision: signed.revision + 1
    }))).rejects.toThrow()
  })

  test("binds authorization to worker, run, scope, topology, operation, attempt, and purpose", async () => {
    const { pair, scope, topologyHash, receipt, plan } = await distributedFixture()
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
