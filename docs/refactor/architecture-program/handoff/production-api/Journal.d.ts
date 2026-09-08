import type * as Effect from "effect/Effect";
import { JournalEvent, Plan } from "./internal/ReleaseModel.js";
import { type ReleaseError } from "./internal/Error.js";
import { type ProviderDefinition } from "./Provider.js";
export type Snapshot = Readonly<{
    revision: number;
    events: ReadonlyArray<JournalEvent>;
}>;
type RevisedAppend = "Appended" | "AlreadyRecorded" | "RevisionMismatch";
export type AppendResult = {
    readonly _tag: RevisedAppend;
    readonly revision: number;
} | {
    readonly _tag: "AmbiguousStorageOutcome";
};
export interface JournalStore {
    readonly read: (journalId: string) => Effect.Effect<Snapshot, ReleaseError>;
    readonly append: (journalId: string, expectedRevision: number, event: JournalEvent) => Effect.Effect<AppendResult, ReleaseError>;
}
/** Preparation views are reconstructed from one concrete durable input; they
 * are never a second persisted publication plan or a future-work recipe. */
export type Scope = {
    readonly _tag: "PublicationScope";
    readonly plan: Plan;
} | {
    readonly _tag: "PreparationScope";
    readonly plan: Plan;
};
export type JournalContext = Readonly<{
    journalId: string;
    scopes: ReadonlyArray<Scope>;
}>;
/** A preparation selects one immutable output. Receipt and observation channels
 * are distinct; their payloads cannot be assumed equivalent across codecs. */
export declare const verifyPreparationSelection: (events: ReadonlyArray<JournalEvent>) => void;
/** Native correspondence is provider protocol knowledge; it grants no replay authority. */
export declare const verifyNativeEvidence: (plan: Plan, events: ReadonlyArray<JournalEvent>, providers: ReadonlyArray<ProviderDefinition>) => void;
export {};
