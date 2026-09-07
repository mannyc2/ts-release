import { expect, test } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import * as Release from "../../../packages/ts-release/src/index.js"
import { canonical } from "../../../packages/ts-release/src/internal/Identity.js"

const provider: Release.ProviderDefinition = {
  contract: Release.PROVIDER_CONTRACT,
  definitionId: "example/publish",
  intentVersion: "1",
  intentCodec: Schema.Unknown,
  receiptVersion: "1",
  receiptCodec: Schema.Struct({ ok: Schema.Boolean }),
  receiptCorresponds: () => true,
  classifyReceipt: () => "Satisfied",
  prepare: () =>
    Release.makeRequest({
      transport: "opaque/1",
      endpoint: "example:destination",
      method: "publish",
      headers: [],
      body: new Uint8Array([1]),
      principal: "example",
      scope: "example",
      replay: new Release.NoReplay({}),
    }),
}

async function fixture() {
  const operation = await Effect.runPromise(Release.createOperation(provider, { value: 1 }))
  const plan = await Effect.runPromise(
    Release.createPlan("bundle:example", [operation], "journal:example"),
  )
  const events: Release.JournalEvent[] = []
  const calls = { reads: 0, appends: 0, sends: 0 }
  const host: Release.HostShape = {
    providers: [provider],
    now: () => 1,
    uniqueId: () => crypto.randomUUID(),
    store: {
      read: () =>
        Effect.sync(() => {
          calls.reads++
          return { revision: events.length, events: [...events] }
        }),
      append: (_journal, revision, event) =>
        Effect.sync(() => {
          calls.appends++
          if (revision !== events.length)
            return { _tag: "RevisionMismatch", revision: events.length } as const
          events.push(event)
          return { _tag: "Appended", revision: events.length } as const
        }),
    },
    transport: {
      send: () =>
        Effect.sync(() => {
          calls.sends++
          return { _tag: "Accepted", receipt: { ok: true } } as const
        }),
    },
  }
  return { operation, plan, events, calls, host }
}
const run = <A>(
  host: Release.HostShape,
  effect: Effect.Effect<A, Release.ReleaseError, Release.Host>,
) => Effect.runPromise(effect.pipe(Effect.provide(Layer.succeed(Release.Host, host))))

test("factory and loaded plans own deeply immutable data", async () => {
  const input = { nested: { value: 1 } }
  const operation = await Effect.runPromise(Release.createOperation(provider, input))
  const plan = await Effect.runPromise(Release.createPlan("bundle:example", [operation]))
  input.nested.value = 2
  expect(operation.intent).toEqual({ nested: { value: 1 } })
  expect(Object.isFrozen(plan.operations[0]?.intent)).toBe(true)
  expect(() => {
    ;(plan.operations[0]!.intent as typeof input).nested.value = 3
  }).toThrow()
  const encoded = JSON.parse(canonical(plan))
  const loaded = await Effect.runPromise(Release.loadPlan(encoded, [provider]))
  encoded.operations[0].intent.nested.value = 4
  expect(loaded.operations[0]!.intent).toEqual({ nested: { value: 1 } })
  expect(Object.isFrozen(loaded)).toBe(true)
})

test("identity rejects hidden properties and accessors before evaluating getters", async () => {
  let getterCalls = 0
  const values = [
    { value: 1, [Symbol("callback")]: () => {} },
    Object.defineProperty({ value: 1 }, "hidden", { value: () => {} }),
    Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => {
        getterCalls++
        return 1
      },
    }),
    Object.defineProperty([1], "hidden", { value: () => {} }),
  ]
  for (const intent of values)
    await expect(Effect.runPromise(Release.createOperation(provider, intent))).rejects.toThrow(
      "hidden",
    )
  expect(getterCalls).toBe(0)
})

test("unknown scopes cannot bypass the single-publication rule", async () => {
  const f = await fixture()
  const host = {
    ...f.host,
    journal: { journalId: f.plan.journalId, scopes: [{ _tag: "InvalidScope", plan: f.plan }] },
  } as unknown as Release.HostShape
  await expect(run(host, Release.runRelease({ plan: f.plan, authorize: true }))).rejects.toThrow(
    "scope kind",
  )
  expect(f.calls).toEqual({ reads: 0, appends: 0, sends: 0 })
})

