import { Buffer } from "node:buffer"
import { sha256Digest } from "../model/digest.js"
import {
  encodeCanonicalJson,
  parseStrictJson,
  type Json
} from "../model/canonical.js"
import {
  JournalInputError,
  JournalIntegrityError,
  journalRecordTags,
  operationJournalByteLimits,
  type JournalOperation,
  type JournalRecord,
  type JournalRecordTag,
  type JournalWorkflowCoordinate
} from "./model.js"

const encoder = new TextEncoder()
const decoder = new TextDecoder("utf-8", { fatal: true })

const releasePointPattern = /^[a-f0-9]{40}$/u
const operationKeyPattern = /^[a-f0-9]{64}$/u
const digestPattern = /^sha256:[a-f0-9]{64}$/u
const transactionIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u
const positiveDecimalPattern = /^[1-9][0-9]*$/u
const codecIdPattern = /^[A-Za-z0-9][A-Za-z0-9._/@-]{0,127}$/u
const etagPattern = /^"[!#-~]{1,1024}"$/u

const canonicalDigest = (bytes: Uint8Array): string => `sha256:${sha256Digest(bytes).hex}`

const failInput = (reason: string): never => {
  throw JournalInputError.make({ reason })
}

const failIntegrity = (reason: string): never => {
  throw JournalIntegrityError.make({ reason })
}

const isObject = (value: Json): value is { readonly [key: string]: Json } =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const exactObject = (
  value: Json,
  fields: ReadonlyArray<string>,
  label: string
): { readonly [key: string]: Json } => {
  if (!isObject(value)) failIntegrity(`${label} must be an object.`)
  const object = value as { readonly [key: string]: Json }
  const actual = Object.keys(object).sort()
  const expected = [...fields].sort()
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    failIntegrity(`${label} fields are not the exact canonical set.`)
  }
  return object
}

const stringField = (
  object: { readonly [key: string]: Json },
  field: string,
  label: string
): string => {
  const value = object[field]
  if (typeof value !== "string") failIntegrity(`${label}.${field} must be a string.`)
  return value as string
}

const integerField = (
  object: { readonly [key: string]: Json },
  field: string,
  label: string
): number => {
  const value = object[field]
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    failIntegrity(`${label}.${field} must be a safe integer.`)
  }
  return value as number
}

const assertPattern = (value: string, pattern: RegExp, label: string): string => {
  if (!pattern.test(value)) failIntegrity(`${label} is not canonical.`)
  return value
}

const assertInputPattern = (value: string, pattern: RegExp, label: string): string => {
  if (!pattern.test(value)) failInput(`${label} is not canonical.`)
  return value
}

export const isCanonicalS3VersionId = (value: string): boolean => {
  const bytes = encoder.encode(value)
  return value !== "null" && bytes.length >= 1 && bytes.length <= 1024 && decoder.decode(bytes) === value
}

const assertVersionId = (value: string, label: string): string => {
  if (!isCanonicalS3VersionId(value)) failIntegrity(`${label} is not a canonical retained S3 VersionId.`)
  return value
}

const decodeCanonical = (bytes: Uint8Array, label: string): Json => {
  if (!(bytes instanceof Uint8Array)) {
    failIntegrity(`${label} must be one Uint8Array.`)
  }
  if (bytes.length === 0 || bytes.length > operationJournalByteLimits.object) {
    failIntegrity(`${label} exceeds the admitted object byte bound.`)
  }
  let text: string
  let parsed: Json
  try {
    text = decoder.decode(bytes)
    parsed = parseStrictJson(text)
  } catch {
    return failIntegrity(`${label} is not strict UTF-8 canonical JSON.`)
  }
  if (encodeCanonicalJson(parsed) !== text) {
    failIntegrity(`${label} is not the canonical encoding of its value.`)
  }
  return parsed
}

