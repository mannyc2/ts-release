import { expect, test } from "bun:test"
import { Cause, Effect, Exit, Result, Schema } from "effect"
import * as Release from "../../../packages/ts-release/src/index.js"
import { verifyNativeEvidence } from "../../../packages/ts-release/src/Journal.js"
import { MemoryJournal, runWithHost } from "./fixtures.js"

class Intent extends Schema.Class<Intent>("DependencyFixtureIntent")({
  name: Schema.String,
  parent: Schema.NullOr(Schema.String),
}) {}
class Native extends Schema.Class<Native>("DependencyFixtureNative")({
  id: Schema.String,
  parentId: Schema.NullOr(Schema.String),
}) {}
const invalid = (): never => {
  throw new Release.ReleaseError({ code: "fixture-parent", message: "Exact parent differs" })
}
const nativeParent = (context: Release.ProviderContext): string | null => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Kernel intentCodec admission is the behavior under test; a second decoder here would mask its failure.
  const intent = context.own.operation.intent as Intent
  if (intent.parent === null) return null
  const dependency = context.dependencies.find(
    (item) => item.operation.operationId === intent.parent,
  )
  if (!dependency || dependency.receipts.length !== 1) return invalid()
  return Schema.decodeUnknownSync(Native)(
    dependency.observations.at(-1)?.evidence ?? dependency.receipts[0],
  ).id
}
async function fixture() {
  const store = new MemoryJournal(),
    calls = { reads: 0, credentials: 0, sends: 0, observations: 0 }
  let serial = 0
  const provider: Release.ProviderDefinition = {
    contract: Release.PROVIDER_CONTRACT,
    definitionId: "outside/native-resources",
    intentVersion: "1",
    intentCodec: Intent,
    receiptVersion: "native/1",
    receiptCodec: Native,
    validatePlan: (operations) => {
      for (const operation of operations.filter(
        (op) => op.definitionId === "outside/native-resources",
      )) {
        const intent = Schema.decodeUnknownSync(Intent)(operation.intent)
        if (intent.parent === null) continue
        const parent = operations.find((op) => op.operationId === intent.parent)
        if (
          !parent ||
          parent.definitionId !== operation.definitionId ||
          !operation.dependsOn.includes(parent.operationId)
        )
          invalid()
      }
    },
    requestCorresponds: (_operation, request, context) =>
      request.scope === JSON.stringify(nativeParent(context)),
    receiptCorresponds: (_operation, request, value) =>
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This callback consumes the native receiptCodec result admitted by the kernel under test.
      JSON.stringify((value as Native).parentId) === request.scope,
    classifyReceipt: () => "Satisfied",
    prepare: (operation, context) =>
      Release.makeRequest({
        transport: "opaque/1",
        method: "create",
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Kernel intentCodec admission must precede this provider callback.
        endpoint: `native:${(operation.intent as Intent).name}`,
        headers: [],
        body: new Uint8Array(),
        principal: "account",
        scope: JSON.stringify(nativeParent(context)),
        replay: new Release.NoReplay({}),
      }),
    observationVersion: "native-observation/1",
    observationCodec: Native,
    classifyObservation: (_operation, value, receipts, context) => {
      expect(JSON.stringify(context.own.receipts)).toBe(JSON.stringify(receipts))
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Native observationCodec admission belongs to the kernel being tested.
      if ((value as Native).parentId !== nativeParent(context)) invalid()
      return "Satisfied"
    },
    observe: (_operation, context) =>
      Effect.sync(() => {
        calls.observations++
        return {
          status: "Satisfied",
          evidence: new Native({ id: "observed", parentId: nativeParent(context) }),
        }
      }),
  }
  const parent = await Effect.runPromise(
    Release.createOperation(provider, { name: "parent", parent: null }),
  )
  const child = await Effect.runPromise(
    Release.createOperation(provider, { name: "child", parent: parent.operationId }, [
      parent.operationId,
    ]),
  )
  const plan = await Effect.runPromise(Release.createPlan("owned:bundle", [child, parent]))
  const host: Release.HostShape = {
    providers: [provider],
    now: () => 1,
    uniqueId: () => `event:${++serial}`,
    store: {
      read: (id) =>
        Effect.suspend(() => {
          calls.reads++
          return store.read(id)
        }),
      append: store.append,
    },
    transport: {
      prepare: () =>
        Effect.sync(() => {
          calls.credentials++
          return host.transport.send
        }),
      send: (request) =>
        Effect.gen(function* () {
          calls.sends++
          const parentId = yield* Schema.decodeEffect(
            Schema.fromJsonString(Native.fields.parentId),
          )(request.facts.scope).pipe(Effect.orDie)
          return {
            _tag: "Accepted" as const,
            receipt: new Native({ id: `returned:${calls.sends}`, parentId }),
          }
        }),
    },
  }
  return { store, calls, provider, parent, child, plan, host }
}

