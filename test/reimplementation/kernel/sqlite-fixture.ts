// Compatibility for the retained test harness: resource ownership is still the
// production openSqliteJournal Scope. This fixture implements no journal logic.
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Scope from "effect/Scope"
import type { JournalStore } from "../../../packages/ts-release/src/index.js"
import { openSqliteJournal } from "../../../packages/ts-release/src/Bun.js"

export class SqliteJournal implements JournalStore {
  readonly scope = Scope.makeUnsafe()
  readonly read: JournalStore["read"]
  readonly append: JournalStore["append"]
  constructor(path: string) {
    const store = Effect.runSync(
      openSqliteJournal(path).pipe(Effect.provideService(Scope.Scope, this.scope)),
    )
    this.read = store.read
    this.append = store.append
  }
  close() {
    Effect.runSync(Scope.close(this.scope, Exit.void))
  }
}
