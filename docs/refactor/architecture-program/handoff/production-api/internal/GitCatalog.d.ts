import { Effect, Schema } from "effect";
import type * as Redacted from "effect/Redacted";
import { Content } from "./ArtifactModel.js";
import { type ReadContent, type PutContent } from "./Content.js";
import { ReleaseError } from "./Error.js";
import { type Operation } from "./ReleaseModel.js";
import { type ProviderDefinition } from "../Provider.js";
declare const FileEdit_base: Schema.Class<FileEdit, Schema.Struct<{
    readonly path: Schema.String;
    readonly mode: Schema.Literals<readonly ["100644", "100755"]>;
    readonly content: typeof Content;
}>, {}>;
export declare class FileEdit extends FileEdit_base {
}
declare const Identity_base: Schema.Class<Identity, Schema.Struct<{
    readonly name: Schema.String;
    readonly email: Schema.String;
    readonly timestamp: Schema.String;
    readonly timezone: Schema.String;
}>, {}>;
export declare class Identity extends Identity_base {
}
declare const CommitInput_base: Schema.Class<CommitInput, Schema.Struct<{
    readonly expectedOld: Schema.String;
    readonly baseObjects: typeof Content;
    readonly files: Schema.$Array<typeof FileEdit>;
    readonly message: Schema.String;
    readonly author: typeof Identity;
    readonly committer: typeof Identity;
    readonly remote: Schema.String;
    readonly ref: Schema.String;
    readonly principal: Schema.String;
    readonly scope: Schema.String;
}>, {}>;
export declare class CommitInput extends CommitInput_base {
}
declare const Intent_base: Schema.Class<Intent, Schema.Struct<{
    readonly expectedOld: Schema.String;
    readonly desiredNew: Schema.String;
    readonly objectFormat: Schema.Literals<readonly ["sha1", "sha256"]>;
    readonly objectSet: typeof Content;
    readonly files: Schema.$Array<typeof FileEdit>;
    readonly remote: Schema.String;
    readonly ref: Schema.String;
    readonly principal: Schema.String;
    readonly scope: Schema.String;
}>, {}>;
export declare class Intent extends Intent_base {
}
export type RefCoordinate = Pick<Intent, "remote" | "ref" | "principal" | "scope">;
export type Credentials = {
    readonly _tag: "Anonymous";
} | {
    readonly _tag: "Bearer";
    readonly token: Redacted.Redacted<string>;
} | {
    readonly _tag: "Basic";
    readonly username: string;
    readonly password: Redacted.Redacted<string>;
};
export type ObserveRef = (input: RefCoordinate) => Effect.Effect<{
    readonly oid: string | null;
}, ReleaseError>;
export interface ObjectBuilder {
    readonly construct: (input: CommitInput, read: ReadContent) => Effect.Effect<{
        readonly desiredNew: string;
        readonly objectFormat: "sha1" | "sha256";
        readonly objectSetBytes: Uint8Array;
    }, ReleaseError>;
}
export declare const invalid: () => never;
export declare const objectFormat: (oid: string) => "sha1" | "sha256";
export declare const admitCoordinate: (input: RefCoordinate) => RefCoordinate;
export declare const validateFiles: (files: readonly FileEdit[]) => void;
export declare const ownIntent: (input: unknown) => Intent;
export declare const update: (input: Intent, dependsOn?: readonly string[] | undefined) => Effect.Effect<Operation, ReleaseError, never>;
export declare const prepare: (input: CommitInput, dependencies: {
    readonly objects: ObjectBuilder;
    readonly readContent: ReadContent;
    readonly putContent: PutContent;
}) => Effect.Effect<Intent, ReleaseError, never>;
export declare const definition: (dependencies: {
    readonly readContent: ReadContent;
    readonly observeRef: ObserveRef;
}) => ProviderDefinition;
export {};
