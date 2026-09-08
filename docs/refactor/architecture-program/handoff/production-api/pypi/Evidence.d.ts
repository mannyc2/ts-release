import * as Schema from "effect/Schema";
import { RequestFacts, type Operation, type ObservationStatus } from "@mannyc1/ts-release";
import { type HttpResponse } from "@mannyc1/ts-release/http";
declare const Absent_base: Schema.Class<Absent, Schema.TaggedStruct<"Absent", {}>, {}>;
declare class Absent extends Absent_base {
}
declare const Unavailable_base: Schema.Class<Unavailable, Schema.TaggedStruct<"Unavailable", {
    readonly reason: Schema.Literals<readonly ["http-status", "malformed-simple"]>;
}>, {}>;
declare class Unavailable extends Unavailable_base {
}
declare const FileFacts_base: Schema.Class<FileFacts, Schema.TaggedStruct<"FileFacts", {
    readonly filename: Schema.String;
    readonly sha256: Schema.NullOr<Schema.String>;
    readonly bytes: Schema.NullOr<Schema.String>;
    readonly yanked: Schema.Boolean;
}>, {}>;
declare class FileFacts extends FileFacts_base {
}
declare const DifferentProject_base: Schema.Class<DifferentProject, Schema.TaggedStruct<"DifferentProject", {
    readonly project: Schema.String;
}>, {}>;
declare class DifferentProject extends DifferentProject_base {
}
declare const SimpleObservation_base: Schema.Class<SimpleObservation, Schema.Struct<{
    readonly request: typeof RequestFacts;
    readonly status: Schema.Int;
    readonly facet: Schema.Union<readonly [typeof Absent, typeof Unavailable, typeof FileFacts, typeof DifferentProject]>;
}>, {}>;
export declare class SimpleObservation extends SimpleObservation_base {
}
declare const UploadReceipt_base: Schema.Class<UploadReceipt, Schema.Struct<{
    readonly request: typeof RequestFacts;
    readonly status: Schema.Literal<200>;
}>, {}>;
export declare class UploadReceipt extends UploadReceipt_base {
}
declare const NativeFailure_base: Schema.Class<NativeFailure, Schema.Struct<{
    readonly request: typeof RequestFacts;
    readonly status: Schema.Int;
    readonly kind: Schema.Literal<"unclassified-response">;
}>, {}>;
export declare class NativeFailure extends NativeFailure_base {
}
export declare const receiptCorresponds: (operation: Operation, request: RequestFacts, input: unknown) => boolean;
export declare const failureCorresponds: (operation: Operation, request: RequestFacts, input: unknown) => boolean;
export declare const classifyObservation: (operation: Operation, input: unknown, receipts: readonly unknown[]) => ObservationStatus;
export declare const observeResponse: (request: RequestFacts, response: HttpResponse) => SimpleObservation;
export {};
