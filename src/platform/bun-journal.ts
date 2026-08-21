import { Database } from "bun:sqlite"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  JournalAmbiguousStorageOutcome,
  JournalAppendFailedBeforeCommit,
  JournalAppended,
  JournalEntry,
  JournalReadFailed,
  JournalRevisionMismatch,
  JournalStore,
  ReleaseJournal,
  decodeJournalEvent,
  emptyReleaseJournal,
  encodeJournalEvent,
  type CanonicalJson,
  type JournalStoreShape
} from "../release/journal.js"
import type { PlanId } from "../release/release-plan.js"

export class BunSqliteJournalOpenError
  extends Schema.TaggedErrorClass<BunSqliteJournalOpenError>()("BunSqliteJournalOpenError", {
    path: Schema.NonEmptyString,
    reason: Schema.NonEmptyString
  }) {}

interface JournalRow {
  readonly revision: number
  readonly event_json: string
}

const detail = (cause: unknown): CanonicalJson => ({
  reason: cause instanceof Error ? cause.message : String(cause)
})

const initialize = (path: string): Database => {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const database = new Database(path, { create: true, readwrite: true, strict: true })
  try {
    database.run("PRAGMA journal_mode = WAL")
    database.run("PRAGMA synchronous = FULL")
    database.run("PRAGMA busy_timeout = 5000")
    database.run(`
      CREATE TABLE IF NOT EXISTS release_journal_events (
        plan_id TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision > 0),
        event_json TEXT NOT NULL,
        PRIMARY KEY (plan_id, revision)
      ) STRICT
    `)
    return database
  } catch (cause) {
    database.close()
    throw cause
  }
}

const makeStore = (database: Database): JournalStoreShape => {
  const select = database.query<JournalRow, [string]>(`
    SELECT revision, event_json
    FROM release_journal_events
    WHERE plan_id = ?
    ORDER BY revision ASC
  `)
  const count = database.query<{ readonly revision: number }, [string]>(`
    SELECT COUNT(*) AS revision
    FROM release_journal_events
    WHERE plan_id = ?
  `)
  const insert = database.query<never, [string, number, string]>(`
    INSERT INTO release_journal_events (plan_id, revision, event_json)
    VALUES (?, ?, ?)
  `)

  const read: JournalStoreShape["read"] = Effect.fn("BunSqliteJournalStore.read")((planId) =>
    Effect.try({
      try: () => {
        const rows = select.all(planId)
        if (rows.length === 0) return emptyReleaseJournal(planId)
        const entries = rows.map((row, index) => {
          if (row.revision !== index + 1) throw new Error("journal revisions are not contiguous")
          return JournalEntry.make({ revision: row.revision, event: decodeJournalEvent(row.event_json) })
        })
        return ReleaseJournal.make({
          schemaVersion: 1,
          planId,
          revision: entries.length,
          entries
        })
      },
      catch: (cause) => new JournalReadFailed({ planId, detail: detail(cause) })
    }))

  const appendTransaction = database.transaction((
    planId: PlanId,
    expectedRevision: number,
    eventJson: string
  ): JournalAppended | JournalRevisionMismatch => {
    const actualRevision = count.get(planId)?.revision ?? 0
    if (actualRevision !== expectedRevision) {
      return new JournalRevisionMismatch({ planId, expectedRevision, actualRevision })
    }
    const revision = actualRevision + 1
    insert.run(planId, revision, eventJson)
    return JournalAppended.make({ planId, revision })
  })

  const appendIfRevision: JournalStoreShape["appendIfRevision"] = Effect.fn(
    "BunSqliteJournalStore.appendIfRevision"
  )(function*(planId, expectedRevision, event) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      return yield* new JournalAppendFailedBeforeCommit({
        planId,
        detail: { reason: "expected revision must be a nonnegative safe integer" }
      })
    }
    let eventJson: string
    try {
      eventJson = encodeJournalEvent(event)
    } catch (cause) {
      return yield* new JournalAppendFailedBeforeCommit({ planId, detail: detail(cause) })
    }
    const result = yield* Effect.try({
      try: () => appendTransaction.immediate(planId, expectedRevision, eventJson),
      catch: (cause) => new JournalAmbiguousStorageOutcome({
        planId,
        expectedRevision,
        detail: detail(cause)
      })
    })
    if (result instanceof JournalRevisionMismatch) return yield* result
    return result
  })

  return { read, appendIfRevision }
}

/** Explicit local path used by the first-party Bun CLI projection. */
export const defaultBunSqliteJournalPath = (projectRoot: string): string =>
  join(projectRoot, ".release", "ts-release", "journal.sqlite")

/**
 * Scoped first-party local journal. SQLite supplies one transactional
 * append-if-revision fence for processes sharing this file; this is not a
 * cross-host storage claim.
 */
export const makeBunSqliteJournalLayer = (
  path: string
): Layer.Layer<JournalStore, BunSqliteJournalOpenError> => Layer.effect(
  JournalStore,
  Effect.acquireRelease(
    Effect.try({
      try: () => initialize(path),
      catch: (cause) => new BunSqliteJournalOpenError({
        path,
        reason: cause instanceof Error ? cause.message : String(cause)
      })
    }),
    (database) => Effect.sync(() => database.close())
  ).pipe(Effect.map(makeStore))
)
