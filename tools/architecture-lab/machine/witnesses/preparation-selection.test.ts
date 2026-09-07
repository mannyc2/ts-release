import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { JournalEvent, ObservationRecorded, createPlan, createPreparationScope, observeRelease, reportRelease, runRelease, type HostShape } from "../src/index.js"
import { evaluatorNames, makeFixture, providerFor, runWithHost } from "../test/fixtures.js"

for (const candidate of evaluatorNames) test(`${candidate}: a preparation selects one satisfied output through the ordinary observe path; a competing different selection is refused by the same CAS loop; publications may be re-observed`, async () => {
  let evidence = { visible: true, output: "bytes-A" }
  const provider = { ...providerFor(() => ({ status: "Satisfied" as const, evidence })), observationCodec: (await import("effect/Schema")).Struct({ visible: (await import("effect/Schema")).Boolean, output: (await import("effect/Schema")).String }) }
  const fixture = await makeFixture(provider, candidate)
  const preparation = await Effect.runPromise(createPreparationScope(provider, fixture.operation.intent, "root"))
  const publication = await Effect.runPromise(createPlan("final", [fixture.operation], "root"))
  const host: HostShape = { ...fixture.host, journal: { journalId: "root", scopes: [preparation, { _tag: "PublicationScope", plan: publication }] } }
  await runWithHost(host, observeRelease({ plan: preparation.plan }))            // selects bytes-A
  await runWithHost(host, observeRelease({ plan: preparation.plan }))            // identical evidence again: legal
  evidence = { visible: true, output: "bytes-B" }
  await expect(runWithHost(host, observeRelease({ plan: preparation.plan }))).rejects.toThrow("already selected different satisfied evidence")
  expect((await runWithHost(host, reportRelease({ plan: preparation.plan }))).operations[0]).toMatchObject({ status: "Satisfied", observations: 2 })
  // The same operation in the publication scope may be re-observed with different evidence.
  await runWithHost(host, observeRelease({ plan: publication }))
  evidence = { visible: true, output: "bytes-C" }
  await runWithHost(host, observeRelease({ plan: publication }))
  expect((await runWithHost(host, reportRelease({ plan: publication }))).operations[0]).toMatchObject({ status: "Satisfied", observations: 2 })
  // History admission enforces the same law on read: a hostile second selection is rejected before any effect.
  const snapshot = await Effect.runPromise(fixture.store.read("root"))
  const hostile = new JournalEvent({ format: "architecture-lab/event/1", eventId: "hostile", journalId: "root", planId: preparation.plan.planId, body: new ObservationRecorded({ operationId: fixture.operation.operationId, evidenceKind: "Observation", status: "Satisfied", evidenceVersion: "fixture-visible/1", evidence: { visible: true, output: "bytes-Z" }, observedAt: 1000 }) })
  expect((await Effect.runPromise(fixture.store.append("root", snapshot.revision, hostile)))._tag).toBe("Appended")
  await expect(runWithHost(host, runRelease({ plan: preparation.plan, authorize: true }))).rejects.toThrow("already selected different satisfied evidence")
  expect(fixture.sends).toHaveLength(0)
})
