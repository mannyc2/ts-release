import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
declare const ReleaseError_base: Schema.Class<ReleaseError, Schema.TaggedStruct<"ReleaseError", {
    readonly code: Schema.String;
    readonly message: Schema.String;
}>, import("effect/Cause").YieldableError>;
/** A failure to admit or execute a release operation. */
export declare class ReleaseError extends ReleaseError_base {
}
export declare function fail(code: string, message: string): never;
export declare const attempt: <A>(body: () => A) => Effect.Effect<A, ReleaseError>;
export {};
