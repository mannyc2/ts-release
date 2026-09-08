import * as Effect from "effect/Effect"
import { currentHost, type HostShape, journalIdFor, read, scopeKind } from "./internal/Host.js"
import { CoreDispatchError, CoreUndecodableReceipt } from "./internal/ReleaseModel.js"
import { DispatchRejectedBeforeCommit, DispatchStarted } from "./internal/ReleaseModel.js"
import { ObservationRecorded, PlanSuperseded, ReceiptAccepted } from "./internal/ReleaseModel.js"
import { EventBody, JournalEvent, Operation, Plan, RiskAccepted } from "./internal/ReleaseModel.js"
import type { RunOptions } from "./internal/ReleaseModel.js"
import { canonical, decodeOwned, freeze, sha256 } from "./internal/Identity.js"
import { attempt, fail, reject } from "./internal/Error.js"
import { type Snapshot, verifyNativeEvidence, verifyPreparationSelection } from "./Journal.js"
import { assertJournalAppend } from "./internal/Decision.js"
import { loadPlan } from "./Plan.js"
import { assertRequestCorresponds, evidenceContext, nativeEvidence } from "./Provider.js"
import { requestFingerprint, verifyRequest } from "./Provider.js"
import type { ProviderDefinition } from "./Provider.js"
import { assertTransportBinding } from "./internal/GitAuthority.js"

export const eventFor = (
  host: HostShape,
  plan: Plan,
  body: EventBody,
  eventId = host.uniqueId(),
): JournalEvent =>
  new JournalEvent({
    format: "ts-release/event/1",
    eventId,
    journalId: journalIdFor(host, plan),
    planId: plan.planId,
    body,
  })
/** Facts survive CAS loss; their identity is retained across append retries. */
export const appendFact = Effect.fn("ts-release.appendFact")(function* (
  host: HostShape,
  plan: Plan,
  event: JournalEvent,
) {
  event = yield* attempt(() => decodeOwned(JournalEvent, event))
  for (let retry = 0; retry < 8; retry++) {
    const { snapshot, machine } = yield* read(host, plan)
    const existing = snapshot.events.find((item) => item.eventId === event.eventId)
    if (existing) {
      if (canonical(existing) !== canonical(event))
        return yield* reject("event-id-conflict", "Event ID already has different facts")
      return
    }
    yield* attempt(() => {
      const scoped = [...snapshot.events.filter((item) => item.planId === plan.planId), event]
      verifyNativeEvidence(plan, scoped, host.providers)
      if (scopeKind(host, plan) === "PreparationScope") verifyPreparationSelection(scoped)
      assertJournalAppend(plan, scoped.slice(0, -1), event, scopeKind(host, plan))
      machine.append(event)
    })
    const result = yield* host.store.append(journalIdFor(host, plan), snapshot.revision, event)
    if (result._tag === "Appended" || result._tag === "AlreadyRecorded") return
  }
  return yield* reject("journal-contention", "Fact append could not be reconciled")
})
const appendBody = (host: HostShape, plan: Plan, body: EventBody) =>
  appendFact(host, plan, eventFor(host, plan, body))
