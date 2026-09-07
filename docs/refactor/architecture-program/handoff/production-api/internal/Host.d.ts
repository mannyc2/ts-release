import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { type JournalContext, type JournalStore, type Snapshot } from "../Journal.js";
import { type ProviderContext, type ProviderDefinition, type Transport } from "../Provider.js";
import { type MachineConstructor } from "./Decision.js";
import { JournalEvent, Operation, Plan } from "./ReleaseModel.js";
import { ReleaseError } from "./Error.js";
export interface HostShape {
    readonly store: JournalStore;
    readonly transport: Transport;
    readonly providers: ReadonlyArray<ProviderDefinition>;
    readonly now: () => number;
    readonly uniqueId: () => string;
    readonly journal?: JournalContext;
    /** Decision evaluator over validated history. Default: the kernel's history machine (M1). Any implementation satisfying the Machine laws may be supplied by the application. */
    readonly machine?: MachineConstructor;
}
declare const Host_base: Context.ServiceClass<Host, "ts-release/Host", HostShape>;
export declare class Host extends Host_base {
}
/** Capture capabilities before calling user code or storage. Mutable service
 * state stays behind its functions; callers cannot replace this invocation's
 * provider table, transport, journal scopes, or clock after admission. */
export declare const captureHost: (input: HostShape) => HostShape;
export declare const currentHost: Effect.Effect<HostShape, ReleaseError, Host>;
/** Both inputs were owned and frozen at admission, preserving Schema classes. */
export declare const model: (host: HostShape, plan: Plan, events: ReadonlyArray<JournalEvent>) => import("./Decision.js").Machine;
export declare const providerContext: (host: HostShape, plan: Plan, operation: Operation, snapshot: Snapshot) => ProviderContext;
export declare const journalIdFor: (host: HostShape, plan: Plan) => string;
export declare const scopeKind: (host: HostShape, plan: Plan) => "PublicationScope" | "PreparationScope";
export declare const read: (host: HostShape, plan: Plan) => Effect.Effect<{
    plans: Plan[];
    snapshot: {
        revision: number;
        events: JournalEvent[];
    };
    machine: import("./Decision.js").Machine;
    report: () => {
        revision: number;
        planId: string;
        superseded: boolean;
        operations: {
            operationId: string;
            status: import("./ReleaseModel.js").OperationStatus;
            dispatches: number;
            receipts: number;
            observations: number;
        }[];
    };
}, ReleaseError, never>;
export {};
