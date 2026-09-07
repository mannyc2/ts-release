import { DispatchBasis, JournalEvent, type OperationStatus, Plan, type ReleaseReport, RequestFacts } from "./ReleaseModel.js";
import { type Scope } from "../Journal.js";
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
    readonly append: (event: JournalEvent) => Machine;
    readonly report: () => ReleaseReport;
    readonly next: (operationId: string, candidate: CandidateRequest | null, now: number) => Next;
}
export type MachineConstructor = (plan: Plan, events: ReadonlyArray<JournalEvent>, scopeKind?: Scope["_tag"]) => Machine;
/** Protocol law shared by representations, not inferred from provider labels. */
export declare const sameProtectedRequest: (recorded: RequestFacts, candidate: RequestFacts) => boolean;
export declare const sameStrings: (left: ReadonlyArray<string>, right: ReadonlyArray<string>) => boolean;
/** Core-owned history laws, shared by M1 and the executor admission boundary. */
export declare const operationFacts: (events: ReadonlyArray<JournalEvent>, operationId: string) => {
    starts: import("./ReleaseModel.js").DispatchStarted[];
    receipts: JournalEvent[];
    rejected: Set<string>;
    observations: import("./ReleaseModel.js").ObservationRecorded[];
    risks: import("./ReleaseModel.js").RiskAccepted[];
    consumed: Set<string>;
};
export declare const operationStatus: (events: ReadonlyArray<JournalEvent>, operationId: string, scopeKind?: Scope["_tag"]) => OperationStatus;
export declare const dispatchDecision: (plan: Plan, events: ReadonlyArray<JournalEvent>, operationId: string, candidate: CandidateRequest | null, now: number, scopeKind?: Scope["_tag"]) => Next;
export declare const assertJournalAppend: (plan: Plan, events: ReadonlyArray<JournalEvent>, event: JournalEvent, scopeKind?: Scope["_tag"]) => void;
export declare const projectReport: (plan: Plan, events: ReadonlyArray<JournalEvent>, scopeKind: Scope["_tag"]) => {
    planId: string;
    revision: number;
    superseded: boolean;
    operations: {
        operationId: string;
        status: OperationStatus;
        dispatches: number;
        receipts: number;
        observations: number;
    }[];
};
export declare const historyMachine: (plan: Plan, events: ReadonlyArray<JournalEvent>, scopeKind?: Scope["_tag"]) => Machine;
