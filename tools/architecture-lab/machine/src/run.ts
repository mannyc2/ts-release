import * as Effect from "effect/Effect"
import {
  CoreDispatchError, CoreUndecodableReceipt, DispatchStarted, Host, JournalEvent, LabError, ObservationRecorded,
  ReceiptAccepted, DispatchRejectedBeforeCommit, PlanSuperseded, RiskAccepted,
  type EventBody, type HostShape, type Plan, type ReleaseReport,
  type RunOptions, type Snapshot, type Operation, type OperationEvidence, type ProviderContext
} from "./contracts.js"
import { attempt, canonical, fail, loadPlan, nativeEvidence, requestFingerprint, sha256, verifyEvents, verifyRequest, verifyNativeEvidence, verifyProviderContracts, decodeObservationEvidence, verifyPreparationSelection } from "./identity.js"
import { assertJournalAppend } from "./laws.js"
import { historyMachine } from "./m1-history.js"
import { assertTransportBinding } from "./core-git.js"

/** The application may supply any evaluator satisfying the Machine laws; the kernel ships M1. */
const immutableCopy = <A>(value: A): A => {
  const freeze = (input: unknown): void => {
    if (input && typeof input === "object") { Object.values(input).forEach(freeze); Object.freeze(input) }
  }
  const copy = structuredClone(value)
  freeze(copy)
  return copy
}
const model = (host: HostShape, plan: Plan, events: ReadonlyArray<JournalEvent>) => (host.machine ?? historyMachine)(immutableCopy(plan), immutableCopy(events), scopeKind(host, plan))

const providerContext = (host: HostShape, plan: Plan, operation: Operation, snapshot: Snapshot): ProviderContext => {
  const evidenceFor = (operation: Operation): OperationEvidence => {
    const provider = host.providers.find((item) => item.definitionId === operation.definitionId)!
    const events = snapshot.events.filter((event) => event.planId === plan.planId)
    const starts = new Set(events.flatMap(({ body }) => body._tag === "DispatchStarted" && body.operationId === operation.operationId ? [body.dispatchId] : []))
    return {
      operation,
      receipts: events.flatMap(({ body }) => body._tag === "ReceiptAccepted" && starts.has(body.dispatchId) ? [nativeEvidence(provider.receiptCodec, body.receipt)] : []),
      observations: events.flatMap(({ body }) => body._tag === "ObservationRecorded" && body.operationId === operation.operationId ? [{ status: body.status, evidence: decodeObservationEvidence(provider, body) }] : [])
    }
  }
  const context: ProviderContext = { own: evidenceFor(operation), dependencies: operation.dependsOn.map((id) => evidenceFor(plan.operations.find((item) => item.operationId === id)!)) }
  // Providers get a private immutable projection, never mutable journal storage.
  const freeze = (value: unknown): void => {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  }
  const copied = JSON.parse(canonical(context)) as ProviderContext
  freeze(copied)
  return copied
}

