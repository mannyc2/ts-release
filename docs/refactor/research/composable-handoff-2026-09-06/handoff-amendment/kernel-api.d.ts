/**
 * Proposed production contract, derived from type-checked research declarations.
 * This file declares no implementation and is not evidence of production completion.
 * Changes from the prototype: error renamed ReleaseError; production domains
 * use ts-release/*; private candidate selection and checkpoint hooks omitted.
 * Operation/Plan IDs remain strings whose validation is proved by constructors;
 * additional compile-time brands are not claimed by this tested contract.
 * Implementation classes must remain Schema.Class / Schema.TaggedClass / tagged
 * errors, not interface casts. No legacy reader or migration export is proposed.
 *
 * 2026-09-06 composable amendment: evaluator seam (Host.machine, Machine types,
 * historyMachine default), provider contract literal, bounded undecodable-receipt
 * diagnostic. Witnessed in plans/research/composable-handoff/examples.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
declare const ReleaseError_base: Schema.Class<ReleaseError, Schema.TaggedStruct<"ReleaseError", {
    readonly code: Schema.String;
    readonly message: Schema.String;
}>, import("effect/Cause").YieldableError>;
/** Implementation must retain Schema.TaggedError and Schema.Class validation. */
export declare class ReleaseError extends ReleaseError_base {
}
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
export interface Snapshot {
    readonly revision: number;
    readonly events: ReadonlyArray<JournalEvent>;
}
export type AppendResult = {
    readonly _tag: "Appended";
    readonly revision: number;
} | {
    readonly _tag: "AlreadyRecorded";
    readonly revision: number;
} | {
    readonly _tag: "RevisionMismatch";
    readonly revision: number;
} | {
    readonly _tag: "AmbiguousStorageOutcome";
};
export interface JournalStore {
    readonly read: (journalId: string) => Effect.Effect<Snapshot, ReleaseError>;
    readonly append: (journalId: string, expectedRevision: number, event: JournalEvent) => Effect.Effect<AppendResult, ReleaseError>;
}
/** Transport owns actual sends; prepare and durable values contain no callback. */
export interface PreparedRequest {
    readonly facts: RequestFacts;
    readonly body: Uint8Array;
}
export type SendResult = {
    readonly _tag: "Accepted";
    readonly receipt: unknown;
} | {
    readonly _tag: "RejectedBeforeCommit";
    readonly proof: unknown;
} | {
    readonly _tag: "Unknown";
    readonly reason: string;
    readonly nativeError?: unknown;
};
export interface Transport {
    readonly send: (request: PreparedRequest) => Effect.Effect<SendResult, ReleaseError>;
}
export interface Observation {
    readonly status: ObservationStatus;
    readonly evidence: unknown;
}
export interface OperationEvidence {
    readonly operation: Operation;
    readonly receipts: ReadonlyArray<unknown>;
    readonly observations: ReadonlyArray<Observation>;
}
export interface ProviderContext {
    readonly own: OperationEvidence;
    readonly dependencies: ReadonlyArray<OperationEvidence>;
}
declare const CoreDispatchError_base: Schema.Class<CoreDispatchError, Schema.Struct<{
    readonly code: Schema.String;
    readonly message: Schema.String;
}>, {}>;
export declare class CoreDispatchError extends CoreDispatchError_base {
}
declare const CoreUndecodableReceipt_base: Schema.Class<CoreUndecodableReceipt, Schema.Struct<{
    readonly code: Schema.String;
    readonly message: Schema.String;
    readonly receiptSha256: Schema.String;
    readonly receiptBytes: Schema.String;
}>, {}>;
/** Bounded, credential-free diagnostic recorded as ObservationRecorded/DispatchError/Inconclusive
 * (evidenceVersion "core-undecodable-receipt/1") when a committed send's receipt fails strict decoding.
 * No raw response bytes are retained; a later native observation may still satisfy the attempt. */
