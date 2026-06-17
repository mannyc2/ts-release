import * as Schema from "effect/Schema"
import { OperationId, OperationRisk } from "./operation.js"
import { TargetId } from "./target.js"

export type * from "../types/effect-internal.js"

export const ReleaseWorkflowPhase = Schema.Literals(["render", "validation", "execution", "verification"])
export type ReleaseWorkflowPhase = typeof ReleaseWorkflowPhase.Type

export const ReleaseOperationStatus = Schema.Literals([
  "pending",
  "passed",
  "warning",
  "skipped",
  "failed",
  "blocked"
])
export type ReleaseOperationStatus = typeof ReleaseOperationStatus.Type

export const ReleaseOverallStatus = Schema.Literals([
  "not-started",
  "in-progress",
  "failed",
  "blocked",
  "complete"
])
export type ReleaseOverallStatus = typeof ReleaseOverallStatus.Type

export const ReleaseResumeAction = Schema.Literals(["skip", "run", "retry-read-only", "block"])
export type ReleaseResumeAction = typeof ReleaseResumeAction.Type

export class ReleaseOperationStatusRecord extends Schema.Class<ReleaseOperationStatusRecord>(
  "ReleaseOperationStatusRecord"
)({
  operationId: OperationId,
  targetId: Schema.optionalKey(TargetId),
  phase: ReleaseWorkflowPhase,
  risk: OperationRisk,
  status: ReleaseOperationStatus,
  resumeAction: ReleaseResumeAction,
  evidenceId: Schema.optionalKey(Schema.String),
  reason: Schema.optionalKey(Schema.String)
}) {}

export class ReleasePhaseStatusRecord extends Schema.Class<ReleasePhaseStatusRecord>("ReleasePhaseStatusRecord")({
  phase: ReleaseWorkflowPhase,
  status: ReleaseOperationStatus,
  completed: Schema.Number,
  total: Schema.Number
}) {}

export class ReleaseStatusReport extends Schema.Class<ReleaseStatusReport>("ReleaseStatusReport")({
  schemaVersion: Schema.Literal("release-status/v1"),
  releaseName: Schema.String,
  releaseVersion: Schema.String,
  overallStatus: ReleaseOverallStatus,
  canResume: Schema.Boolean,
  evidenceDirectory: Schema.String,
  phases: Schema.Array(ReleasePhaseStatusRecord),
  operations: Schema.Array(ReleaseOperationStatusRecord)
}) {}
