import * as Schema from "effect/Schema"
import { CommandSpec, HttpEnvHeader, HttpHeader, HttpMethod, OperationId } from "./operation.js"
import { ReleaseName, ReleaseVersion } from "./release.js"
import { TargetId } from "./target.js"

export type * from "../types/effect-internal.js"

export const EvidenceId = Schema.NonEmptyString
export type EvidenceId = typeof EvidenceId.Type

export const EvidenceSeverity = Schema.Literals(["info", "warning", "error"])
export type EvidenceSeverity = typeof EvidenceSeverity.Type

export const EvidenceStatus = Schema.Literals(["passed", "failed", "skipped", "warning"])
export type EvidenceStatus = typeof EvidenceStatus.Type

export class CommandEvidence extends Schema.Class<CommandEvidence>("CommandEvidence")({
  id: EvidenceId,
  operationId: OperationId,
  operationFingerprint: Schema.String,
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

export class HttpRequestEvidence extends Schema.Class<HttpRequestEvidence>("HttpRequestEvidence")({
  method: HttpMethod,
  url: Schema.String,
  headers: Schema.Array(HttpHeader),
  envHeaders: Schema.Array(HttpEnvHeader)
}) {}

export class HttpCheckEvidence extends Schema.Class<HttpCheckEvidence>("HttpCheckEvidence")({
  description: Schema.String,
  passed: Schema.Boolean
}) {}

export class HttpEvidence extends Schema.Class<HttpEvidence>("HttpEvidence")({
  id: EvidenceId,
  operationId: OperationId,
  operationFingerprint: Schema.String,
  targetId: Schema.optionalKey(TargetId),
  status: EvidenceStatus,
  severity: EvidenceSeverity,
  request: HttpRequestEvidence,
  responseStatus: Schema.optionalKey(Schema.Number),
  checks: Schema.Array(HttpCheckEvidence),
  message: Schema.String,
  startedAt: Schema.String,
  endedAt: Schema.String,
  durationMillis: Schema.Number
}) {}

export class ValidationEvidence extends Schema.Class<ValidationEvidence>("ValidationEvidence")({
  id: EvidenceId,
  operationFingerprint: Schema.String,
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
  operationFingerprint: Schema.String,
  targetId: Schema.optionalKey(TargetId),
  status: EvidenceStatus,
  severity: EvidenceSeverity,
  message: Schema.String,
  timestamp: Schema.String
}) {}

export const EvidenceRecord = Schema.Union([CommandEvidence, HttpEvidence, ValidationEvidence, ExecutionEvidence])
export type EvidenceRecord = typeof EvidenceRecord.Type

export class EvidenceBundle extends Schema.Class<EvidenceBundle>("EvidenceBundle")({
  schemaVersion: Schema.Literal("release-evidence/v1"),
  releaseName: ReleaseName,
  releaseVersion: ReleaseVersion,
  records: Schema.Array(EvidenceRecord)
}) {}

export class ReleaseWorkflowEvidence extends Schema.Class<ReleaseWorkflowEvidence>("ReleaseWorkflowEvidence")({
  render: EvidenceBundle,
  validation: EvidenceBundle,
  execution: EvidenceBundle,
  verification: EvidenceBundle
}) {}

export class ReleaseWorkflowFailureEvidence extends Schema.Class<ReleaseWorkflowFailureEvidence>(
  "ReleaseWorkflowFailureEvidence"
)({
  render: Schema.optionalKey(EvidenceBundle),
  validation: Schema.optionalKey(EvidenceBundle),
  execution: Schema.optionalKey(EvidenceBundle),
  verification: Schema.optionalKey(EvidenceBundle)
}) {}