test("malformed provider capabilities reject before storage or transport", async () => {
  for (const patch of [
    { intentCodec: undefined },
    { observe: true },
    { observationCodec: Schema.Unknown },
    {
      observe: () => Effect.succeed({ status: "Absent", evidence: null }),
      observationVersion: "1",
      observationCodec: Schema.Unknown,
      classifyObservation: true,
    },
    { rejection: { version: "1", codec: Schema.Unknown, corresponds: true } },
  ]) {
    const f = await fixture()
    const host = {
      ...f.host,
      providers: [{ ...provider, ...patch }],
    } as unknown as Release.HostShape
    await expect(run(host, Release.runRelease({ plan: f.plan, authorize: true }))).rejects.toThrow()
    expect(f.calls).toEqual({ reads: 0, appends: 0, sends: 0 })
  }
})

test("native codec versions are nonempty canonical strings before any effects", async () => {
  for (const version of [true, 123, "", "e\u0301", "\ud800"]) {
    for (const patch of [
      { receiptVersion: version },
      {
        observe: () => Effect.succeed({ status: "Absent", evidence: null }),
        observationVersion: version,
        observationCodec: Schema.Unknown,
        classifyObservation: () => "Absent",
      },
      { rejection: { version, codec: Schema.Unknown, corresponds: () => true } },
      { dispatchError: { version, codec: Schema.Unknown, corresponds: () => true } },
    ]) {
      const f = await fixture()
      const host = {
        ...f.host,
        providers: [{ ...provider, ...patch }],
      } as unknown as Release.HostShape
      await expect(
        run(host, Release.runRelease({ plan: f.plan, authorize: true })),
      ).rejects.toThrow()
      expect(f.calls).toEqual({ reads: 0, appends: 0, sends: 0 })
    }
  }
})

test("a store cannot change the recorded endpoint before dispatch", async () => {
  const f = await fixture()
  const endpoints: string[] = []
  const host: Release.HostShape = {
    ...f.host,
    store: {
      ...f.host.store,
      append: (journal, revision, event) =>
        f.host.store.append(journal, revision, event).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              if (event.body._tag === "DispatchStarted") {
                expect(Reflect.set(event.body.request, "endpoint", "example:altered")).toBe(false)
                expect(event).toBeInstanceOf(Release.JournalEvent)
              }
            }),
          ),
        ),
    },
    transport: {
      send: (request) => {
        endpoints.push(request.facts.endpoint)
        return f.host.transport.send(request)
      },
    },
  }
  await run(host, Release.runRelease({ plan: f.plan, authorize: true }))
  expect(endpoints).toEqual(["example:destination"])
  const start = f.events.find((event) => event.body._tag === "DispatchStarted")!
  expect(start.body._tag === "DispatchStarted" && start.body.request.endpoint).toBe(endpoints[0]!)
})

test("receipt facts own their bytes and keep one immutable identity across append retries", async () => {
  const f = await fixture()
  const receipt = { ok: true }
  const attempts: Release.JournalEvent[] = []
  const host: Release.HostShape = {
    ...f.host,
    transport: { send: () => Effect.succeed({ _tag: "Accepted", receipt }) },
    store: {
      ...f.host.store,
      append: (journal, revision, event) =>
        Effect.suspend(() => {
          if (event.body._tag === "ReceiptAccepted") {
            attempts.push(event)
            if (attempts.length === 1) {
              receipt.ok = false
              return Effect.succeed({ _tag: "RevisionMismatch", revision })
            }
          }
          return f.host.store.append(journal, revision, event)
        }),
    },
  }
  await run(host, Release.runRelease({ plan: f.plan, authorize: true }))
  expect(attempts).toHaveLength(2)
  expect(attempts[0]).toBe(attempts[1])
  const accepted = f.events.find((event) => event.body._tag === "ReceiptAccepted")!
  expect(accepted.body._tag === "ReceiptAccepted" && accepted.body.receipt).toEqual({ ok: true })
  expect(receipt.ok).toBe(false)
  expect(Object.isFrozen(accepted.body)).toBe(true)
})

test("a mutable store snapshot cannot change during asynchronous history admission", async () => {
  const f = await fixture()
  await run(f.host, Release.runRelease({ plan: f.plan, authorize: true }))
  const stored = JSON.parse(canonical({ revision: f.events.length, events: f.events }))
  const host: Release.HostShape = {
    ...f.host,
    store: {
      ...f.host.store,
      read: () =>
        Effect.sync(() => {
          queueMicrotask(() => {
            stored.events[0].body.request.endpoint = "example:altered"
            stored.events[1].body.status = "Pending"
          })
          return stored
        }),
    },
  }
  const report = await run(host, Release.reportRelease({ plan: f.plan }))
  expect(stored.events[1].body.status).toBe("Pending")
  expect(report.operations[0]?.status).toBe("Satisfied")
})

