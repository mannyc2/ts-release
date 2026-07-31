import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { applyAcceptedPlan, type ApplyRecovery } from "../apply/apply.js"
import { mintExecutionReceipt, mintPublishReceipt } from "../apply/approval.js"
import { createLedger, validateLedger } from "../apply/ledger.js"
import { settled } from "../apply/transition.js"
import { decodeLedger } from "../apply/store.js"
import { acceptExpected, type AcceptedPlan } from "../plan/review.js"
import {
  ApprovalNonce, CheckpointId, OperationHash, OperationId, type PublishReviewId, RunId
} from "../model/primitives.js"
import type { RunLedger } from "../model/run.js"
import { projectEvidence } from "../view/evidence.js"
import { ReleaseApiError } from "./errors.js"
import {
  exact, selectScope, topology, within, workspace, type ApiRun
} from "./input.js"
import type { ApplyInput, ApplyOutput, ApplyStatus } from "./types.js"

const complete = (ledger: RunLedger): boolean => ledger.operations
  .filter((record) => ledger.scope.operationIds.includes(record.operationId))
  .every((record) => settled(record.attempts.at(-1)?.state))
const receipt = (ledger: RunLedger) => ledger.operations[0]?.attempts[0]?.executionReceipt
const expectedLedger = (plan: AcceptedPlan, ledger: RunLedger) => ({
  planId: plan.planId,
  operationHashes: plan.operationHashes.map(({ hash }) => OperationHash.make(hash)),
  scope: ledger.scope,
  topologyHash: ledger.executionTopologyHash
})
const recoveries = (ledger: RunLedger, input: ApplyInput): ReadonlyArray<ApplyRecovery> => [
  ...(input.resolutions ?? []).map((item) => ({
    _tag: "Resolve" as const,
    operationId: OperationId.make(String(item.operationId)),
    resolution: item.outcome,
    operator: item.operator,
    reason: item.reason,
    at: new Date().toISOString()
  })),
  ...(input.reconcile ?? []).flatMap((id) => {
    const state = ledger.operations
      .find((item) => item.operationId === String(id))
      ?.attempts.at(-1)?.state
    return state?._tag === "CommitUnknown"
      ? state.progress.filter((item) => item._tag === "CheckpointUnknown").map((item) => ({
          _tag: "Reconcile" as const,
          operationId: OperationId.make(String(id)),
          checkpointId: CheckpointId.make(item.checkpointId)
        }))
      : []
  })
]

interface PreparedRun {
  readonly ledger: RunLedger, readonly runPath: string
  readonly execution: NonNullable<ReturnType<typeof receipt>>
}
type ApplyResult = RunLedger | {
  readonly _tag: "PublishReviewRequired", readonly reviewId: PublishReviewId
  readonly ledger: RunLedger
}
const prepareNew = (plan: AcceptedPlan, root: string, input: ApplyInput): PreparedRun => {
  const request = input.newRun!
  exact("apply", request, ["path", "scope", "executionReviewId", "reviewer", "reason"], "newRun")
  const selected = selectScope(plan, request.scope)
  const topologyHash = topology()
  const execution = mintExecutionReceipt(plan, selected, topologyHash, {
    reviewId: request.executionReviewId,
    runId: RunId.make(randomUUID()),
    reviewer: request.reviewer,
    approvalNonce: ApprovalNonce.make(randomUUID()),
    approvedAt: new Date().toISOString(),
    ...(request.reason === undefined ? {} : { newRunReason: request.reason })
  })
  return {
    execution,
    runPath: within(root, request.path),
    ledger: createLedger(plan, {
      runId: execution.runId,
      logicalRunId: execution.logicalRunId,
      scope: selected,
      frontier: "build",
      topologyHash,
      receipt: execution
    })
  }
}
const prepareResume = (plan: AcceptedPlan, root: string, path: string): PreparedRun => {
  const runPath = within(root, path)
  const ledger = decodeLedger(readFileSync(runPath, "utf8"))
  validateLedger(plan, ledger)
  const execution = receipt(ledger)
  if (execution === undefined) {
    throw new ReleaseApiError("apply", "Run ledger has no execution receipt.")
  }
  return { runPath, ledger, execution }
}
const output = (
  prepared: PreparedRun, ledger: RunLedger, status: ApplyStatus,
  extra: Partial<ApplyOutput> = {}
): ApplyOutput => ({
  runId: ledger.runId,
  runPath: prepared.runPath,
  ledger,
  evidence: projectEvidence(ledger),
  executionReceiptId: prepared.execution.receiptId,
  status,
  ...extra
})
const publishOutput = async (
  run: ApiRun,
  plan: AcceptedPlan,
  input: ApplyInput,
  prepared: PreparedRun,
  review: ApplyResult
): Promise<ApplyOutput> => {
  if (!("_tag" in review)) {
    return output(prepared, review, complete(review) ? "complete" : "stopped")
  }
  if (input.publishConfirmation === undefined) {
    return output(prepared, review.ledger, "publish-review-required", {
      nextPublishReviewId: review.reviewId
    })
  }
  exact("apply", input.publishConfirmation, ["publishReviewId", "reviewer"], "publishConfirmation")
  const publish = mintPublishReceipt(prepared.execution, review.reviewId, {
    reviewId: input.publishConfirmation.publishReviewId,
    reviewer: input.publishConfirmation.reviewer,
    approvalNonce: ApprovalNonce.make(randomUUID()),
    approvedAt: new Date().toISOString()
  })
  const second = await run("apply", applyAcceptedPlan(plan, {
    root: workspace("apply", input.workspace),
    snapshotDirectory: `${prepared.runPath}.snapshots`,
    through: input.through ?? "verify",
    executionReceipt: prepared.execution,
    recoveries: recoveries(review.ledger, input),
    run: {
      _tag: "ResumeRun",
      path: prepared.runPath,
      expected: expectedLedger(plan, review.ledger)
    },
    publish: { receipt: publish }
  }))
  if ("_tag" in second) throw new ReleaseApiError("apply", "Publish review did not advance.")
  return output(prepared, second, complete(second) ? "complete" : "stopped", {
    publishReceiptId: publish.receiptId
  })
}

export const makeApply = (run: ApiRun) => async (input: ApplyInput): Promise<ApplyOutput> => {
  exact("apply", input, [
    "planBytes", "expectedPlanId", "workspace", "newRun", "resumeRunPath", "through",
    "publishConfirmation", "reconcile", "resolutions"
  ], "apply input")
  if ((input.newRun === undefined) === (input.resumeRunPath === undefined)) {
    throw new ReleaseApiError("apply", "Choose exactly one of newRun or resumeRunPath.")
  }
  const plan = await run("apply", acceptExpected(input.planBytes, input.expectedPlanId))
  const root = workspace("apply", input.workspace)
  const prepared = input.newRun === undefined
    ? prepareResume(plan, root, input.resumeRunPath!)
    : prepareNew(plan, root, input)
  const first = await run("apply", applyAcceptedPlan(plan, {
    root,
    snapshotDirectory: `${prepared.runPath}.snapshots`,
    through: input.through ?? "verify",
    executionReceipt: prepared.execution,
    recoveries: recoveries(prepared.ledger, input),
    run: input.newRun === undefined
      ? {
          _tag: "ResumeRun",
          path: prepared.runPath,
          expected: expectedLedger(plan, prepared.ledger)
        }
      : { _tag: "NewRun", path: prepared.runPath, ledger: prepared.ledger }
  }))
  return publishOutput(run, plan, input, prepared, first)
}
