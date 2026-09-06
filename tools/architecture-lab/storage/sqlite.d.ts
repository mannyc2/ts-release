import { Database } from "bun:sqlite";
import { type AppendResult, type JournalStore, type Snapshot, type JournalEvent } from "../machine/src/contracts.js";
export declare class SqliteJournal implements JournalStore {
    readonly path: string;
    readonly limit: number;
    readonly db: Database;
    constructor(path: string, limit?: number);
    close(): void;
    read: (journalId: string) => import("effect/Effect").Effect<Snapshot, import("../machine/src/contracts.js").LabError, never>;
    append: (journalId: string, expectedRevision: number, event: JournalEvent) => import("effect/Effect").Effect<AppendResult, import("../machine/src/contracts.js").LabError, never>;
}
