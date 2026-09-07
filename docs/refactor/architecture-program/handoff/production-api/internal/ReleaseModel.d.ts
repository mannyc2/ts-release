import * as Schema from "effect/Schema";
declare const Operation_base: Schema.Class<Operation, Schema.Struct<{
    readonly operationId: Schema.String;
    readonly definitionId: Schema.String;
    readonly intentVersion: Schema.String;
    readonly intent: Schema.Unknown;
    readonly dependsOn: Schema.$Array<Schema.String>;
}>, {}>;
export declare class Operation extends Operation_base {
}
declare const Plan_base: Schema.Class<Plan, Schema.Struct<{
    readonly format: Schema.Literal<"ts-release/plan/1">;
    readonly planId: Schema.String;
    readonly journalId: Schema.String;
    readonly bundleId: Schema.String;
    readonly operations: Schema.$Array<typeof Operation>;
}>, {}>;
export declare class Plan extends Plan_base {
}
declare const NoReplay_base: Schema.Class<NoReplay, Schema.TaggedStruct<"None", {}>, {}>;
export declare class NoReplay extends NoReplay_base {
}
declare const GitCas_base: Schema.Class<GitCas, Schema.TaggedStruct<"GitCas", {
    readonly ref: Schema.String;
    readonly expectedOld: Schema.String;
    readonly desiredNew: Schema.String;
}>, {}>;
export declare class GitCas extends GitCas_base {
}
export declare const ReplayProtection: Schema.Union<readonly [typeof NoReplay, typeof GitCas]>;
export type ReplayProtection = typeof ReplayProtection.Type;
declare const RequestFacts_base: Schema.Class<RequestFacts, Schema.Struct<{
    readonly transport: Schema.Literals<readonly ["core.http/1", "core.git/1", "opaque/1"]>;
    readonly endpoint: Schema.String;
    readonly method: Schema.String;
    readonly headers: Schema.$Array<Schema.Tuple<readonly [Schema.String, Schema.String]>>;
    readonly bodyDigest: Schema.String;
    readonly byteLength: Schema.String;
    readonly principal: Schema.String;
    readonly scope: Schema.String;
    readonly replay: Schema.Union<readonly [typeof NoReplay, typeof GitCas]>;
}>, {}>;
export declare class RequestFacts extends RequestFacts_base {
}
declare const Initial_base: Schema.Class<Initial, Schema.TaggedStruct<"Initial", {}>, {}>;
export declare class Initial extends Initial_base {
}
declare const NonCommit_base: Schema.Class<NonCommit, Schema.TaggedStruct<"NonCommit", {
    readonly dispatchIds: Schema.$Array<Schema.String>;
}>, {}>;
export declare class NonCommit extends NonCommit_base {
}
declare const ProtectedReplay_base: Schema.Class<ProtectedReplay, Schema.TaggedStruct<"ProtectedReplay", {
    readonly dispatchIds: Schema.$Array<Schema.String>;
}>, {}>;
export declare class ProtectedReplay extends ProtectedReplay_base {
}
declare const AcceptedRisk_base: Schema.Class<AcceptedRisk, Schema.TaggedStruct<"AcceptedRisk", {
    readonly decisionId: Schema.String;
}>, {}>;
export declare class AcceptedRisk extends AcceptedRisk_base {
}
export declare const DispatchBasis: Schema.Union<readonly [typeof Initial, typeof NonCommit, typeof ProtectedReplay, typeof AcceptedRisk]>;
export type DispatchBasis = typeof DispatchBasis.Type;
declare const DispatchStarted_base: Schema.Class<DispatchStarted, Schema.TaggedStruct<"DispatchStarted", {
    readonly operationId: Schema.String;
    readonly dispatchId: Schema.String;
    readonly request: typeof RequestFacts;
    readonly fingerprint: Schema.String;
    readonly startedAt: Schema.Number;
    readonly basis: Schema.Union<readonly [typeof Initial, typeof NonCommit, typeof ProtectedReplay, typeof AcceptedRisk]>;
}>, {}>;
export declare class DispatchStarted extends DispatchStarted_base {
}
declare const DispatchRejectedBeforeCommit_base: Schema.Class<DispatchRejectedBeforeCommit, Schema.TaggedStruct<"DispatchRejectedBeforeCommit", {
    readonly dispatchId: Schema.String;
    readonly proofVersion: Schema.String;
    readonly proof: Schema.Unknown;
}>, {}>;
export declare class DispatchRejectedBeforeCommit extends DispatchRejectedBeforeCommit_base {
}
declare const ReceiptAccepted_base: Schema.Class<ReceiptAccepted, Schema.TaggedStruct<"ReceiptAccepted", {
    readonly dispatchId: Schema.String;
    readonly receiptVersion: Schema.String;
    readonly status: Schema.Literals<readonly ["Satisfied", "Pending"]>;
    readonly receipt: Schema.Unknown;
}>, {}>;
export declare class ReceiptAccepted extends ReceiptAccepted_base {
}
export declare const ObservationStatus: Schema.Literals<readonly ["Satisfied", "Conflict", "Pending", "Inconclusive", "Absent"]>;
export type ObservationStatus = typeof ObservationStatus.Type;
declare const ObservationRecorded_base: Schema.Class<ObservationRecorded, Schema.TaggedStruct<"ObservationRecorded", {
    readonly operationId: Schema.String;
    readonly evidenceKind: Schema.Literals<readonly ["Observation", "DispatchError"]>;
    readonly dispatchId: Schema.optionalKey<Schema.String>;
    readonly status: Schema.Literals<readonly ["Satisfied", "Conflict", "Pending", "Inconclusive", "Absent"]>;
    readonly evidenceVersion: Schema.String;
    readonly evidence: Schema.Unknown;
    readonly observedAt: Schema.Number;
}>, {}>;
export declare class ObservationRecorded extends ObservationRecorded_base {
}
declare const RiskAccepted_base: Schema.Class<RiskAccepted, Schema.TaggedStruct<"RiskAccepted", {
    readonly operationId: Schema.String;
    readonly decisionId: Schema.String;
    readonly fingerprint: Schema.String;
    readonly priorDispatchIds: Schema.$Array<Schema.String>;
    readonly principal: Schema.String;
    readonly expiresAt: Schema.Number;
}>, {}>;
export declare class RiskAccepted extends RiskAccepted_base {
}
declare const PlanSuperseded_base: Schema.Class<PlanSuperseded, Schema.TaggedStruct<"PlanSuperseded", {
    readonly reason: Schema.String;
}>, {}>;
export declare class PlanSuperseded extends PlanSuperseded_base {
}
export declare const EventBody: Schema.Union<readonly [typeof DispatchStarted, typeof DispatchRejectedBeforeCommit, typeof ReceiptAccepted, typeof ObservationRecorded, typeof RiskAccepted, typeof PlanSuperseded]>;
export type EventBody = typeof EventBody.Type;
declare const JournalEvent_base: Schema.Class<JournalEvent, Schema.Struct<{
    readonly format: Schema.Literal<"ts-release/event/1">;
    readonly eventId: Schema.String;
    readonly journalId: Schema.String;
    readonly planId: Schema.String;
    readonly body: Schema.Union<readonly [typeof DispatchStarted, typeof DispatchRejectedBeforeCommit, typeof ReceiptAccepted, typeof ObservationRecorded, typeof RiskAccepted, typeof PlanSuperseded]>;
}>, {}>;
export declare class JournalEvent extends JournalEvent_base {
}
declare const CoreDispatchError_base: Schema.Class<CoreDispatchError, Schema.Struct<{
    readonly code: Schema.Literals<readonly ["transport-error", "outcome-unknown", "unverified-noncommit"]>;
    readonly message: Schema.Literals<readonly ["Transport failed after dispatch began", "Transport did not provide a verifiable outcome", "Transport supplied no declared native proof of terminal noncommit"]>;
}>, {}>;
export declare class CoreDispatchError extends CoreDispatchError_base {
}
declare const CoreUndecodableReceipt_base: Schema.Class<CoreUndecodableReceipt, Schema.Struct<{
    readonly code: Schema.Literal<"undecodable-receipt">;
    readonly message: Schema.Literal<"Committed response could not be admitted by the installed provider">;
    readonly receiptSha256: Schema.NullOr<Schema.String>;
    readonly receiptBytes: Schema.NullOr<Schema.String>;
}>, {}>;
/** Bounded, credential-free diagnostic for a committed send whose receipt failed strict decoding. No raw response bytes are retained. */
export declare class CoreUndecodableReceipt extends CoreUndecodableReceipt_base {
}
export type OperationStatus = "Unattempted" | "Satisfied" | "Conflict" | "Pending" | "Inconclusive" | "Rejected" | "Superseded";
export interface OperationReport {
    readonly operationId: string;
    readonly status: OperationStatus;
    readonly dispatches: number;
    readonly receipts: number;
    readonly observations: number;
}
export interface ReleaseReport {
    readonly planId: string;
    readonly revision: number;
    readonly superseded: boolean;
    readonly operations: ReadonlyArray<OperationReport>;
}
export interface RunOptions {
    readonly plan: Plan;
    readonly authorize: boolean;
    readonly maxDispatches?: number;
    readonly observe?: boolean;
}
export {};
