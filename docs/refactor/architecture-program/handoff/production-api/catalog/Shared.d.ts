import { Effect, Schema } from "effect";
import { ReleaseError } from "@mannyc1/ts-release";
import { Bundle, File } from "@mannyc1/ts-release/bundle";
export declare const Text: Schema.String;
export declare const Url: Schema.String;
export declare const Executable: Schema.String;
export declare const decode: <A, I>(codec: Schema.Codec<A, I>, input: unknown) => A;
export declare const downloads: (bundle: Bundle, archives: Readonly<Record<string, {
    readonly url: string;
    readonly file: File;
}>>) => void;
export declare const renderBytes: (render: () => string) => Effect.Effect<Uint8Array<ArrayBuffer>, ReleaseError, never>;
