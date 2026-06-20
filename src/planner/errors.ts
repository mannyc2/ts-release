import * as Schema from "effect/Schema"
import { EvidenceBundle, ReleaseWorkflowFailureEvidence } from "../domain/evidence.js"

export type * from "../types/effect-internal.js"

export class ReleaseNormalizationError extends Schema.TaggedErrorClass<ReleaseNormalizationError>()(
  "ReleaseNormalizationError",
  {
    field: Schema.String,
    reason: Schema.String,
    cause: Schema.optionalKey(Schema.Defect())
  }
) {}

export class ArtifactInventoryError extends Schema.TaggedErrorClass<ArtifactInventoryError>()(
  "ArtifactInventoryError",
  {
    path: Schema.String,
    reason: Schema.String,
    cause: Schema.optionalKey(Schema.Defect())
  }
) {}

export class PlanConstructionError extends Schema.TaggedErrorClass<PlanConstructionError>()("PlanConstructionError", {
  targetId: Schema.optionalKey(Schema.String),
  reason: Schema.String
}) {}

export class EvidenceWriteError extends Schema.TaggedErrorClass<EvidenceWriteError>()("EvidenceWriteError", {
  path: Schema.String,
  reason: Schema.String,
  cause: Schema.optionalKey(Schema.Defect())
}) {}

export class EvidenceReadError extends Schema.TaggedErrorClass<EvidenceReadError>()("EvidenceReadError", {
  path: Schema.String,
  reason: Schema.String,
  cause: Schema.optionalKey(Schema.Defect())
}) {}

export class WorkspaceWriteError extends Schema.TaggedErrorClass<WorkspaceWriteError>()("WorkspaceWriteError", {
  path: Schema.String,
  reason: Schema.String
}) {}

export class ResumeBlockedError extends Schema.TaggedErrorClass<ResumeBlockedError>()("ResumeBlockedError", {
  operationId: Schema.String,
  reason: Schema.String
}) {}

export class RemoteStateInspectionError extends Schema.TaggedErrorClass<RemoteStateInspectionError>()(
  "RemoteStateInspectionError",
  {
    targetId: Schema.String,
    reason: Schema.String,
    cause: Schema.optionalKey(Schema.Defect())
  }
) {}

export class ReleaseEligibilityCheckError extends Schema.TaggedErrorClass<ReleaseEligibilityCheckError>()(
  "ReleaseEligibilityCheckError",
  {
    targetId: Schema.optionalKey(Schema.String),
    reason: Schema.String,
    cause: Schema.optionalKey(Schema.Defect())
  }
) {}

export class ReconciliationBlockedError extends Schema.TaggedErrorClass<ReconciliationBlockedError>()(
  "ReconciliationBlockedError",
  {
    targetId: Schema.String,
    reasons: Schema.Array(Schema.String)
  }
) {}

export class OperationFailedError extends Schema.TaggedErrorClass<OperationFailedError>()("OperationFailedError", {
  operationId: Schema.String,
  exitCode: Schema.optionalKey(Schema.Number),
  responseStatus: Schema.optionalKey(Schema.Number),
  reason: Schema.String,
  evidence: Schema.optionalKey(EvidenceBundle),
  workflowEvidence: Schema.optionalKey(ReleaseWorkflowFailureEvidence)
}) {}

export type PlannerError =
  | ReleaseNormalizationError
  | ArtifactInventoryError
  | PlanConstructionError
  | EvidenceWriteError
  | EvidenceReadError
  | WorkspaceWriteError
  | ResumeBlockedError
  | RemoteStateInspectionError
  | ReleaseEligibilityCheckError
  | ReconciliationBlockedError
  | OperationFailedError
