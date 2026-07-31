import {
  executionReviewId, mintExecutionReceipt
} from "../../src/apply/approval.js"
import { createLedger } from "../../src/apply/ledger.js"
import {
  executionTopologyHash, partition, registerTopology
} from "../../src/apply/partition.js"
import {
  exportWorkerKey, generateWorkerKey
} from "../../src/apply/trust.js"
import { ApprovalNonce, RunId } from "../../src/model/primitives.js"
import { acceptedRunPlan } from "../core/run-fixture.js"

export const distributedFixture = async () => {
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