const decodeBase64 = (value: string, label: string): Uint8Array => {
  const maximumEncodedLength = Math.ceil(operationJournalByteLimits.payload / 3) * 4
  if (value.length > maximumEncodedLength) {
    failIntegrity(`${label} exceeds the admitted payload byte bound.`)
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    failIntegrity(`${label} is not canonical base64.`)
  }
  const bytes = new Uint8Array(Buffer.from(value, "base64"))
  if (bytes.length > operationJournalByteLimits.payload || Buffer.from(bytes).toString("base64") !== value) {
    failIntegrity(`${label} is not canonical base64.`)
  }
  return bytes
}

export interface CanonicalJournalRecord {
  readonly tag: JournalRecordTag
  readonly codecId: string
  readonly payloadBase64: string
  readonly payloadDigest: string
}

export interface CanonicalJournalPredecessor {
  readonly eventDigest: string
  readonly headVersionId: string
  readonly headEtag: string
}

export interface CanonicalJournalEvent extends JournalOperation {
  readonly schemaVersion: "ts-release-operation-journal-event/v1"
  readonly sequence: number
  readonly transactionId: string
  readonly previous: CanonicalJournalPredecessor | null
  readonly workflow: JournalWorkflowCoordinate
  readonly record: CanonicalJournalRecord
}

export interface CanonicalJournalHead extends JournalOperation {
  readonly schemaVersion: "ts-release-operation-journal-head/v1"
  readonly sequence: number
  readonly transactionId: string
  readonly eventKey: string
  readonly eventVersionId: string
  readonly eventChecksumSha256: string
  readonly eventDigest: string
  readonly previousHeadVersionId: string | null
  readonly previousHeadEtag: string | null
}

export const validateJournalOperation = (operation: JournalOperation): JournalOperation => ({
  releasePoint: assertInputPattern(operation.releasePoint, releasePointPattern, "releasePoint"),
  operationKey: assertInputPattern(operation.operationKey, operationKeyPattern, "operationKey")
})

export const validateJournalWorkflow = (
  workflow: JournalWorkflowCoordinate
): JournalWorkflowCoordinate => ({
  repositoryId: assertInputPattern(workflow.repositoryId, positiveDecimalPattern, "workflow.repositoryId"),
  runId: assertInputPattern(workflow.runId, positiveDecimalPattern, "workflow.runId"),
  runAttempt: assertInputPattern(workflow.runAttempt, positiveDecimalPattern, "workflow.runAttempt")
})

export const validateTransactionId = (transactionId: string): string =>
  assertInputPattern(transactionId, transactionIdPattern, "transactionId")

export const deriveOperationKey = (canonicalOperationIdentity: Uint8Array): string => {
  if (!(canonicalOperationIdentity instanceof Uint8Array)) {
    failInput("Canonical operation identity must be one Uint8Array.")
  }
  if (canonicalOperationIdentity.length === 0 ||
      canonicalOperationIdentity.length > operationJournalByteLimits.operationIdentity) {
    failInput("Canonical operation identity exceeds its admitted byte bound.")
  }
  return sha256Digest(canonicalOperationIdentity).hex
}

export const journalNamespace = (
  operation: JournalOperation,
  prefix = "operation-journal/v1"
): string => {
  const valid = validateJournalOperation(operation)
  if (prefix !== "operation-journal/v1") failInput("Journal prefix must be operation-journal/v1.")
  return `${prefix}/${valid.releasePoint}/${valid.operationKey}/`
}

export const journalHeadKey = (operation: JournalOperation): string =>
  `${journalNamespace(operation)}head.bin`

export const journalEventKey = (
  operation: JournalOperation,
  sequence: number,
  transactionId: string
): string => {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 99_999_999) {
    failInput("Journal sequence must be an integer from 1 through 99999999.")
  }
  return `${journalNamespace(operation)}events/${String(sequence).padStart(8, "0")}/${validateTransactionId(transactionId)}.bin`
}

