import * as Schema from "effect/Schema"
import { OperationId } from "../pipeline/operation.js"
import { EvidenceBundle, EvidenceRecord } from "./evidence.js"


export class ReleaseNormalizationError extends Schema.TaggedErrorClass<ReleaseNormalizationError>()(
  "ReleaseNormalizationError",
  {
    field: Schema.String,
    reason: Schema.String,
    cause: Schema.optional(Schema.Defect())
  }
) {}

export class EvidenceWriteError extends Schema.TaggedErrorClass<EvidenceWriteError>()("EvidenceWriteError", {
  path: Schema.String,
  reason: Schema.String,
  cause: Schema.optional(Schema.Defect())
}) {}

export class ActionAttemptFailed extends Schema.TaggedErrorClass<ActionAttemptFailed>()("ActionAttemptFailed", {
  record: EvidenceRecord
}) {}

export class WorkspaceWriteError extends Schema.TaggedErrorClass<WorkspaceWriteError>()("WorkspaceWriteError", {
  path: Schema.String,
  reason: Schema.String
}) {}

export class PlanReferenceMismatchError extends Schema.TaggedErrorClass<PlanReferenceMismatchError>()(
  "PlanReferenceMismatchError",
  {
    source: Schema.Literals(["evidence", "staged-artifact"]),
    referencedId: Schema.NonEmptyString,
    reason: Schema.String
  }
) {}

export class OperationFailedError extends Schema.TaggedErrorClass<OperationFailedError>()("OperationFailedError", {
  operationId: OperationId,
  exitCode: Schema.optional(Schema.Number),
  responseStatus: Schema.optional(Schema.Number),
  reason: Schema.String,
  evidence: Schema.optional(EvidenceBundle)
}) {}

export type EngineError =
  | ReleaseNormalizationError
  | EvidenceWriteError
  | WorkspaceWriteError
  | PlanReferenceMismatchError
  | OperationFailedError
