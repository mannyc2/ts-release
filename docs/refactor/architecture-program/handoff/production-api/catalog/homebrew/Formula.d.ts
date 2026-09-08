import { Effect, Schema } from "effect";
import { File, type Bundle } from "@mannyc1/ts-release/bundle";
declare const Download_base: Schema.Class<Download, Schema.Struct<{
    readonly url: Schema.String;
    readonly file: typeof File;
}>, {}>;
export declare class Download extends Download_base {
}
declare const Formula_base: Schema.Class<Formula, Schema.Struct<{
    readonly className: Schema.String;
    readonly description: Schema.String;
    readonly homepage: Schema.String;
    readonly license: Schema.String;
    readonly version: Schema.String;
    readonly executable: Schema.String;
    readonly archives: Schema.Struct<{
        readonly "darwin-x64": typeof Download;
        readonly "darwin-arm64": typeof Download;
        readonly "linux-x64": typeof Download;
        readonly "linux-arm64": typeof Download;
    }>;
}>, {}>;
export declare class Formula extends Formula_base {
}
export declare const render: (input: Formula, bundle: Bundle) => Effect.Effect<Uint8Array<ArrayBuffer>, import("@mannyc1/ts-release").ReleaseError, never>;
export {};
