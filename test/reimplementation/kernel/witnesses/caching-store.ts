// Read cache over an authoritative JournalStore, built from public exports only.
// Laws (checked by store-laws.ts and cache.test.ts):
//  1. append is never served from the cache; every append reaches the authoritative store;
//  2. the cache is extended only by this decorator's own `Appended` result at the cached revision;
//  3. RevisionMismatch, AmbiguousStorageOutcome, AlreadyRecorded and errors invalidate the cache;
//  4. a miss reads the authoritative store. A dispatch permit therefore still requires the underlying CAS.
import * as Effect from "effect/Effect"
import type {
  AppendResult,
  JournalEvent,
  JournalStore,
  ReleaseError,
  Snapshot,
} from "../../../../packages/ts-release/src/index.js"

export class CachingJournalStore implements JournalStore {
  private readonly cache = new Map<string, Snapshot>()
  readonly counters = { reads: 0, underlyingReads: 0, appends: 0, invalidations: 0 }
  constructor(readonly underlying: JournalStore) {}
  invalidate(journalId?: string): void {
    this.counters.invalidations++
    if (journalId === undefined) this.cache.clear()
    else this.cache.delete(journalId)
  }
  read = (journalId: string): Effect.Effect<Snapshot, ReleaseError> =>
    Effect.suspend(() => {
      this.counters.reads++
      const cached = this.cache.get(journalId)
      if (cached)
        return Effect.succeed({ revision: cached.revision, events: cached.events.slice() })
      this.counters.underlyingReads++
      return this.underlying.read(journalId).pipe(
        Effect.tap((snapshot) =>
          Effect.sync(() => {
            this.cache.set(journalId, {
              revision: snapshot.revision,
              events: snapshot.events.slice(),
            })
          }),
        ),
      )
    })
  append = (
    journalId: string,
    expectedRevision: number,
    event: JournalEvent,
  ): Effect.Effect<AppendResult, ReleaseError> =>
    Effect.suspend(() => {
      this.counters.appends++
      return this.underlying.append(journalId, expectedRevision, event).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            const cached = this.cache.get(journalId)
            if (
              result._tag === "Appended" &&
              cached !== undefined &&
              cached.revision === expectedRevision &&
              result.revision === expectedRevision + 1
            ) {
              this.cache.set(journalId, {
                revision: result.revision,
                events: [...cached.events, event],
              })
            } else this.invalidate(journalId)
          }),
        ),
        Effect.tapError(() => Effect.sync(() => this.invalidate(journalId))),
      )
    })
}
