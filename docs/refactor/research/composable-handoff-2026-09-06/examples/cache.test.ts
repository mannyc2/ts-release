import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { type HostShape, type JournalStore, createOperation, createPlan, reportRelease, runRelease, supersedePlan } from "../machine/src/index.js"
import { MemoryJournal, makeFixture, providerFor, runWithHost, startEvents, evaluatorNames } from "../machine/test/fixtures.js"
import { CachingJournalStore } from "./caching-store.js"

const counting = (store: JournalStore) => { const counters = { reads: 0 }; return { counters, store: { read: (id: string) => Effect.suspend(() => { counters.reads++; return store.read(id) }), append: store.append } satisfies JournalStore } }

for (const candidate of evaluatorNames) {
  test(`${candidate}: cache hit — one ordinary release costs one authoritative read instead of many`, async () => {
    const plain = await makeFixture(undefined, candidate)
    const counted = counting(plain.store)
    await runWithHost({ ...plain.host, store: counted.store }, runRelease({ plan: plain.plan, authorize: true }))
    const cached = await makeFixture(undefined, candidate)
    const cache = new CachingJournalStore(counting(cached.store).store)
    const result = await runWithHost({ ...cached.host, store: cache }, runRelease({ plan: cached.plan, authorize: true }))
    expect(result.operations[0]).toMatchObject({ status: "Satisfied", dispatches: 1, receipts: 1 })
    expect(cached.sends).toHaveLength(1)
    expect(cache.counters.underlyingReads).toBe(1)
    expect(counted.counters.reads).toBeGreaterThanOrEqual(5)
    expect(cache.counters.reads).toBe(counted.counters.reads)
  })

  test(`${candidate}: stale cached revision cannot mint a permit; the authoritative CAS refuses and the runner re-reads`, async () => {
    const fixture = await makeFixture(undefined, candidate)
    const stale = new CachingJournalStore(fixture.store)
    await Effect.runPromise(stale.read(fixture.plan.journalId)) // warm at revision 0
    await runWithHost(fixture.host, runRelease({ plan: fixture.plan, authorize: true })) // another runner completes the release
    expect(fixture.sends).toHaveLength(1)
    const report = await runWithHost({ ...fixture.host, store: stale }, runRelease({ plan: fixture.plan, authorize: true }))
    expect(fixture.sends).toHaveLength(1)
    expect(report.operations[0]).toMatchObject({ status: "Satisfied", dispatches: 1 })
    expect(stale.counters.invalidations).toBeGreaterThanOrEqual(1)
    expect(await startEvents(fixture.store, fixture.plan)).toHaveLength(1)
  })

  test(`${candidate}: two concurrent runners with private caches over one journal produce one CAS winner and one send`, async () => {
    const fixture = await makeFixture(undefined, candidate)
    let arrivals = 0
    let release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    const gate: JournalStore = { read: fixture.store.read, append: (id, revision, event) => Effect.gen(function*() {
      if (event.body._tag === "DispatchStarted") { arrivals++; if (arrivals === 2) release(); yield* Effect.promise(() => barrier) }
      return yield* fixture.store.append(id, revision, event)
    }) }
    const a = new CachingJournalStore(gate), b = new CachingJournalStore(gate)
    const [ra, rb] = await Promise.all([runWithHost({ ...fixture.host, store: a }, runRelease({ plan: fixture.plan, authorize: true })), runWithHost({ ...fixture.host, store: b }, runRelease({ plan: fixture.plan, authorize: true }))])
    expect(arrivals).toBe(2)
    expect(fixture.sends).toHaveLength(1)
    expect(await startEvents(fixture.store, fixture.plan)).toHaveLength(1)
    // The loser may have read a prefix before the winner's receipt landed; both reports are true of their revision.
    expect([ra.revision, rb.revision].sort()).toEqual([Math.min(ra.revision, rb.revision), 2])
    const settled = await runWithHost({ ...fixture.host, store: new CachingJournalStore(fixture.store) }, reportRelease({ plan: fixture.plan }))
    expect(settled.operations[0]).toMatchObject({ status: "Satisfied", dispatches: 1, receipts: 1 })
  })

  test(`${candidate}: ambiguous append invalidates the cache; the live runner reconciles by an authoritative read-back; a fresh runner never resends`, async () => {
    for (const tag of ["AmbiguousStorageOutcome", "AlreadyRecorded"] as const) {
      const fixture = await makeFixture(undefined, candidate)
      const flaky: JournalStore = { read: fixture.store.read, append: (id, revision, event) => fixture.store.append(id, revision, event).pipe(Effect.map((result) => event.body._tag === "DispatchStarted" ? (tag === "AlreadyRecorded" ? { _tag: tag, revision: 1 } as const : { _tag: tag } as const) : result)) }
      const cache = new CachingJournalStore(flaky)
      await runWithHost({ ...fixture.host, store: cache }, runRelease({ plan: fixture.plan, authorize: true }))
      expect(fixture.sends).toHaveLength(tag === "AmbiguousStorageOutcome" ? 1 : 0)
      expect(cache.counters.invalidations).toBeGreaterThanOrEqual(1)
      const fresh = new CachingJournalStore(fixture.store)
      await runWithHost({ ...fixture.host, store: fresh }, runRelease({ plan: fixture.plan, authorize: true }))
      expect(fixture.sends).toHaveLength(tag === "AmbiguousStorageOutcome" ? 1 : 0)
    }
  })

  test(`${candidate}: a lying cache (truncated or tampered history) cannot turn into a send; a stale report is visibly stale`, async () => {
    const fixture = await makeFixture(undefined, candidate)
    const lost: HostShape = { ...fixture.host, transport: { send: () => Effect.succeed({ _tag: "Unknown", reason: "lost" } as const) } }
    await runWithHost(lost, runRelease({ plan: fixture.plan, authorize: true })) // one uncertain attempt is durable
    let sends = 0
    const counting: HostShape = { ...fixture.host, transport: { send: () => Effect.sync(() => { sends++; return { _tag: "Accepted", receipt: { status: 201, endpoint: "https://fixture.invalid/package-1", bodyDigest: "x" } } as const }) } }
    const truncated: JournalStore = { read: () => Effect.succeed({ revision: 0, events: [] }), append: fixture.store.append }
    const misled = await runWithHost({ ...counting, store: truncated }, runRelease({ plan: fixture.plan, authorize: true }))
    expect(sends).toBe(0) // the authoritative CAS refused the stale expectedRevision; no permit was minted
    expect(misled.revision).toBe(0) // the report is visibly a prefix of the truth (revision 1)
    expect((await Effect.runPromise(fixture.store.read(fixture.plan.journalId))).revision).toBe(2) // DispatchStarted + DispatchError
    const tampered: JournalStore = { read: (id) => fixture.store.read(id).pipe(Effect.map((s) => ({ ...s, events: s.events.map((e) => e.body._tag === "DispatchStarted" ? { ...e, body: { ...e.body, fingerprint: "0".repeat(64) } } as typeof e : e) }))), append: fixture.store.append }
    await expect(runWithHost({ ...counting, store: tampered }, runRelease({ plan: fixture.plan, authorize: true }))).rejects.toThrow("fingerprint")
    expect(sends).toBe(0)
    const shortRevision: JournalStore = { read: (id) => fixture.store.read(id).pipe(Effect.map((s) => ({ ...s, revision: s.revision + 1 }))), append: fixture.store.append }
    await expect(runWithHost({ ...counting, store: shortRevision }, reportRelease({ plan: fixture.plan }))).rejects.toThrow("complete global history")
    // Derived state law: a report from a cache is authoritative only at a fresh revision.
    const cache = new CachingJournalStore(fixture.store)
    const before = await runWithHost({ ...fixture.host, store: cache }, reportRelease({ plan: fixture.plan }))
    await runWithHost(fixture.host, supersedePlan({ plan: fixture.plan, authorize: true, reason: "replaced elsewhere" }))
    const staleReport = await runWithHost({ ...fixture.host, store: cache }, reportRelease({ plan: fixture.plan }))
    expect(staleReport).toEqual(before)
    const truth = await Effect.runPromise(fixture.store.read(fixture.plan.journalId))
    expect(staleReport.revision).toBeLessThan(truth.revision)
    cache.invalidate()
    expect((await runWithHost({ ...fixture.host, store: cache }, reportRelease({ plan: fixture.plan }))).superseded).toBe(true)
  })
}

