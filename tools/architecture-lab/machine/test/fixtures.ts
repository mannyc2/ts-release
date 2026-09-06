import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { appendFileSync } from "node:fs"
import {
  Host, LabError, NoReplay, createOperation, createPlan, makeRequest, canonical,
  type AppendResult, type HostShape, type JournalEvent, type JournalStore,
  type Observation, type Plan, type ProviderDefinition, type SendResult
} from "../src/index.js"

export class FixtureIntent extends Schema.Class<FixtureIntent>("FixtureIntent")({
  coordinate: Schema.String, endpoint: Schema.String, content: Schema.String
}) {}

export class FixtureReceipt extends Schema.Class<FixtureReceipt>("FixtureReceipt")({
  status: Schema.Number, endpoint: Schema.String, bodyDigest: Schema.String
}) {}
export class FixtureObservation extends Schema.Class<FixtureObservation>("FixtureObservation")({ visible: Schema.Boolean }) {}

export const recordEventSize = (event: JournalEvent, result: string, backend: string): void => {
  const path = process.env.LAB_EVENT_SIZE_FILE
  if (path) appendFileSync(path, JSON.stringify({ event: event.body._tag, encodedBytes: new TextEncoder().encode(canonical(event)).length, result, backend }) + "\n")
}
export const measureStore = (store: JournalStore, backend: string): JournalStore => ({
  read: store.read,
  append: (id, revision, event) => store.append(id, revision, event).pipe(
    Effect.tap((result) => Effect.sync(() => recordEventSize(event, result._tag, backend))),
    Effect.catch((error) => { recordEventSize(event, "Rejected", backend); return Effect.fail(error) })
  )
})

export class MemoryJournal implements JournalStore {
  readonly journals = new Map<string, JournalEvent[]>()
  read = (planId: string) => Effect.sync(() => {
    const events = this.journals.get(planId) ?? []
    return { revision: events.length, events: events.slice() }
  })
  append = (planId: string, expected: number, event: JournalEvent) => Effect.try({
    try: (): AppendResult => {
      const events = this.journals.get(planId) ?? []
      const existing = events.findIndex((item) => item.eventId === event.eventId)
      if (existing >= 0) {
        if (canonical(events[existing]) !== canonical(event)) throw new LabError({ code: "event-id-conflict", message: "Event ID has different bytes" })
        return { _tag: "AlreadyRecorded", revision: existing + 1 }
      }
      if (expected !== events.length) return { _tag: "RevisionMismatch", revision: events.length }
      this.journals.set(planId, [...events, event])
      recordEventSize(event, "Appended", "memory")
      return { _tag: "Appended", revision: events.length + 1 }
    },
    catch: (error) => error instanceof LabError ? error : new LabError({ code: "store", message: String(error) })
  })
}

export const providerFor = (
  observation?: () => Observation,
  definitionId = "fixture.http"
): ProviderDefinition => ({
  definitionId, intentVersion: "1", intentCodec: FixtureIntent,
  receiptVersion: "http-fixture/1", receiptCodec: FixtureReceipt,
  classifyReceipt: () => "Satisfied",
  receiptCorresponds: (_operation, request, input) => {
    const receipt = input as FixtureReceipt
    return receipt.status === 201 && receipt.endpoint === request.endpoint && receipt.bodyDigest === request.bodyDigest
  },
  prepare: Effect.fn("fixture.prepare")(function*(operation) {
    const intent = operation.intent as FixtureIntent
    return yield* makeRequest({
      transport: "core.http/1", endpoint: `${intent.endpoint}/${intent.coordinate}`,
      method: "PUT", headers: [["content-type", "application/octet-stream"]],
      body: new TextEncoder().encode(intent.content), principal: "fixture-user",
      scope: "release:write", replay: new NoReplay({})
    })
  }),
  ...(observation ? {
    observationVersion: "fixture-visible/1", observationCodec: FixtureObservation,
    classifyObservation: (_operation: unknown, evidence: unknown) => (evidence as FixtureObservation).visible ? "Satisfied" as const : "Absent" as const,
    observe: () => Effect.sync(observation)
  } : {})
})

export const makeFixture = async (provider = providerFor()) => {
  const operation = await Effect.runPromise(createOperation(provider, { coordinate: "package-1", endpoint: "https://fixture.invalid", content: "exact artifact bytes" }))
  const plan = await Effect.runPromise(createPlan("fixture-bundle-sha256", [operation]))
  const store = new MemoryJournal()
  const sends: Array<{ readonly eventCount: number; readonly endpoint: string; readonly body: string }> = []
  let serial = 0
  const host: HostShape = {
    store, providers: [provider], now: () => 1000, uniqueId: () => `event-${++serial}`,
    transport: {
      send: (request) => Effect.gen(function*() {
        const before = yield* store.read(plan.journalId)
        // External observation, independent of the machine's status projection.
        sends.push({ eventCount: before.events.length, endpoint: request.facts.endpoint, body: new TextDecoder().decode(request.body) })
        return { _tag: "Accepted", receipt: { status: 201, endpoint: request.facts.endpoint, bodyDigest: request.facts.bodyDigest } } satisfies SendResult
      })
    }
  }
  return { operation, plan, store, sends, host }
}

export const runWithHost = <A, E>(host: HostShape, effect: Effect.Effect<A, E, Host>) =>
  Effect.runPromise(Effect.provide(effect, Layer.succeed(Host, host)))

export const startEvents = async (store: JournalStore, plan: Plan) =>
  (await Effect.runPromise(store.read(plan.journalId))).events.filter((event) => event.body._tag === "DispatchStarted")
