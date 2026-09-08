import * as Schema from "effect/Schema"

export class Operation extends Schema.Class<Operation>("ReleaseOperation")({
  operationId: Schema.String,
  definitionId: Schema.String,
  intentVersion: Schema.String,
  intent: Schema.Unknown,
  dependsOn: Schema.Array(Schema.String),
}) {}
export class Plan extends Schema.Class<Plan>("ReleasePlan")({
  format: Schema.Literal("ts-release/plan/1"),
  planId: Schema.String,
  journalId: Schema.String,
  bundleId: Schema.String,
  operations: Schema.Array(Operation),
}) {}
export class NoReplay extends Schema.TaggedClass<NoReplay>()("None", {}) {}
export class GitCas extends Schema.TaggedClass<GitCas>()("GitCas", {
  ref: Schema.String,
  expectedOld: Schema.String,
  desiredNew: Schema.String,
}) {}
export const ReplayProtection = Schema.Union([NoReplay, GitCas])
export type ReplayProtection = typeof ReplayProtection.Type
export class RequestFacts extends Schema.Class<RequestFacts>("ReleaseRequestFacts")({
  transport: Schema.Literals(["core.http/1", "core.git/1", "opaque/1"]),
  endpoint: Schema.String,
  method: Schema.String,
  headers: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
  bodyDigest: Schema.String,
  byteLength: Schema.String,
  principal: Schema.String,
  scope: Schema.String,
  replay: ReplayProtection,
}) {}
export class Initial extends Schema.TaggedClass<Initial>()("Initial", {}) {}
export class NonCommit extends Schema.TaggedClass<NonCommit>()("NonCommit", {
  dispatchIds: Schema.Array(Schema.String),
}) {}
export class ProtectedReplay extends Schema.TaggedClass<ProtectedReplay>()("ProtectedReplay", {
  dispatchIds: Schema.Array(Schema.String),
}) {}
export class AcceptedRisk extends Schema.TaggedClass<AcceptedRisk>()("AcceptedRisk", {
  decisionId: Schema.String,
}) {}
export const DispatchBasis = Schema.Union([Initial, NonCommit, ProtectedReplay, AcceptedRisk])
export type DispatchBasis = typeof DispatchBasis.Type
export class DispatchStarted extends Schema.TaggedClass<DispatchStarted>()("DispatchStarted", {
  operationId: Schema.String,
  dispatchId: Schema.String,
  request: RequestFacts,
  fingerprint: Schema.String,
  startedAt: Schema.Number,
  basis: DispatchBasis,
}) {}
export class DispatchRejectedBeforeCommit extends Schema.TaggedClass<DispatchRejectedBeforeCommit>()(
  "DispatchRejectedBeforeCommit",
  {
    dispatchId: Schema.String,
    proofVersion: Schema.String,
    proof: Schema.Unknown,
  },
) {}
export class ReceiptAccepted extends Schema.TaggedClass<ReceiptAccepted>()("ReceiptAccepted", {
  dispatchId: Schema.String,
  receiptVersion: Schema.String,
  status: Schema.Literals(["Satisfied", "Pending"]),
  receipt: Schema.Unknown,
}) {}
export const ObservationStatus = Schema.Literals([
  "Satisfied",
  "Conflict",
  "Pending",
  "Inconclusive",
  "Absent",
])
export type ObservationStatus = typeof ObservationStatus.Type
export class ObservationRecorded extends Schema.TaggedClass<ObservationRecorded>()(
  "ObservationRecorded",
  {
    operationId: Schema.String,
    evidenceKind: Schema.Literals(["Observation", "DispatchError"]),
    dispatchId: Schema.optionalKey(Schema.String),
    status: ObservationStatus,
    evidenceVersion: Schema.String,
    evidence: Schema.Unknown,
    observedAt: Schema.Number,
  },
) {}
export class RiskAccepted extends Schema.TaggedClass<RiskAccepted>()("RiskAccepted", {
  operationId: Schema.String,
  decisionId: Schema.String,
  fingerprint: Schema.String,
  priorDispatchIds: Schema.Array(Schema.String),
  principal: Schema.String,
  expiresAt: Schema.Number,
}) {}
export class PlanSuperseded extends Schema.TaggedClass<PlanSuperseded>()("PlanSuperseded", {
  reason: Schema.String,
}) {}
export const EventBody = Schema.Union([
  DispatchStarted,
  DispatchRejectedBeforeCommit,
  ReceiptAccepted,
  ObservationRecorded,
  RiskAccepted,
  PlanSuperseded,
])
export type EventBody = typeof EventBody.Type
export class JournalEvent extends Schema.Class<JournalEvent>("ReleaseJournalEvent")({
  format: Schema.Literal("ts-release/event/1"),
  eventId: Schema.String,
  journalId: Schema.String,
  planId: Schema.String,
  body: EventBody,
}) {}
export class CoreDispatchError extends Schema.Class<CoreDispatchError>("CoreDispatchError")({
  code: Schema.Literals(["transport-error", "outcome-unknown", "unverified-noncommit"]),
  message: Schema.Literals([
    "Transport failed after dispatch began",
    "Transport did not provide a verifiable outcome",
    "Transport supplied no declared native proof of terminal noncommit",
  ]),
}) {}
/** Bounded, credential-free diagnostic for a committed send whose receipt failed strict decoding. No raw response bytes are retained. */
export class CoreUndecodableReceipt extends Schema.Class<CoreUndecodableReceipt>(
  "CoreUndecodableReceipt",
)({
  code: Schema.Literal("undecodable-receipt"),
  message: Schema.Literal("Committed response could not be admitted by the installed provider"),
  receiptSha256: Schema.NullOr(Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/))),
  receiptBytes: Schema.NullOr(
    Schema.String.check(Schema.isPattern(/^(0|[1-9][0-9]*)$/), Schema.isMaxLength(20)),
  ),
}) {}
export type OperationStatus =
  "Unattempted" | "Satisfied" | "Conflict" | "Pending" | "Inconclusive" | "Rejected" | "Superseded"
export interface OperationReport {
  readonly operationId: string
  readonly status: OperationStatus
  readonly dispatches: number
  readonly receipts: number
  readonly observations: number
}
export interface ReleaseReport {
  readonly planId: string
  readonly revision: number
  readonly superseded: boolean
  readonly operations: ReadonlyArray<OperationReport>
}
export interface RunOptions {
  readonly plan: Plan
  readonly authorize: boolean
  readonly maxDispatches?: number
  readonly observe?: boolean
}
