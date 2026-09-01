import { describe, expect, test } from "bun:test"
import {
  JournalInputError,
  JournalIntegrityError,
  JournalTransitionError,
  admitJournalTransition,
  deriveOperationKey,
  journalEventKey,
  journalHeadKey,
  journalNamespace,
  operationJournalByteLimits
} from "../../src/operation-journal.js"
import {
  decodeJournalEvent,
  encodeJournalEvent,
  makeCanonicalJournalRecord,
  objectChecksum
} from "../../src/operation-journal/canonical.js"
import { makeJournalEvent } from "../../src/operation-journal/reducer.js"

const operation = {
  releasePoint: "a".repeat(40),
  operationKey: "b".repeat(64)
}

describe("canonical operation journal model", () => {
  test("derives one lowercase SHA-256 operation key and closed namespace", () => {
    expect(deriveOperationKey(new TextEncoder().encode("exact-operation/v1\n"))).toBe(
      "f778eefcdab6be1eb9d7d219939be28fe09e9efea60040e6003c9ce81986bf9e"
    )
    expect(journalNamespace(operation)).toBe(
      `operation-journal/v1/${"a".repeat(40)}/${"b".repeat(64)}/`
    )
    expect(journalHeadKey(operation)).toBe(`${journalNamespace(operation)}head.bin`)
    expect(journalEventKey(
      operation,
      7,
      "00000000-0000-4000-8000-000000000007"
    )).toBe(`${journalNamespace(operation)}events/00000007/00000000-0000-4000-8000-000000000007.bin`)
  })

  test("admits only the hard-cut finite state machine", () => {
    expect(admitJournalTransition("Empty", "IntentRecorded")).toBe("IntentRecorded")
    expect(admitJournalTransition("IntentRecorded", "ReceiptRecorded")).toBe("ReceiptRecorded")
    expect(admitJournalTransition("IntentRecorded", "OutcomeUnknown")).toBe("OutcomeUnknown")
    expect(admitJournalTransition("ReceiptRecorded", "TerminalRecorded")).toBe("TerminalRecorded")
    expect(admitJournalTransition("ObservationRecorded", "ObservationRecorded")).toBe("ObservationRecorded")
    expect(() => admitJournalTransition("Empty", "ReceiptRecorded")).toThrow(JournalTransitionError)
    expect(() => admitJournalTransition("IntentRecorded", "IntentRecorded")).toThrow(JournalTransitionError)
    expect(() => admitJournalTransition("OutcomeUnknown", "ReceiptRecorded")).toThrow(JournalTransitionError)
    expect(() => admitJournalTransition("TerminalRecorded", "ObservationRecorded")).toThrow(JournalTransitionError)
  })

  test("rejects noncanonical coordinates before storage", () => {
    expect(() => journalNamespace({ ...operation, releasePoint: "A".repeat(40) })).toThrow(JournalInputError)
    expect(() => journalNamespace({ ...operation, operationKey: `${"b".repeat(63)}/` })).toThrow(JournalInputError)
    expect(() => journalEventKey(operation, 0, "00000000-0000-4000-8000-000000000007")).toThrow(JournalInputError)
    expect(() => deriveOperationKey(new Uint8Array())).toThrow(JournalInputError)
    expect(() => deriveOperationKey(
      new Uint8Array(operationJournalByteLimits.operationIdentity + 1)
    )).toThrow(JournalInputError)
    expect(() => deriveOperationKey("identity" as never)).toThrow(JournalInputError)
  })

  test("bounds consumer payloads and every canonical object before allocation", () => {
    expect(operationJournalByteLimits).toEqual({
      operationIdentity: 65_536,
      payload: 1_048_576,
      object: 1_500_000
    })
    expect(() => makeCanonicalJournalRecord({
      tag: "IntentRecorded",
      codecId: "fixture/v1",
      payload: "not-bytes" as never
    })).toThrow(JournalInputError)
    expect(() => makeCanonicalJournalRecord({
      tag: "IntentRecorded",
      codecId: "fixture/v1",
      payload: new Uint8Array(operationJournalByteLimits.payload + 1)
    })).toThrow(JournalInputError)
    try {
      decodeJournalEvent(new Uint8Array(operationJournalByteLimits.object + 1))
      throw new Error("Expected oversized object rejection")
    } catch (cause) {
      expect(cause).toMatchObject({ reason: expect.stringContaining("object byte bound") })
    }
    expect(() => decodeJournalEvent("{}" as never)).toThrow(JournalIntegrityError)
    expect(() => objectChecksum("object" as never)).toThrow(JournalIntegrityError)

    const record = makeCanonicalJournalRecord({
      tag: "IntentRecorded",
      codecId: "fixture/v1",
      payload: new Uint8Array(operationJournalByteLimits.payload)
    })
    const event = makeJournalEvent({
      ...operation,
      sequence: 1,
      transactionId: "00000000-0000-4000-8000-000000000001",
      previous: null,
      previousHead: null,
      workflow: { repositoryId: "1", runId: "1", runAttempt: "1" },
      record
    })
    expect(encodeJournalEvent(event).length).toBeLessThanOrEqual(operationJournalByteLimits.object)
  })
})
