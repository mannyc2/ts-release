import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { encodeCanonicalJson, parseStrictJson } from "../model/canonical.js"
import {
  ArtifactBundle,
  ArtifactBundleManifestV1,
  BundleId,
  encodeArtifactBundleManifest
} from "./artifact-bundle.js"
import {
  DispatchId,
  DispatchRejectedBeforeCommit,
  DispatchStarted,
  JournalEntry,
  ObservationRecorded,
  PlanSuperseded,
  ReceiptAccepted,
  ReleaseJournal,
  RiskAccepted,
  decodeReleaseJournal,
  encodeReleaseJournal
} from "./journal.js"
import {
  PlanId,
  PlannedOperationV1,
  ReleasePlanV1,
  encodeReleasePlan
} from "./release-plan.js"

const NonNegativeInteger = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0))

/** A provider-local interpretation of one native durable observation. */
export const ObservationConclusion = Schema.Literals([
  "satisfied",
  "conflict",
  "pending",
  "inconclusive"
])
export type ObservationConclusion = typeof ObservationConclusion.Type

export interface ObservationClassificationInput {
  readonly operation: PlannedOperationV1
  readonly revision: number
  readonly observation: ObservationRecorded
}

/** Optional pure projection supplied by the provider module that owns the observation codec. */
export type ObservationClassifier = (
  input: ObservationClassificationInput
) => ObservationConclusion | undefined

export class OperationNotDispatched
  extends Schema.TaggedClass<OperationNotDispatched>()("OperationNotDispatched", {}) {}

export class OperationDispatchRejected
  extends Schema.TaggedClass<OperationDispatchRejected>()("OperationDispatchRejected", {
    dispatchId: DispatchId,
    dispatchRevision: PositiveInteger,
    rejectionRevision: PositiveInteger
  }) {}

export class OperationReceiptAccepted
  extends Schema.TaggedClass<OperationReceiptAccepted>()("OperationReceiptAccepted", {
    dispatchId: DispatchId,
    dispatchRevision: PositiveInteger,
    receiptRevision: PositiveInteger
  }) {}

export class OperationObservationConcluded
  extends Schema.TaggedClass<OperationObservationConcluded>()("OperationObservationConcluded", {
    dispatchId: Schema.optionalKey(DispatchId),
    observationRevision: PositiveInteger,
    conclusion: ObservationConclusion
  }) {}

export class OperationRiskAccepted
  extends Schema.TaggedClass<OperationRiskAccepted>()("OperationRiskAccepted", {
    dispatchId: Schema.optionalKey(DispatchId),
    riskRevision: PositiveInteger
  }) {}

/** A send may have committed; this state never implies permission to replay it. */
export class OperationReconciliationRequired
  extends Schema.TaggedClass<OperationReconciliationRequired>()("OperationReconciliationRequired", {
    dispatchId: DispatchId,
    dispatchRevision: PositiveInteger,
    observationRevisions: Schema.Array(PositiveInteger)
  }) {}

export const ReleaseOperationProgress = Schema.Union([
  OperationNotDispatched,
  OperationDispatchRejected,
  OperationReceiptAccepted,
  OperationObservationConcluded,
  OperationRiskAccepted,
  OperationReconciliationRequired
])
export type ReleaseOperationProgress = typeof ReleaseOperationProgress.Type

export class ReleaseOperationReportV1
  extends Schema.Class<ReleaseOperationReportV1>("ReleaseOperationReportV1")({
    operation: PlannedOperationV1,
    history: Schema.Array(JournalEntry),
    progress: ReleaseOperationProgress
  }) {}

export class ReleaseReportV1 extends Schema.Class<ReleaseReportV1>("ReleaseReportV1")({
  schemaVersion: Schema.Literal("release-report/v1"),
  bundleId: BundleId,
  bundleManifest: ArtifactBundleManifestV1,
  planId: PlanId,
  journalRevision: NonNegativeInteger,
  planHistory: Schema.Array(JournalEntry),
  operations: Schema.Array(ReleaseOperationReportV1)
}) {}

export class ReleaseReportDerivationError
  extends Schema.TaggedErrorClass<ReleaseReportDerivationError>()("ReleaseReportDerivationError", {
    reason: Schema.NonEmptyString
  }) {}

export interface DeriveReleaseReportInput {
  readonly bundle: ArtifactBundle
  readonly plan: ReleasePlanV1
  readonly journal: ReleaseJournal
  readonly classifyObservation?: ObservationClassifier
}

const encodeReleaseReportValue = Schema.encodeSync(ReleaseReportV1)
const decodeReleaseReportValue = Schema.decodeUnknownSync(ReleaseReportV1, {
  onExcessProperty: "error"
})

export const encodeReleaseReport = (report: ReleaseReportV1): string =>
  encodeCanonicalJson(encodeReleaseReportValue(report))

/** Structural canonical parser only; authoritative reports are always re-derived below. */
export const decodeReleaseReport = (canonicalText: string): ReleaseReportV1 => {
  const report = decodeReleaseReportValue(parseStrictJson(canonicalText))
  if (encodeReleaseReport(report) !== canonicalText) {
    throw new Error("Release report text is not canonical.")
  }
  return report
}

