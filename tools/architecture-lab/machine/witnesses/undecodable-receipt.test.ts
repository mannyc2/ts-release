import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { CoreUndecodableReceipt, type HostShape, runRelease } from "../src/index.js"
import { evaluatorNames, makeFixture, providerFor, runWithHost, startEvents } from "../test/fixtures.js"

for (const candidate of evaluatorNames) test(`${candidate}: a committed send whose receipt fails strict decoding is journaled as a bounded diagnostic; no resend; later observation satisfies`, async () => {
  let visible = false
  const fixture = await makeFixture(providerFor(() => ({ status: visible ? "Satisfied" : "Absent", evidence: { visible } })), candidate)
  let sends = 0
  const host: HostShape = { ...fixture.host, transport: { send: (request) => Effect.sync(() => { sends++; return { _tag: "Accepted", receipt: { status: 201, endpoint: request.facts.endpoint, bodyDigest: request.facts.bodyDigest, "token=should-not-be-stored": "registry added a field; token=should-not-be-stored" } } as const }) } }
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

test("provider classifier exceptions cannot enter committed-receipt diagnostics", async () => {
  const provider = { ...providerFor(), classifyReceipt: (): "Satisfied" => { throw new Error("token=classifier-secret") } }
  const fixture = await makeFixture(provider)
  await runWithHost(fixture.host, runRelease({ plan: fixture.plan, authorize: true }))
  const snapshot = await Effect.runPromise(fixture.store.read(fixture.plan.journalId))
  expect(JSON.stringify(snapshot)).not.toContain("classifier-secret")
  expect(snapshot.events.at(-1)!.body).toMatchObject({ evidenceVersion: "core-undecodable-receipt/1", status: "Inconclusive" })
  await runWithHost(fixture.host, runRelease({ plan: fixture.plan, authorize: true }))
  expect(fixture.sends).toHaveLength(1)
})

test("an unencodable receipt records unavailable identity without inventing a digest", async () => {
  const fixture = await makeFixture()
  const host: HostShape = { ...fixture.host, transport: { send: () => Effect.succeed({ _tag: "Accepted", receipt: { invalid: undefined } }) } }
  await runWithHost(host, runRelease({ plan: fixture.plan, authorize: true }))
  const snapshot = await Effect.runPromise(fixture.store.read(fixture.plan.journalId))
  expect(snapshot.events.at(-1)!.body).toMatchObject({ evidence: { receiptSha256: null, receiptBytes: null } })
})

test("committed diagnostics reject arbitrary messages and malformed identities on decode", () => {
  const valid = { code: "undecodable-receipt", message: "Committed response could not be admitted by the installed provider", receiptSha256: "a".repeat(64), receiptBytes: "42" }
  const decode = Schema.decodeUnknownSync(CoreUndecodableReceipt)
  expect(decode(valid)).toMatchObject(valid)
  for (const changed of [{ message: "token=secret" }, { code: "arbitrary" }, { receiptSha256: "" }, { receiptBytes: "01" }, { receiptBytes: "9".repeat(21) }]) {
    expect(() => decode({ ...valid, ...changed })).toThrow()
  }
})
