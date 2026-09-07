import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { JournalEvent, Plan } from "./internal/ReleaseModel.js"
import { read } from "./internal/Host.js"
import { ReleaseError, attempt, fail } from "./internal/Error.js"
import { canonical, decodeOwned, freeze } from "./internal/Identity.js"
import {
  type ProviderDefinition,
  decodeObservationEvidence,
  isCoreErrorVersion,
  nativeEvidence,
  requestFingerprint,
} from "./Provider.js"
import { corresponds } from "./Http.js"

export interface Snapshot {
  readonly revision: number
  readonly events: ReadonlyArray<JournalEvent>
}
export type AppendResult =
  | {
      readonly _tag: "Appended"
      readonly revision: number
    }
  | {
      readonly _tag: "AlreadyRecorded"
      readonly revision: number
    }
  | {
      readonly _tag: "RevisionMismatch"
      readonly revision: number
    }
  | {
      readonly _tag: "AmbiguousStorageOutcome"
    }
export interface JournalStore {
  readonly read: (journalId: string) => Effect.Effect<Snapshot, ReleaseError>
  readonly append: (
    journalId: string,
    expectedRevision: number,
    event: JournalEvent,
  ) => Effect.Effect<AppendResult, ReleaseError>
}
/** Preparation views are reconstructed from one concrete durable input; they
 * are never a second persisted publication plan or a future-work recipe. */
export type Scope =
  | {
      readonly _tag: "PublicationScope"
      readonly plan: Plan
    }
  | {
      readonly _tag: "PreparationScope"
      readonly plan: Plan
    }
export interface JournalContext {
  readonly journalId: string
  readonly scopes: ReadonlyArray<Scope>
}
export const verifyEvents = Effect.fn("ts-release.verifyEvents")(function* (
  plan: Plan,
  input: ReadonlyArray<JournalEvent>,
  journalId: string = plan.journalId,
) {
  const ids = new Set<string>()
  const events: JournalEvent[] = []
  const owned = yield* attempt(() => decodeOwned(Schema.Array(JournalEvent), input))
  for (const event of owned) {
    yield* attempt(() => {
      canonical(event)
      if (event.journalId !== journalId || event.planId !== plan.planId || ids.has(event.eventId))
        fail("journal-envelope", "Wrong journal, plan or repeated event ID")
      ids.add(event.eventId)
    })
    if (
      event.body._tag === "DispatchStarted" &&
      event.body.fingerprint !== (yield* requestFingerprint(event.body.request))
    )
      return yield* new ReleaseError({
        code: "request-fingerprint",
        message: "Historical request fingerprint mismatch",
      })
    events.push(event)
  }
  return freeze(events)
})
/** A preparation selects one immutable output. Receipt and observation channels
 * are distinct; their payloads cannot be assumed equivalent across codecs. */
export const verifyPreparationSelection = (events: ReadonlyArray<JournalEvent>): void => {
  const selected = new Map<string, string>()
  const starts = new Map<string, string>()
  for (const { body } of events) {
    if (body._tag === "DispatchStarted") starts.set(body.dispatchId, body.operationId)
    if (
      (body._tag !== "ObservationRecorded" && body._tag !== "ReceiptAccepted") ||
      body.status !== "Satisfied"
    )
      continue
    const operationId =
      body._tag === "ObservationRecorded" ? body.operationId : starts.get(body.dispatchId)
    if (operationId === undefined)
      fail("unknown-dispatch", "Preparation output has no matching dispatch")
    const encoded =
      body._tag === "ObservationRecorded"
        ? canonical({
            kind: body.evidenceKind,
            version: body.evidenceVersion,
            value: body.evidence,
          })
        : canonical({ kind: "Receipt", version: body.receiptVersion, value: body.receipt })
    const prior = selected.get(operationId)
    if (prior !== undefined && prior !== encoded)
      fail("preparation-selected", "This preparation already selected different satisfied evidence")
    selected.set(operationId, encoded)
  }
}
/** Native correspondence is provider protocol knowledge; it grants no replay authority. */
export const verifyNativeEvidence = (
  plan: Plan,
  events: ReadonlyArray<JournalEvent>,
  providers: ReadonlyArray<ProviderDefinition>,
): void => {
  const starts = new Map<
    string,
    Extract<
      JournalEvent["body"],
      {
        readonly _tag: "DispatchStarted"
      }
    >
  >()
  const receipts = new Map<string, unknown[]>()
  for (const { body } of events) {
    if (body._tag === "DispatchStarted") starts.set(body.dispatchId, body)
    if (body._tag === "ReceiptAccepted") {
      const start = starts.get(body.dispatchId)
      const operation = plan.operations.find((item) => item.operationId === start?.operationId)
      if (!start || !operation) fail("unassociated-receipt", "Receipt has no preceding dispatch")
      const provider = providers.find((item) => item.definitionId === operation.definitionId)!
      if (body.receiptVersion !== provider.receiptVersion)
        fail("unknown-receipt-codec", "Native receipt version is unavailable")
      const receipt = nativeEvidence(provider.receiptCodec, body.receipt)
      if (!provider.receiptCorresponds(operation, start.request, receipt))
        fail(
          "receipt-correspondence",
          "Native receipt does not identify the exact dispatched request",
        )
      if (provider.classifyReceipt(operation, start.request, receipt) !== body.status)
        fail("receipt-classification", "Stored completion differs from native acceptance")
      receipts.set(operation.operationId, [...(receipts.get(operation.operationId) ?? []), receipt])
    }
    if (body._tag === "DispatchRejectedBeforeCommit") {
      const start = starts.get(body.dispatchId)
      const operation = plan.operations.find((item) => item.operationId === start?.operationId)
      if (!start || !operation)
        fail("unassociated-rejection", "Rejection has no preceding dispatch")
      const boundary = providers.find(
        (item) => item.definitionId === operation.definitionId,
      )!.rejection
      if (!boundary || boundary.version !== body.proofVersion)
        fail("unknown-rejection-codec", "Native terminal noncommit proof version is unavailable")
      const proof = nativeEvidence(boundary.codec, body.proof)
      if (!boundary.corresponds(operation, start.request, proof))
        fail(
          "rejection-correspondence",
          "Terminal noncommit proof does not match the exact dispatch",
        )
    }
    if (body._tag === "ObservationRecorded") {
      const operation = plan.operations.find((item) => item.operationId === body.operationId)
      if (!operation) fail("unknown-operation", "Observation references an unknown operation")
      const provider = providers.find((item) => item.definitionId === operation.definitionId)!
      const evidence = decodeObservationEvidence(provider, body)
      if (body.evidenceKind === "DispatchError") {
        const start = starts.get(body.dispatchId!)
        if (!start || start.operationId !== operation.operationId)
          fail(
            "error-correspondence",
            "Dispatch error does not identify a preceding dispatch for this operation",
          )
        if (
          !isCoreErrorVersion(body.evidenceVersion) &&
          !provider.dispatchError!.corresponds(operation, start.request, evidence)
        )
          fail("error-correspondence", "Native dispatch error differs from the exact request")
      } else if (
        provider.classifyObservation!(
          operation,
          evidence,
          receipts.get(operation.operationId) ?? [],
        ) !== body.status
      )
        fail(
          "observation-classification",
          "Stored classification differs from native evidence and associated receipts",
        )
    }
  }
}