interface DispatchRecord {
  readonly operationId: string
  readonly entry: JournalEntry
  readonly event: DispatchStarted
  receipt?: JournalEntry
  rejection?: JournalEntry
}

const eventOperationId = (entry: JournalEntry): string | undefined =>
  entry.event._tag === "PlanSuperseded" ? undefined : entry.event.operationId

const reason = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

const assertJournalHistory = (
  plan: ReleasePlanV1,
  journal: ReleaseJournal
): {
  readonly operationHistory: ReadonlyMap<string, ReadonlyArray<JournalEntry>>
  readonly planHistory: ReadonlyArray<JournalEntry>
} => {
  const operations = new Map(plan.operations.map((operation) => [operation.operationId.toString(), operation]))
  const operationHistory = new Map<string, Array<JournalEntry>>(
    plan.operations.map((operation) => [operation.operationId.toString(), []])
  )
  const planHistory: Array<JournalEntry> = []
  const dispatches = new Map<string, DispatchRecord>()
  const acceptedOperations = new Set<string>()
  let superseded: JournalEntry | undefined

  for (const entry of journal.entries) {
    const operationId = eventOperationId(entry)
    if (operationId === undefined) {
      if (!(entry.event instanceof PlanSuperseded)) throw new Error("Journal contains an unknown plan event.")
      if (superseded !== undefined) throw new Error("Journal contains more than one PlanSuperseded event.")
      if (entry.event.supersedingPlanId === plan.planId) {
        throw new Error("A release plan cannot supersede itself.")
      }
      superseded = entry
      planHistory.push(entry)
      continue
    }
    const operation = operations.get(operationId)
    const history = operationHistory.get(operationId)
    if (operation === undefined || history === undefined) {
      throw new Error(`Journal references unknown operation ${operationId}.`)
    }
    history.push(entry)

    const event = entry.event
    if (event instanceof DispatchStarted) {
      if (superseded !== undefined) {
        throw new Error(`Operation ${operationId} dispatched after PlanSuperseded.`)
      }
      if (acceptedOperations.has(operationId)) {
        throw new Error(`Operation ${operationId} dispatched after an accepted receipt.`)
      }
      if (event.providerDefinitionId !== operation.intent.providerDefinitionId) {
        throw new Error(`Dispatch ${event.dispatchId} names the wrong provider definition.`)
      }
      if (dispatches.has(event.dispatchId)) {
        throw new Error(`Journal repeats dispatch ${event.dispatchId}.`)
      }
      if ([...dispatches.values()].some((dispatch) => dispatch.operationId === operationId)) {
        throw new Error(`Operation ${operationId} has more than one dispatch in journal v1.`)
      }
      if (event.attempt !== 1) {
        throw new Error(`Operation ${operationId} journal v1 dispatch attempt must be one.`)
      }
      dispatches.set(event.dispatchId, { operationId, entry, event })
      continue
    }

    if (event instanceof DispatchRejectedBeforeCommit || event instanceof ReceiptAccepted) {
      const dispatch = dispatches.get(event.dispatchId)
      if (dispatch === undefined || dispatch.operationId !== operationId) {
        throw new Error(`Event for operation ${operationId} references unknown dispatch ${event.dispatchId}.`)
      }
      if (dispatch.receipt !== undefined || dispatch.rejection !== undefined) {
        throw new Error(`Dispatch ${event.dispatchId} has more than one terminal response event.`)
      }
      if (event instanceof ReceiptAccepted) {
        dispatch.receipt = entry
        acceptedOperations.add(operationId)
      }
      else dispatch.rejection = entry
      continue
    }

    if (event instanceof ObservationRecorded || event instanceof RiskAccepted) {
      if (superseded !== undefined && event.dispatchId === undefined) {
        throw new Error(`Unlinked evidence for operation ${operationId} was recorded after PlanSuperseded.`)
      }
      if (event.dispatchId !== undefined) {
        const dispatch = dispatches.get(event.dispatchId)
        if (dispatch === undefined || dispatch.operationId !== operationId) {
          throw new Error(`Event for operation ${operationId} references unknown dispatch ${event.dispatchId}.`)
        }
      }
    }
  }

  return { operationHistory, planHistory }
}

