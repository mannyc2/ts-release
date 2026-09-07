import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { File, type Bundle } from "@mannyc1/ts-release/bundle";
declare const Download_base: Schema.Class<Download, Schema.Struct<{
    readonly url: Schema.String;
    readonly file: typeof File;
}>, {}>;
export declare class Download extends Download_base {
}
declare const Manifest_base: Schema.Class<Manifest, Schema.Struct<{
    readonly version: Schema.String;
    readonly homepage: Schema.String;
    readonly license: Schema.String;
    readonly executable: Schema.String;
    readonly archives: Schema.Struct<{
        readonly "windows-x64": typeof Download;
        readonly "windows-arm64": typeof Download;
    }>;
}>, {}>;
export declare class Manifest extends Manifest_base {
}
export declare const render: (input: Manifest, bundle: Bundle) => Effect.Effect<Uint8Array<ArrayBuffer>, import("@mannyc1/ts-release").ReleaseError, never>;
export {};
