import { Effect, Schema } from "effect";
/** Unicode scalar order equals UTF-8 byte order for admitted strings. */
export declare const compareText: (left: string, right: string) => number;
/** Canonical JSON includes every owned field; hidden data and accessors reject. */
export declare const canonical: (input: unknown) => string;
/** Copy only admitted data; never retain caller aliases behind durable identities. */
export declare const copyData: (input: unknown) => unknown;
export declare const sameData: (left: unknown, right: unknown) => boolean;
export declare const sameBytes: (left: Uint8Array, right: Uint8Array) => boolean;
export declare const freeze: <A>(value: A) => A;
/** Own the complete wire value before decoding; preserve durable Schema classes. */
export declare const decodeOwned: <A, I>(codec: Schema.Codec<A, I>, input: unknown) => A;
export declare const parseCanonical: (text: string) => unknown;
export declare const sha256: (bytes: Uint8Array<ArrayBufferLike>) => Effect.Effect<string, import("./Error.js").ReleaseError, never>;
export declare const hashCanonical: (domain: string, value: unknown) => Effect.Effect<string, import("./Error.js").ReleaseError, never>;
