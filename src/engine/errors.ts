import * as Schema from "effect/Schema"
import { OperationId } from "../pipeline/operation.js"
import { EvidenceBundle } from "./evidence.js"


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
  targetId: Schema.optionalKey(Schema.NonEmptyString),
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

export class OperationFailedError extends Schema.TaggedErrorClass<OperationFailedError>()("OperationFailedError", {
  operationId: OperationId,
  exitCode: Schema.optionalKey(Schema.Number),
  responseStatus: Schema.optionalKey(Schema.Number),
  reason: Schema.String,
  evidence: Schema.optionalKey(EvidenceBundle)
}) {}

export type EngineError =
  | ReleaseNormalizationError
  | ArtifactInventoryError
  | PlanConstructionError
  | EvidenceWriteError
  | EvidenceReadError
  | WorkspaceWriteError
  | OperationFailedError
