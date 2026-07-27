import { ApprovalError, type ExecutionApprovalReceipt, type PublishApprovalReceipt } from "./run.js"
import type { PublishReviewId, RunId } from "./primitives.js"

const fail = (reason: string): never => { throw ApprovalError.make({ reason }) }
export class ExecutionPermit {
  private constructor(readonly receipt: ExecutionApprovalReceipt) {}
  static from(receipt: ExecutionApprovalReceipt, runId: RunId, reviewId = receipt.reviewId): ExecutionPermit {
    if (receipt.runId !== runId || receipt.reviewId !== reviewId)
      fail("Execution receipt cannot authorize this review or another run.")
    return new ExecutionPermit(receipt)
  }
}
export class PublishPermit {
  private constructor(readonly receipt: PublishApprovalReceipt) {}
  static from(receipt: PublishApprovalReceipt, execution: ExecutionPermit,
    reviewId: PublishReviewId): PublishPermit {
    if (receipt.executionReceiptId !== execution.receipt.receiptId ||
      receipt.reviewId !== reviewId || receipt.runId !== execution.receipt.runId ||
      receipt.logicalRunId !== execution.receipt.logicalRunId ||
      receipt.topologyHash !== execution.receipt.topologyHash)
      fail("Publish receipt cannot authorize this material or execution.")
    return new PublishPermit(receipt)
  }
}
