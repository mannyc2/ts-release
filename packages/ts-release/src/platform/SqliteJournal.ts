import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import type { ReleaseError } from "../internal/Error.js"
import type { AppendResult, JournalStore, Snapshot } from "../Journal.js"
import type { JournalEvent } from "../internal/ReleaseModel.js"
import { EVENT_BYTES, encodeEvent, readEvent } from "./StoreCodec.js"
import { attempt, fail } from "../internal/Error.js"

const FORMAT = "ts-release/sqlite-journal/1"

class SqliteJournal implements JournalStore {
  readonly db: Database
  constructor(path: string) {
    if (!path || path.includes("\0")) fail("journal-path", "An explicit database path is required")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    this.db = new Database(path, { create: true, strict: true })
    try {
      this.db.exec("PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;")
      this.db
        .transaction(() => {
          const tables = this.db
            .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .all() as { name: string }[]
          if (tables.length === 0) {
            this.db.exec(
              "CREATE TABLE metadata (format TEXT NOT NULL); CREATE TABLE events (journal TEXT NOT NULL, revision INTEGER NOT NULL, event_id TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(journal,revision), UNIQUE(journal,event_id))",
            )
            this.db.query("INSERT INTO metadata(format) VALUES(?)").run(FORMAT)
          } else {
            if (
              tables.length !== 2 ||
              !tables.some((t) => t.name === "metadata") ||
              !tables.some((t) => t.name === "events")
            )
              fail("journal-format", "Database is not a current release journal")
            const rows = this.db.query("SELECT format FROM metadata").all() as { format: string }[]
            if (rows.length !== 1 || rows[0]?.format !== FORMAT)
              fail("journal-format", "Journal format is not supported")
          }
        })
        .immediate()
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  read = Effect.fn("ts-release.SqliteJournal.read")((journalId: string) =>
    attempt((): Snapshot => {
      const rows = this.db
        .query(
          "SELECT revision, length(bytes) AS size FROM events WHERE journal=? ORDER BY revision",
        )
        .all(journalId) as { revision: number; size: number }[]
      const events = rows.map(({ revision, size }, index) => {
        if (revision !== index + 1) fail("revision-gap", "Journal revisions are not contiguous")
        if (size > EVENT_BYTES)
          fail("event-too-large", "Stored event exceeds the journal byte limit")
        const row = this.db
          .query("SELECT bytes FROM events WHERE journal=? AND revision=?")
          .get(journalId, revision) as { bytes: Uint8Array }
        const event = readEvent(row.bytes)
        if (event.journalId !== journalId)
          fail("journal-mismatch", "Stored event belongs to another journal")
        return event
      })
      return { revision: events.length, events }
    }),
  )

  append = Effect.fn("ts-release.SqliteJournal.append")(
    (journalId: string, expectedRevision: number, event: JournalEvent) =>
      attempt((): AppendResult => {
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
          fail("journal-revision", "Expected revision must be a nonnegative safe integer")
        const bytes = encodeEvent(event, journalId)
        return this.db
          .transaction((): AppendResult => {
            const existing = this.db
              .query("SELECT revision, bytes FROM events WHERE journal=? AND event_id=?")
              .get(journalId, event.eventId) as { revision: number; bytes: Uint8Array } | null
            if (existing) {
              if (!Buffer.from(existing.bytes).equals(bytes))
                fail("event-id-conflict", "Event ID has different facts")
              return { _tag: "AlreadyRecorded", revision: existing.revision }
            }
            const row = this.db
              .query("SELECT COUNT(*) AS revision FROM events WHERE journal=?")
              .get(journalId) as { revision: number }
            if (row.revision !== expectedRevision)
              return { _tag: "RevisionMismatch", revision: row.revision }
            this.db
              .query("INSERT INTO events(journal,revision,event_id,bytes) VALUES(?,?,?,?)")
              .run(journalId, expectedRevision + 1, event.eventId, bytes)
            return { _tag: "Appended", revision: expectedRevision + 1 }
          })
          .immediate()
      }),
  )
}

export const openSqliteJournal = Effect.fn("ts-release.openSqliteJournal")(
  (path: string): Effect.Effect<JournalStore, ReleaseError, Scope.Scope> =>
    Effect.acquireRelease(
      attempt(() => new SqliteJournal(path)),
      (journal) => Effect.sync(() => journal.db.close()),
    ),
)
