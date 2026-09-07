import * as Effect from "effect/Effect";
import { type ReadContent } from "../internal/Content.js";
import { CommitInput, FileEdit } from "../internal/GitCatalog.js";
import { type GitCommand } from "./GitProcess.js";
export declare const importObjects: (run: GitCommand, input: Uint8Array<ArrayBufferLike>, format: "sha256" | "sha1", limit: number) => Effect.Effect<string[], import("../internal/Error.js").ReleaseError, never>;
export declare const verifyGraph: (run: GitCommand, commit: string, objects: readonly string[]) => Effect.Effect<undefined, import("../internal/Error.js").ReleaseError, never>;
export declare const exportObjects: (run: GitCommand, commit: string, limit: number) => Effect.Effect<Uint8Array<ArrayBuffer>, import("../internal/Error.js").ReleaseError, never>;
export declare const verifyManagedCommit: (run: GitCommand, read: ReadContent, expectedOld: string, desiredNew: string, input: readonly FileEdit[], limit: number) => Effect.Effect<undefined, import("../internal/Error.js").ReleaseError, never>;
export declare const construct: (run: GitCommand, read: ReadContent, input: CommitInput, limit: number) => Effect.Effect<{
    desiredNew: string;
    objectFormat: "sha256" | "sha1";
    objectSetBytes: Uint8Array<ArrayBuffer>;
}, import("../internal/Error.js").ReleaseError, never>;
