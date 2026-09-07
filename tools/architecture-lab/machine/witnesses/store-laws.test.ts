import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SqliteJournal } from "../../storage/sqlite.js"
import { type AppendResult, type JournalEvent, type JournalStore } from "../src/index.js"
import { MemoryJournal } from "../test/fixtures.js"
import { CachingJournalStore } from "./caching-store.js"
import { checkStoreLaws } from "./store-laws.js"

/** Deliberately unlawful store: last writer wins, always reports Appended. */
class LastWriterWinsStore implements JournalStore {
  private events: JournalEvent[] = []
  read = (_id: string) => Effect.sync(() => ({ revision: this.events.length, events: this.events.slice() }))
  append = (_id: string, expected: number, event: JournalEvent) => Effect.sync((): AppendResult => { this.events.push(event); return { _tag: "Appended", revision: expected + 1 } })
}

test("store laws hold for MemoryJournal, SqliteJournal and the caching decorator over both", async () => {
  const directory = mkdtempSync(join(tmpdir(), "store-laws-"))
  const sqlite = new SqliteJournal(join(directory, "a.sqlite")), sqlite2 = new SqliteJournal(join(directory, "b.sqlite"))
  try {
    for (const [name, store] of [["memory", new MemoryJournal()], ["sqlite", sqlite], ["cache(memory)", new CachingJournalStore(new MemoryJournal())], ["cache(sqlite)", new CachingJournalStore(sqlite2)]] as const) {
      const report = await checkStoreLaws(store)
      expect({ name, failed: report.failed }).toEqual({ name, failed: [] })
      expect(report.passed).toHaveLength(7)
    }
  } finally { sqlite.close(); sqlite2.close(); rmSync(directory, { recursive: true, force: true }) }
})

test("store laws reject a last-writer-wins store (it would mint permits without CAS)", async () => {
  const report = await checkStoreLaws(new LastWriterWinsStore())
  expect(report.failed.map((f) => f.law)).toEqual(expect.arrayContaining([
    "identical event again is AlreadyRecorded, never Appended",
    "a different event at a stale revision is RevisionMismatch, never Appended",
    "same event ID with different facts is an error"
  ]))
  expect(report.passed).toEqual(["empty journal reads revision 0 and no events", "append at the expected revision is Appended with revision+1"])
})
