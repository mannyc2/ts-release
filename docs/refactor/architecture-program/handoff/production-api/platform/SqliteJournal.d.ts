import * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import type { ReleaseError } from "../internal/Error.js";
import type { JournalStore } from "../Journal.js";
export declare const openSqliteJournal: (path: string) => Effect.Effect<JournalStore, ReleaseError, Scope.Scope>;
