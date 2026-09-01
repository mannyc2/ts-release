import {
  JournalIntegrityError,
  JournalTransitionError,
  type JournalRecordTag,
  type JournalStateTag
} from "./model.js"
import type {
  CanonicalJournalEvent,
  CanonicalJournalHead,
  CanonicalJournalRecord
} from "./canonical.js"

const admittedTransitions: Readonly<Record<JournalStateTag, ReadonlySet<JournalRecordTag>>> = {
  Empty: new Set(["IntentRecorded"]),
  IntentRecorded: new Set(["ReceiptRecorded", "OutcomeUnknown"]),
  ReceiptRecorded: new Set(["ObservationRecorded", "TerminalRecorded"]),
  ObservationRecorded: new Set(["ObservationRecorded", "TerminalRecorded"]),
  TerminalRecorded: new Set(),
  OutcomeUnknown: new Set()
}

export const admitJournalTransition = (
  state: JournalStateTag,
  next: JournalRecordTag
): JournalRecordTag => {
  if (!admittedTransitions[state].has(next)) {
    throw JournalTransitionError.make({
      reason: `Journal transition ${state} -> ${next} is not admitted.`
    })
  }
  return next
}

export const reduceJournalEvents = (
  events: ReadonlyArray<CanonicalJournalEvent>
): JournalStateTag => {
  let state: JournalStateTag = "Empty"
  let expectedSequence = 1
  const transactions = new Set<string>()
  for (const event of events) {
    if (event.sequence !== expectedSequence) {
      throw JournalIntegrityError.make({ reason: "Reachable journal sequences are not contiguous from one." })
    }
    if (transactions.has(event.transactionId)) {
      throw JournalIntegrityError.make({ reason: "Reachable journal chain repeats a transaction ID." })
    }
    transactions.add(event.transactionId)
    try {
      admitJournalTransition(state, event.record.tag)
    } catch (cause) {
      if (cause instanceof JournalTransitionError) {
        throw JournalIntegrityError.make({ reason: cause.reason })
      }
      throw cause
    }
    state = event.record.tag
    expectedSequence += 1
  }
  return state
}

export const makeJournalEvent = (input: {
  readonly releasePoint: string
  readonly operationKey: string
  readonly sequence: number
  readonly transactionId: string
  readonly previous: CanonicalJournalEvent | null
  readonly previousHead: {
    readonly versionId: string
    readonly etag: string
    readonly eventDigest: string
  } | null
  readonly workflow: CanonicalJournalEvent["workflow"]
  readonly record: CanonicalJournalRecord
}): CanonicalJournalEvent => ({
  schemaVersion: "ts-release-operation-journal-event/v1",
  releasePoint: input.releasePoint,
  operationKey: input.operationKey,
  sequence: input.sequence,
  transactionId: input.transactionId,
  previous: input.previous === null || input.previousHead === null
    ? null
    : {
      eventDigest: input.previousHead.eventDigest,
      headVersionId: input.previousHead.versionId,
      headEtag: input.previousHead.etag
    },
  workflow: input.workflow,
  record: input.record
})

export const makeJournalHead = (input: {
  readonly event: CanonicalJournalEvent
  readonly eventKey: string
  readonly eventVersionId: string
  readonly eventChecksumSha256: string
  readonly eventDigest: string
  readonly previousHeadVersionId: string | null
  readonly previousHeadEtag: string | null
}): CanonicalJournalHead => ({
  schemaVersion: "ts-release-operation-journal-head/v1",
  releasePoint: input.event.releasePoint,
  operationKey: input.event.operationKey,
  sequence: input.event.sequence,
  transactionId: input.event.transactionId,
  eventKey: input.eventKey,
  eventVersionId: input.eventVersionId,
  eventChecksumSha256: input.eventChecksumSha256,
  eventDigest: input.eventDigest,
  previousHeadVersionId: input.previousHeadVersionId,
  previousHeadEtag: input.previousHeadEtag
})