test("an external provider admits the complete graph before storage, observation or credential effects", async () => {
  const f = await fixture()
  const child = await Effect.runPromise(Release.createOperation(f.provider, f.child.intent))
  const plan = await Effect.runPromise(Release.createPlan("owned:bundle", [child, f.parent]))
  for (const effect of [
    Release.runRelease({ plan, authorize: true }),
    Release.observeRelease({ plan }),
    Release.reportRelease({ plan }),
  ]) {
    expect(runWithHost(f.host, effect)).rejects.toThrow("Exact parent")
  }
  expect(f.calls).toEqual({ reads: 0, credentials: 0, sends: 0, observations: 0 })
  expect(f.store.journals.size).toBe(0)
})

test("native returned parent IDs survive a fresh runner and are the only declared dependency facts", async () => {
  const f = await fixture()
  await runWithHost(
    f.host,
    Release.runRelease({ plan: f.plan, authorize: true, observe: false, maxDispatches: 1 }),
  )
  expect(f.calls.sends).toBe(1)
  const report = await runWithHost(
    { ...f.host },
    Release.runRelease({ plan: f.plan, authorize: true, observe: false }),
  )
  expect(report.operations.map((op) => op.status)).toEqual(["Satisfied", "Satisfied"])
  expect(f.calls.sends).toBe(2)
  const snapshot = await Effect.runPromise(f.store.read(f.plan.journalId))
  const child = snapshot.events.find(
    (event) =>
      event.body._tag === "DispatchStarted" && event.body.operationId === f.child.operationId,
  )
  if (child === undefined) throw new Error("Fixture requires the child dispatch")
  expect(child.body._tag === "DispatchStarted" && child.body.request.scope).toBe('"returned:1"')
  await runWithHost(f.host, Release.runRelease({ plan: f.plan, authorize: true, observe: false }))
  expect(f.calls.sends).toBe(2)
})

test("a changed or future parent receipt cannot validate an earlier child request", async () => {
  const f = await fixture()
  await runWithHost(f.host, Release.runRelease({ plan: f.plan, authorize: true, observe: false }))
  const snapshot = await Effect.runPromise(f.store.read(f.plan.journalId)),
    events = snapshot.events
  const parentReceipt = events.findIndex((event) => event.body._tag === "ReceiptAccepted")
  const changed = structuredClone(events)
  const body = changed[parentReceipt]?.body
  if (body?._tag !== "ReceiptAccepted") throw new Error("fixture receipt")
  Object.assign(body, { receipt: { id: "foreign-parent", parentId: null } })
  expect(() => verifyNativeEvidence(f.plan, changed, [f.provider])).toThrow("preceding dependency")
  const future = events.filter((_, index) => index !== parentReceipt)
  const original = events[parentReceipt]
  if (original === undefined) throw new Error("Fixture requires the parent receipt")
  future.push(original)
  expect(() => verifyNativeEvidence(f.plan, future, [f.provider])).toThrow("Exact parent")
  f.store.journals.set(f.plan.journalId, changed)
  const before = { ...f.calls }
  expect(
    runWithHost(f.host, Release.runRelease({ plan: f.plan, authorize: true })),
  ).rejects.toThrow()
  expect(f.calls.sends).toBe(before.sends)
  expect(f.calls.credentials).toBe(before.credentials)
  expect(f.calls.observations).toBe(before.observations)
})

test("changed returned-parent requests reject before acquiring credentials or appending a start", async () => {
  const f = await fixture(),
    prepare = f.provider.prepare
  await runWithHost(
    f.host,
    Release.runRelease({ plan: f.plan, authorize: true, observe: false, maxDispatches: 1 }),
  )
  const changedPrepare: Release.ProviderDefinition["prepare"] = (operation, context) =>
    Effect.map(prepare(operation, context), (request) => ({
      ...request,
      facts: new Release.RequestFacts({ ...request.facts, scope: '"foreign-parent"' }),
    }))
  Object.assign(f.provider, { prepare: changedPrepare })
  expect(
    runWithHost(f.host, Release.runRelease({ plan: f.plan, authorize: true, observe: false })),
  ).rejects.toThrow("declared dependency")
  expect(f.calls.credentials).toBe(1)
  expect(f.calls.sends).toBe(1)
  expect((await Effect.runPromise(f.store.read(f.plan.journalId))).events).toHaveLength(2)
})

test("observation classification receives only the preceding validated dependency history", async () => {
  const f = await fixture()
  await runWithHost(
    f.host,
    Release.runRelease({ plan: f.plan, authorize: true, observe: false, maxDispatches: 1 }),
  )
  const changedObserve: NonNullable<Release.ProviderDefinition["observe"]> = () =>
    Effect.succeed({
      status: "Satisfied",
      evidence: new Native({ id: "invented", parentId: "foreign-parent" }),
    })
  Object.assign(f.provider, { observe: changedObserve })
  expect(
    runWithHost(f.host, Release.runRelease({ plan: f.plan, authorize: false })),
  ).rejects.toThrow("Exact parent")
  expect((await Effect.runPromise(f.store.read(f.plan.journalId))).events).toHaveLength(2)
  expect(f.calls.sends).toBe(1)
})

