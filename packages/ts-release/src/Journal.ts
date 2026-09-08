import type * as Effect from "effect/Effect"
import { JournalEvent, Plan } from "./internal/ReleaseModel.js"
import { fail, type ReleaseError } from "./internal/Error.js"
import { canonical } from "./internal/Identity.js"
import { assertRequestCorresponds, decodeObservationEvidence } from "./Provider.js"
import { evidenceContext, isCoreErrorVersion } from "./Provider.js"
import { nativeEvidence, type ProviderDefinition } from "./Provider.js"

export type Snapshot = Readonly<{ revision: number; events: ReadonlyArray<JournalEvent> }>
type RevisedAppend = "Appended" | "AlreadyRecorded" | "RevisionMismatch"
export type AppendResult =
  | { readonly _tag: RevisedAppend; readonly revision: number }
  | { readonly _tag: "AmbiguousStorageOutcome" }
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
  | { readonly _tag: "PublicationScope"; readonly plan: Plan }
  | { readonly _tag: "PreparationScope"; readonly plan: Plan }
export type JournalContext = Readonly<{ journalId: string; scopes: ReadonlyArray<Scope> }>
type Started = Extract<JournalEvent["body"], { readonly _tag: "DispatchStarted" }>
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
  const starts = new Map<string, Started>()
  const receipts = new Map<string, unknown[]>()
  const definition = (operationId: string) => {
    const operation = plan.operations.find((item) => item.operationId === operationId)
    if (!operation) fail("unknown-operation", "Evidence references an unknown operation")
    return {
      operation,
      provider: providers.find((item) => item.definitionId === operation.definitionId)!,
    }
  }
  const dispatched = (dispatchId: string, kind: string) => {
    const start = starts.get(dispatchId)
    if (!start) fail(`unassociated-${kind}`, `${kind} has no preceding dispatch`)
    return { start, ...definition(start.operationId) }
  }
  for (let index = 0; index < events.length; index++) {
    const { body } = events[index]!
    if (body._tag === "DispatchStarted") {
      const { operation, provider } = definition(body.operationId)
      assertRequestCorresponds(
        provider,
        operation,
        body.request,
        evidenceContext(plan, operation, events.slice(0, index)),
      )
      starts.set(body.dispatchId, body)
    }
    if (body._tag === "ReceiptAccepted") {
      const { start, operation, provider } = dispatched(body.dispatchId, "receipt")
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
      const { start, operation, provider } = dispatched(body.dispatchId, "rejection")
      const boundary = provider.rejection
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
      const { operation, provider } = definition(body.operationId)
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
          evidenceContext(plan, operation, events.slice(0, index)),
        ) !== body.status
      )
        fail(
          "observation-classification",
          "Stored classification differs from native evidence and associated receipts",
        )
    }
  }
}
