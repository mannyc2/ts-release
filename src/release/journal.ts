import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { encodeCanonicalJson, parseStrictJson } from "../model/canonical.js"
import { Sha256Hex } from "../model/digest.js"
import {
  OperationId,
  PlanId,
  ProviderDefinitionId
} from "./release-plan.js"

const NonNegativeInteger = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0))

const canonicalIdentifier = <const Name extends string>(name: Name) =>
  Schema.NonEmptyString.check(Schema.makeFilter((value: string) =>
    value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/u.test(value)
      ? undefined
      : `${name} must be nonempty NFC text without control characters.`
  )).pipe(Schema.brand(name))

export const DispatchId = canonicalIdentifier("DispatchId")
export type DispatchId = typeof DispatchId.Type

export const TransportId = canonicalIdentifier("TransportId")
export type TransportId = typeof TransportId.Type

export const EndpointIdentity = canonicalIdentifier("EndpointIdentity")
export type EndpointIdentity = typeof EndpointIdentity.Type

export const AuthorizationIdentity = canonicalIdentifier("AuthorizationIdentity")
export type AuthorizationIdentity = typeof AuthorizationIdentity.Type

export const ActorId = canonicalIdentifier("ActorId")
export type ActorId = typeof ActorId.Type

export const RequestFingerprint = Sha256Hex.pipe(Schema.brand("RequestFingerprint"))
export type RequestFingerprint = typeof RequestFingerprint.Type

const canonicalJsonIssue = (value: Schema.Json): string | undefined => {
  try {
    encodeCanonicalJson(value)
    return undefined
  } catch (cause) {
    return cause instanceof Error ? cause.message : "value has no strict canonical JSON encoding"
  }
}

/** JSON values that have the one strict canonical encoding used by durable release data. */
export const CanonicalJson = Schema.Json.check(Schema.makeFilter(canonicalJsonIssue))
export type CanonicalJson = typeof CanonicalJson.Type

export class DispatchStarted extends Schema.TaggedClass<DispatchStarted>()("DispatchStarted", {
  schemaVersion: Schema.Literal(1),
  operationId: OperationId,
  dispatchId: DispatchId,
  attempt: PositiveInteger,
  providerDefinitionId: ProviderDefinitionId,
  transportId: TransportId,
  endpointIdentity: EndpointIdentity,
  requestFingerprint: RequestFingerprint,
  authorizationIdentity: AuthorizationIdentity,
  replayProtection: CanonicalJson,
  replayBasis: CanonicalJson,
  implementationProvenance: Schema.optionalKey(CanonicalJson),
  startedAtEpochMillis: NonNegativeInteger
}) {}

export class DispatchRejectedBeforeCommit
  extends Schema.TaggedClass<DispatchRejectedBeforeCommit>()("DispatchRejectedBeforeCommit", {
    schemaVersion: Schema.Literal(1),
    operationId: OperationId,
    dispatchId: DispatchId,
    rejection: CanonicalJson,
    recordedAtEpochMillis: NonNegativeInteger
  }) {}

export class ReceiptAccepted extends Schema.TaggedClass<ReceiptAccepted>()("ReceiptAccepted", {
  schemaVersion: Schema.Literal(1),
  operationId: OperationId,
  dispatchId: DispatchId,
  receipt: CanonicalJson,
  recordedAtEpochMillis: NonNegativeInteger
}) {}

export class ObservationRecorded extends Schema.TaggedClass<ObservationRecorded>()("ObservationRecorded", {
  schemaVersion: Schema.Literal(1),
  operationId: OperationId,
  dispatchId: Schema.optionalKey(DispatchId),
  observation: CanonicalJson,
  recordedAtEpochMillis: NonNegativeInteger
}) {}

export class RiskAccepted extends Schema.TaggedClass<RiskAccepted>()("RiskAccepted", {
  schemaVersion: Schema.Literal(1),
  operationId: OperationId,
  dispatchId: Schema.optionalKey(DispatchId),
  acceptedBy: ActorId,
  basis: CanonicalJson,
  recordedAtEpochMillis: NonNegativeInteger
}) {}

export class PlanSuperseded extends Schema.TaggedClass<PlanSuperseded>()("PlanSuperseded", {
  schemaVersion: Schema.Literal(1),
  supersedingPlanId: PlanId,
  reason: CanonicalJson,
  recordedAtEpochMillis: NonNegativeInteger
}) {}

export const JournalEvent = Schema.Union([
  DispatchStarted,
  DispatchRejectedBeforeCommit,
  ReceiptAccepted,
  ObservationRecorded,
  RiskAccepted,
  PlanSuperseded
])
export type JournalEvent = typeof JournalEvent.Type

export class JournalEntry extends Schema.Class<JournalEntry>("JournalEntry")({
  revision: PositiveInteger,
  event: JournalEvent
}) {}

const ReleaseJournalFields = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  planId: PlanId,
  revision: NonNegativeInteger,
  entries: Schema.Array(JournalEntry)
}).pipe(Schema.check(Schema.makeFilter((journal) => {
  if (journal.revision !== journal.entries.length) {
    return "journal revision must equal its number of entries"
  }
  return journal.entries.findIndex((entry, index) => entry.revision !== index + 1) === -1
    ? undefined
    : "journal entry revisions must be contiguous and begin at one"
})))

export class ReleaseJournal extends Schema.Class<ReleaseJournal>("ReleaseJournal")(ReleaseJournalFields) {}

export class JournalAppended extends Schema.TaggedClass<JournalAppended>()("JournalAppended", {
  planId: PlanId,
  revision: PositiveInteger
}) {}

