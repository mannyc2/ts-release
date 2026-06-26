import * as Schema from "effect/Schema"
import { CommandSpec, HttpEnvHeader, HttpHeader, HttpMethod, OperationId, OperationRisk } from "./operation.js"
import { ReleaseName, ReleaseVersion } from "./release.js"
import { TargetId } from "./target.js"

export type * from "../types/effect-internal.js"

export const EvidenceId = Schema.NonEmptyString
export type EvidenceId = typeof EvidenceId.Type

export const EvidenceSeverity = Schema.Literals(["info", "warning", "error"])
export type EvidenceSeverity = typeof EvidenceSeverity.Type

export const EvidenceStatus = Schema.Literals(["passed", "failed", "skipped", "warning"])
export type EvidenceStatus = typeof EvidenceStatus.Type

export const EvidencePhase = Schema.Literals(["render", "validation", "execution", "verification", "reconciliation"])
export type EvidencePhase = typeof EvidencePhase.Type

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

export class OperationEvidenceRecord extends Schema.Class<OperationEvidenceRecord>("OperationEvidenceRecord")({
  id: EvidenceId,
  operationId: OperationId,
  phase: EvidencePhase,
  targetId: Schema.optionalKey(TargetId),
  risk: OperationRisk,
  status: EvidenceStatus,
  severity: EvidenceSeverity,
  message: Schema.String,
  startedAt: Schema.String,
  endedAt: Schema.String,
  durationMillis: Schema.Number,
  command: Schema.optionalKey(CommandSpec),
  exitCode: Schema.optionalKey(Schema.Number),
  stdout: Schema.optionalKey(Schema.String),
  stderr: Schema.optionalKey(Schema.String),
  request: Schema.optionalKey(HttpRequestEvidence),
  responseStatus: Schema.optionalKey(Schema.Number),
  checks: Schema.optionalKey(Schema.Array(HttpCheckEvidence)),
  skipped: Schema.optionalKey(Schema.Boolean)
}) {}

export const EvidenceRecord = OperationEvidenceRecord
export type EvidenceRecord = typeof EvidenceRecord.Type

export class EvidenceBundle extends Schema.Class<EvidenceBundle>("EvidenceBundle")({
  schemaVersion: Schema.Literal("release-evidence/v1"),
  releaseName: ReleaseName,
  releaseVersion: ReleaseVersion,
  records: Schema.Array(EvidenceRecord)
}) {}
