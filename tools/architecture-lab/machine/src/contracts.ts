import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

/** Research-only durable boundary. No published compatibility claim. */
export class LabError extends Schema.TaggedError<LabError>()("LabError", {
  code: Schema.String,
  message: Schema.String
}) {}

export class Operation extends Schema.Class<Operation>("LabOperation")({
  operationId: Schema.String,
  definitionId: Schema.String,
  intentVersion: Schema.String,
  intent: Schema.Unknown,
  dependsOn: Schema.Array(Schema.String)
}) {}

export class Plan extends Schema.Class<Plan>("LabPlan")({
  format: Schema.Literal("architecture-lab/plan/1"),
  planId: Schema.String,
  journalId: Schema.String,
  bundleId: Schema.String,
  operations: Schema.Array(Operation)
}) {}

export class NoReplay extends Schema.TaggedClass<NoReplay>()("None", {}) {}
export class GitCas extends Schema.TaggedClass<GitCas>()("GitCas", {
  ref: Schema.String,
  expectedOld: Schema.String,
  desiredNew: Schema.String
}) {}
export const ReplayProtection = Schema.Union([NoReplay, GitCas])
export type ReplayProtection = typeof ReplayProtection.Type

export class RequestFacts extends Schema.Class<RequestFacts>("LabRequestFacts")({
  transport: Schema.Literals(["core.http/1", "core.git/1", "opaque/1"]),
  endpoint: Schema.String,
  method: Schema.String,
  headers: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
  bodyDigest: Schema.String,
  byteLength: Schema.String,
  principal: Schema.String,
  scope: Schema.String,
  replay: ReplayProtection
}) {}

export class Initial extends Schema.TaggedClass<Initial>()("Initial", {}) {}
export class NonCommit extends Schema.TaggedClass<NonCommit>()("NonCommit", {
  dispatchIds: Schema.Array(Schema.String)
}) {}
export class ProtectedReplay extends Schema.TaggedClass<ProtectedReplay>()("ProtectedReplay", {
  dispatchIds: Schema.Array(Schema.String)
}) {}
export class AcceptedRisk extends Schema.TaggedClass<AcceptedRisk>()("AcceptedRisk", {
  decisionId: Schema.String
}) {}
export const DispatchBasis = Schema.Union([Initial, NonCommit, ProtectedReplay, AcceptedRisk])
export type DispatchBasis = typeof DispatchBasis.Type

export class DispatchStarted extends Schema.TaggedClass<DispatchStarted>()("DispatchStarted", {
  operationId: Schema.String,
  dispatchId: Schema.String,
  request: RequestFacts,
  fingerprint: Schema.String,
  startedAt: Schema.Number,
  basis: DispatchBasis
}) {}
export class DispatchRejectedBeforeCommit extends Schema.TaggedClass<DispatchRejectedBeforeCommit>()("DispatchRejectedBeforeCommit", {
  dispatchId: Schema.String,
  proofVersion: Schema.String,
  proof: Schema.Unknown
}) {}
export class ReceiptAccepted extends Schema.TaggedClass<ReceiptAccepted>()("ReceiptAccepted", {
  dispatchId: Schema.String,
  receiptVersion: Schema.String,
  status: Schema.Literals(["Satisfied", "Pending"]),
  receipt: Schema.Unknown
}) {}
export const ObservationStatus = Schema.Literals(["Satisfied", "Conflict", "Pending", "Inconclusive", "Absent"])
export type ObservationStatus = typeof ObservationStatus.Type
export class ObservationRecorded extends Schema.TaggedClass<ObservationRecorded>()("ObservationRecorded", {
  operationId: Schema.String,
  evidenceKind: Schema.Literals(["Observation", "DispatchError"]),
  dispatchId: Schema.optionalKey(Schema.String),
  status: ObservationStatus,
  evidenceVersion: Schema.String,
  evidence: Schema.Unknown,
  observedAt: Schema.Number
}) {}
export class RiskAccepted extends Schema.TaggedClass<RiskAccepted>()("RiskAccepted", {
  operationId: Schema.String,
  decisionId: Schema.String,
  fingerprint: Schema.String,
  priorDispatchIds: Schema.Array(Schema.String),
  principal: Schema.String,
  expiresAt: Schema.Number
}) {}
export class PlanSuperseded extends Schema.TaggedClass<PlanSuperseded>()("PlanSuperseded", {
  reason: Schema.String
}) {}
export const EventBody = Schema.Union([
  DispatchStarted, DispatchRejectedBeforeCommit, ReceiptAccepted,
  ObservationRecorded, RiskAccepted, PlanSuperseded
])
export type EventBody = typeof EventBody.Type
export class JournalEvent extends Schema.Class<JournalEvent>("LabJournalEvent")({
  format: Schema.Literal("architecture-lab/event/1"),
  eventId: Schema.String,
  journalId: Schema.String,
  planId: Schema.String,
  body: EventBody
}) {}