export const makeCanonicalJournalRecord = (input: {
  readonly tag: JournalRecordTag
  readonly codecId: string
  readonly payload: Uint8Array
}): CanonicalJournalRecord => {
  if (!journalRecordTags.includes(input.tag)) failInput("Journal record tag is not admitted.")
  if (!(input.payload instanceof Uint8Array)) {
    failInput("Journal payload must be one Uint8Array.")
  }
  if (input.payload.length > operationJournalByteLimits.payload) {
    failInput("Journal payload exceeds the admitted byte bound.")
  }
  const codecId = assertInputPattern(input.codecId, codecIdPattern, "codecId")
  const payload = new Uint8Array(input.payload)
  return {
    tag: input.tag,
    codecId,
    payloadBase64: Buffer.from(payload).toString("base64"),
    payloadDigest: canonicalDigest(payload)
  }
}

export const encodeJournalEvent = (event: CanonicalJournalEvent): Uint8Array =>
  encoder.encode(encodeCanonicalJson(event))

export const encodeJournalHead = (head: CanonicalJournalHead): Uint8Array =>
  encoder.encode(encodeCanonicalJson(head))

const decodeWorkflow = (value: Json): JournalWorkflowCoordinate => {
  const object = exactObject(value, ["repositoryId", "runAttempt", "runId"], "event.workflow")
  return {
    repositoryId: assertPattern(stringField(object, "repositoryId", "event.workflow"), positiveDecimalPattern, "event.workflow.repositoryId"),
    runId: assertPattern(stringField(object, "runId", "event.workflow"), positiveDecimalPattern, "event.workflow.runId"),
    runAttempt: assertPattern(stringField(object, "runAttempt", "event.workflow"), positiveDecimalPattern, "event.workflow.runAttempt")
  }
}

const decodeRecord = (value: Json): CanonicalJournalRecord => {
  const object = exactObject(value, ["codecId", "payloadBase64", "payloadDigest", "tag"], "event.record")
  const tag = stringField(object, "tag", "event.record")
  if (!journalRecordTags.includes(tag as JournalRecordTag)) failIntegrity("event.record.tag is not admitted.")
  const codecId = assertPattern(stringField(object, "codecId", "event.record"), codecIdPattern, "event.record.codecId")
  const payloadBase64 = stringField(object, "payloadBase64", "event.record")
  const payload = decodeBase64(payloadBase64, "event.record.payloadBase64")
  const payloadDigest = assertPattern(stringField(object, "payloadDigest", "event.record"), digestPattern, "event.record.payloadDigest")
  if (canonicalDigest(payload) !== payloadDigest) failIntegrity("event.record payload digest does not match its bytes.")
  return { tag: tag as JournalRecordTag, codecId, payloadBase64, payloadDigest }
}

const decodePredecessor = (value: Json): CanonicalJournalPredecessor | null => {
  if (value === null) return null
  const object = exactObject(value, ["eventDigest", "headEtag", "headVersionId"], "event.previous")
  return {
    eventDigest: assertPattern(stringField(object, "eventDigest", "event.previous"), digestPattern, "event.previous.eventDigest"),
    headVersionId: assertVersionId(stringField(object, "headVersionId", "event.previous"), "event.previous.headVersionId"),
    headEtag: assertPattern(stringField(object, "headEtag", "event.previous"), etagPattern, "event.previous.headEtag")
  }
}

export const decodeJournalEvent = (bytes: Uint8Array): CanonicalJournalEvent => {
  const object = exactObject(decodeCanonical(bytes, "Journal event"), [
    "operationKey",
    "previous",
    "record",
    "releasePoint",
    "schemaVersion",
    "sequence",
    "transactionId",
    "workflow"
  ], "event")
  if (stringField(object, "schemaVersion", "event") !== "ts-release-operation-journal-event/v1") {
    failIntegrity("Journal event schema version is unsupported.")
  }
  const schemaVersion = "ts-release-operation-journal-event/v1" as const
  const sequence = integerField(object, "sequence", "event")
  if (sequence < 1 || sequence > 99_999_999) failIntegrity("event.sequence is outside the admitted range.")
  return {
    schemaVersion,
    releasePoint: assertPattern(stringField(object, "releasePoint", "event"), releasePointPattern, "event.releasePoint"),
    operationKey: assertPattern(stringField(object, "operationKey", "event"), operationKeyPattern, "event.operationKey"),
    sequence,
    transactionId: assertPattern(stringField(object, "transactionId", "event"), transactionIdPattern, "event.transactionId"),
    previous: decodePredecessor(object.previous!),
    workflow: decodeWorkflow(object.workflow!),
    record: decodeRecord(object.record!)
  }
}