test("complete-graph validation cannot silently return an unexecuted Effect", async () => {
  const f = await fixture()
  Object.assign(f.provider, { validatePlan: () => Effect.void })
  expect(
    runWithHost(f.host, Release.runRelease({ plan: f.plan, authorize: true })),
  ).rejects.toThrow("synchronously")
  expect(f.calls).toEqual({ reads: 0, credentials: 0, sends: 0, observations: 0 })
})

// An intentional refusal does not exercise a callback bug being changed into
// ordinary invalid-data. Preserve the original defect before external work.
test("complete-graph validator defects remain defects before external actions", async () => {
  const f = await fixture()
  const defect = new TypeError("Provider validator implementation failed")
  Object.assign(f.provider, {
    validatePlan: () => {
      throw defect
    },
  })
  const exit = await runWithHost(
    f.host,
    Effect.exit(Release.runRelease({ plan: f.plan, authorize: true })),
  )
  expect(f.calls).toEqual({ reads: 0, credentials: 0, sends: 0, observations: 0 })
  expect(f.store.journals.size).toBe(0)
  if (!Exit.isFailure(exit)) throw new Error("Expected provider validator defect")
  const found = Cause.findDie(exit.cause)
  expect(Result.isSuccess(found) && found.success.defect).toBe(defect)
})

test("host machine defects remain defects before credentials or publication", async () => {
  const f = await fixture()
  const defect = new TypeError("Host machine implementation failed")
  const exit = await runWithHost(
    {
      ...f.host,
      machine: () => {
        throw defect
      },
    },
    Effect.exit(Release.runRelease({ plan: f.plan, authorize: true })),
  )
  expect(f.calls).toMatchObject({ credentials: 0, sends: 0, observations: 0 })
  expect(f.store.journals.size).toBe(0)
  if (!Exit.isFailure(exit)) throw new Error("Expected host machine defect")
  const found = Cause.findDefect(exit.cause)
  expect(Result.isSuccess(found) && found.success).toBe(defect)
})

test("a valid parent change during credential preparation prevents a stale child CAS and send", async () => {
  const f = await fixture()
  const host: Release.HostShape = {
    ...f.host,
    transport: {
      ...f.host.transport,
      prepare: (request) =>
        Effect.gen(function* () {
          if (request.facts.endpoint === "native:child") {
            const snapshot = yield* f.store.read(f.plan.journalId)
            const event = new Release.JournalEvent({
              format: "ts-release/event/1",
              eventId: "concurrent-parent-change",
              journalId: f.plan.journalId,
              planId: f.plan.planId,
              body: new Release.ObservationRecorded({
                operationId: f.parent.operationId,
                evidenceKind: "Observation",
                evidenceVersion: "native-observation/1",
                observedAt: 1,
                status: "Satisfied",
                evidence: new Native({ id: "changed-parent", parentId: null }),
              }),
            })
            yield* f.store.append(f.plan.journalId, snapshot.revision, event)
            verifyNativeEvidence(f.plan, [...snapshot.events, event], [f.provider])
          }
          return f.host.transport.send
        }),
    },
  }
  expect(
    runWithHost(host, Release.runRelease({ plan: f.plan, authorize: true, observe: false })),
  ).rejects.toThrow("preceding dependency")
  expect(f.calls.sends).toBe(1)
  const snapshot = await Effect.runPromise(f.store.read(f.plan.journalId))
  expect(snapshot.events.filter((event) => event.body._tag === "DispatchStarted")).toHaveLength(1)
  expect(() => verifyNativeEvidence(f.plan, snapshot.events, [f.provider])).not.toThrow()
})

test("public loadPlan captures descriptor receivers and preserves constructor-independent refusals", async () => {
  const f = await fixture()
  // A separately defined domain error shares the stable contract, not the core
  // constructor. This covers foreign refusal classification without a new host.
  class ForeignReleaseError extends Schema.TaggedError<ForeignReleaseError>()("ReleaseError", {
    code: Schema.String,
    message: Schema.String,
  }) {}
  for (const ErrorType of [Release.ReleaseError, ForeignReleaseError]) {
    class Descriptor {
      readonly definitionId = f.provider.definitionId
      readonly intentVersion = "1"
      readonly intentCodec = Intent
      #message = "Original captured validator"
      validatePlan() {
        throw new ErrorType({ code: "original-validator", message: this.#message })
      }
    }
    const descriptor = new Descriptor()
    const loaded = Effect.runPromise(Release.loadPlan(f.plan, [descriptor]))
    queueMicrotask(() => Object.assign(descriptor, { validatePlan: () => undefined }))
    expect(loaded).rejects.toMatchObject({
      code: "original-validator",
      message: "Original captured validator",
    })
  }
})
