import * as Context from "effect/Context"
import { Effect, Schema } from "effect"
import { verifyNativeEvidence, verifyPreparationSelection } from "../Journal.js"
import type { JournalContext, JournalStore, Snapshot } from "../Journal.js"
import { requestFingerprint, verifyProviderContracts } from "../Provider.js"
import type { ProviderDefinition, Transport } from "../Provider.js"
import { assertJournalAppend, historyMachine, projectReport } from "./Decision.js"
import type { Machine, MachineConstructor } from "./Decision.js"
import { JournalEvent, Plan } from "./ReleaseModel.js"
import { decodeOwned } from "./Identity.js"
import { attempt, fail, reject } from "./Error.js"
import { loadPlan } from "../Plan.js"
import { captureTransport } from "./GitAuthority.js"

export interface HostShape {
  readonly store: JournalStore
  readonly transport: Transport
  readonly providers: ReadonlyArray<ProviderDefinition>
  readonly now: () => number
  readonly uniqueId: () => string
  readonly journal?: JournalContext
  /** Decision evaluator over validated history. Default: the kernel's history machine (M1). Any implementation satisfying the Machine laws may be supplied by the application. */
  readonly machine?: MachineConstructor
}
export class Host extends Context.Service<Host, HostShape>()("ts-release/Host") {}
/** Capture capabilities before calling user code or storage. Mutable service
 * state stays behind its functions; callers cannot replace this invocation's
 * provider table, transport, journal scopes, or clock after admission. */
export const captureHost = (input: HostShape): HostShape => {
  return Object.freeze({
    store: Object.freeze({
      read: input.store.read.bind(input.store),
      append: input.store.append.bind(input.store),
    }),
    transport: captureTransport(input.transport),
    providers: verifyProviderContracts(input.providers),
    now: input.now.bind(input),
    uniqueId: input.uniqueId.bind(input),
    ...(input.machine && { machine: input.machine.bind(input) }),
    ...(input.journal && {
      journal: Object.freeze({
        journalId: input.journal.journalId,
        scopes: Object.freeze(
          input.journal.scopes.map((scope) =>
            Object.freeze({
              _tag: scope._tag,
              plan: decodeOwned(Plan, scope.plan),
            }),
          ),
        ),
      }),
    }),
  })
}
export const currentHost = Effect.flatMap(Host, (host) => attempt(() => captureHost(host)))
export const journalIdFor = (host: HostShape, plan: Plan) =>
  host.journal?.journalId ?? plan.journalId
export const scopeKind = (host: HostShape, plan: Plan) =>
  host.journal?.scopes.find((scope) => scope.plan.planId === plan.planId)?._tag ??
  "PublicationScope"
export const read = Effect.fn("ts-release.readHistory")(function* (host: HostShape, plan: Plan) {
  yield* attempt(() => {
    const now = host.now()
    if (!Number.isSafeInteger(now) || now < 0)
      fail("host-time", "Host time must be a nonnegative safe integer")
  })
  const journalId = journalIdFor(host, plan)
  if (journalId !== plan.journalId)
    return yield* reject("journal-binding", "Host cannot move a plan into another journal")
  const scopes = host.journal?.scopes ?? [{ _tag: "PublicationScope" as const, plan }]
  if (scopes.filter((scope) => scope._tag === "PublicationScope").length > 1) {
    return yield* reject("publication-scope", "A journal admits at most one publication plan")
  }
  const registered = new Map<string, Plan>()
  for (const scope of scopes) {
    if (scope._tag !== "PreparationScope" && scope._tag !== "PublicationScope")
      return yield* reject("scope-kind", "Unknown release scope kind")
    const admitted = yield* loadPlan(scope.plan, host.providers)
    yield* attempt(() => {
      if (admitted.journalId !== journalId)
        fail("journal-binding", "Every admitted scope must bind this physical journal")
      if (registered.has(admitted.planId))
        fail("duplicate-scope", "A journal scope is registered twice")
      if (scope._tag === "PreparationScope") {
        const operation = admitted.operations[0]
        if (
          admitted.operations.length !== 1 ||
          !operation ||
          operation.dependsOn.length !== 0 ||
          admitted.bundleId !== `preparation:${operation.operationId}`
        )
          fail(
            "preparation-scope",
            "Preparation is exactly one input-bound operation without a future DAG",
          )
      }
      registered.set(admitted.planId, admitted)
    })
  }
  if (!registered.has(plan.planId))
    return yield* reject("unregistered-scope", "Current plan is not admitted to this journal")
  const stored = yield* host.store.read(journalId)
  const snapshot = yield* attempt(() =>
    decodeOwned(
      Schema.Struct({ revision: Schema.Number, events: Schema.Array(JournalEvent) }),
      stored,
    ),
  )
  yield* attempt(() => {
    if (snapshot.revision !== snapshot.events.length)
      fail("journal-revision", "Snapshot revision does not match complete global history")
    const ids = new Set<string>()
    for (const event of snapshot.events) {
      if (event.journalId !== journalId || !registered.has(event.planId) || ids.has(event.eventId))
        fail(
          "journal-envelope",
          "Journal contains an unknown scope, foreign root or duplicate event ID",
        )
      ids.add(event.eventId)
    }
  })
  let selected: Machine | undefined
  for (const admitted of registered.values()) {
    const kind = scopeKind(host, admitted)
    const scoped = Object.freeze(
      snapshot.events.filter((event) => event.planId === admitted.planId),
    )
    for (const { body } of scoped)
      if (
        body._tag === "DispatchStarted" &&
        body.fingerprint !== (yield* requestFingerprint(body.request))
      )
        return yield* reject("request-fingerprint", "Historical request fingerprint mismatch")
    yield* attempt(() => verifyNativeEvidence(admitted, scoped, host.providers))
    if (kind === "PreparationScope") yield* attempt(() => verifyPreparationSelection(scoped))
    yield* attempt(() => {
      for (let index = 0; index < scoped.length; index++)
        assertJournalAppend(admitted, scoped.slice(0, index), scoped[index]!, kind)
    })
    if (admitted.planId === plan.planId)
      selected = yield* attempt(() => (host.machine ?? historyMachine)(admitted, scoped, kind))
  }
  const events = snapshot.events
  const machine = selected!
  return {
    plans: [...registered.values()],
    snapshot: { revision: snapshot.revision, events } satisfies Snapshot,
    machine,
    report: () => ({
      ...projectReport(
        plan,
        events.filter((event) => event.planId === plan.planId),
        scopeKind(host, plan),
      ),
      revision: snapshot.revision,
    }),
  }
})
