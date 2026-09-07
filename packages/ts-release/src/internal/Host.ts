import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  type JournalContext,
  type JournalStore,
  type Snapshot,
  verifyEvents,
  verifyNativeEvidence,
  verifyPreparationSelection,
} from "../Journal.js"
import {
  type OperationEvidence,
  type ProviderContext,
  type ProviderDefinition,
  type Transport,
  verifyProviderContracts,
} from "../Provider.js"
import {
  type MachineConstructor,
  assertJournalAppend,
  historyMachine,
  projectReport,
} from "./Decision.js"
import { JournalEvent, Operation, Plan } from "./ReleaseModel.js"
import { decodeOwned, freeze } from "./Identity.js"
import { ReleaseError, attempt, fail } from "./Error.js"
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
  verifyProviderContracts(input.providers)
  return Object.freeze({
    store: Object.freeze({
      read: input.store.read.bind(input.store),
      append: input.store.append.bind(input.store),
    }),
    transport: captureTransport(input.transport),
    providers: Object.freeze(
      input.providers.map((provider) =>
        Object.freeze({
          contract: provider.contract,
          definitionId: provider.definitionId,
          intentVersion: provider.intentVersion,
          intentCodec: provider.intentCodec,
          receiptVersion: provider.receiptVersion,
          receiptCodec: provider.receiptCodec,
          prepare: provider.prepare.bind(provider),
          receiptCorresponds: provider.receiptCorresponds.bind(provider),
          classifyReceipt: provider.classifyReceipt.bind(provider),
          ...(provider.observe && {
            observe: provider.observe.bind(provider),
            observationVersion: provider.observationVersion!,
            observationCodec: provider.observationCodec!,
            classifyObservation: provider.classifyObservation!.bind(provider),
          }),
          ...(provider.rejection && {
            rejection: Object.freeze({
              version: provider.rejection.version,
              codec: provider.rejection.codec,
              corresponds: provider.rejection.corresponds.bind(provider.rejection),
            }),
          }),
          ...(provider.dispatchError && {
            dispatchError: Object.freeze({
              version: provider.dispatchError.version,
              codec: provider.dispatchError.codec,
              corresponds: provider.dispatchError.corresponds.bind(provider.dispatchError),
            }),
          }),
        }),
      ),
    ),
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
/** Both inputs were owned and frozen at admission, preserving Schema classes. */
export const model = (host: HostShape, plan: Plan, events: ReadonlyArray<JournalEvent>) =>
  (host.machine ?? historyMachine)(plan, events, scopeKind(host, plan))
export const providerContext = (
  host: HostShape,
  plan: Plan,
  operation: Operation,
  snapshot: Snapshot,
): ProviderContext => {
  const evidenceFor = (operation: Operation): OperationEvidence => {
    const events = snapshot.events.filter((event) => event.planId === plan.planId)
    const starts = new Set(
      events.flatMap(({ body }) =>
        body._tag === "DispatchStarted" && body.operationId === operation.operationId
          ? [body.dispatchId]
          : [],
      ),
    )
    return {
      operation,
      receipts: events.flatMap(({ body }) =>
        body._tag === "ReceiptAccepted" && starts.has(body.dispatchId) ? [body.receipt] : [],
      ),
      observations: events.flatMap(({ body }) =>
        body._tag === "ObservationRecorded" && body.operationId === operation.operationId
          ? [{ status: body.status, evidence: body.evidence }]
          : [],
      ),
    }
  }
  const context: ProviderContext = {
    own: evidenceFor(operation),
    dependencies: operation.dependsOn.map((id) =>
      evidenceFor(plan.operations.find((item) => item.operationId === id)!),
    ),
  }
  // Every referenced fact was owned at admission; only these projection arrays are new.
  return freeze(context)
}
export const journalIdFor = (host: HostShape, plan: Plan) =>
  host.journal?.journalId ?? plan.journalId
export const scopeKind = (host: HostShape, plan: Plan) =>
  host.journal?.scopes.find((scope) => scope.plan.planId === plan.planId)?._tag ??
  "PublicationScope"
export const read = Effect.fn("ts-release.readHistory")(function* (host: HostShape, plan: Plan) {
  yield* attempt(() => {
    verifyProviderContracts(host.providers)
    const now = host.now()
    if (!Number.isSafeInteger(now) || now < 0)
      fail("host-time", "Host time must be a nonnegative safe integer")
  })
  const journalId = journalIdFor(host, plan)
  if (journalId !== plan.journalId)
    return yield* new ReleaseError({
      code: "journal-binding",
      message: "Host cannot move an immutable plan into another journal",
    })
  const scopes = host.journal?.scopes ?? [{ _tag: "PublicationScope" as const, plan }]
  if (scopes.filter((scope) => scope._tag === "PublicationScope").length > 1) {
    return yield* new ReleaseError({
      code: "publication-scope",
      message: "A release journal admits at most one publication plan",
    })
  }
  const registered = new Map<string, Plan>()
  for (const scope of scopes) {
    if (scope._tag !== "PreparationScope" && scope._tag !== "PublicationScope")
      return yield* new ReleaseError({ code: "scope-kind", message: "Unknown release scope kind" })
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
    return yield* new ReleaseError({
      code: "unregistered-scope",
      message: "Current plan is not admitted to this journal",
    })
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
  const decoded: JournalEvent[] = []
  let selected: ReturnType<typeof model> | undefined
  for (const admitted of registered.values()) {
    const scoped = yield* verifyEvents(
      admitted,
      snapshot.events.filter((event) => event.planId === admitted.planId),
      journalId,
    )
    yield* attempt(() => verifyNativeEvidence(admitted, scoped, host.providers))
    if (scopeKind(host, admitted) === "PreparationScope")
      yield* attempt(() => verifyPreparationSelection(scoped))
    yield* attempt(() => {
      for (let index = 0; index < scoped.length; index++)
        assertJournalAppend(
          admitted,
          scoped.slice(0, index),
          scoped[index]!,
          scopeKind(host, admitted),
        )
    })
    const machine = yield* attempt(() => model(host, admitted, scoped))
    decoded.push(...scoped)
    if (admitted.planId === plan.planId) selected = machine
  }
  const byId = new Map(decoded.map((event) => [event.eventId, event]))
  const events = snapshot.events.map((event) => byId.get(event.eventId)!)
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
