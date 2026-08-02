import { describe, expect, test } from "@effect/bun-test"
import * as Result from "effect/Result"
import {
  ExecutionApprovalReceipt,
  ExecutionScope,
  type RunLedger
} from "../../src/model/run.js"
import {
  ApprovalNonce,
  ExecutionReviewId,
  ExecutionTopologyHash,
  LogicalRunId,
  OperationId,
  ReceiptId,
  RunId
} from "../../src/model/primitives.js"
import {
  createLedger,
  transition,
  type TransitionCommand
} from "../../src/apply/transition.js"
import { projectEvidence } from "../../src/view/evidence.js"
import { acceptedRunPlan } from "./run-fixture.js"

const selected = ["source", "second", "trusted", "upload", "forge"]
  .map((id) => OperationId.make(id))
const apply = (
  accepted: Awaited<ReturnType<typeof acceptedRunPlan>>,
  ledger: RunLedger,
  command: TransitionCommand
): RunLedger => {
  const result = transition(accepted, ledger, command)
  if (Result.isFailure(result)) throw result.failure
  return result.success
}
const fresh = async () => {
  const accepted = await acceptedRunPlan()
  const topology = ExecutionTopologyHash.make("single-machine/v1")
  const logicalRunId = LogicalRunId.make("logical")
  const runId = RunId.make("run")
  const ledger = createLedger(accepted, {
    runId,
    logicalRunId,
    scope: ExecutionScope.make({ operationIds: selected }),
    frontier: "build",
    topologyHash: topology,
    receipt: ExecutionApprovalReceipt.make({
      receiptId: ReceiptId.make("receipt"),
      reviewId: ExecutionReviewId.make("review"),
      runId,
      logicalRunId,
      reviewer: "reviewer",
      approvalNonce: ApprovalNonce.make("nonce"),
      approvedAt: "2026-08-01T00:00:00.000Z",
      topologyHash: topology
    })
  })
  return { accepted, ledger }
}

describe("evidence projection", () => {
  test("mirrors ledger identity and maps each operation to its latest attempt state", async () => {
    const { accepted, ledger: initial } = await fresh()
    let ledger = apply(accepted, initial, {
      _tag: "BeginStructured",
      operationId: OperationId.make("source"),
      at: "2026-08-01T00:00:01.000Z"
    })
    ledger = apply(accepted, ledger, {
      _tag: "Pass",
      operationId: OperationId.make("source"),
      detail: "checked"
    })
    ledger = apply(accepted, ledger, {
      _tag: "BeginStructured",
      operationId: OperationId.make("second"),
      at: "2026-08-01T00:00:02.000Z"
    })
    const projection = projectEvidence(ledger)
    expect(projection.schemaVersion).toBe("evidence-projection/v1")
    expect(projection.planId).toBe(ledger.planId)
    expect(projection.runId).toBe(ledger.runId)
    expect(projection.frontier).toBe(ledger.frontier)
    expect(projection.operations.map(({ operationId }) => operationId))
      .toEqual(selected)
    expect(projection.operations.map(({ status }) => status)).toEqual([
      "Passed",
      "RunningStructured",
      "Pending",
      "Pending",
      "Pending"
    ])
  })

  test("publishes only the declared fields; ledger internals can never leak", async () => {
    const { ledger } = await fresh()
    const projection = projectEvidence(ledger)
    // The projection is the artifact release automation uploads. Failure
    // detail and observed publish outcomes stay in the ledger.
    expect(Object.keys(projection).sort()).toEqual([
      "frontier",
      "operations",
      "planId",
      "runId",
      "schemaVersion"
    ])
    for (const operation of projection.operations) {
      expect(Object.keys(operation).sort()).toEqual(["operationId", "status"])
    }
  })
})
