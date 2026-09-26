import assert from "node:assert/strict"
import { Cause, Effect, Exit, Result } from "effect"
import { JournalEvent, PlanSuperseded } from "@mannyc1/ts-release"
import { openSqliteJournal } from "@mannyc1/ts-release/bun"

const event = new JournalEvent({
  format: "ts-release/event/1",
  eventId: "event",
  journalId: "journal",
  planId: "plan",
  body: new PlanSuperseded({ reason: "consumer smoke" }),
})
let closedStore
await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const store = yield* openSqliteJournal("./consumer.sqlite")
      closedStore = store
      assert.deepEqual(yield* store.append("journal", 0, event), { _tag: "Appended", revision: 1 })
      assert.deepEqual(yield* store.append("journal", 0, event), {
        _tag: "AlreadyRecorded",
        revision: 1,
      })
    }),
  ),
)
const closed = await Effect.runPromiseExit(closedStore.read("journal"))
assert.equal(
  Exit.isFailure(closed) &&
    Result.getOrUndefined(Cause.findDefect(closed.cause)) instanceof RangeError,
  true,
)
await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const store = yield* openSqliteJournal("./consumer.sqlite")
      const snapshot = yield* store.read("journal")
      assert.equal(snapshot.revision, 1)
      assert.deepEqual(snapshot.events, [event])
    }),
  ),
)
console.log(JSON.stringify({ sqlite: "reopened", revision: 1, scopeClosed: true }))
