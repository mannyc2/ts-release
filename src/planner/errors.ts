import * as Schema from "effect/Schema"
import { EvidenceBundle } from "../domain/evidence.js"

export type * from "../types/effect-internal.js"

export class ReleaseNormalizationError extends Schema.TaggedErrorClass<ReleaseNormalizationError>()(
  "ReleaseNormalizationError",
  {
    field: Schema.String,
    reason: Schema.String
  }
) {}

export class ArtifactInventoryError extends Schema.TaggedErrorClass<ArtifactInventoryError>()(
  "ArtifactInventoryError",
  {
    path: Schema.String,
    reason: Schema.String
  }
) {}

export class PlanConstructionError extends Schema.TaggedErrorClass<PlanConstructionError>()("PlanConstructionError", {
  targetId: Schema.optionalKey(Schema.String),
  reason: Schema.String
}) {}

export class EvidenceWriteError extends Schema.TaggedErrorClass<EvidenceWriteError>()("EvidenceWriteError", {
  path: Schema.String,
  reason: Schema.String
}) {}

export class OperationFailedError extends Schema.TaggedErrorClass<OperationFailedError>()("OperationFailedError", {
  operationId: Schema.String,
  exitCode: Schema.Number,
  reason: Schema.String,
  evidence: Schema.optionalKey(EvidenceBundle)
}) {}

export type PlannerError =
  | ReleaseNormalizationError
  | ArtifactInventoryError
  | PlanConstructionError
  | EvidenceWriteError
  | OperationFailedError
