import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import {
  AcceptedRisk, DispatchRejectedBeforeCommit, DispatchStarted, GitCas, Host,
  GitReceipt, makeCoreGitTransport, Initial, JournalEvent, LabError, ObservationRecorded, Operation, Plan,
  PlanSuperseded, ReceiptAccepted, RiskAccepted, acceptRisk, canonical,
  createOperation, createPlan, historyMachine, loadPlan, makeRequest, observeRelease,
  reportRelease, requestFingerprint, runRelease, supersedePlan, transitionMachine,
  type Candidate, type HostShape, type JournalStore, type SendResult
} from "../src/index.js"
import { makeFixture, providerFor, startEvents, runWithHost } from "./fixtures.js"

for (const candidate of ["M1", "M2"] as const) describe(candidate, () => {
  test("C01: real send follows durable started fact, report is recreated from history", async () => {
    const fixture = await makeFixture()
    const result = await runWithHost(fixture.host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(fixture.sends).toEqual([{ eventCount: 1, endpoint: "https://fixture.invalid/package-1", body: "exact artifact bytes" }])
    expect(result.operations[0]).toMatchObject({ status: "Satisfied", dispatches: 1, receipts: 1, observations: 0 })
    expect(await runWithHost(fixture.host, reportRelease({ candidate, plan: fixture.plan }))).toEqual(result)
    expect((await Effect.runPromise(fixture.store.read(fixture.plan.journalId))).events.map((event) => event.body._tag)).toEqual(["DispatchStarted", "ReceiptAccepted"])
  })

  test("C02a: credential/prepare rejection creates no attempt and remains retryable", async () => {
    const fixture = await makeFixture()
    const unavailable = { ...fixture.host.providers[0]!, prepare: () => Effect.fail(new LabError({ code: "credentials", message: "No credential available" })) }
    await expect(runWithHost({ ...fixture.host, providers: [unavailable] }, runRelease({ candidate, plan: fixture.plan, authorize: true }))).rejects.toThrow("No credential")
    expect(await startEvents(fixture.store, fixture.plan)).toHaveLength(0)
    expect(fixture.sends).toHaveLength(0)
    expect((await runWithHost(fixture.host, runRelease({ candidate, plan: fixture.plan, authorize: true }))).operations[0]?.status).toBe("Satisfied")
  })

  test("C02b: proven terminal noncommit is linked to dispatch and permits another attempt", async () => {
    const fixture = await makeFixture({ ...providerFor(), rejection: {
      version: "fixture-terminal-rejection/1", codec: Schema.Struct({ endpoint: Schema.String, requestDigest: Schema.String, terminal: Schema.Literal(true) }),
      corresponds: (_operation, request, proof) => { const native = proof as { endpoint: string; requestDigest: string }; return native.endpoint === request.endpoint && native.requestDigest === request.bodyDigest }
    } })
    const rejected: HostShape = { ...fixture.host, transport: { send: (request) => Effect.succeed({ _tag: "RejectedBeforeCommit", proof: { endpoint: request.facts.endpoint, requestDigest: request.facts.bodyDigest, terminal: true } } as const) } }
    expect((await runWithHost(rejected, runRelease({ candidate, plan: fixture.plan, authorize: true }))).operations[0]?.status).toBe("Rejected")
    const result = await runWithHost(fixture.host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(result.operations[0]).toMatchObject({ status: "Satisfied", dispatches: 2, receipts: 1 })
    const starts = await startEvents(fixture.store, fixture.plan)
    expect(starts[1]?.body).toMatchObject({ basis: { _tag: "NonCommit" } })
  })

  test("C03/C04: response loss followed by absence never resends; matching observation satisfies", async () => {
    let visible = false
    const provider = providerFor(() => ({ status: visible ? "Satisfied" : "Absent", evidence: { visible } }))
    const fixture = await makeFixture(provider)
    let sends = 0
    const host: HostShape = { ...fixture.host, transport: { send: () => Effect.sync(() => { sends++; return { _tag: "Unknown", reason: "connection lost" } as const }) } }
    const first = await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(first.operations[0]?.status).toBe("Inconclusive")
    await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(sends).toBe(1)
    visible = true
    const recovered = await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(recovered.operations[0]).toMatchObject({ status: "Satisfied", dispatches: 1, receipts: 0 })
    expect(sends).toBe(1)
  })

  test("C05: only identical structural Git CAS can replay a possibly committed attempt", async () => {
    const provider = providerFor()
    const git = { ...provider, receiptVersion: "git/1", receiptCodec: GitReceipt, receiptCorresponds: (_op: Operation, request: import("../src/index.js").RequestFacts, receipt: unknown) => request.replay._tag === "GitCas" && (receipt as GitReceipt).desiredNew === request.replay.desiredNew, prepare: () => makeRequest({
      transport: "core.git/1", endpoint: "file:///fixture/remote.git", method: "update-ref", headers: [], body: new Uint8Array(),
      principal: "git-user", scope: "refs/heads/release", replay: new GitCas({ ref: "refs/heads/release", expectedOld: "0".repeat(40), desiredNew: "1".repeat(40) })
    }) }
    const fixture = await makeFixture(git)
    let calls = 0
    const host: HostShape = { ...fixture.host, transport: makeCoreGitTransport({
      principal: "git-user", scope: "refs/heads/release",
      execute: (args) => Effect.sync(() => {
        calls++
        expect(args).toEqual(["push", "--porcelain", `--force-with-lease=refs/heads/release:${"0".repeat(40)}`, "--", "file:///fixture/remote.git", `${"1".repeat(40)}:refs/heads/release`])
        return calls === 1 ? { exitCode: 1, stdout: "" } : { exitCode: 0, stdout: `=\t${"1".repeat(40)}:refs/heads/release\t[up to date]\n` }
      })
    }) }
    await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    const result = await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(calls).toBe(2)
    expect(result.operations[0]?.status).toBe("Satisfied")
    expect((await startEvents(fixture.store, fixture.plan))[1]?.body).toMatchObject({ basis: { _tag: "ProtectedReplay" } })
  })

  test("C06: authenticated risk binds request, all prior attempts, expiry and one additional attempt", async () => {
    const fixture = await makeFixture()
    let sends = 0
    const host: HostShape = { ...fixture.host, transport: { send: () => Effect.sync(() => { sends++; return { _tag: "Unknown", reason: "lost" } as const }) } }
    await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    const start = (await startEvents(fixture.store, fixture.plan))[0]!.body as DispatchStarted
    const decision = new RiskAccepted({ operationId: fixture.operation.operationId, decisionId: "approval-1", fingerprint: start.fingerprint, priorDispatchIds: [start.dispatchId], principal: "maintainer", expiresAt: 2000 })
    await expect(runWithHost(host, acceptRisk({ candidate, plan: fixture.plan, authorize: false, decision }))).rejects.toThrow("requires host authorization")
    await runWithHost(host, acceptRisk({ candidate, plan: fixture.plan, authorize: true, decision }))
    await runWithHost({ ...host, now: () => 2001 }, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(sends).toBe(1)
    await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(sends).toBe(2)
    expect((await startEvents(fixture.store, fixture.plan))[1]?.body).toMatchObject({ basis: { _tag: "AcceptedRisk", decisionId: "approval-1" } })
  })

  test("C07: real contending executions produce one CAS winner and one send", async () => {
    const fixture = await makeFixture()
    let arrivals = 0
    let release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    const store: JournalStore = {
      read: fixture.store.read,
      append: (planId, revision, event) => Effect.gen(function*() {
        if (event.body._tag === "DispatchStarted") {
          arrivals++
          if (arrivals === 2) release()
          yield* Effect.promise(() => barrier)
        }
        return yield* fixture.store.append(planId, revision, event)
      })
    }
    await Promise.all([runWithHost({ ...fixture.host, store }, runRelease({ candidate, plan: fixture.plan, authorize: true })), runWithHost({ ...fixture.host, store }, runRelease({ candidate, plan: fixture.plan, authorize: true }))])
    expect(arrivals).toBe(2)
    expect(fixture.sends).toHaveLength(1)
    expect(await startEvents(fixture.store, fixture.plan)).toHaveLength(1)
  })

  test("C08: request endpoint, bytes, headers, principal and scope drift block protected replay", async () => {
    const fixture = await makeFixture()
    const original = await Effect.runPromise(makeRequest({ transport: "core.git/1", endpoint: "file:///remote.git", method: "update-ref", headers: [], body: new Uint8Array(), principal: "a", scope: "ref-a", replay: new GitCas({ ref: "refs/heads/a", expectedOld: "0".repeat(40), desiredNew: "1".repeat(40) }) }))
    const provider = { ...fixture.host.providers[0]!, prepare: () => Effect.succeed(original) }
    const host: HostShape = { ...fixture.host, providers: [provider], transport: makeCoreGitTransport({ principal: "a", scope: "ref-a", execute: () => Effect.succeed({ exitCode: 1, stdout: "" }) }) }
    await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    for (const changed of [{ endpoint: "file:///other.git" }, { principal: "b" }, { scope: "ref-b" }, { headers: [["x-law", "changed"]] as [string, string][] }]) {
      const altered = await Effect.runPromise(makeRequest({ ...original.facts, ...changed, body: original.body }))
      const changedRun = runWithHost({ ...host, providers: [{ ...provider, prepare: () => Effect.succeed(altered) }] }, runRelease({ candidate, plan: fixture.plan, authorize: true }))
      if ("endpoint" in changed) await changedRun
      else await expect(changedRun).rejects.toThrow()
    }
    expect(await startEvents(fixture.store, fixture.plan)).toHaveLength(1)
  })

  test("C09: supersession accepts late factual receipt while forbidding new dispatch", async () => {
    const fixture = await makeFixture()
    const result = await runWithHost(fixture.host, runRelease({ candidate, plan: fixture.plan, authorize: true,
      checkpoint: (stage) => stage === "after-send" ? supersedePlan({ candidate, plan: fixture.plan, authorize: true, reason: "replacement" }).pipe(Effect.asVoid, Effect.provide(Layer.succeed(Host, fixture.host))) : Effect.void
    }))
    expect(result.superseded).toBe(true)
    expect(result.operations[0]).toMatchObject({ status: "Superseded", receipts: 1, dispatches: 1 })
    await runWithHost(fixture.host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(fixture.sends).toHaveLength(1)
    const events = (await Effect.runPromise(fixture.store.read(fixture.plan.journalId))).events
    expect(events.map((event) => event.body._tag)).toEqual(["DispatchStarted", "PlanSuperseded", "ReceiptAccepted"])
  })

  test("C10: live unknown append readback can continue, AlreadyRecorded never grants permit", async () => {
    for (const resultTag of ["AmbiguousStorageOutcome", "AlreadyRecorded"] as const) {
      const fixture = await makeFixture()
      const store: JournalStore = {
        read: fixture.store.read,
        append: (planId, revision, event) => fixture.store.append(planId, revision, event).pipe(Effect.map((result) => event.body._tag === "DispatchStarted" ? (resultTag === "AlreadyRecorded" ? { _tag: resultTag, revision: 1 } : { _tag: resultTag }) : result))
      }
      await runWithHost({ ...fixture.host, store }, runRelease({ candidate, plan: fixture.plan, authorize: true }))
      expect(fixture.sends).toHaveLength(resultTag === "AmbiguousStorageOutcome" ? 1 : 0)
      await runWithHost(fixture.host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
      expect(fixture.sends).toHaveLength(resultTag === "AmbiguousStorageOutcome" ? 1 : 0)
    }
  })

  test("C11: cycles, missing dependencies, duplicate IDs and unknown codecs fail before provider effects", async () => {
    const fixture = await makeFixture()
    const a = new Operation({ ...fixture.operation, operationId: "a", dependsOn: ["b"] })
    const b = new Operation({ ...fixture.operation, operationId: "b", dependsOn: ["a"] })
    await expect(Effect.runPromise(createPlan("bundle", [a, b]))).rejects.toThrow("cycle")
    await expect(Effect.runPromise(createPlan("bundle", [a]))).rejects.toThrow("dangling")
    await expect(Effect.runPromise(createPlan("bundle", [fixture.operation, fixture.operation]))).rejects.toThrow("unique")
    await expect(runWithHost({ ...fixture.host, providers: [] }, runRelease({ candidate, plan: fixture.plan, authorize: true }))).rejects.toThrow("unavailable")
    expect(fixture.sends).toHaveLength(0)
  })

  test("C12: one definition serves two distinct instance intents without ID collision", async () => {
    const fixture = await makeFixture()
    const second = await Effect.runPromise(createOperation(fixture.host.providers[0]!, { coordinate: "package-1", endpoint: "https://other.invalid", content: "other bytes" }))
    const plan = await Effect.runPromise(createPlan("bundle", [fixture.operation, second]))
    expect(second.operationId).not.toBe(fixture.operation.operationId)
    const report = await runWithHost(fixture.host, runRelease({ candidate, plan, authorize: true }))
    expect(report.operations.every((operation) => operation.status === "Satisfied")).toBe(true)
    expect(fixture.sends.map((send) => send.endpoint).sort()).toEqual(["https://fixture.invalid/package-1", "https://other.invalid/package-1"])
  })

  test("C13: opaque write-only acceptance before correlation ID loss honestly stops", async () => {
    const fixture = await makeFixture()
    let calls = 0
    const host: HostShape = { ...fixture.host, transport: { send: () => Effect.sync(() => { calls++; return { _tag: "Unknown", reason: "accepted before identifier recorded" } as const }) } }
    await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    const report = await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(calls).toBe(1)
    expect(report.operations[0]?.status).toBe("Inconclusive")
  })

  test("C15: captured host cannot be shadowed by a provider-local Layer", async () => {
    const fixture = await makeFixture()
    let shadowCalls = 0
    const shadow: HostShape = { ...fixture.host, transport: { send: () => Effect.sync(() => { shadowCalls++; return { _tag: "Accepted", receipt: {} } as const }) } }
    const base = fixture.host.providers[0]!
    const provider = { ...base, prepare: (operation: Operation) => base.prepare(operation, { own: { operation, receipts: [], observations: [] }, dependencies: [] }).pipe(Effect.provide(Layer.succeed(Host, shadow))) }
    await runWithHost({ ...fixture.host, providers: [provider] }, runRelease({ candidate, plan: fixture.plan, authorize: true }))
    expect(shadowCalls).toBe(0)
    expect(fixture.sends).toHaveLength(1)
  })
})

test("M1/M2 reject impossible histories, preserve late evidence, and expose equal reports", async () => {
  const fixture = await makeFixture()
  const request = await Effect.runPromise(fixture.host.providers[0]!.prepare(fixture.operation, { own: { operation: fixture.operation, receipts: [], observations: [] }, dependencies: [] }))
  const fingerprint = await Effect.runPromise(requestFingerprint(request.facts))
  const envelope = (eventId: string, body: JournalEvent["body"]) => new JournalEvent({ format: "architecture-lab/event/1", eventId, journalId: fixture.plan.journalId, planId: fixture.plan.planId, body })
  const started = envelope("start", new DispatchStarted({ operationId: fixture.operation.operationId, dispatchId: "d1", request: request.facts, fingerprint, startedAt: 1000, basis: new Initial({}) }))
  const accepted = envelope("receipt", new ReceiptAccepted({ status: "Satisfied", dispatchId: "d1", receiptVersion: "http-fixture/1", receipt: { status: 201 } }))
  const superseded = envelope("superseded", new PlanSuperseded({ reason: "replaced" }))
  for (const constructor of [historyMachine, transitionMachine]) {
    expect(() => constructor(fixture.plan, [accepted])).toThrow("dispatch")
    expect(() => constructor(fixture.plan, [superseded, started])).toThrow("lawful")
    expect(() => constructor(fixture.plan, [started, accepted, envelope("reject", new DispatchRejectedBeforeCommit({ proofVersion: "fixture/1", dispatchId: "d1", proof: {} }))])).toThrow()
  }
  const history = [started, superseded, accepted]
  expect(historyMachine(fixture.plan, history).report()).toEqual(transitionMachine(fixture.plan, history).report())
})