test("external evaluators and providers receive admitted immutable Schema classes", async () => {
  const f = await fixture()
  let evaluatorCalls = 0,
    providerCalls = 0
  const host: Release.HostShape = {
    ...f.host,
    machine: (plan, events, scope) => {
      evaluatorCalls++
      expect(plan).toBeInstanceOf(Release.Plan)
      expect(Object.isFrozen(plan)).toBe(true)
      expect(Object.isFrozen(events)).toBe(true)
      for (const event of events) expect(event).toBeInstanceOf(Release.JournalEvent)
      return Release.historyMachine(plan, events, scope)
    },
    providers: [
      {
        ...provider,
        prepare: (operation, context) => {
          providerCalls++
          expect(operation).toBeInstanceOf(Release.Operation)
          expect(context.own.operation).toBeInstanceOf(Release.Operation)
          expect(Object.isFrozen(context.own)).toBe(true)
          return provider.prepare(operation, context)
        },
      },
    ],
  }
  await run(host, Release.runRelease({ plan: f.plan, authorize: true }))
  expect(evaluatorCalls).toBeGreaterThan(0)
  expect(providerCalls).toBe(1)
})

test("extra observation fields cannot override core-owned routing or event kind", async () => {
  const f = await fixture()
  const host: Release.HostShape = {
    ...f.host,
    providers: [
      {
        ...provider,
        observationVersion: "1",
        observationCodec: Schema.Unknown,
        classifyObservation: () => "Absent",
        observe: () =>
          Effect.succeed({
            status: "Absent",
            evidence: null,
            operationId: "foreign-operation",
            evidenceKind: "DispatchError",
            _tag: "PlanSuperseded",
            observedAt: 99,
          }),
      },
    ],
  }
  await run(host, Release.observeRelease({ plan: f.plan }))
  expect(f.events).toHaveLength(1)
  expect(f.events[0]?.body).toEqual(
    new Release.ObservationRecorded({
      operationId: f.operation.operationId,
      evidenceKind: "Observation",
      status: "Absent",
      evidence: null,
      evidenceVersion: "1",
      observedAt: 1,
    }),
  )
  expect(f.calls.sends).toBe(0)
})

test("generic transport diagnostics are fixed and never persist a secret", async () => {
  for (const failure of ["error", "unknown"] as const) {
    const f = await fixture()
    const secret = "Bearer regression-only-sensitive-value"
    const host = {
      ...f.host,
      transport: {
        send: () => {
          f.calls.sends++
          return failure === "error"
            ? Effect.fail(new Release.ReleaseError({ code: secret, message: secret }))
            : Effect.succeed({ _tag: "Unknown", reason: secret } as const)
        },
      },
    }
    const first = await run(host, Release.runRelease({ plan: f.plan, authorize: true }))
    expect(first.operations[0]?.status).toBe("Inconclusive")
    expect(canonical(f.events)).not.toContain(secret)
    expect(f.events[1]?.body).toMatchObject({
      evidenceKind: "DispatchError",
      evidenceVersion: "core-dispatch-error/1",
    })
    await run(host, Release.runRelease({ plan: f.plan, authorize: true }))
    expect(f.calls.sends).toBe(1)
  }
})

test("invalid clock, dispatch limit and truthy authorization reject without effects", async () => {
  for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const f = await fixture()
    await expect(
      run(f.host, Release.runRelease({ plan: f.plan, authorize: true, maxDispatches: value })),
    ).rejects.toThrow("Dispatch limit")
    await expect(
      run({ ...f.host, now: () => value }, Release.runRelease({ plan: f.plan, authorize: true })),
    ).rejects.toThrow("Host time")
    expect(f.calls).toEqual({ reads: 0, appends: 0, sends: 0 })
  }
  const f = await fixture()
  await expect(
    run(f.host, Release.runRelease({ plan: f.plan, authorize: "false" as unknown as boolean })),
  ).rejects.toThrow("booleans")
  expect(f.calls.sends).toBe(0)
})

test("request capture owns Node Buffer bytes and nested facts before asynchronous hashing", async () => {
  const bytes = Buffer.from("abc"),
    headers: [string, string][] = [["content-type", "text/plain"]]
  const input = {
    transport: "core.http/1" as const,
    endpoint: "https://fixture.invalid/",
    method: "PUT",
    headers,
    principal: "publisher",
    scope: "fixture",
    replay: new Release.NoReplay({}),
    body: bytes,
  }
  const pending = Effect.runPromise(Release.makeRequest(input))
  bytes[0] = 122
  headers[0]![1] = "changed"
  const prepared = await pending
  expect(new TextDecoder().decode(prepared.body)).toBe("abc")
  expect(prepared.facts.headers).toEqual([["content-type", "text/plain"]])
})
