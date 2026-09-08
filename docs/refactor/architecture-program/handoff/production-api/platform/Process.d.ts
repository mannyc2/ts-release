import * as Effect from "effect/Effect";
export type ProcessBounds = Readonly<{
    timeoutMilliseconds: number;
    maximumOutputBytes: number;
}>;
export type ProcessResult = Readonly<{
    exitCode: number;
    stdout: Uint8Array;
}>;
type RawCommand<E> = (args: readonly string[], input?: Uint8Array, environment?: Readonly<Record<string, string>>) => Effect.Effect<ProcessResult, E>;
export declare const command: <E>(executable: string, directory: string, options: ProcessBounds, error: () => E) => RawCommand<E>;
export {};