test("independent releases keep independent histories in one store", async () => {
  const store = new MemoryJournal()
  const first = await makeFixture(providerFor()), second = await makeFixture(providerFor())
  const host = (fixture: Awaited<ReturnType<typeof makeFixture>>): HostShape => ({ ...fixture.host, store })
  await runWithHost(host(first), runRelease({ plan: first.plan, authorize: true }))
  const other = await runWithHost(host(second), runRelease({ plan: second.plan, authorize: true }))
  expect(other.revision).toBe(2)
  expect((await Effect.runPromise(store.read(first.plan.journalId))).revision).toBe(2)
  expect(first.plan.journalId).toBe(second.plan.journalId) // identical plan inputs => identical journal; the second run found it Satisfied and sent nothing
  expect(first.sends).toHaveLength(1); expect(second.sends).toHaveLength(0)
  const thirdOperation = await Effect.runPromise(createOperation(providerFor(), { coordinate: "package-2", endpoint: "https://fixture.invalid", content: "other bytes" }))
  const thirdPlan = await Effect.runPromise(createPlan("other-bundle", [thirdOperation]))
  expect(thirdPlan.journalId).not.toBe(first.plan.journalId)
  const third = await runWithHost({ ...host(first), uniqueId: () => `third-${crypto.randomUUID()}` }, runRelease({ plan: thirdPlan, authorize: true }))
  expect(third).toMatchObject({ revision: 2, operations: [{ status: "Satisfied", dispatches: 1 }] })
  expect((await Effect.runPromise(store.read(first.plan.journalId))).revision).toBe(2)
  expect((await Effect.runPromise(store.read(thirdPlan.journalId))).revision).toBe(2)
  expect(first.sends).toHaveLength(2) // first.host's transport counted the independent release too
})
