import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SqliteJournal } from "./sqlite-fixture.js"
import {
  GitCas,
  JournalEvent,
  ReceiptAccepted,
  RiskAccepted,
  acceptRisk,
  canonical,
  createPlan,
  createPreparationScope,
  hashCanonical,
  makeRequest,
  parseCanonical,
  reportRelease,
  runRelease,
  type DispatchStarted,
  type HostShape,
} from "./kernel.js"
import {
  evaluatorNames,
  makeFixture,
  providerFor,
  runWithHost,
  startEvents,
  measureStore,
} from "./fixtures.js"

test("Canonical bytes have explicit lexical UTF-16 key order, framed SHA-256, no normalization or exotic objects", async () => {
  const input = { "2": "two", "10": "ten", é: "é", nested: [1, true, null] }
  const encoded = '{"10":"ten","2":"two","nested":[1,true,null],"é":"é"}'
  expect(canonical(input)).toBe(encoded)
  const domain = "fixture/1"
  const framed = `${Buffer.byteLength(domain)}:${domain}${Buffer.byteLength(encoded)}:${encoded}`
  expect(await Effect.runPromise(hashCanonical(domain, input))).toBe(
    createHash("sha256").update(framed).digest("hex"),
  )
  expect(parseCanonical(encoded)).toEqual(input)
  for (const bad of [
    new Date(),
    new Map(),
    new Set(),
    { bad: undefined },
    { bad: -0 },
    { bad: 1.2 },
    { bad: "e\u0301" },
    { bad: "\uD800" },
    new Array(2),
  ])
    expect(() => canonical(bad)).toThrow()
  for (const text of ['{"a":1,"a":1}', '{"2":2,"10":10}', ' {"a":1}', '{"a":1.0}'])
    expect(() => parseCanonical(text)).toThrow()
})

