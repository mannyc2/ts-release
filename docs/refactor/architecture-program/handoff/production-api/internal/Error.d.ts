import { Effect, Schema } from "effect";
declare const ReleaseError_base: Schema.Class<ReleaseError, Schema.TaggedStruct<"ReleaseError", {
    readonly code: Schema.String;
    readonly message: Schema.String;
}>, import("effect/Cause").YieldableError>;
/** A failure to admit or execute a release operation. */
export declare class ReleaseError extends ReleaseError_base {
}
export declare function fail(code: string, message: string): never;
export declare const failure: (code: string, message: string) => ReleaseError;
export declare const reject: (code: string, message: string) => Effect.Effect<never, ReleaseError>;
export declare const attempt: <A>(body: () => A) => Effect.Effect<A, ReleaseError>;
export {};
