import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { type AppendResult, type JournalStore, type Snapshot, type JournalEvent } from "../machine/src/contracts.js"
import { EVENT_BYTES, attempt, body, encoder, fail, readEvent } from "./protocol.js"

export class SqliteJournal implements JournalStore {
  readonly db: Database
  constructor(readonly path: string, readonly limit = EVENT_BYTES) {
    mkdirSync(dirname(path), { recursive: true })
    this.db = new Database(path, { create: true, strict: true })
    this.db.exec("PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;")
    this.db.exec(`CREATE TABLE IF NOT EXISTS events (
      plan TEXT NOT NULL, revision INTEGER NOT NULL, event_id TEXT NOT NULL,
      bytes BLOB NOT NULL, PRIMARY KEY(plan, revision), UNIQUE(plan, event_id)
    )`)
  }
  close() { this.db.close() }
  read = (journalId: string) => attempt("SqliteJournal.read", (): Snapshot => {
    const rows = this.db.query("SELECT revision, length(bytes) AS size FROM events WHERE plan=? ORDER BY revision")
      .all(journalId) as Array<{ revision: number; size: number }>
    const events = rows.map(({ revision, size }, index) => {
      if (revision !== index + 1) fail("revision-gap", "Journal revisions are not contiguous")
      if (size > this.limit) fail("event-too-large", "Reject oversized storage input before loading its body")
      const row = this.db.query("SELECT bytes FROM events WHERE plan=? AND revision=?").get(journalId, revision) as { bytes: Uint8Array }
      const event = readEvent(row.bytes, this.limit)
      if (event.journalId !== journalId) fail("journal-mismatch", "Stored event belongs to another journal")
      return event
    })
    return { revision: events.length, events }
  })
  append = (journalId: string, expectedRevision: number, event: JournalEvent) => attempt("SqliteJournal.append", (): AppendResult => {
    const encoded = body(event, journalId, this.limit)
    return this.db.transaction((): AppendResult => {
      const existing = this.db.query("SELECT revision, bytes FROM events WHERE plan=? AND event_id=?")
        .get(journalId, event.eventId) as { revision: number; bytes: Uint8Array } | null
      if (existing) {
        if (new TextDecoder().decode(existing.bytes) !== encoded) fail("event-id-conflict", "Event ID has different facts")
        return { _tag: "AlreadyRecorded", revision: existing.revision }
      }
      const row = this.db.query("SELECT COUNT(*) AS revision FROM events WHERE plan=?").get(journalId) as { revision: number }
      if (row.revision !== expectedRevision) return { _tag: "RevisionMismatch", revision: row.revision }
      this.db.query("INSERT INTO events(plan,revision,event_id,bytes) VALUES(?,?,?,?)")
        .run(journalId, expectedRevision + 1, event.eventId, encoder.encode(encoded))
      return { _tag: "Appended", revision: expectedRevision + 1 }
    }).immediate()
  })
}