export const decodeJournalHead = (bytes: Uint8Array): CanonicalJournalHead => {
  const object = exactObject(decodeCanonical(bytes, "Journal head"), [
    "eventChecksumSha256",
    "eventDigest",
    "eventKey",
    "eventVersionId",
    "operationKey",
    "previousHeadEtag",
    "previousHeadVersionId",
    "releasePoint",
    "schemaVersion",
    "sequence",
    "transactionId"
  ], "head")
  if (stringField(object, "schemaVersion", "head") !== "ts-release-operation-journal-head/v1") {
    failIntegrity("Journal head schema version is unsupported.")
  }
  const schemaVersion = "ts-release-operation-journal-head/v1" as const
  const sequence = integerField(object, "sequence", "head")
  if (sequence < 1 || sequence > 99_999_999) failIntegrity("head.sequence is outside the admitted range.")
  const nullable = (field: "previousHeadVersionId" | "previousHeadEtag", pattern: RegExp): string | null => {
    const value = object[field]
    if (value === null) return null
    if (typeof value !== "string") failIntegrity(`head.${field} must be a string or null.`)
    return assertPattern(value as string, pattern, `head.${field}`)
  }
  return {
    schemaVersion,
    releasePoint: assertPattern(stringField(object, "releasePoint", "head"), releasePointPattern, "head.releasePoint"),
    operationKey: assertPattern(stringField(object, "operationKey", "head"), operationKeyPattern, "head.operationKey"),
    sequence,
    transactionId: assertPattern(stringField(object, "transactionId", "head"), transactionIdPattern, "head.transactionId"),
    eventKey: stringField(object, "eventKey", "head"),
    eventVersionId: assertVersionId(stringField(object, "eventVersionId", "head"), "head.eventVersionId"),
    eventChecksumSha256: assertPattern(stringField(object, "eventChecksumSha256", "head"), digestPattern, "head.eventChecksumSha256"),
    eventDigest: assertPattern(stringField(object, "eventDigest", "head"), digestPattern, "head.eventDigest"),
    previousHeadVersionId: (() => {
      const value = object.previousHeadVersionId
      if (value === null) return null
      if (typeof value !== "string") failIntegrity("head.previousHeadVersionId must be a string or null.")
      return assertVersionId(value as string, "head.previousHeadVersionId")
    })(),
    previousHeadEtag: nullable("previousHeadEtag", etagPattern)
  }
}

const canonicalObjectDigest = (bytes: Uint8Array, label: string): string => {
  if (!(bytes instanceof Uint8Array)) failIntegrity(`${label} must be one Uint8Array.`)
  if (bytes.length < 1 || bytes.length > operationJournalByteLimits.object) {
    failIntegrity(`${label} exceeds the admitted object byte bound.`)
  }
  return canonicalDigest(bytes)
}

export const eventDigest = (bytes: Uint8Array): string => canonicalObjectDigest(bytes, "Journal event")
export const objectChecksum = (bytes: Uint8Array): string => canonicalObjectDigest(bytes, "Journal object")

export const journalRecordFromEvent = (event: CanonicalJournalEvent): JournalRecord => ({
  tag: event.record.tag,
  codecId: event.record.codecId,
  payload: decodeBase64(event.record.payloadBase64, "event.record.payloadBase64"),
  payloadDigest: event.record.payloadDigest,
  sequence: event.sequence,
  transactionId: event.transactionId,
  workflow: event.workflow
})