const appendObservation = (
  host: HostShape,
  plan: Plan,
  body: Omit<typeof ObservationRecorded.Type, "_tag">,
) => appendBody(host, plan, new ObservationRecorded(body))
const recordObservation = Effect.fn("ts-release.recordObservation")(function* (
  host: HostShape,
  plan: Plan,
  operation: Operation,
  provider: ProviderDefinition,
  snapshot: Snapshot,
) {
  const observation = yield* provider.observe!(
    operation,
    yield* attempt(() => evidenceContext(plan, operation, snapshot.events)),
  )
  yield* appendObservation(host, plan, {
    operationId: operation.operationId,
    evidenceKind: "Observation",
    status: observation.status,
    evidence: observation.evidence,
    evidenceVersion: provider.observationVersion!,
    observedAt: host.now(),
  })
})
export const reportRelease = Effect.fn("ts-release.reportRelease")(function* (options: {
  readonly plan: Plan
}) {
  const host = yield* currentHost
  const plan = yield* loadPlan(options.plan, host.providers)
  return (yield* read(host, plan)).report()
})
export const observeRelease = Effect.fn("ts-release.observeRelease")(function* (options: {
  readonly plan: Plan
}) {
  const host = yield* currentHost
  const plan = yield* loadPlan(options.plan, host.providers)
  // Validate all history and definitions before the first provider effect.
  yield* read(host, plan)
  for (const operation of plan.operations) {
    const provider = host.providers.find((item) => item.definitionId === operation.definitionId)!
    if (!provider.observe) continue
    const prefix = yield* read(host, plan)
    yield* recordObservation(host, plan, operation, provider, prefix.snapshot)
  }
  return (yield* read(host, plan)).report()
})
/** One interpreter, no durable permit and no provider-selected mutation retry. */
export const runRelease = Effect.fn("ts-release.runRelease")(function* (input: RunOptions) {
  const options = { ...input }
  const host = yield* currentHost
  if (
    typeof options.authorize !== "boolean" ||
    (options.observe !== undefined && typeof options.observe !== "boolean")
  )
    return yield* reject("run-options", "Authorization and observation options must be booleans")
  if (
    options.maxDispatches !== undefined &&
    (!Number.isSafeInteger(options.maxDispatches) || options.maxDispatches < 0)
  )
    return yield* reject("dispatch-limit", "Dispatch limit must be a nonnegative safe integer")
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
      if (
        operation.dependsOn.some(
          (id) => reports.find((item) => item.operationId === id)?.status !== "Satisfied",
        )
      )
        continue
      progressed = true
      visited.add(operation.operationId)
      const provider = host.providers.find((item) => item.definitionId === operation.definitionId)!
      if (options.observe !== false && provider.observe) {
        yield* recordObservation(host, plan, operation, provider, current.snapshot)
        current = yield* read(host, plan)
      }
      if (!options.authorize || dispatches >= (options.maxDispatches ?? plan.operations.length))
        continue
      const first = yield* attempt(() =>
        current.machine.next(operation.operationId, null, host.now()),
      )
      if (first._tag !== "PrepareDispatch") continue
      // Private byte copy resolves credentials/artifacts before the uncertainty boundary.
      const context = yield* attempt(() =>
        evidenceContext(plan, operation, current.snapshot.events),
      )
      const request = yield* verifyRequest(yield* provider.prepare(operation, context))
      yield* attempt(() => assertRequestCorresponds(provider, operation, request.facts, context))
      yield* attempt(() => assertTransportBinding(host.transport, request.facts))
      const send = host.transport.prepare
        ? yield* host.transport.prepare(yield* verifyRequest(request))
        : host.transport.send
      yield* attempt(() => {
        if (typeof send !== "function")
          fail("transport-preparation", "Transport preparation did not return a callable send")
      })
      const fingerprint = yield* requestFingerprint(request.facts)
      current = yield* read(host, plan)
      const startedAt = host.now()
      const next = yield* attempt(() =>
        current.machine.next(
          operation.operationId,
          freeze({ facts: request.facts, fingerprint }),
          startedAt,
        ),
      )
      if (next._tag !== "AppendDispatch") continue
      const eventId = host.uniqueId()
      const dispatchId = `${eventId}:dispatch`
      const event = yield* attempt(() =>
        eventFor(
          host,
          plan,
          new DispatchStarted({
            operationId: operation.operationId,
            dispatchId,
            request: request.facts,
            fingerprint,
            startedAt,
            basis: next.basis,
          }),
          eventId,
        ),
      )
      yield* attempt(() => {
        verifyNativeEvidence(
          plan,
          [...current.snapshot.events.filter((item) => item.planId === plan.planId), event],
          host.providers,
        )
        assertJournalAppend(
          plan,
          current.snapshot.events.filter((item) => item.planId === plan.planId),
          event,
          scopeKind(host, plan),
        )
        current.machine.append(event)
      })
      const appended = yield* host.store.append(
        journalIdFor(host, plan),
        current.snapshot.revision,
        event,
      )
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
      // This branch contains one send; its authority exists only on this call stack.
      const verified = yield* verifyRequest(request)
      const result = yield* send(verified).pipe(
        Effect.catch((error) => Effect.succeed({ _tag: "CoreError" as const, error })),
      )
      dispatches++
      if (result._tag === "Accepted") {
        const decoded = yield* attempt(() => ({
          _tag: "Decoded" as const,
          status: provider.classifyReceipt(
            operation,
            request.facts,
            nativeEvidence(provider.receiptCodec, result.receipt),
          ),
        })).pipe(Effect.catch((error) => Effect.succeed({ _tag: "Undecodable" as const, error })))
        if (decoded._tag === "Decoded") {
          yield* appendBody(
            host,
            plan,
            new ReceiptAccepted({
              dispatchId,
              receiptVersion: provider.receiptVersion,
              status: decoded.status,
              receipt: result.receipt,
            }),
          )
        } else {
          // The remote may have committed; keep the attempt uncertain and retain only a bounded, credential-free diagnostic.
          let diagnostic: Uint8Array | null = null
          try {
            diagnostic = new TextEncoder().encode(canonical(result.receipt))
          } catch {}
          const evidence = new CoreUndecodableReceipt({
            code: "undecodable-receipt",
            message: "Committed response could not be admitted by the installed provider",
            receiptSha256: diagnostic && (yield* sha256(diagnostic)),
            receiptBytes: diagnostic && String(diagnostic.byteLength),
          })
          yield* appendObservation(host, plan, {
            operationId: operation.operationId,
            evidenceKind: "DispatchError",
            dispatchId,
            status: "Inconclusive",
            evidenceVersion: "core-undecodable-receipt/1",
            evidence,
            observedAt: host.now(),
          })
        }
      } else if (result._tag === "RejectedBeforeCommit" && provider.rejection) {
        yield* appendBody(
          host,
          plan,
          new DispatchRejectedBeforeCommit({
            dispatchId,
            proofVersion: provider.rejection.version,
            proof: result.proof,
          }),
        )
      } else {
        const native = result._tag === "Unknown" && result.nativeError !== undefined
        if (native && !provider.dispatchError)
          return yield* reject(
            "unknown-error-codec",
            "Native dispatch error requires an installed versioned codec",
          )
        const evidence = native
          ? result.nativeError
          : result._tag === "CoreError"
            ? new CoreDispatchError({
                code: "transport-error",
                message: "Transport failed after dispatch began",
              })
            : new CoreDispatchError({
                code:
                  result._tag === "RejectedBeforeCommit"
                    ? "unverified-noncommit"
                    : "outcome-unknown",
                message:
                  result._tag === "RejectedBeforeCommit"
                    ? "Transport supplied no declared native proof of terminal noncommit"
                    : "Transport did not provide a verifiable outcome",
              })
        yield* appendObservation(host, plan, {
          operationId: operation.operationId,
          evidenceKind: "DispatchError",
          dispatchId,
          status: "Inconclusive",
          evidenceVersion: native ? provider.dispatchError!.version : "core-dispatch-error/1",
          evidence,
          observedAt: host.now(),
        })
      }
    }
    if (!progressed) break
  }
  return (yield* read(host, plan)).report()
})
export const supersedePlan = Effect.fn("ts-release.supersedePlan")(function* (options: {
  readonly plan: Plan
  readonly authorize: boolean
  readonly reason: string
}) {
  const host = yield* currentHost
  if (options.authorize !== true)
    return yield* reject("authority-required", "Supersession requires host authorization")
  const plan = yield* loadPlan(options.plan, host.providers)
  yield* appendBody(host, plan, new PlanSuperseded({ reason: options.reason }))
  return (yield* read(host, plan)).report()
})
export const acceptRisk = Effect.fn("ts-release.acceptRisk")(function* (options: {
  readonly plan: Plan
  readonly authorize: boolean
  readonly decision: RiskAccepted
}) {
  const host = yield* currentHost
  if (options.authorize !== true)
    return yield* reject("authority-required", "Risk acceptance requires host authorization")
  const plan = yield* loadPlan(options.plan, host.providers)
  yield* appendBody(host, plan, options.decision)
  return (yield* read(host, plan)).report()
})
