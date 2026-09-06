import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SqliteJournal } from "../../storage/sqlite.js"
import {
  JournalEvent, LabError, ObservationRecorded, canonical, reportRelease, runRelease,
  type DispatchStarted, type HostShape
} from "../src/index.js"
import { makeFixture, providerFor, runWithHost, startEvents, measureStore } from "./fixtures.js"

for (const candidate of ["M1", "M2"] as const) {
  test(`${candidate}: exact versioned native error survives SQLite close/reopen and remains inconclusive`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "machine-native-error-"))
    const path = join(directory, "events.sqlite")
    let store = new SqliteJournal(path)
    try {
      const codec = Schema.Struct({ status: Schema.Number, endpoint: Schema.String, requestDigest: Schema.String, nativeBody: Schema.String })
      const provider = { ...providerFor(), dispatchError: { version: "fixture-http-error/1", codec,
        corresponds: (_operation: unknown, request: { endpoint: string; bodyDigest: string }, evidence: unknown) => { const native = evidence as typeof codec.Type; return native.endpoint === request.endpoint && native.requestDigest === request.bodyDigest }
      } }
      const fixture = await makeFixture(provider)
      let native: unknown
      let sends = 0
      const host: HostShape = { ...fixture.host, store: measureStore(store, "sqlite-native-error"), transport: { send: (request) => Effect.sync(() => {
        sends++
        native = { status: 503, endpoint: request.facts.endpoint, requestDigest: request.facts.bodyDigest, nativeBody: '{"error":"backend_pending","request_id":"fixture-42"}' }
        return { _tag: "Unknown", reason: "native service unavailable", nativeError: native } as const
      }) } }
      expect((await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))).operations[0]?.status).toBe("Inconclusive")
      const original = await Effect.runPromise(store.read(fixture.plan.journalId))
      expect(original.events[1]?.body).toMatchObject({ _tag: "ObservationRecorded", evidenceKind: "DispatchError", status: "Inconclusive", evidenceVersion: "fixture-http-error/1", evidence: native })
      store.close()
      store = new SqliteJournal(path)
      expect(canonical(await Effect.runPromise(store.read(fixture.plan.journalId)))).toBe(canonical(original))
      expect((await runWithHost({ ...host, store }, runRelease({ candidate, plan: fixture.plan, authorize: true }))).operations[0]?.status).toBe("Inconclusive")
      expect(sends).toBe(1)
      await expect(runWithHost({ ...host, store, providers: [providerFor()] }, reportRelease({ candidate, plan: fixture.plan }))).rejects.toThrow("version is unavailable")
    } finally { store.close(); rmSync(directory, { recursive: true, force: true }) }
  })

  test(`${candidate}: caught core errors preserve code/message; undeclared noncommit and native error cannot grant another send`, async () => {
    for (const failure of ["core", "forged-noncommit", "unknown-native"] as const) {
      const fixture = await makeFixture()
      let sends = 0
      const host: HostShape = { ...fixture.host, transport: { send: () => Effect.suspend(() => {
        sends++
        return failure === "core" ? Effect.fail(new LabError({ code: "connection-reset", message: "fixture peer reset after request bytes" })) : Effect.succeed(failure === "forged-noncommit" ? { _tag: "RejectedBeforeCommit", proof: { safeToRetry: true } } as const : { _tag: "Unknown", reason: "error", nativeError: { arbitrary: true } } as const)
      }) } }
      const first = runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
      if (failure === "unknown-native") await expect(first).rejects.toThrow("installed versioned codec")
      else await first
      const snapshot = await Effect.runPromise(fixture.store.read(fixture.plan.journalId))
      expect(snapshot.events.some((event) => event.body._tag === "DispatchRejectedBeforeCommit")).toBe(false)
      if (failure === "core") expect(snapshot.events[1]?.body).toMatchObject({ evidenceKind: "DispatchError", evidenceVersion: "core-dispatch-error/1", evidence: { code: "connection-reset", message: "fixture peer reset after request bytes" } })
      expect((await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))).operations[0]?.status).toBe("Inconclusive")
      expect(sends).toBe(1)
    }
  })

  test(`${candidate}: fake dispatch identity, satisfied error classification and foreign error request reject before effects`, async () => {
    for (const invalid of ["ordinary-dispatch-id", "satisfied-error", "foreign-dispatch"] as const) {
      const fixture = await makeFixture()
      const host: HostShape = { ...fixture.host, transport: { send: () => Effect.succeed({ _tag: "Unknown", reason: "uncertain" } as const) } }
      await runWithHost(host, runRelease({ candidate, plan: fixture.plan, authorize: true }))
      const start = (await startEvents(fixture.store, fixture.plan))[0]!.body as DispatchStarted
      const event = new JournalEvent({ format: "architecture-lab/event/1", eventId: "malformed", journalId: fixture.plan.journalId, planId: fixture.plan.planId,
        body: new ObservationRecorded({ operationId: fixture.operation.operationId, evidenceKind: invalid === "ordinary-dispatch-id" ? "Observation" : "DispatchError", dispatchId: invalid === "foreign-dispatch" ? "another-dispatch" : start.dispatchId, status: invalid === "satisfied-error" ? "Satisfied" : "Inconclusive", evidenceVersion: "core-dispatch-error/1", evidence: { code: "error", message: "fixture" }, observedAt: 1000 })
      })
      await Effect.runPromise(fixture.store.append(fixture.plan.journalId, 2, event))
      await expect(runWithHost(fixture.host, runRelease({ candidate, plan: fixture.plan, authorize: true }))).rejects.toThrow()
      expect(fixture.sends).toHaveLength(0)
    }
  })
}
