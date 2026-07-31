import * as Schema from "effect/Schema"

const identifier = <const Name extends string>(name: Name) =>
  Schema.NonEmptyString.pipe(Schema.brand(name))

export const PlanId = identifier("PlanId"); export type PlanId = typeof PlanId.Type
export const OperationId = identifier("OperationId"); export type OperationId = typeof OperationId.Type
export const OutputId = identifier("OutputId"); export type OutputId = typeof OutputId.Type
export const RecipeId = identifier("RecipeId"); export type RecipeId = typeof RecipeId.Type
export const ProfileId = identifier("ProfileId"); export type ProfileId = typeof ProfileId.Type
export const Digest = identifier("Digest"); export type Digest = typeof Digest.Type
export const CredentialName = identifier("CredentialName"); export type CredentialName = typeof CredentialName.Type
export const NonEmptyName = identifier("NonEmptyName"); export type NonEmptyName = typeof NonEmptyName.Type
export const Version = identifier("Version"); export type Version = typeof Version.Type
export const RunId = identifier("RunId"); export type RunId = typeof RunId.Type
export const LogicalRunId = identifier("LogicalRunId"); export type LogicalRunId = typeof LogicalRunId.Type
export const AttemptId = identifier("AttemptId"); export type AttemptId = typeof AttemptId.Type
export const OperationHash = identifier("OperationHash"); export type OperationHash = typeof OperationHash.Type
export const ExecutionTopologyHash = identifier("ExecutionTopologyHash")
export type ExecutionTopologyHash = typeof ExecutionTopologyHash.Type
export const ExecutionScopeHash = identifier("ExecutionScopeHash")
export type ExecutionScopeHash = typeof ExecutionScopeHash.Type
export const WorkerId = identifier("WorkerId"); export type WorkerId = typeof WorkerId.Type
export const WorkerKeyFingerprint = identifier("WorkerKeyFingerprint")
export type WorkerKeyFingerprint = typeof WorkerKeyFingerprint.Type
export const ProjectId = identifier("ProjectId"); export type ProjectId = typeof ProjectId.Type
export const ExecutionReviewId = identifier("ExecutionReviewId")
export type ExecutionReviewId = typeof ExecutionReviewId.Type
export const PublishReviewId = identifier("PublishReviewId"); export type PublishReviewId = typeof PublishReviewId.Type
export const ReceiptId = identifier("ReceiptId"); export type ReceiptId = typeof ReceiptId.Type
export const ApprovalNonce = identifier("ApprovalNonce"); export type ApprovalNonce = typeof ApprovalNonce.Type
export const SnapshotId = identifier("SnapshotId"); export type SnapshotId = typeof SnapshotId.Type
export const CheckpointId = identifier("CheckpointId"); export type CheckpointId = typeof CheckpointId.Type

export const isSafeRelativePath = (value: string): boolean =>
  value.trim().length > 0 &&
  !value.startsWith("/") &&
  !value.startsWith("\\") &&
  !/^[A-Za-z]:[\\/]/u.test(value) &&
  !value.split(/[\\/]+/u).includes("..")

export const SafeRelativePath = Schema.String.check(
  Schema.makeFilter((value: string) =>
    isSafeRelativePath(value)
      ? undefined
      : "Path must be nonempty, relative, and contain no parent traversal.")
).pipe(Schema.brand("SafeRelativePath"))
export type SafeRelativePath = typeof SafeRelativePath.Type

export const SafeArchivePattern = Schema.String.check(
  Schema.makeFilter((value: string) =>
    isSafeRelativePath(value) ? undefined : "Archive pattern must be relative and contain no parent traversal.")
).pipe(Schema.brand("SafeArchivePattern"))
export type SafeArchivePattern = typeof SafeArchivePattern.Type

export const WorkspaceRoot = Schema.String.check(
  Schema.makeFilter((value: string) =>
    value.startsWith("/") ? undefined : "WorkspaceRoot must be absolute.")
).pipe(Schema.brand("WorkspaceRoot"))
export type WorkspaceRoot = typeof WorkspaceRoot.Type
