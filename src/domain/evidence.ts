import * as Schema from "effect/Schema"
import { CommandSpec, OperationId } from "./operation.js"
import { TargetId } from "./target.js"

export type * from "../types/effect-internal.js"

export const EvidenceId = Schema.String
export type EvidenceId = typeof EvidenceId.Type

export const EvidenceSeverity = Schema.Literals(["info", "warning", "error"])
export type EvidenceSeverity = typeof EvidenceSeverity.Type

export const EvidenceStatus = Schema.Literals(["passed", "failed", "skipped", "warning"])
export type EvidenceStatus = typeof EvidenceStatus.Type

export class CommandEvidence extends Schema.Class<CommandEvidence>("CommandEvidence")({
  id: EvidenceId,
  operationId: OperationId,
  targetId: Schema.optionalKey(TargetId),
  status: EvidenceStatus,
  severity: EvidenceSeverity,
  command: CommandSpec,
  exitCode: Schema.Number,
  stdout: Schema.String,
  stderr: Schema.String,
  startedAt: Schema.String,
  endedAt: Schema.String,
  durationMillis: Schema.Number
}) {}

export class ValidationEvidence extends Schema.Class<ValidationEvidence>("ValidationEvidence")({
  id: EvidenceId,
  targetId: Schema.optionalKey(TargetId),
  status: EvidenceStatus,
  severity: EvidenceSeverity,
  message: Schema.String,
  timestamp: Schema.String,
  skipped: Schema.Boolean
}) {}

export class ExecutionEvidence extends Schema.Class<ExecutionEvidence>("ExecutionEvidence")({
  id: EvidenceId,
  operationId: OperationId,
  targetId: Schema.optionalKey(TargetId),
  status: EvidenceStatus,
  severity: EvidenceSeverity,
  message: Schema.String,
  timestamp: Schema.String
}) {}

export const EvidenceRecord = Schema.Union([CommandEvidence, ValidationEvidence, ExecutionEvidence])
export type EvidenceRecord = typeof EvidenceRecord.Type

export class EvidenceBundle extends Schema.Class<EvidenceBundle>("EvidenceBundle")({
  schemaVersion: Schema.Literal("release-evidence/v1"),
  releaseName: Schema.String,
  releaseVersion: Schema.String,
  records: Schema.Array(EvidenceRecord)
}) {}
