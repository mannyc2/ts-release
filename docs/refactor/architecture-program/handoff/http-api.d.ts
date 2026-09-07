/**
 * Proposed production contract, derived from type-checked research declarations.
 * This file declares no implementation and is not evidence of production completion.
 * Changes from the prototype: error renamed ReleaseError; production domains
 * use ts-release/*; private candidate selection and checkpoint hooks omitted.
 * Operation/Plan IDs remain strings whose validation is proved by constructors;
 * additional compile-time brands are not claimed by this tested contract.
 * Implementation classes must remain Schema.Class / Schema.TaggedClass / tagged
 * errors, not interface casts. No legacy reader or migration export is proposed.
 */
import { Schema } from "effect";
import type { RequestFacts } from "./kernel-api.js";
declare const HttpReceipt_base: Schema.Class<HttpReceipt, Schema.Struct<{
    readonly status: Schema.Number;
    readonly body: Schema.String;
    readonly endpoint: Schema.String;
    readonly method: Schema.String;
    readonly bodyDigest: Schema.String;
}>, {}>;
/** Native response envelope binds the observed acknowledgement to exact send facts. */
export declare class HttpReceipt extends HttpReceipt_base {
}
export declare const corresponds: (request: RequestFacts, receipt: unknown) => boolean;
export {};