const journalIdFor = (host: HostShape, plan: Plan) => host.journal?.journalId ?? plan.journalId
const scopeKind = (host: HostShape, plan: Plan) => host.journal?.scopes.find((scope) => scope.plan.planId === plan.planId)?._tag ?? "PublicationScope"
const read = Effect.fn("lab.readHistory")(function*(host: HostShape, plan: Plan) {
  yield* attempt(() => verifyProviderContracts(host.providers))
  const journalId = journalIdFor(host, plan)
  if (journalId !== plan.journalId) return yield* Effect.fail(new LabError({ code: "journal-binding", message: "Host cannot move an immutable plan into another journal" }))
  const scopes = host.journal?.scopes ?? [{ _tag: "PublicationScope" as const, plan }]
  if (scopes.filter((scope) => scope._tag === "PublicationScope").length > 1) {
    return yield* Effect.fail(new LabError({ code: "publication-scope", message: "A release journal admits at most one publication plan" }))
  }
  const registered = new Map<string, Plan>()
  for (const scope of scopes) {
    const admitted = yield* loadPlan(scope.plan, host.providers)
    yield* attempt(() => {
      if (admitted.journalId !== journalId) fail("journal-binding", "Every admitted scope must bind this physical journal")
      if (registered.has(admitted.planId)) fail("duplicate-scope", "A journal scope is registered twice")
      if (scope._tag === "PreparationScope") {
        const operation = admitted.operations[0]
        if (admitted.operations.length !== 1 || !operation || operation.dependsOn.length !== 0 || admitted.bundleId !== `preparation:${operation.operationId}`) fail("preparation-scope", "Preparation is exactly one input-bound operation without a future DAG")
      }
      registered.set(admitted.planId, admitted)
    })
  }
  if (!registered.has(plan.planId)) return yield* Effect.fail(new LabError({ code: "unregistered-scope", message: "Current plan is not admitted to this journal" }))
  const snapshot = yield* host.store.read(journalId)
  yield* attempt(() => {
    if (snapshot.revision !== snapshot.events.length) fail("journal-revision", "Snapshot revision does not match complete global history")
    const ids = new Set<string>()
    for (const event of snapshot.events) {
      if (event.journalId !== journalId || !registered.has(event.planId) || ids.has(event.eventId)) fail("journal-envelope", "Journal contains an unknown scope, foreign root or duplicate event ID")
      ids.add(event.eventId)
    }
  })
  const decoded: JournalEvent[] = []
  let selected: ReturnType<typeof model> | undefined
  for (const admitted of registered.values()) {
    const scoped = yield* verifyEvents(admitted, snapshot.events.filter((event) => event.planId === admitted.planId), journalId)
    yield* attempt(() => verifyNativeEvidence(admitted, scoped, host.providers))
    if (scopeKind(host, admitted) === "PreparationScope") yield* attempt(() => verifyPreparationSelection(scoped))
    yield* attempt(() => {
      for (let index = 0; index < scoped.length; index++) assertJournalAppend(admitted, scoped.slice(0, index), scoped[index]!, scopeKind(host, admitted))
    })
    const machine = yield* attempt(() => model(host, admitted, scoped))
    decoded.push(...scoped)
    if (admitted.planId === plan.planId) selected = machine
  }
  const byId = new Map(decoded.map((event) => [event.eventId, event]))
  const events = snapshot.events.map((event) => byId.get(event.eventId)!)
  const machine = selected!
  return {
    snapshot: { revision: snapshot.revision, events } satisfies Snapshot,
    machine,
    report: () => ({ ...machine.report(), revision: snapshot.revision })
  }
})

const eventFor = (host: HostShape, plan: Plan, body: EventBody): JournalEvent => new JournalEvent({
  format: "architecture-lab/event/1", eventId: host.uniqueId(), journalId: journalIdFor(host, plan), planId: plan.planId, body
})

/** Facts survive CAS loss; their identity is retained across append retries. */
const appendFact = Effect.fn("lab.appendFact")(function*(host: HostShape, plan: Plan, event: JournalEvent) {
  for (let retry = 0; retry < 8; retry++) {
    const { snapshot, machine } = yield* read(host, plan)
    const existing = snapshot.events.find((item) => item.eventId === event.eventId)
    if (existing) {
      if (canonical(existing) !== canonical(event)) return yield* Effect.fail(new LabError({ code: "event-id-conflict", message: "Event ID already has different facts" }))
      return
    }
    yield* attempt(() => {
      const scoped = [...snapshot.events.filter((item) => item.planId === plan.planId), event]
      verifyNativeEvidence(plan, scoped, host.providers)
      if (scopeKind(host, plan) === "PreparationScope") verifyPreparationSelection(scoped)
      assertJournalAppend(plan, scoped.slice(0, -1), event, scopeKind(host, plan))
      machine.append(immutableCopy(event))
    })
    const result = yield* host.store.append(journalIdFor(host, plan), snapshot.revision, event)
    if (result._tag === "Appended" || result._tag === "AlreadyRecorded") return
  }
  return yield* Effect.fail(new LabError({ code: "journal-contention", message: "Fact append could not be reconciled within this invocation" }))
})

export const reportRelease = Effect.fn("lab.reportRelease")(function*(options: { readonly plan: Plan }) {
  const host = yield* Host
  const plan = yield* loadPlan(options.plan, host.providers)
  return (yield* read(host, plan)).report()
})

