import * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import { type JournalStore } from "../Journal.js";
import { type ReleaseError } from "../internal/Error.js";
import { type Credentials, type RefCoordinate } from "../internal/GitCatalog.js";
export interface GitJournalOptions {
    readonly cacheDirectory: string;
    readonly remote: string;
    readonly principal: string;
    readonly scope: string;
    readonly gitExecutable: string;
    readonly timeoutMilliseconds: number;
    readonly maximumOutputBytes: number;
    /** The configured remote's object format, including when its ref is unborn. */
    readonly objectFormat?: "sha1" | "sha256";
    readonly credentials: (input: RefCoordinate) => Effect.Effect<Credentials, ReleaseError>;
}
export declare const journalRef: (journalId: string) => string;
export declare const openGitJournal: (input: GitJournalOptions) => Effect.Effect<JournalStore, ReleaseError, Scope.Scope>;