export declare class CoreUndecodableReceipt extends CoreUndecodableReceipt_base {
}
/** Provider contract spoken by this kernel. Verified for every definition before any store or provider effect. */
export declare const PROVIDER_CONTRACT: "ts-release/provider/1";
export interface NativeFailureBoundary {
    readonly version: string;
    readonly codec: Schema.Codec<unknown, unknown>;
    readonly corresponds: (operation: Operation, request: RequestFacts, evidence: unknown) => boolean;
}
export interface ProviderDefinition {
    /** Must equal PROVIDER_CONTRACT of the kernel that runs it; installers do not guarantee this. */
    readonly contract: typeof PROVIDER_CONTRACT;
    readonly definitionId: string;
    readonly intentVersion: string;
    readonly intentCodec: Schema.Codec<unknown, unknown>;
    readonly receiptVersion: string;
    readonly receiptCodec: Schema.Codec<unknown, unknown>;
    readonly receiptCorresponds: (operation: Operation, request: RequestFacts, receipt: unknown) => boolean;
    readonly classifyReceipt: (operation: Operation, request: RequestFacts, receipt: unknown) => "Satisfied" | "Pending";
    readonly dispatchError?: NativeFailureBoundary;
    readonly rejection?: NativeFailureBoundary;
    readonly observationVersion?: string;
    readonly observationCodec?: Schema.Codec<unknown, unknown>;
    readonly classifyObservation?: (operation: Operation, evidence: unknown, acceptedReceipts: ReadonlyArray<unknown>) => ObservationStatus;
    readonly prepare: (operation: Operation, context: ProviderContext) => Effect.Effect<PreparedRequest, ReleaseError>;
    readonly observe?: (operation: Operation, context: ProviderContext) => Effect.Effect<Observation, ReleaseError>;
}
export type ProviderDescriptor = Pick<ProviderDefinition, "definitionId" | "intentVersion" | "intentCodec">;
/** Preparation views are reconstructed from one concrete durable input; they
 * are never a second persisted publication plan or a future-work recipe. */
