import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { Cause, Effect, Exit, Result } from "effect"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openSqliteJournal } from "../../../packages/ts-release/src/Bun.js"
import { JournalEvent, PlanSuperseded } from "../../../packages/ts-release/src/index.js"
import type { JournalStore, ReleaseError } from "../../../packages/ts-release/src/index.js"
import { canonical } from "../../../packages/ts-release/src/internal/Identity.js"

test("C16: default SQLite exact 1MiB envelope writes/reads; +1 rejects symmetrically", async () => {
  const root = await mkdtemp(join(tmpdir(), "sqlite-bound-")),
    path = join(root, "journal.sqlite")
  const eventFor = (reason: string) =>
    new JournalEvent({
      format: "ts-release/event/1",
      eventId: "event",
      journalId: "journal",
      planId: "plan",
      body: new PlanSuperseded({ reason }),
    })
  const overhead = new TextEncoder().encode(canonical(eventFor(""))).byteLength
  const exact = eventFor("a".repeat(1_048_576 - overhead)),
    over = eventFor("a".repeat(1_048_577 - overhead))
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const store = yield* openSqliteJournal(path)
          expect(new TextEncoder().encode(canonical(exact))).toHaveLength(1_048_576)
          expect(yield* store.append("journal", 0, exact)).toEqual({
            _tag: "Appended",
            revision: 1,
          })
          expect((yield* store.read("journal")).events).toEqual([exact])
          expect(yield* Effect.isFailure(store.append("journal", 1, over))).toBe(true)
          expect((yield* store.read("journal")).revision).toBe(1)
          const db = new Database(path)
          try {
            db.query("UPDATE events SET bytes=? WHERE journal=?").run(
              new TextEncoder().encode(canonical(over)),
              "journal",
            )
          } finally {
            db.close()
          }
          expect(yield* Effect.isFailure(store.read("journal"))).toBe(true)
        }),
      ),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("legacy SQLite data rejects without initialization or migration", async () => {
  const root = await mkdtemp(join(tmpdir(), "sqlite-legacy-")),
    path = join(root, "legacy.sqlite")
  try {
    const db = new Database(path, { create: true })
    db.exec("CREATE TABLE legacy(value TEXT); INSERT INTO legacy VALUES('preserved')")
    db.close()
    expect(Effect.runPromise(Effect.scoped(openSqliteJournal(path)))).rejects.toThrow(
      "current release journal",
    )
    // Keep the genuine format refusal observable even if cleanup's completion
    // observer throws after the real native close. This does not simulate a
    // failed SQLite close or change its default sqlite3_close_v2 semantics.
    const injected = new TypeError("synthetic post-close observer failure")
    let nativeClosed = false
    // oxlint-disable-next-line typescript/unbound-method -- Preserve the native method and invoke it only with its real Database receiver.
    const close = Database.prototype.close
    Database.prototype.close = function (...args) {
      Reflect.apply(close, this, args)
      if (this.filename === path) {
        nativeClosed = true
        throw injected
      }
    }
    let exit: Exit.Exit<JournalStore, ReleaseError>
    try {
      // No asynchronous test overlap while the exact native prototype is held.
      exit = Effect.runSyncExit(Effect.scoped(openSqliteJournal(path)))
    } finally {
      Database.prototype.close = close
    }
    expect(nativeClosed).toBe(true)
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const failure = Cause.findError(exit.cause)
      expect(Result.isSuccess(failure)).toBe(true)
      if (Result.isSuccess(failure)) expect(failure.success.code).toBe("journal-format")
      const defect = Cause.findDefect(exit.cause)
      expect(Result.isSuccess(defect)).toBe(true)
      if (Result.isSuccess(defect)) expect(defect.success).toBe(injected)
    }
    const retained = new Database(path, { readonly: true })
    try {
      expect(retained.query("SELECT * FROM legacy").all()).toEqual([{ value: "preserved" }])
    } finally {
      retained.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
