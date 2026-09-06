import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { type HostShape, runRelease } from "../machine/src/index.js"
import { evaluatorNames, makeFixture, providerFor, runWithHost, startEvents } from "../machine/test/fixtures.js"

for (const candidate of evaluatorNames) test(`${candidate}: a committed send whose receipt fails strict decoding is journaled as a bounded diagnostic; no resend; later observation satisfies`, async () => {
  let visible = false
  const fixture = await makeFixture(providerFor(() => ({ status: visible ? "Satisfied" : "Absent", evidence: { visible } })), candidate)
  let sends = 0
  const host: HostShape = { ...fixture.host, transport: { send: (request) => Effect.sync(() => { sends++; return { _tag: "Accepted", receipt: { status: 201, endpoint: request.facts.endpoint, bodyDigest: request.facts.bodyDigest, unexpectedField: "registry added a field; token=should-not-be-stored" } } as const }) } }
  const first = await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))
  expect(first.operations[0]).toMatchObject({ status: "Inconclusive", dispatches: 1, receipts: 0 })
  const events = (await Effect.runPromise(fixture.store.read(fixture.plan.journalId))).events
  expect(events.map((e) => e.body._tag)).toEqual(["ObservationRecorded", "DispatchStarted", "ObservationRecorded"])
  const diagnostic = events[2]!.body
  expect(diagnostic).toMatchObject({ _tag: "ObservationRecorded", evidenceKind: "DispatchError", status: "Inconclusive", evidenceVersion: "core-undecodable-receipt/1" })
  const evidence = (diagnostic as { evidence: { code: string; message: string; receiptSha256: string; receiptBytes: string } }).evidence
  expect(evidence.receiptSha256).toMatch(/^[0-9a-f]{64}$/)
  expect(Number(evidence.receiptBytes)).toBeGreaterThan(0)
  expect(evidence.message.length).toBeLessThanOrEqual(256)
  expect(JSON.stringify(evidence)).not.toContain("should-not-be-stored")
  await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))
  expect(sends).toBe(1)
  visible = true
  const recovered = await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))
  expect(recovered.operations[0]).toMatchObject({ status: "Satisfied", dispatches: 1, receipts: 0 })
  expect(sends).toBe(1)
  expect(await startEvents(fixture.store, fixture.plan)).toHaveLength(1)
})
