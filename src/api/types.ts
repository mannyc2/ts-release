import type * as Layer from "effect/Layer"
import type { ApprovalSigner } from "../apply/approval.js"
import type { RunStore } from "../apply/store.js"
import type { CredentialStore, DriverCatalog, WorkspaceStore } from "../drivers/services.js"
import type { ReleasePlanV6 } from "../model/plan.js"
import type { ExecutionReviewId, OperationId, PlanId, PublishReviewId, RunId } from "../model/primitives.js"
import type { ExecutionScope, RunLedger, Stage } from "../model/run.js"
import type { EvidenceProjection } from "../view/evidence.js"

export type ExecutionScopeInput = "all" | {
  readonly operationIds: ReadonlyArray<OperationId | string>
}
export interface ExecutionTopology { readonly id: string }
export type ReviewerIdentity = string
export interface OperatorResolution {
  readonly operationId: OperationId | string, readonly outcome: "committed" | "absent"
  readonly operator: string, readonly reason: string
}
export type { EvidenceProjection } from "../view/evidence.js"
export type ApplyStatus = "complete" | "stopped" | "publish-review-required"
export type ReleaseApiServices = RunStore | DriverCatalog | WorkspaceStore | CredentialStore | ApprovalSigner
export type ReleaseApiLayer = Layer.Layer<ReleaseApiServices>

export interface PlanInput { readonly config: unknown, readonly workspace: string }
export interface ReviewExecutionInput {
  readonly planBytes: string, readonly expectedPlanId: PlanId, readonly scope: ExecutionScopeInput
  readonly topology?: ExecutionTopology
}
export interface ApplyInput {
  readonly planBytes: string, readonly expectedPlanId: PlanId, readonly workspace: string
  readonly newRun?: {
    readonly path: string, readonly scope: ExecutionScopeInput
    readonly executionReviewId: ExecutionReviewId, readonly reviewer: ReviewerIdentity
    readonly reason?: string
  }
  readonly resumeRunPath?: string, readonly through?: Stage
  readonly publishConfirmation?: {
    readonly publishReviewId: PublishReviewId, readonly reviewer: ReviewerIdentity
  }
  readonly reconcile?: ReadonlyArray<OperationId | string>, readonly resolutions?: ReadonlyArray<OperatorResolution>
}
export interface ApplyOutput {
  readonly runId: RunId, readonly runPath: string, readonly ledger: RunLedger
  readonly evidence: EvidenceProjection, readonly executionReceiptId: string
  readonly nextPublishReviewId?: PublishReviewId, readonly publishReceiptId?: string
  readonly status: ApplyStatus
}
export interface ReleaseApi {
  readonly plan: (input: PlanInput) => Promise<{
    readonly plan: ReleasePlanV6, readonly bytes: string, readonly planId: PlanId
  }>
  readonly reviewExecution: (input: ReviewExecutionInput) => Promise<{
    readonly scope: ExecutionScope, readonly executionReviewId: ExecutionReviewId
  }>
  readonly apply: (input: ApplyInput) => Promise<ApplyOutput>, readonly dispose: () => Promise<void>
}
