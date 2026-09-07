import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ObservationRecorded, ObservationStatus, Operation, RequestFacts } from "./internal/ReleaseModel.js";
import { ReleaseError } from "./internal/Error.js";
/** Provider contract version spoken by this kernel. A definition built against another contract is rejected at Host verification, whatever the installer resolved. */
export declare const PROVIDER_CONTRACT: "ts-release/provider/1";
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
    /** Resolve ephemeral credentials before the journal uncertainty boundary.
     * The returned send has no dispatch permission; only fresh core CAS grants it. */
    readonly prepare?: (request: PreparedRequest) => Effect.Effect<Transport["send"], ReleaseError>;
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
export interface NativeFailureBoundary {
    readonly version: string;
    readonly codec: Schema.Codec<unknown, unknown>;
    readonly corresponds: (operation: Operation, request: RequestFacts, evidence: unknown) => boolean;
}
export interface ProviderDefinition {
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
export type Json = Schema.Json;
export type OperationId = string;
export type Author<A> = (input: A, dependsOn?: readonly OperationId[]) => Effect.Effect<Operation, ReleaseError>;
export declare const requestFingerprint: (facts: RequestFacts) => Effect.Effect<string, ReleaseError, never>;
export declare const makeRequest: (input: Omit<RequestFacts, "byteLength" | "bodyDigest"> & {
    readonly body: Uint8Array;
}) => Effect.Effect<{
    facts: RequestFacts;
    body: Uint8Array<ArrayBuffer>;
}, ReleaseError, never>;
export declare const verifyRequest: (request: PreparedRequest) => Effect.Effect<{
    facts: RequestFacts;
    body: Uint8Array<ArrayBuffer>;
}, ReleaseError, never>;
export declare const CORE_ERROR_VERSIONS: Set<string>;
export declare const isCoreErrorVersion: (version: string) => boolean;
export declare const verifyDescriptor: (provider: ProviderDescriptor) => void;
export declare const verifyProviderContracts: (providers: ReadonlyArray<ProviderDefinition>) => void;
export declare const decodeObservationEvidence: (provider: ProviderDefinition, body: ObservationRecorded) => unknown;
export declare const nativeEvidence: (codec: Schema.Codec<unknown, unknown>, input: unknown) => unknown;