for (const candidate of evaluatorNames) {
  test(`${candidate}: provider-forged core Git labels cannot grant a transport replay mechanism`, async () => {
    const fixture = await makeFixture(undefined, candidate)
    const provider = {
      ...fixture.host.providers[0]!,
      prepare: () =>
        makeRequest({
          transport: "core.git/1",
          endpoint: "file:///tmp/unused.git",
          method: "update-ref",
          headers: [],
          body: new Uint8Array(),
          principal: "fixture-user",
          scope: "release:write",
          replay: new GitCas({
            ref: "refs/heads/release",
            expectedOld: "0".repeat(40),
            desiredNew: "1".repeat(40),
          }),
        }),
    }
    await expect(
      runWithHost(
        { ...fixture.host, providers: [provider] },
        runRelease({ plan: fixture.plan, authorize: true }),
      ),
    ).rejects.toThrow("captured core Git")
    expect(fixture.sends).toHaveLength(0)
    expect(await startEvents(fixture.store, fixture.plan)).toHaveLength(0)
  })

  test(`${candidate}: authentication header material never enters durable facts; credential identity drift invalidates risk`, async () => {
    const fixture = await makeFixture(undefined, candidate)
    const base = fixture.host.providers[0]!
    const original = await Effect.runPromise(
      base.prepare(fixture.operation, {
        own: { operation: fixture.operation, receipts: [], observations: [] },
        dependencies: [],
      }),
    )
    const sensitive = await Effect.runPromise(
      makeRequest({
        ...original.facts,
        headers: [["Authorization", "fixture-secret-marker"]],
        body: original.body,
      }),
    )
    await expect(
      runWithHost(
        { ...fixture.host, providers: [{ ...base, prepare: () => Effect.succeed(sensitive) }] },
        runRelease({ plan: fixture.plan, authorize: true }),
      ),
    ).rejects.toThrow("host transport closure")
    expect(await startEvents(fixture.store, fixture.plan)).toHaveLength(0)
    let credential = "fixture-first-token"
    const used: string[] = []
    const host: HostShape = {
      ...fixture.host,
      transport: {
        send: () =>
          Effect.sync(() => {
            used.push(credential)
            return { _tag: "Unknown", reason: "lost" } as const
          }),
      },
    }
    await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))
    const start = (await startEvents(fixture.store, fixture.plan))[0]!.body as DispatchStarted
    await runWithHost(
      host,
      acceptRisk({
        plan: fixture.plan,
        authorize: true,
        decision: new RiskAccepted({
          operationId: fixture.operation.operationId,
          decisionId: "risk",
          fingerprint: start.fingerprint,
          priorDispatchIds: [start.dispatchId],
          principal: "maintainer",
          expiresAt: 2000,
        }),
      }),
    )
    const changed = await Effect.runPromise(
      makeRequest({ ...original.facts, principal: "another-principal", body: original.body }),
    )
    await runWithHost(
      { ...host, providers: [{ ...base, prepare: () => Effect.succeed(changed) }] },
      runRelease({ plan: fixture.plan, authorize: true }),
    )
    expect(used).toHaveLength(1)
    credential = "fixture-rotated-token"
    await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))
    expect(used).toEqual(["fixture-first-token", "fixture-rotated-token"])
    expect(
      canonical(await Effect.runPromise(fixture.store.read(fixture.plan.journalId))),
    ).not.toContain("fixture-secret")
    expect(
      canonical(await Effect.runPromise(fixture.store.read(fixture.plan.journalId))),
    ).not.toContain("token")
  })

  test(`${candidate}: native codec/version and correspondence reject bad receipts and false classified observations`, async () => {
    const fixture = await makeFixture(undefined, candidate)
    const badHost: HostShape = {
      ...fixture.host,
      transport: {
        send: () =>
          Effect.succeed({
            _tag: "Accepted",
            receipt: { status: 201, endpoint: "https://another.invalid", bodyDigest: "different" },
          } as const),
      },
    }
    await expect(
      runWithHost(badHost, runRelease({ plan: fixture.plan, authorize: true })),
    ).rejects.toThrow("exact dispatched request")
    expect(
      (await runWithHost(fixture.host, reportRelease({ plan: fixture.plan }))).operations[0]
        ?.status,
    ).toBe("Inconclusive")
    const start = (await startEvents(fixture.store, fixture.plan))[0]!.body as DispatchStarted
    const badVersion = new JournalEvent({
      format: "ts-release/event/1",
      eventId: "bad-version",
      journalId: fixture.plan.journalId,
      planId: fixture.plan.planId,
      body: new ReceiptAccepted({
        status: "Satisfied",
        dispatchId: start.dispatchId,
        receiptVersion: "future-version",
        receipt: {},
      }),
    })
    await Effect.runPromise(fixture.store.append(fixture.plan.journalId, 1, badVersion))
    await expect(
      runWithHost(fixture.host, runRelease({ plan: fixture.plan, authorize: true })),
    ).rejects.toThrow("version is unavailable")
    expect(fixture.sends).toHaveLength(0)
    const observation = await makeFixture(
      providerFor(() => ({ status: "Satisfied", evidence: { visible: false } })),
      candidate,
    )
    await expect(
      runWithHost(observation.host, runRelease({ plan: observation.plan, authorize: true })),
    ).rejects.toThrow("classification")
    expect(
      (await Effect.runPromise(observation.store.read(observation.plan.journalId))).events,
    ).toHaveLength(0)
  })

  test(`${candidate}: publication root is immutable and preparation/publication preserve a single global CAS revision`, async () => {
    const fixture = await makeFixture(undefined, candidate)
    const preparation = await Effect.runPromise(
      createPreparationScope(fixture.host.providers[0]!, fixture.operation.intent, "shared-root"),
    )
    const publication = await Effect.runPromise(
      createPlan("final-bundle", [fixture.operation], "shared-root"),
    )
    const host: HostShape = {
      ...fixture.host,
      journal: {
        journalId: "shared-root",
        scopes: [preparation, { _tag: "PublicationScope", plan: publication }],
      },
    }
    const prep = await runWithHost(host, runRelease({ plan: preparation.plan, authorize: true }))
    expect(prep.revision).toBe(2)
    const final = await runWithHost(host, runRelease({ plan: publication, authorize: true }))
    expect(final.revision).toBe(4)
    const history = await Effect.runPromise(fixture.store.read("shared-root"))
    expect(history.events.map((event) => event.planId)).toEqual([
      preparation.plan.planId,
      preparation.plan.planId,
      publication.planId,
      publication.planId,
    ])
    let reads = 0
    const moved: HostShape = {
      ...host,
      store: {
        ...fixture.store,
        read: (id) => {
          reads++
          return fixture.store.read(id)
        },
      },
      journal: { ...host.journal!, journalId: "foreign-root" },
    }
    await expect(
      runWithHost(moved, runRelease({ plan: publication, authorize: true })),
    ).rejects.toThrow("another journal")
    expect(reads).toBe(0)
    await expect(
      runWithHost(
        {
          ...host,
          journal: {
            journalId: "shared-root",
            scopes: [{ _tag: "PublicationScope", plan: publication }],
          },
        },
        reportRelease({ plan: publication }),
      ),
    ).rejects.toThrow("unknown scope")
    expect((await runWithHost(host, reportRelease({ plan: preparation.plan }))).revision).toBe(4)
  })

  test(`${candidate}: receipt exceeding storage bounds leaves a durable uncertain attempt and never silently retries`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "machine-bounds-"))
    const store = new SqliteJournal(join(directory, "events.sqlite"))
    try {
      const provider = {
        ...providerFor(),
        receiptVersion: "large/1",
        receiptCodec: Schema.Struct({ native: Schema.String }),
        receiptCorresponds: () => true,
      }
      const fixture = await makeFixture(provider, candidate)
      let sends = 0
      const host: HostShape = {
        ...fixture.host,
        store: measureStore(store, "sqlite-bounds"),
        transport: {
          send: () =>
            Effect.sync(() => {
              sends++
              return { _tag: "Accepted", receipt: { native: "x".repeat(1_048_576) } } as const
            }),
        },
      }
      await expect(
        runWithHost(host, runRelease({ plan: fixture.plan, authorize: true })),
      ).rejects.toThrow()
      expect(
        (await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))).operations[0]
          ?.status,
      ).toBe("Inconclusive")
      expect(sends).toBe(1)
      expect((await Effect.runPromise(store.read(fixture.plan.journalId))).events).toHaveLength(1)
    } finally {
      store.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test(`${candidate}: two publication plans in one journal reject before any provider or store effect`, async () => {
    const fixture = await makeFixture(undefined, candidate)
    const first = await Effect.runPromise(
      createPlan("first-bundle", [fixture.operation], "single-publication"),
    )
    const second = await Effect.runPromise(
      createPlan("second-bundle", [fixture.operation], "single-publication"),
    )
    let reads = 0,
      appends = 0,
      prepares = 0
    const base = fixture.host.providers[0]!
    const host: HostShape = {
      ...fixture.host,
      store: {
        read: (id) =>
          Effect.suspend(() => {
            reads++
            return fixture.store.read(id)
          }),
        append: (id, revision, event) =>
          Effect.suspend(() => {
            appends++
            return fixture.store.append(id, revision, event)
          }),
      },
      providers: [
        {
          ...base,
          prepare: (...args) =>
            Effect.suspend(() => {
              prepares++
              return base.prepare(...args)
            }),
        },
      ],
      journal: {
        journalId: "single-publication",
        scopes: [
          { _tag: "PublicationScope", plan: first },
          { _tag: "PublicationScope", plan: second },
        ],
      },
    }
    for (const plan of [first, second]) {
      await expect(runWithHost(host, runRelease({ plan, authorize: true }))).rejects.toThrow(
        "at most one publication plan",
      )
      await expect(runWithHost(host, reportRelease({ plan }))).rejects.toThrow(
        "at most one publication plan",
      )
    }
    expect([reads, appends, prepares, fixture.sends.length]).toEqual([0, 0, 0, 0])
    expect((await Effect.runPromise(fixture.store.read("single-publication"))).events).toHaveLength(
      0,
    )
  })

  test(`${candidate}: two concrete preparations and one publication share every global CAS revision`, async () => {
    const fixture = await makeFixture(undefined, candidate)
    const provider = fixture.host.providers[0]!
    const first = await Effect.runPromise(
      createPreparationScope(provider, fixture.operation.intent, "multiple-preparations"),
    )
    const second = await Effect.runPromise(
      createPreparationScope(
        provider,
        { ...(fixture.operation.intent as object), coordinate: "package-2" },
        "multiple-preparations",
      ),
    )
    const publication = await Effect.runPromise(
      createPlan("mixed-final-bundle", [fixture.operation], "multiple-preparations"),
    )
    const revisions: number[] = []
    const host: HostShape = {
      ...fixture.host,
      store: {
        read: fixture.store.read,
        append: (id, revision, event) =>
          Effect.suspend(() => {
            revisions.push(revision)
            return fixture.store.append(id, revision, event)
          }),
      },
      journal: {
        journalId: "multiple-preparations",
        scopes: [first, second, { _tag: "PublicationScope", plan: publication }],
      },
    }
    for (const [index, plan] of [first.plan, second.plan, publication].entries()) {
      const report = await runWithHost(host, runRelease({ plan, authorize: true }))
      expect(report.revision).toBe((index + 1) * 2)
      expect(report.operations[0]?.status).toBe("Satisfied")
    }
    expect(revisions).toEqual([0, 1, 2, 3, 4, 5])
    expect(fixture.sends).toHaveLength(3)
    const snapshot = await Effect.runPromise(fixture.store.read("multiple-preparations"))
    expect(snapshot.revision).toBe(6)
    expect(snapshot.events.map((event) => event.planId)).toEqual([
      first.plan.planId,
      first.plan.planId,
      second.plan.planId,
      second.plan.planId,
      publication.planId,
      publication.planId,
    ])
    for (const plan of [first.plan, second.plan, publication]) {
      expect((await runWithHost(host, reportRelease({ plan }))).revision).toBe(6)
    }
  })
}