export type Scope = {
    readonly _tag: "PublicationScope";
    readonly plan: Plan;
} | {
    readonly _tag: "PreparationScope";
    readonly plan: Plan;
};
export interface JournalContext {
    readonly journalId: string;
    readonly scopes: ReadonlyArray<Scope>;
}
export interface HostShape {
    readonly store: JournalStore;
    readonly transport: Transport;
    readonly providers: ReadonlyArray<ProviderDefinition>;
    readonly now: () => number;
    readonly uniqueId: () => string;
    readonly journal?: JournalContext;
    /** Decision evaluator over validated history. Default: historyMachine (M1). Any Machine satisfying the
     * kernel conformance suite may be supplied; the kernel keeps every permit, admission and append law. */
    readonly machine?: MachineConstructor;
}
/** Evaluator seam. `next` is a pure function of (validated history, plan, candidate request, now). */
export interface CandidateRequest {
    readonly facts: RequestFacts;
    readonly fingerprint: string;
}
export type Next = {
    readonly _tag: "PrepareDispatch";
} | {
    readonly _tag: "AppendDispatch";
    readonly basis: DispatchBasis;
} | {
    readonly _tag: "RequestRiskAcceptance";
} | {
    readonly _tag: "Finish";
    readonly status: OperationStatus;
};
export interface Machine {
    /** Rejects an illegal next event (throws ReleaseError); returns the successor evaluator. */
    readonly append: (event: JournalEvent) => Machine;
    readonly report: () => ReleaseReport;
    readonly next: (operationId: string, candidate: CandidateRequest | null, now: number) => Next;
}
/** Must reject impossible histories on construction (fold through append). */
export type MachineConstructor = (plan: Plan, events: ReadonlyArray<JournalEvent>) => Machine;
/** Default evaluator: history retained, facts and decisions derived by queries. */
export declare const historyMachine: MachineConstructor;
/** Protocol laws shared by every evaluator; not inferred from provider labels. */
export declare const sameProtectedRequest: (recorded: RequestFacts, candidate: RequestFacts) => boolean;
export declare const sameStrings: (left: ReadonlyArray<string>, right: ReadonlyArray<string>) => boolean;
declare const Host_base: Context.ServiceClass<Host, "ts-release/Host", HostShape>;
export declare class Host extends Host_base {
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

export declare const createOperation: (provider: ProviderDescriptor, intent: unknown, dependsOn?: readonly string[] | undefined) => Effect.Effect<Operation, ReleaseError, never>;
export declare const createPlan: (bundleId: string, operations: readonly Operation[], journalId?: string | undefined) => Effect.Effect<Plan, ReleaseError, never>;
export declare const createPreparationScope: (provider: ProviderDescriptor, input: unknown, journalId?: string | undefined) => Effect.Effect<{
    readonly _tag: "PreparationScope";
    readonly plan: Plan;
}, ReleaseError, never>;
export declare const loadPlan: (input: unknown, providers: readonly ProviderDescriptor[]) => Effect.Effect<Plan, ReleaseError, never>;
export declare const makeRequest: (input: Omit<RequestFacts, "byteLength" | "bodyDigest"> & {
    readonly body: Uint8Array;
}) => Effect.Effect<{
    facts: RequestFacts;
    body: Uint8Array<ArrayBuffer>;
}, ReleaseError, never>;
declare const GitReceipt_base: Schema.Class<GitReceipt, Schema.Struct<{
    readonly kind: Schema.Literal<"git-push">;
    readonly ref: Schema.String;
    readonly desiredNew: Schema.String;
    readonly porcelain: Schema.String;
}>, {}>;
export declare class GitReceipt extends GitReceipt_base {
}
export interface GitExecution {
    readonly exitCode: number;
    readonly stdout: string;
}
export interface CoreGitOptions {
    readonly principal: string;
    readonly scope: string;
    /** Captured at the host boundary; implement with execFile/spawn, never a shell. */
    readonly execute: (arguments_: ReadonlyArray<string>) => Effect.Effect<GitExecution, ReleaseError>;
    readonly otherwise?: Transport;
}
/** The only protected mechanism in this experiment is one exact conditional push. */
export declare function makeCoreGitTransport(options: CoreGitOptions): Transport;
export declare function makeCoreGitTransport(options: readonly [CoreGitOptions, ...CoreGitOptions[]], otherwise?: Transport): Transport;

export declare const reportRelease: (options: {
    readonly plan: Plan;
}) => Effect.Effect<{
    revision: number;
    planId: string;
    superseded: boolean;
    operations: ReadonlyArray<OperationReport>;
}, ReleaseError, Host>;
export declare const observeRelease: (options: {
    readonly plan: Plan;
}) => Effect.Effect<{
    revision: number;
    planId: string;
    superseded: boolean;
    operations: ReadonlyArray<OperationReport>;
}, ReleaseError, Host>;
/** One interpreter, no durable permit and no provider-selected mutation retry. */
export declare const runRelease: (options: RunOptions) => Effect.Effect<{
    revision: number;
    planId: string;
    superseded: boolean;
    operations: ReadonlyArray<OperationReport>;
}, ReleaseError, Host>;
export declare const supersedePlan: (options: {
    readonly plan: Plan;
    readonly authorize: boolean;
    readonly reason: string;
}) => Effect.Effect<{
    revision: number;
    planId: string;
    superseded: boolean;
    operations: ReadonlyArray<OperationReport>;
}, ReleaseError, Host>;
export declare const acceptRisk: (options: {
    readonly plan: Plan;
    readonly authorize: boolean;
    readonly decision: RiskAccepted;
}) => Effect.Effect<{
    revision: number;
    planId: string;
    superseded: boolean;
    operations: ReadonlyArray<OperationReport>;
}, ReleaseError, Host>;
