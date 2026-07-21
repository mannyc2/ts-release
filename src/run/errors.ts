// Invariant: failure tags preserve their boundary, and ActionAttemptFailed remains the only retryable execution channel.
import * as Schema from "effect/Schema"
import { OperationId } from "../grammar/operation.js"
import { EvidenceBundle, EvidenceRecord } from "./evidence.js"


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

export class OperationFailedError extends Schema.TaggedErrorClass<OperationFailedError>()("OperationFailedError", {
  operationId: OperationId,
  exitCode: Schema.optional(Schema.Number),
  responseStatus: Schema.optional(Schema.Number),
  reason: Schema.String,
  evidence: Schema.optional(EvidenceBundle)
}) {}

export class ContinueRequiresExecuteError extends Schema.TaggedErrorClass<ContinueRequiresExecuteError>()(
  "ContinueRequiresExecuteError",
  {}
) {}

export class ContinueSnapshotRefusedError extends Schema.TaggedErrorClass<ContinueSnapshotRefusedError>()(
  "ContinueSnapshotRefusedError",
  {}
) {}

export class ContinueEvidenceMissingError extends Schema.TaggedErrorClass<ContinueEvidenceMissingError>()(
  "ContinueEvidenceMissingError",
  { path: Schema.String }
) {}

export class ContinueEvidenceReadError extends Schema.TaggedErrorClass<ContinueEvidenceReadError>()(
  "ContinueEvidenceReadError",
  { path: Schema.String, reason: Schema.String }
) {}

export class ContinueEvidenceInvalidError extends Schema.TaggedErrorClass<ContinueEvidenceInvalidError>()(
  "ContinueEvidenceInvalidError",
  { path: Schema.String, reason: Schema.String }
) {}

export class ContinueFingerprintMissingError extends Schema.TaggedErrorClass<ContinueFingerprintMissingError>()(
  "ContinueFingerprintMissingError",
  { path: Schema.String }
) {}

export class ContinueMismatchError extends Schema.TaggedErrorClass<ContinueMismatchError>()(
  "ContinueMismatchError",
  { path: Schema.String, expected: Schema.String, actual: Schema.String }
) {}
