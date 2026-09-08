import * as Schema from "effect/Schema";
import { RequestFacts, type ObservationStatus, type Operation } from "@mannyc1/ts-release";
import type { PreparedRequest } from "@mannyc1/ts-release";
import { type HttpResponse } from "@mannyc1/ts-release/http";
declare const Absent_base: Schema.Class<Absent, Schema.TaggedStruct<"Absent", {}>, {}>;
declare class Absent extends Absent_base {
}
declare const Unavailable_base: Schema.Class<Unavailable, Schema.TaggedStruct<"Unavailable", {
    readonly reason: Schema.Literals<readonly ["http-status", "malformed-package", "malformed-version", "incomplete-digests", "malformed-tag"]>;
}>, {}>;
declare class Unavailable extends Unavailable_base {
}
declare const DifferentPackage_base: Schema.Class<DifferentPackage, Schema.TaggedStruct<"DifferentPackage", {
    readonly name: Schema.String;
}>, {}>;
declare class DifferentPackage extends DifferentPackage_base {
}
declare const VersionFacts_base: Schema.Class<VersionFacts, Schema.TaggedStruct<"VersionFacts", {
    readonly name: Schema.String;
    readonly version: Schema.String;
    readonly integrity: Schema.String;
    readonly shasum: Schema.String;
}>, {}>;
declare class VersionFacts extends VersionFacts_base {
}
declare const TagValue_base: Schema.Class<TagValue, Schema.TaggedStruct<"TagValue", {
    readonly version: Schema.String;
}>, {}>;
declare class TagValue extends TagValue_base {
}
declare const NotApplicable_base: Schema.Class<NotApplicable, Schema.TaggedStruct<"NotApplicable", {}>, {}>;
declare class NotApplicable extends NotApplicable_base {
}
declare const RegistryObservation_base: Schema.Class<RegistryObservation, Schema.Struct<{
    readonly request: typeof RequestFacts;
    readonly status: Schema.Int;
    readonly version: Schema.Union<readonly [typeof Absent, typeof Unavailable, typeof DifferentPackage, typeof VersionFacts, typeof NotApplicable]>;
    readonly tag: Schema.Union<readonly [typeof Absent, typeof Unavailable, typeof TagValue]>;
}>, {}>;
export declare class RegistryObservation extends RegistryObservation_base {
}
declare const RegistryReceipt_base: Schema.Class<RegistryReceipt, Schema.Struct<{
    readonly request: typeof RequestFacts;
    readonly status: Schema.Int;
    readonly responseBody: Schema.Literal<"not-used-as-publication-facts">;
}>, {}>;
export declare class RegistryReceipt extends RegistryReceipt_base {
}
export declare const ownsRequest: (definitionId: string, input: PreparedRequest) => boolean;
export declare const requestMatches: (operation: Operation, request: RequestFacts) => boolean;
export declare const receiptCorresponds: (operation: Operation, request: RequestFacts, input: unknown) => boolean;
export declare const classifyObservation: (operation: Operation, input: unknown, acceptedReceipts?: ReadonlyArray<unknown>) => ObservationStatus;
export declare const observeResponse: (request: RequestFacts, response: HttpResponse) => RegistryObservation;
export {};
