import * as Effect from "effect/Effect";
import { type HostShape } from "./internal/Host.js";
import { EventBody, JournalEvent, Plan, RiskAccepted, type RunOptions } from "./internal/ReleaseModel.js";
import { ReleaseError } from "./internal/Error.js";
export declare const eventFor: (host: HostShape, plan: Plan, body: EventBody) => JournalEvent;
/** Facts survive CAS loss; their identity is retained across append retries. */
export declare const appendFact: (host: HostShape, plan: Plan, event: JournalEvent) => Effect.Effect<undefined, ReleaseError, never>;
export declare const reportRelease: (options: {
    readonly plan: Plan;
}) => Effect.Effect<{
    revision: number;
    planId: string;
    superseded: boolean;
    operations: {
        operationId: string;
        status: import("./internal/ReleaseModel.js").OperationStatus;
        dispatches: number;
        receipts: number;
        observations: number;
    }[];
}, ReleaseError, import("./internal/Host.js").Host>;
export declare const observeRelease: (options: {
    readonly plan: Plan;
}) => Effect.Effect<{
    revision: number;
    planId: string;
    superseded: boolean;
    operations: {
        operationId: string;
        status: import("./internal/ReleaseModel.js").OperationStatus;
        dispatches: number;
        receipts: number;
        observations: number;
    }[];
}, ReleaseError, import("./internal/Host.js").Host>;
/** One interpreter, no durable permit and no provider-selected mutation retry. */
export declare const runRelease: (input: RunOptions) => Effect.Effect<{
    revision: number;
    planId: string;
    superseded: boolean;
    operations: {
        operationId: string;
        status: import("./internal/ReleaseModel.js").OperationStatus;
        dispatches: number;
        receipts: number;
        observations: number;
    }[];
}, ReleaseError, import("./internal/Host.js").Host>;
export declare const supersedePlan: (options: {
    readonly plan: Plan;
    readonly authorize: boolean;
    readonly reason: string;
}) => Effect.Effect<{
    revision: number;
    planId: string;
    superseded: boolean;
    operations: {
        operationId: string;
        status: import("./internal/ReleaseModel.js").OperationStatus;
        dispatches: number;
        receipts: number;
        observations: number;
    }[];
}, ReleaseError, import("./internal/Host.js").Host>;
export declare const acceptRisk: (options: {
    readonly plan: Plan;
    readonly authorize: boolean;
    readonly decision: RiskAccepted;
}) => Effect.Effect<{
    revision: number;
    planId: string;
    superseded: boolean;
    operations: {
        operationId: string;
        status: import("./internal/ReleaseModel.js").OperationStatus;
        dispatches: number;
        receipts: number;
        observations: number;
    }[];
}, ReleaseError, import("./internal/Host.js").Host>;
