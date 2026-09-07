import * as Schema from "effect/Schema";
import { RequestFacts, type Operation, type ProviderContext, type ObservationStatus } from "@mannyc1/ts-release";
import * as Model from "./Model.js";
import { BoundScope, NativeFacts } from "./Binding.js";
declare const Receipt_base: Schema.Class<Receipt, Schema.Struct<{
    readonly request: typeof RequestFacts;
    readonly status: Schema.Literals<readonly [200, 201]>;
    readonly facts: Schema.Union<readonly [typeof Model.AnnotatedTagFacts, typeof Model.RefFacts, typeof Model.ReleaseFacts, typeof Model.AssetFacts]>;
}>, {}>;
export declare class Receipt extends Receipt_base {
}
declare const NativeFailure_base: Schema.Class<NativeFailure, Schema.Struct<{
    readonly request: typeof RequestFacts;
    readonly status: Schema.Int;
    readonly kind: Schema.Literals<readonly ["http-status", "malformed-native", "different-native"]>;
}>, {}>;
export declare class NativeFailure extends NativeFailure_base {
}
declare const AssetEvidence_base: Schema.Class<AssetEvidence, Schema.Struct<{
    readonly facts: typeof Model.AssetFacts;
    readonly downloadedSha256: Schema.NullOr<Schema.String>;
}>, {}>;
export declare class AssetEvidence extends AssetEvidence_base {
}
declare const Present_base: Schema.Class<Present, Schema.TaggedStruct<"Present", {
    readonly scope: Schema.String;
    readonly facts: Schema.Union<readonly [typeof Model.AnnotatedTagFacts, typeof Model.RefFacts, typeof Model.ReleaseFacts, typeof Model.AssetFacts]>;
    readonly observedCommit: Schema.NullOr<Schema.String>;
    readonly downloadedSha256: Schema.NullOr<Schema.String>;
    readonly assets: Schema.$Array<typeof AssetEvidence>;
}>, {}>;
export declare class Present extends Present_base {
}
declare const Missing_base: Schema.Class<Missing, Schema.TaggedStruct<"Missing", {
    readonly scope: Schema.String;
}>, {}>;
export declare class Missing extends Missing_base {
}
declare const Unavailable_base: Schema.Class<Unavailable, Schema.TaggedStruct<"Unavailable", {
    readonly operationId: Schema.String;
    readonly reason: Schema.Literals<readonly ["parent-unresolved", "http-status", "malformed-native", "pagination-bound", "download-unavailable"]>;
}>, {}>;
export declare class Unavailable extends Unavailable_base {
}
export declare const Observation: Schema.Union<readonly [typeof Present, typeof Missing, typeof Unavailable]>;
export type Observation = typeof Observation.Type;
export declare const decodeFacts: (scope: BoundScope, value: unknown) => NativeFacts;
export declare const matches: (scope: BoundScope, facts: NativeFacts) => boolean;
export declare const receiptCorresponds: (operation: Operation, request: RequestFacts, value: unknown) => boolean;
export declare const failureCorresponds: (operation: Operation, request: RequestFacts, value: unknown) => boolean;
export declare const classifyObservation: (operation: Operation, input: unknown, receipts: readonly unknown[], context: ProviderContext) => ObservationStatus;
/** Publish compares the complete native enumeration against every selected asset. */
export declare const classifyAssets: (scope: BoundScope, assets: readonly AssetEvidence[], context: ProviderContext) => ObservationStatus;
export {};
