export type {} from "./internal/EffectTypes.js";
import * as Schema from "effect/Schema";
import { RequestFacts } from "./internal/ReleaseModel.js";
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
