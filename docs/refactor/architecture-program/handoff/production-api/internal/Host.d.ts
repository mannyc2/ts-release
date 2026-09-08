import * as Context from "effect/Context";
import { Effect } from "effect";
import type { JournalContext, JournalStore } from "../Journal.js";
import type { ProviderDefinition, Transport } from "../Provider.js";
import type { Machine, MachineConstructor } from "./Decision.js";
import { JournalEvent, Plan } from "./ReleaseModel.js";
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
export declare const currentHost: Effect.Effect<HostShape, import("./Error.js").ReleaseError, Host>;
export declare const journalIdFor: (host: HostShape, plan: Plan) => string;
export declare const scopeKind: (host: HostShape, plan: Plan) => "PublicationScope" | "PreparationScope";
export declare const read: (host: HostShape, plan: Plan) => Effect.Effect<{
    plans: Plan[];
    snapshot: {
        revision: number;
        events: readonly JournalEvent[];
    };
    machine: Machine;
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
}, import("./Error.js").ReleaseError, never>;
export {};