const progressFor = (
  operation: PlannedOperationV1,
  history: ReadonlyArray<JournalEntry>,
  classifyObservation: ObservationClassifier | undefined
): ReleaseOperationProgress => {
  let dispatchEntry: JournalEntry | undefined
  for (const entry of history) {
    if (entry.event instanceof DispatchStarted) dispatchEntry = entry
  }
  const dispatch = dispatchEntry?.event as DispatchStarted | undefined
  const relevant = dispatchEntry === undefined || dispatch === undefined
    ? history
    : history.filter((entry) => entry.revision >= dispatchEntry.revision && (
      !(entry.event instanceof ObservationRecorded || entry.event instanceof RiskAccepted) ||
      entry.event.dispatchId === undefined ||
      entry.event.dispatchId === dispatch.dispatchId
    ))

  const candidates: Array<{ readonly revision: number; readonly progress: ReleaseOperationProgress }> = []
  let accepted: OperationReceiptAccepted | undefined
  let rejected: OperationDispatchRejected | undefined
  for (const entry of relevant) {
    const event = entry.event
    if (event instanceof ReceiptAccepted && dispatchEntry !== undefined && event.dispatchId === dispatch?.dispatchId) {
      accepted = OperationReceiptAccepted.make({
        dispatchId: event.dispatchId,
        dispatchRevision: dispatchEntry.revision,
        receiptRevision: entry.revision
      })
      continue
    }
    if (event instanceof DispatchRejectedBeforeCommit && dispatchEntry !== undefined &&
        event.dispatchId === dispatch?.dispatchId) {
      rejected = OperationDispatchRejected.make({
        dispatchId: event.dispatchId,
        dispatchRevision: dispatchEntry.revision,
        rejectionRevision: entry.revision
      })
      continue
    }
    if (event instanceof ObservationRecorded && classifyObservation !== undefined) {
      const conclusion = classifyObservation({ operation, revision: entry.revision, observation: event })
      if (conclusion !== undefined) {
        candidates.push({
          revision: entry.revision,
          progress: OperationObservationConcluded.make({
            ...(event.dispatchId === undefined ? {} : { dispatchId: event.dispatchId }),
            observationRevision: entry.revision,
            conclusion
          })
        })
      }
      continue
    }
    if (event instanceof RiskAccepted) {
      candidates.push({
        revision: entry.revision,
        progress: OperationRiskAccepted.make({
          ...(event.dispatchId === undefined ? {} : { dispatchId: event.dispatchId }),
          riskRevision: entry.revision
        })
      })
    }
  }

  if (accepted !== undefined) return accepted
  if (rejected !== undefined) return rejected
  const latest = candidates.reduce<undefined | { readonly revision: number; readonly progress: ReleaseOperationProgress }>(
    (current, candidate) => current === undefined || candidate.revision > current.revision ? candidate : current,
    undefined
  )
  if (latest !== undefined) {
    if (dispatchEntry !== undefined && dispatch !== undefined &&
        latest.progress instanceof OperationObservationConcluded &&
        (latest.progress.conclusion === "pending" || latest.progress.conclusion === "inconclusive")) {
      const priorConclusive = [...candidates].reverse().find((candidate) =>
        candidate.progress instanceof OperationObservationConcluded &&
        (candidate.progress.conclusion === "satisfied" || candidate.progress.conclusion === "conflict"))
      if (priorConclusive !== undefined) return priorConclusive.progress
      return OperationReconciliationRequired.make({
        dispatchId: dispatch.dispatchId,
        dispatchRevision: dispatchEntry.revision,
        observationRevisions: relevant
          .filter((entry) => entry.event instanceof ObservationRecorded)
          .map((entry) => entry.revision)
      })
    }
    return latest.progress
  }
  if (dispatchEntry === undefined || dispatch === undefined) return OperationNotDispatched.make({})

  return OperationReconciliationRequired.make({
    dispatchId: dispatch.dispatchId,
    dispatchRevision: dispatchEntry.revision,
    observationRevisions: relevant
      .filter((entry) => entry.event instanceof ObservationRecorded)
      .map((entry) => entry.revision)
  })
}

/** Pure projection of canonical bundle, plan, and journal facts; it performs no observation or mutation. */
export const deriveReleaseReport = Effect.fn("ReleaseReport.derive")(function*(
  input: DeriveReleaseReportInput
) {
  yield* encodeReleasePlan({ plan: input.plan, bundle: input.bundle }).pipe(
    Effect.mapError((cause) => ReleaseReportDerivationError.make({ reason: cause.reason }))
  )
  return yield* Effect.try({
    try: () => {
      encodeArtifactBundleManifest(input.bundle.manifest)
      if (input.plan.bundleId !== input.bundle.bundleId) {
        throw new Error("Release plan does not belong to the supplied bundle.")
      }
      if (input.journal.planId !== input.plan.planId) {
        throw new Error("Release journal does not belong to the supplied plan.")
      }

      const journal = decodeReleaseJournal(encodeReleaseJournal(input.journal))
      const { operationHistory, planHistory } = assertJournalHistory(input.plan, journal)
      const report = ReleaseReportV1.make({
        schemaVersion: "release-report/v1",
        bundleId: input.bundle.bundleId,
        bundleManifest: input.bundle.manifest,
        planId: input.plan.planId,
        journalRevision: journal.revision,
        planHistory,
        operations: input.plan.operations.map((operation) => {
          const history = operationHistory.get(operation.operationId.toString()) ?? []
          return ReleaseOperationReportV1.make({
            operation,
            history,
            progress: progressFor(operation, history, input.classifyObservation)
          })
        })
      })
      return decodeReleaseReport(encodeReleaseReport(report))
    },
    catch: (cause) => ReleaseReportDerivationError.make({ reason: reason(cause) })
  })
})
