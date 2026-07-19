// Invariant: failure tags preserve their boundary, and ActionAttemptFailed remains the only retryable execution channel.
import * as Schema from "effect/Schema"
import { OperationId } from "../pipeline/operation.js"
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