export class JournalRevisionMismatch
  extends Schema.TaggedErrorClass<JournalRevisionMismatch>()("JournalRevisionMismatch", {
    planId: PlanId,
    expectedRevision: NonNegativeInteger,
    actualRevision: NonNegativeInteger
  }) {}

export class JournalReadFailed extends Schema.TaggedErrorClass<JournalReadFailed>()("JournalReadFailed", {
  planId: PlanId,
  detail: CanonicalJson
}) {}

export class JournalAppendFailedBeforeCommit
  extends Schema.TaggedErrorClass<JournalAppendFailedBeforeCommit>()("JournalAppendFailedBeforeCommit", {
    planId: PlanId,
    detail: CanonicalJson
  }) {}

export class JournalAmbiguousStorageOutcome
  extends Schema.TaggedErrorClass<JournalAmbiguousStorageOutcome>()("JournalAmbiguousStorageOutcome", {
    planId: PlanId,
    expectedRevision: NonNegativeInteger,
    detail: CanonicalJson
  }) {}

export type JournalAppendError =
  | JournalRevisionMismatch
  | JournalAppendFailedBeforeCommit
  | JournalAmbiguousStorageOutcome

export interface JournalStoreShape {
  readonly read: (planId: PlanId) => Effect.Effect<ReleaseJournal, JournalReadFailed>
  readonly appendIfRevision: (
    planId: PlanId,
    expectedRevision: number,
    event: JournalEvent
  ) => Effect.Effect<JournalAppended, JournalAppendError>
}

/** Storage law boundary; concrete implementations are supplied with operation-local Layers. */
export class JournalStore extends Context.Service<JournalStore, JournalStoreShape>()(
  "ts-release/JournalStore"
) {}

export const emptyReleaseJournal = (planId: PlanId): ReleaseJournal => ReleaseJournal.make({
  schemaVersion: 1,
  planId,
  revision: 0,
  entries: []
})

const encodeJournalEventValue = Schema.encodeSync(JournalEvent)
const decodeJournalEventValue = Schema.decodeUnknownSync(JournalEvent, { onExcessProperty: "error" })
const encodeReleaseJournalValue = Schema.encodeSync(ReleaseJournal)
const decodeReleaseJournalValue = Schema.decodeUnknownSync(ReleaseJournal, { onExcessProperty: "error" })

export const encodeJournalEvent = (event: JournalEvent): string =>
  encodeCanonicalJson(encodeJournalEventValue(event))

export const decodeJournalEvent = (canonicalText: string): JournalEvent => {
  const event = decodeJournalEventValue(parseStrictJson(canonicalText))
  if (encodeJournalEvent(event) !== canonicalText) {
    throw new Error("Journal event text is not canonical.")
  }
  return event
}

export const encodeReleaseJournal = (journal: ReleaseJournal): string =>
  encodeCanonicalJson(encodeReleaseJournalValue(journal))

export const decodeReleaseJournal = (canonicalText: string): ReleaseJournal => {
  const journal = decodeReleaseJournalValue(parseStrictJson(canonicalText))
  if (encodeReleaseJournal(journal) !== canonicalText) {
    throw new Error("Release journal text is not canonical.")
  }
  return journal
}

const snapshotEvent = (event: JournalEvent): JournalEvent => decodeJournalEvent(encodeJournalEvent(event))

const snapshotJournal = (journal: ReleaseJournal): ReleaseJournal =>
  decodeReleaseJournal(encodeReleaseJournal(journal))

const failureDetail = (cause: unknown): CanonicalJson => ({
  reason: cause instanceof Error ? cause.message : String(cause)
})

/** In-process conformance store for focused tests; it makes no cross-process durability claim. */
export const makeInMemoryJournalStore = Effect.fn("makeInMemoryJournalStore")(function*() {
  const state = yield* Ref.make<ReadonlyMap<PlanId, ReleaseJournal>>(new Map())

  const read: JournalStoreShape["read"] = Effect.fn("InMemoryJournalStore.read")((planId) =>
    Ref.get(state).pipe(
      Effect.map((journals) => snapshotJournal(journals.get(planId) ?? emptyReleaseJournal(planId)))
    ))

  const appendIfRevision: JournalStoreShape["appendIfRevision"] = Effect.fn(
    "InMemoryJournalStore.appendIfRevision"
  )(function*(planId, expectedRevision, event) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      return yield* new JournalAppendFailedBeforeCommit({
        planId,
        detail: { reason: "expected revision must be a nonnegative safe integer" }
      })
    }

    const ownedEvent = yield* Effect.try({
      try: () => snapshotEvent(event),
      catch: (cause) => new JournalAppendFailedBeforeCommit({ planId, detail: failureDetail(cause) })
    })

    const result = yield* Ref.modify(state, (
      journals
    ): readonly [
      Result.Result<JournalAppended, JournalRevisionMismatch>,
      ReadonlyMap<PlanId, ReleaseJournal>
    ] => {
      const current = journals.get(planId) ?? emptyReleaseJournal(planId)
      if (current.revision !== expectedRevision) {
        return [Result.fail(new JournalRevisionMismatch({
          planId,
          expectedRevision,
          actualRevision: current.revision
        })), journals] as const
      }

      const revision = current.revision + 1
      const next = ReleaseJournal.make({
        schemaVersion: 1,
        planId,
        revision,
        entries: [...current.entries, JournalEntry.make({ revision, event: ownedEvent })]
      })
      const updated = new Map(journals)
      updated.set(planId, next)
      return [Result.succeed(JournalAppended.make({ planId, revision })), updated] as const
    })

    return yield* Effect.fromResult(result)
  })

  return JournalStore.of({ read, appendIfRevision })
})

export const inMemoryJournalStoreLayer = Layer.effect(JournalStore, makeInMemoryJournalStore())