export const observeRelease = Effect.fn("lab.observeRelease")(function*(options: { readonly plan: Plan }) {
  const host = yield* Host
  const plan = yield* loadPlan(options.plan, host.providers)
  // Validate all history and definitions before the first provider effect.
  yield* read(host, plan)
  for (const operation of plan.operations) {
    const provider = host.providers.find((item) => item.definitionId === operation.definitionId)!
    if (!provider.observe) continue
    const prefix = yield* read(host, plan)
    const observation = yield* provider.observe(operation, yield* attempt(() => providerContext(host, plan, operation, prefix.snapshot)))
    yield* appendFact(host, plan, eventFor(host, plan, new ObservationRecorded({
      operationId: operation.operationId, evidenceKind: "Observation", ...observation, evidenceVersion: provider.observationVersion!, observedAt: host.now()
    })))
  }
  return (yield* read(host, plan)).report()
})

/** One interpreter, no durable permit and no provider-selected mutation retry. */
export const runRelease = Effect.fn("lab.runRelease")(function*(options: RunOptions) {
  const host = yield* Host
  const plan = yield* loadPlan(options.plan, host.providers)
  yield* read(host, plan)
  const visited = new Set<string>()
  let dispatches = 0
  while (visited.size < plan.operations.length) {
    let progressed = false
    for (const operation of plan.operations) {
      if (visited.has(operation.operationId)) continue
      let current = yield* read(host, plan)
      const reports = current.machine.report().operations
      if (operation.dependsOn.some((id) => reports.find((item) => item.operationId === id)?.status !== "Satisfied")) continue
      progressed = true
      visited.add(operation.operationId)
      const provider = host.providers.find((item) => item.definitionId === operation.definitionId)!
      if (options.observe !== false && provider.observe) {
        const observation = yield* provider.observe(operation, yield* attempt(() => providerContext(host, plan, operation, current.snapshot)))
        yield* appendFact(host, plan, eventFor(host, plan, new ObservationRecorded({
          operationId: operation.operationId, evidenceKind: "Observation", ...observation, evidenceVersion: provider.observationVersion!, observedAt: host.now()
        })))
        current = yield* read(host, plan)
      }
      if (!options.authorize || dispatches >= (options.maxDispatches ?? plan.operations.length)) continue
      const first = yield* attempt(() => current.machine.next(operation.operationId, null, host.now()))
      if (first._tag !== "PrepareDispatch") continue
      // Private byte copy resolves credentials/artifacts before the uncertainty boundary.
      const request = yield* verifyRequest(yield* provider.prepare(operation, yield* attempt(() => providerContext(host, plan, operation, current.snapshot))))
      yield* attempt(() => assertTransportBinding(host.transport, request.facts))
      const fingerprint = yield* requestFingerprint(request.facts)
      current = yield* read(host, plan)
      const startedAt = host.now()
      const next = yield* attempt(() => current.machine.next(operation.operationId, immutableCopy({ facts: request.facts, fingerprint }), startedAt))
      if (next._tag !== "AppendDispatch") continue
      const eventId = host.uniqueId()
      const event = new JournalEvent({
        format: "architecture-lab/event/1", eventId, journalId: journalIdFor(host, plan), planId: plan.planId,
        body: new DispatchStarted({
          operationId: operation.operationId, dispatchId: `${eventId}:dispatch`,
          request: request.facts, fingerprint, startedAt, basis: immutableCopy(next.basis)
        })
      })
      yield* attempt(() => {
        assertJournalAppend(plan, current.snapshot.events.filter((item) => item.planId === plan.planId), event, scopeKind(host, plan))
        current.machine.append(immutableCopy(event))
      })
      const appended = yield* host.store.append(journalIdFor(host, plan), current.snapshot.revision, event)
      let owned = appended._tag === "Appended"
      if (appended._tag === "AmbiguousStorageOutcome") {
        const reconciled = yield* read(host, plan)
        // This invocation still owns the unsent call stack. A restarted run has
        // no path into this block merely because it loaded the same event.
        const exact = reconciled.snapshot.events.find((item) => item.eventId === eventId)
        owned = exact !== undefined && canonical(exact) === canonical(event)
      }
      // AlreadyRecorded and a CAS loser never receive a permit.
      if (!owned) continue
      const permit = { consumed: false }
      if (options.checkpoint) yield* options.checkpoint("after-append", event)
      const verified = yield* verifyRequest(request)
      yield* attempt(() => {
        if (permit.consumed) fail("permit-consumed", "Dispatch permit is single use")
        permit.consumed = true
      })
      const result = yield* host.transport.send(verified).pipe(Effect.catch((error) => Effect.succeed({ _tag: "CoreError" as const, error })))
      dispatches++
      if (options.checkpoint) yield* options.checkpoint("after-send", event)
      if (event.body._tag !== "DispatchStarted") return yield* Effect.fail(new LabError({ code: "internal-event", message: "Expected dispatch event" }))
      if (result._tag === "Accepted") {
        const decoded = yield* attempt(() => ({ _tag: "Decoded" as const, status: provider.classifyReceipt(operation, request.facts, nativeEvidence(provider.receiptCodec, result.receipt)) }))
          .pipe(Effect.catch((error) => Effect.succeed({ _tag: "Undecodable" as const, error })))
        if (decoded._tag === "Decoded") {
          yield* appendFact(host, plan, eventFor(host, plan, new ReceiptAccepted({ dispatchId: event.body.dispatchId, receiptVersion: provider.receiptVersion, status: decoded.status, receipt: result.receipt })))
          if (options.checkpoint) yield* options.checkpoint("after-receipt", event)
        } else {
          // The remote may have committed; keep the attempt uncertain and retain only a bounded, credential-free diagnostic.
          let encoded: string | undefined
          try { encoded = canonical(result.receipt) } catch { encoded = undefined }
          const receiptSha256 = encoded === undefined ? null : yield* sha256(new TextEncoder().encode(encoded))
          const evidence = new CoreUndecodableReceipt({ code: "undecodable-receipt", message: "Committed response could not be admitted by the installed provider", receiptSha256, receiptBytes: encoded === undefined ? null : String(new TextEncoder().encode(encoded).byteLength) })
          yield* appendFact(host, plan, eventFor(host, plan, new ObservationRecorded({ operationId: operation.operationId, evidenceKind: "DispatchError", dispatchId: event.body.dispatchId, status: "Inconclusive", evidenceVersion: "core-undecodable-receipt/1", evidence, observedAt: host.now() })))
        }
      } else if (result._tag === "RejectedBeforeCommit" && provider.rejection) {
        yield* appendFact(host, plan, eventFor(host, plan, new DispatchRejectedBeforeCommit({ dispatchId: event.body.dispatchId, proofVersion: provider.rejection.version, proof: result.proof })))
      } else {
        const native = result._tag === "Unknown" && result.nativeError !== undefined
        if (native && !provider.dispatchError) return yield* Effect.fail(new LabError({ code: "unknown-error-codec", message: "Native dispatch error requires an installed versioned codec" }))
        const evidence = native ? result.nativeError : result._tag === "CoreError" ? new CoreDispatchError({ code: result.error.code, message: result.error.message }) : new CoreDispatchError({ code: result._tag === "RejectedBeforeCommit" ? "unverified-noncommit" : "outcome-unknown", message: result._tag === "RejectedBeforeCommit" ? "Transport supplied no declared native proof of terminal noncommit" : result.reason })
        yield* appendFact(host, plan, eventFor(host, plan, new ObservationRecorded({ operationId: operation.operationId, evidenceKind: "DispatchError", dispatchId: event.body.dispatchId, status: "Inconclusive", evidenceVersion: native ? provider.dispatchError!.version : "core-dispatch-error/1", evidence, observedAt: host.now() })))
      }
    }
    if (!progressed) break
  }
  return (yield* read(host, plan)).report()
})

export const supersedePlan = Effect.fn("lab.supersedePlan")(function*(options: { readonly plan: Plan; readonly authorize: boolean; readonly reason: string }) {
  const host = yield* Host
  if (!options.authorize) return yield* Effect.fail(new LabError({ code: "authority-required", message: "Supersession requires host authorization" }))
  const plan = yield* loadPlan(options.plan, host.providers)
  yield* appendFact(host, plan, eventFor(host, plan, new PlanSuperseded({ reason: options.reason })))
  return (yield* read(host, plan)).report()
})

export const acceptRisk = Effect.fn("lab.acceptRisk")(function*(options: {
  readonly plan: Plan; readonly authorize: boolean;
  readonly decision: RiskAccepted
}) {
  const host = yield* Host
  if (!options.authorize) return yield* Effect.fail(new LabError({ code: "authority-required", message: "Risk acceptance requires host authorization" }))
  const plan = yield* loadPlan(options.plan, host.providers)
  yield* appendFact(host, plan, eventFor(host, plan, options.decision))
  return (yield* read(host, plan)).report()
})
