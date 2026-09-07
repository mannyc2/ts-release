import * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import { type Transport } from "../Provider.js";
import { type ReadContent } from "../internal/Content.js";
import { type ReleaseError } from "../internal/Error.js";
import { type Credentials, type Intent, type ObjectBuilder, type ObserveRef, type RefCoordinate } from "../internal/GitCatalog.js";
import { type GitProcessOptions } from "./GitProcess.js";
export interface GitCatalogHost {
    readonly objects: ObjectBuilder;
    readonly captureBase: (input: RefCoordinate & {
        readonly expectedOld: string;
    }) => Effect.Effect<Uint8Array, ReleaseError>;
    readonly observeRef: ObserveRef;
    readonly transport: (intents: readonly [Intent, ...Intent[]], otherwise?: Transport) => Transport;
}
export interface GitCatalogHostOptions extends GitProcessOptions {
    readonly readContent: ReadContent;
    readonly credentials: (input: RefCoordinate) => Effect.Effect<Credentials, ReleaseError>;
}
export declare const makeGitCatalogHost: (options: GitCatalogHostOptions) => Effect.Effect<GitCatalogHost, ReleaseError, Scope.Scope>;
