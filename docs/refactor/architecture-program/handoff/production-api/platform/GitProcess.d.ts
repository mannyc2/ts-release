import * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import { type ProcessResult } from "./Process.js";
import { ReleaseError } from "../internal/Error.js";
import { type Credentials, type RefCoordinate } from "../internal/GitCatalog.js";
export interface GitProcessOptions {
    readonly gitExecutable: string;
    readonly temporaryRoot: string;
    readonly timeoutMilliseconds: number;
    readonly maximumOutputBytes: number;
}
export type GitResult = ProcessResult;
export interface GitEnvironment {
    readonly identity?: Readonly<Record<string, string>>;
    readonly credentialConfig?: Readonly<Record<string, string>>;
}
export type GitCommand = (args: readonly string[], input?: Uint8Array, environment?: GitEnvironment) => Effect.Effect<GitResult, ReleaseError>;
export type GitRepository = Readonly<{
    run: GitCommand;
    directory: string;
}>;
export interface GitRuntime {
    readonly maximumOutputBytes: number;
    readonly repository: (format: "sha1" | "sha256") => Effect.Effect<GitRepository, ReleaseError>;
}
export declare const credentialEnvironment: (input: RefCoordinate, credentials: Credentials) => GitEnvironment;
export declare const resolveGitCredentials: (resolve: (input: RefCoordinate) => Effect.Effect<Credentials, ReleaseError>, input: RefCoordinate) => Effect.Effect<GitEnvironment, ReleaseError, never>;
export declare const openGitRuntime: (input: GitProcessOptions) => Effect.Effect<GitRuntime, ReleaseError, Scope.Scope>;
export declare const checked: (run: GitCommand, args: readonly string[], bytes?: Uint8Array<ArrayBufferLike> | undefined, environment?: GitEnvironment | undefined) => Effect.Effect<Uint8Array<ArrayBufferLike>, ReleaseError, never>;
export declare const nativeText: (bytes: Uint8Array) => string;
export declare const checkedText: (run: GitCommand, args: readonly string[], bytes?: Uint8Array<ArrayBufferLike> | undefined, environment?: GitEnvironment | undefined) => Effect.Effect<string, ReleaseError, never>;
