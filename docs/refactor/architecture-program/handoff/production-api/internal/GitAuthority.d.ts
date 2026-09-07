import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ReleaseError } from "./Error.js";
import { type Transport } from "../Provider.js";
import { RequestFacts } from "./ReleaseModel.js";
declare const GitReceipt_base: Schema.Class<GitReceipt, Schema.Struct<{
    readonly kind: Schema.Literal<"git-push">;
    readonly ref: Schema.String;
    readonly desiredNew: Schema.String;
    readonly porcelain: Schema.String;
}>, {}>;
export declare class GitReceipt extends GitReceipt_base {
}
export interface GitExecution {
    readonly exitCode: number;
    readonly stdout: string;
}
export interface CoreGitOptions {
    readonly principal: string;
    readonly scope: string;
    /** Captured at the host boundary; implement with execFile/spawn, never a shell. */
    readonly execute: (arguments_: ReadonlyArray<string>) => Effect.Effect<GitExecution, ReleaseError>;
    readonly otherwise?: Transport;
}
export declare const authorityKey: (principal: string, scope: string) => string;
export declare const mechanisms: WeakMap<Transport, ReadonlyMap<string, CoreGitOptions>>;
/** Keep the exact core mechanism identity; ordinary ports retain their state
 * behind a captured function, never behind a mutable method lookup. */
export declare const captureTransport: (transport: Transport) => Transport;
export declare const assertTransportBinding: (transport: Transport, facts: RequestFacts) => void;
/** The only protected mechanism in this experiment is one exact conditional push. */
export declare function makeCoreGitTransport(options: CoreGitOptions): Transport;
export declare function makeCoreGitTransport(options: readonly [CoreGitOptions, ...CoreGitOptions[]], otherwise?: Transport): Transport;
export {};
