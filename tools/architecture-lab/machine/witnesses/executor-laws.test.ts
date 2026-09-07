import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Initial, JournalEvent, DispatchStarted, createPreparationScope, observeRelease, reportRelease, runRelease,
  type HostShape, type MachineConstructor
} from "../src/index.js"
import { evaluatorNames, makeFixture, providerFor, runWithHost } from "../test/fixtures.js"

test("an evaluator proposing Initial after an unknown send cannot bypass core recovery laws", async () => {
  const fixture = await makeFixture()
  let sends = 0
  const machine: MachineConstructor = () => {
    const value = {
      report: () => ({ planId: fixture.plan.planId, revision: 0, superseded: false, operations: [] }),
      append: () => value,
      next: (_id: string, candidate: unknown) => candidate === null
        ? { _tag: "PrepareDispatch" as const }
        : { _tag: "AppendDispatch" as const, basis: new Initial({}) }
    }
    return value
  }
  const host: HostShape = { ...fixture.host, machine, transport: {
    send: () => Effect.sync(() => { sends++; return { _tag: "Unknown", reason: "response lost" } as const })
  } }
  await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))
  await expect(runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))).rejects.toThrow("lawful basis")
  expect(sends).toBe(1)
})

test("an evaluator cannot alter the admitted journal prefix used by the executor", async () => {
  const fixture = await makeFixture()
  const machine: MachineConstructor = (plan, events) => {
    expect(Object.isFrozen(plan)).toBe(true)
    expect(Object.isFrozen(plan.operations)).toBe(true)
    expect(Object.isFrozen(events)).toBe(true)
    expect(() => (events as unknown[]).push({})).toThrow()
    return fixture.host.machine!(plan, events)
  }
  await runWithHost({ ...fixture.host, machine }, runRelease({ plan: fixture.plan, authorize: true }))
  expect(fixture.sends).toHaveLength(1)
})

test("corrupt replay history fails core admission before evaluator construction", async () => {
  const fixture = await makeFixture()
  const host: HostShape = { ...fixture.host, transport: { send: () => Effect.succeed({ _tag: "Unknown", reason: "lost response" }) } }
  await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))
  const snapshot = await Effect.runPromise(fixture.store.read(fixture.plan.journalId))
  const start = snapshot.events.find((event) => event.body._tag === "DispatchStarted")!
  if (start.body._tag !== "DispatchStarted") throw new Error("Missing fixture dispatch")
  await Effect.runPromise(fixture.store.append(fixture.plan.journalId, snapshot.revision, new JournalEvent({
    ...start, eventId: "corrupt-replay",
    body: new DispatchStarted({ ...start.body, dispatchId: "corrupt-replay:dispatch", basis: new Initial({}) })
  })))
  let constructions = 0
  await expect(runWithHost({ ...host, machine: (...args) => { constructions++; return fixture.host.machine!(...args) } }, reportRelease({ plan: fixture.plan }))).rejects.toThrow("lawful basis")
  expect(constructions).toBe(0)
})

for (const evaluator of evaluatorNames) {
  test(`${evaluator}: selected preparation retains late observations without allowing another send`, async () => {
    let state: "Satisfied" | "Pending" | "Absent" = "Satisfied"
    const evidence = Schema.Struct({ state: Schema.Literals(["Satisfied", "Pending", "Absent"]), output: Schema.String })
    const provider = {
      ...providerFor(() => ({ status: state, evidence: { state, output: "selected-output" } })),
      observationCodec: evidence,
      classifyObservation: (_operation: unknown, input: unknown) => Schema.decodeUnknownSync(evidence)(input).state
    }
    const fixture = await makeFixture(provider, evaluator)
    const scope = await Effect.runPromise(createPreparationScope(provider, fixture.operation.intent, "preparation-root"))
    const host: HostShape = { ...fixture.host, journal: { journalId: "preparation-root", scopes: [scope] } }
    for (const next of ["Satisfied", "Pending", "Absent"] as const) {
      state = next
      await runWithHost(host, observeRelease({ plan: scope.plan }))
      expect((await runWithHost(host, reportRelease({ plan: scope.plan }))).operations[0]!.status).toBe("Satisfied")
    }
    await runWithHost(host, runRelease({ plan: scope.plan, authorize: true, observe: false }))
    expect(fixture.sends).toHaveLength(0)
    expect((await Effect.runPromise(fixture.store.read(scope.plan.journalId))).events).toHaveLength(3)
  })

  test(`${evaluator}: distinct receipt and observation codecs cannot select two preparation outputs`, async () => {
    const provider = providerFor(() => ({ status: "Satisfied", evidence: { visible: true } }))
    const fixture = await makeFixture(provider, evaluator)
    const scope = await Effect.runPromise(createPreparationScope(provider, fixture.operation.intent, "receipt-root"))
    const host: HostShape = { ...fixture.host, journal: { journalId: "receipt-root", scopes: [scope] } }
    await runWithHost(host, runRelease({ plan: scope.plan, authorize: true, observe: false }))
    await expect(runWithHost(host, observeRelease({ plan: scope.plan }))).rejects.toThrow("already selected different")
    expect(fixture.sends).toHaveLength(1)
  })
}