export interface Snapshot {
  readonly revision: number
  readonly events: ReadonlyArray<JournalEvent>
}
export type AppendResult =
  | { readonly _tag: "Appended"; readonly revision: number }
  | { readonly _tag: "AlreadyRecorded"; readonly revision: number }
  | { readonly _tag: "RevisionMismatch"; readonly revision: number }
  | { readonly _tag: "AmbiguousStorageOutcome" }
export interface JournalStore {
  readonly read: (journalId: string) => Effect.Effect<Snapshot, LabError>
  readonly append: (journalId: string, expectedRevision: number, event: JournalEvent) => Effect.Effect<AppendResult, LabError>
}

/** Transport owns actual sends; prepare and durable values contain no callback. */
export interface PreparedRequest {
  readonly facts: RequestFacts
  readonly body: Uint8Array
}
export type SendResult =
  | { readonly _tag: "Accepted"; readonly receipt: unknown }
  | { readonly _tag: "RejectedBeforeCommit"; readonly proof: unknown }
  | { readonly _tag: "Unknown"; readonly reason: string; readonly nativeError?: unknown }
export interface Transport {
  readonly send: (request: PreparedRequest) => Effect.Effect<SendResult, LabError>
}
export interface Observation {
  readonly status: ObservationStatus
  readonly evidence: unknown
}
export interface OperationEvidence {
  readonly operation: Operation
  readonly receipts: ReadonlyArray<unknown>
  readonly observations: ReadonlyArray<Observation>
}
export interface ProviderContext {
  readonly own: OperationEvidence
  readonly dependencies: ReadonlyArray<OperationEvidence>
}
export class CoreDispatchError extends Schema.Class<CoreDispatchError>("CoreDispatchError")({
  code: Schema.String, message: Schema.String
}) {}
export interface NativeFailureBoundary {
  readonly version: string
  readonly codec: Schema.Codec<unknown, unknown>
  readonly corresponds: (operation: Operation, request: RequestFacts, evidence: unknown) => boolean
}
export interface ProviderDefinition {
  readonly definitionId: string
  readonly intentVersion: string
  readonly intentCodec: Schema.Codec<unknown, unknown>
  readonly receiptVersion: string
  readonly receiptCodec: Schema.Codec<unknown, unknown>
  readonly receiptCorresponds: (operation: Operation, request: RequestFacts, receipt: unknown) => boolean
  readonly classifyReceipt: (operation: Operation, request: RequestFacts, receipt: unknown) => "Satisfied" | "Pending"
  readonly dispatchError?: NativeFailureBoundary
  readonly rejection?: NativeFailureBoundary
  readonly observationVersion?: string
  readonly observationCodec?: Schema.Codec<unknown, unknown>
  readonly classifyObservation?: (operation: Operation, evidence: unknown, acceptedReceipts: ReadonlyArray<unknown>) => ObservationStatus
  readonly prepare: (operation: Operation, context: ProviderContext) => Effect.Effect<PreparedRequest, LabError>
  readonly observe?: (operation: Operation, context: ProviderContext) => Effect.Effect<Observation, LabError>
}
export type ProviderDescriptor = Pick<ProviderDefinition, "definitionId" | "intentVersion" | "intentCodec">
/** Preparation views are reconstructed from one concrete durable input; they
 * are never a second persisted publication plan or a future-work recipe. */
export type Scope =
  | { readonly _tag: "PublicationScope"; readonly plan: Plan }
  | { readonly _tag: "PreparationScope"; readonly plan: Plan }
export interface JournalContext {
  readonly journalId: string
  readonly scopes: ReadonlyArray<Scope>
}
export interface HostShape {
  readonly store: JournalStore
  readonly transport: Transport
  readonly providers: ReadonlyArray<ProviderDefinition>
  readonly now: () => number
  readonly uniqueId: () => string
  readonly journal?: JournalContext
}
export class Host extends Context.Service<Host, HostShape>()("architecture-lab/Host") {}

export type Candidate = "M1" | "M2"
export type OperationStatus = "Unattempted" | "Satisfied" | "Conflict" | "Pending" | "Inconclusive" | "Rejected" | "Superseded"
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
  readonly candidate: Candidate
  readonly plan: Plan
  readonly authorize: boolean
  readonly maxDispatches?: number
  readonly observe?: boolean
  /** Research fault hook: exits/interrupts after a real durable boundary. */
  readonly checkpoint?: (stage: "after-append" | "after-send" | "after-receipt", event: JournalEvent) => Effect.Effect<void, LabError>
}
