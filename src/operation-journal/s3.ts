import { randomUUID } from "node:crypto"
import * as Effect from "effect/Effect"
import { encodeCanonicalJson } from "../model/canonical.js"
import {
  decodeJournalEvent,
  decodeJournalHead,
  encodeJournalEvent,
  encodeJournalHead,
  eventDigest,
  isCanonicalS3VersionId,
  journalEventKey,
  journalHeadKey,
  journalNamespace,
  journalRecordFromEvent,
  makeCanonicalJournalRecord,
  objectChecksum,
  validateJournalOperation,
  validateJournalWorkflow,
  validateTransactionId,
  type CanonicalJournalEvent,
  type CanonicalJournalHead,
  type CanonicalJournalRecord
} from "./canonical.js"
import { validateS3JournalAuthority } from "./authority.js"
import {
  CanonicalOperationJournalShape,
  JournalAuthorityMismatch,
  JournalConflict,
  JournalInputError,
  JournalIntegrityError,
  JournalStorageOutcomeUnknown,
  JournalStorageUnavailable,
  JournalTransitionError,
  S3JournalBoundaryError,
  type JournalAcknowledgement,
  type JournalAppendError,
  type JournalAppendRequest,
  type JournalOperation,
  type JournalReadError,
  type JournalSnapshot,
  type S3JournalAuthority,
  type S3JournalBoundaryShape,
  type S3JournalNamespaceListing,
  type S3JournalObjectVersion,
  type S3JournalPutRequest,
  type S3JournalPutResult
} from "./model.js"
import {
  admitJournalTransition,
  makeJournalEvent,
  makeJournalHead,
  reduceJournalEvents
} from "./reducer.js"

interface LoadedEntry {
  readonly headObject: S3JournalObjectVersion
  readonly head: CanonicalJournalHead
  readonly eventObject: S3JournalObjectVersion
  readonly event: CanonicalJournalEvent
}

interface LoadedOrphan {
  readonly eventObject: S3JournalObjectVersion
  readonly event: CanonicalJournalEvent
}

interface LoadedJournal {
  readonly authority: S3JournalAuthority
  readonly operation: JournalOperation
  readonly entries: ReadonlyArray<LoadedEntry>
  readonly orphans: ReadonlyArray<LoadedOrphan>
  readonly state: JournalSnapshot["state"]
}

const pureInput = <A>(evaluate: () => A): Effect.Effect<A, JournalInputError> => Effect.try({
  try: evaluate,
  catch: (cause) => cause instanceof JournalInputError
    ? cause
    : JournalInputError.make({ reason: "Journal input validation failed." })
})

const pureIntegrity = <A>(evaluate: () => A): Effect.Effect<A, JournalIntegrityError> => Effect.try({
  try: evaluate,
  catch: (cause) => cause instanceof JournalIntegrityError
    ? cause
    : JournalIntegrityError.make({
      reason: cause instanceof JournalInputError || cause instanceof JournalTransitionError
        ? cause.reason
        : "Journal canonical validation failed."
    })
})

const pureTransition = <A>(evaluate: () => A): Effect.Effect<A, JournalTransitionError> => Effect.try({
  try: evaluate,
  catch: (cause) => cause instanceof JournalTransitionError
    ? cause
    : JournalTransitionError.make({ reason: "Journal transition validation failed." })
})

const safeReason = (error: S3JournalBoundaryError): string =>
  `S3 journal ${error.operation} boundary failed with ${error.commitment} commitment.`

const readBoundary = <A>(
  effect: Effect.Effect<A, S3JournalBoundaryError>
): Effect.Effect<A, JournalStorageUnavailable> => effect.pipe(Effect.mapError((error) =>
  JournalStorageUnavailable.make({ reason: safeReason(error) })
))

const postMutationRead = <A>(
  effect: Effect.Effect<A, S3JournalBoundaryError>
): Effect.Effect<A, JournalStorageOutcomeUnknown> => effect.pipe(Effect.mapError((error) =>
  JournalStorageOutcomeUnknown.make({ reason: safeReason(error) })
))

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

const objectIdentity = (key: string, versionId: string): string => `${key}\u0000${versionId}`

const canonicalAuthority = (authority: S3JournalAuthority): string => encodeCanonicalJson(authority)

const observeAuthority = (
  expected: S3JournalAuthority,
  client: S3JournalBoundaryShape
): Effect.Effect<S3JournalAuthority, JournalAuthorityMismatch | JournalStorageUnavailable> => Effect.gen(function*() {
  yield* Effect.try({
    try: () => validateS3JournalAuthority(expected),
    catch: (cause) => cause instanceof JournalAuthorityMismatch
      ? cause
      : JournalAuthorityMismatch.make({ reason: "Expected journal authority is malformed." })
  })
  const observed = yield* readBoundary(client.observeAuthority())
  yield* Effect.try({
    try: () => validateS3JournalAuthority(observed),
    catch: (cause) => cause instanceof JournalAuthorityMismatch
      ? cause
      : JournalAuthorityMismatch.make({ reason: "Observed journal authority is malformed." })
  })
  if (canonicalAuthority(observed) !== canonicalAuthority(expected)) {
    return yield* JournalAuthorityMismatch.make({ reason: "Observed journal authority drifted from the exact expected identity and policy." })
  }
  return observed
})

const minimumTenYearRetentionMilliseconds = 10 * 365 * 24 * 60 * 60 * 1_000

const validateRetainedObject = (
  object: S3JournalObjectVersion,
  expectedKey: string,
  expectedVersionId?: string,
  expectedEtag?: string
): void => {
  if (object.key !== expectedKey || (expectedVersionId !== undefined && object.versionId !== expectedVersionId) ||
      (expectedEtag !== undefined && object.etag !== expectedEtag)) {
    throw JournalIntegrityError.make({ reason: "Journal object identity disagrees with its exact version listing." })
  }
  if (!isCanonicalS3VersionId(object.versionId) || !/^"[!#-~]{1,1024}"$/u.test(object.etag)) {
    throw JournalIntegrityError.make({ reason: "Journal object version or ETag is not canonical." })
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(object.checksumSha256) ||
      object.checksumSha256 !== objectChecksum(object.bytes)) {
    throw JournalIntegrityError.make({ reason: "Journal object checksum does not match its exact bytes." })
  }
  const modified = new Date(object.lastModified)
  const retained = new Date(object.retainUntil)
  if (Number.isNaN(modified.getTime()) || modified.toISOString() !== object.lastModified ||
      Number.isNaN(retained.getTime()) || retained.toISOString() !== object.retainUntil ||
      object.retentionMode !== "COMPLIANCE" ||
      retained.getTime() - modified.getTime() < minimumTenYearRetentionMilliseconds) {
    throw JournalIntegrityError.make({ reason: "Journal object is not retained in COMPLIANCE mode for the required ten years." })
  }
}

function listOperation(
  authority: S3JournalAuthority,
  operation: JournalOperation,
  maximum: number,
  client: S3JournalBoundaryShape,
  afterMutation: true
): Effect.Effect<S3JournalNamespaceListing, JournalStorageOutcomeUnknown>
function listOperation(
  authority: S3JournalAuthority,
  operation: JournalOperation,
  maximum: number,
  client: S3JournalBoundaryShape,
  afterMutation: false
): Effect.Effect<S3JournalNamespaceListing, JournalStorageUnavailable>
function listOperation(
  authority: S3JournalAuthority,
  operation: JournalOperation,
  maximum: number,
  client: S3JournalBoundaryShape,
  afterMutation: boolean
): Effect.Effect<S3JournalNamespaceListing, JournalStorageUnavailable | JournalStorageOutcomeUnknown> {
  const request = {
    bucketName: authority.bucketName,
    expectedBucketOwner: authority.expectedBucketOwner,
    region: authority.region,
    prefix: journalNamespace(operation),
    maximum
  }
  return afterMutation
    ? postMutationRead(client.listNamespace(request))
    : readBoundary(client.listNamespace(request))
}

function getObject(
  authority: S3JournalAuthority,
  key: string,
  versionId: string,
  client: S3JournalBoundaryShape,
  afterMutation: true
): Effect.Effect<S3JournalObjectVersion, JournalStorageOutcomeUnknown>
function getObject(
  authority: S3JournalAuthority,
  key: string,
  versionId: string,
  client: S3JournalBoundaryShape,
  afterMutation: false
): Effect.Effect<S3JournalObjectVersion, JournalStorageUnavailable>
function getObject(
  authority: S3JournalAuthority,
  key: string,
  versionId: string,
  client: S3JournalBoundaryShape,
  afterMutation: boolean
): Effect.Effect<S3JournalObjectVersion, JournalStorageUnavailable | JournalStorageOutcomeUnknown> {
  const request = {
    bucketName: authority.bucketName,
    expectedBucketOwner: authority.expectedBucketOwner,
    region: authority.region,
    key,
    versionId
  }
  return afterMutation
    ? postMutationRead(client.getObjectVersion(request))
    : readBoundary(client.getObjectVersion(request))
}

const loadJournal = (input: {
  readonly expectedAuthority: S3JournalAuthority
  readonly client: S3JournalBoundaryShape
  readonly operation: JournalOperation
  readonly maximum: number
  readonly allowStandaloneOrphans: boolean
  readonly afterMutation?: boolean
}): Effect.Effect<LoadedJournal, JournalReadError | JournalStorageOutcomeUnknown> => Effect.gen(function*() {
  const operation = yield* pureInput(() => validateJournalOperation(input.operation))
  const authority = input.afterMutation === true
    ? yield* observeAuthority(input.expectedAuthority, input.client).pipe(Effect.mapError((error) =>
      error instanceof JournalStorageUnavailable
        ? JournalStorageOutcomeUnknown.make({ reason: error.reason })
        : error
    ))
    : yield* observeAuthority(input.expectedAuthority, input.client)
  if (operation.releasePoint !== authority.oidc.sha) {
    return yield* JournalAuthorityMismatch.make({
      reason: "Journal release point does not equal the exact caller SHA."
    })
  }
  const listing = input.afterMutation === true
    ? yield* listOperation(authority, operation, input.maximum, input.client, true)
    : yield* listOperation(authority, operation, input.maximum, input.client, false)
  if (listing.truncated || listing.versions.length > input.maximum) {
    if (input.afterMutation === true) {
      return yield* JournalStorageOutcomeUnknown.make({ reason: "Journal namespace exceeded the bounded authoritative re-read." })
    }
    return yield* JournalIntegrityError.make({ reason: "Journal namespace exceeded the bounded authoritative read." })
  }
  if (listing.deleteMarkers.length > 0) {
    return yield* JournalIntegrityError.make({ reason: "Journal namespace contains a forbidden delete marker." })
  }
  const namespace = journalNamespace(operation)
  const headKey = journalHeadKey(operation)
  const eventPattern = new RegExp(`^${namespace.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}events/[0-9]{8}/[a-f0-9-]{36}\\.bin$`, "u")
  const metadataIds = new Set<string>()
  const latestByKey = new Map<string, number>()
  for (const metadata of listing.versions) {
    if (metadata.key !== headKey && !eventPattern.test(metadata.key)) {
      return yield* JournalIntegrityError.make({ reason: "Journal namespace contains an unadmitted object key." })
    }
    const identity = objectIdentity(metadata.key, metadata.versionId)
    if (metadataIds.has(identity)) {
      return yield* JournalIntegrityError.make({ reason: "Journal version listing repeats an object version." })
    }
    metadataIds.add(identity)
    if (metadata.isLatest) latestByKey.set(metadata.key, (latestByKey.get(metadata.key) ?? 0) + 1)
  }
  for (const key of new Set(listing.versions.map((version) => version.key))) {
    if (latestByKey.get(key) !== 1) {
      return yield* JournalIntegrityError.make({ reason: "Journal object key does not have exactly one latest version." })
    }
  }
  const objects = new Map<string, S3JournalObjectVersion>()
  for (const metadata of listing.versions) {
    const object = input.afterMutation === true
      ? yield* getObject(authority, metadata.key, metadata.versionId, input.client, true)
      : yield* getObject(authority, metadata.key, metadata.versionId, input.client, false)
    yield* pureIntegrity(() => validateRetainedObject(object, metadata.key, metadata.versionId, metadata.etag))
    objects.set(objectIdentity(metadata.key, metadata.versionId), object)
  }

  const headMetadata = listing.versions.filter((version) => version.key === headKey)
  const eventMetadata = listing.versions.filter((version) => version.key !== headKey)
  const eventKeys = new Set<string>()
  for (const metadata of eventMetadata) {
    if (eventKeys.has(metadata.key)) {
      return yield* JournalIntegrityError.make({ reason: "Immutable journal event key has more than one version." })
    }
    eventKeys.add(metadata.key)
  }
  const headByVersion = new Map(headMetadata.map((metadata) => [metadata.versionId, metadata] as const))
  const latestHead = headMetadata.find((metadata) => metadata.isLatest)
  const visitedHeads = new Set<string>()
  const reverseEntries: Array<LoadedEntry> = []
  let cursor = latestHead
  while (cursor !== undefined) {
    if (reverseEntries.length >= input.maximum || visitedHeads.has(cursor.versionId)) {
      return yield* JournalIntegrityError.make({ reason: "Journal head chain is cyclic or exceeds its bound." })
    }
    visitedHeads.add(cursor.versionId)
    const headObject = objects.get(objectIdentity(cursor.key, cursor.versionId))!
    const head = yield* pureIntegrity(() => decodeJournalHead(headObject.bytes))
    if (head.releasePoint !== operation.releasePoint || head.operationKey !== operation.operationKey) {
      return yield* JournalIntegrityError.make({ reason: "Journal head belongs to a different operation." })
    }
    const eventObject = objects.get(objectIdentity(head.eventKey, head.eventVersionId))
    if (eventObject === undefined) {
      return yield* JournalIntegrityError.make({ reason: "Journal head references a missing exact event version." })
    }
    const event = yield* pureIntegrity(() => decodeJournalEvent(eventObject.bytes))
    if (event.releasePoint !== operation.releasePoint || event.operationKey !== operation.operationKey ||
        event.sequence !== head.sequence || event.transactionId !== head.transactionId ||
        journalEventKey(operation, event.sequence, event.transactionId) !== head.eventKey ||
        eventObject.checksumSha256 !== head.eventChecksumSha256 || eventDigest(eventObject.bytes) !== head.eventDigest) {
      return yield* JournalIntegrityError.make({ reason: "Journal head and event do not form one exact canonical record." })
    }
    if (event.workflow.repositoryId !== authority.oidc.repositoryId) {
      return yield* JournalIntegrityError.make({
        reason: "Journal event workflow repository does not equal the re-observed authority."
      })
    }
    reverseEntries.push({ headObject, head, eventObject, event })
    if (head.previousHeadVersionId === null || head.previousHeadEtag === null) {
      if (head.previousHeadVersionId !== null || head.previousHeadEtag !== null || event.previous !== null) {
        return yield* JournalIntegrityError.make({ reason: "Journal root predecessor is only partially empty." })
      }
      cursor = undefined
    } else {
      const previous = headByVersion.get(head.previousHeadVersionId)
      if (previous === undefined || previous.etag !== head.previousHeadEtag || event.previous === null ||
          event.previous.headVersionId !== head.previousHeadVersionId || event.previous.headEtag !== head.previousHeadEtag) {
        return yield* JournalIntegrityError.make({ reason: "Journal predecessor does not identify one retained head version." })
      }
      cursor = previous
    }
  }
  if (visitedHeads.size !== headMetadata.length) {
    return yield* JournalIntegrityError.make({ reason: "Journal contains an unreachable head version." })
  }
  const entries = reverseEntries.reverse()
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!
    const previous = entries[index - 1]
    if (previous === undefined) {
      if (entry.event.sequence !== 1 || entry.event.previous !== null) {
        return yield* JournalIntegrityError.make({ reason: "Journal first event is not a canonical root." })
      }
    } else if (entry.event.previous === null ||
        entry.event.previous.eventDigest !== previous.head.eventDigest ||
        entry.event.previous.headVersionId !== previous.headObject.versionId ||
        entry.event.previous.headEtag !== previous.headObject.etag) {
      return yield* JournalIntegrityError.make({ reason: "Journal event chain does not bind the preceding exact head." })
    }
  }
  const state = yield* pureIntegrity(() => reduceJournalEvents(entries.map((entry) => entry.event)))
  const reachableEvents = new Set(entries.map((entry) => objectIdentity(entry.eventObject.key, entry.eventObject.versionId)))
  const reachableTransactions = new Set(entries.map((entry) => entry.event.transactionId))
  const entryByHeadVersion = new Map(entries.map((entry) => [entry.headObject.versionId, entry] as const))
  const orphans: Array<LoadedOrphan> = []
  for (const metadata of eventMetadata) {
    if (reachableEvents.has(objectIdentity(metadata.key, metadata.versionId))) continue
    const eventObject = objects.get(objectIdentity(metadata.key, metadata.versionId))!
    const event = yield* pureIntegrity(() => decodeJournalEvent(eventObject.bytes))
    if (event.releasePoint !== operation.releasePoint || event.operationKey !== operation.operationKey ||
        journalEventKey(operation, event.sequence, event.transactionId) !== eventObject.key) {
      return yield* JournalIntegrityError.make({ reason: "Unreachable journal event is not a canonical attempt for this operation." })
    }
    if (event.workflow.repositoryId !== authority.oidc.repositoryId) {
      return yield* JournalIntegrityError.make({
        reason: "Journal orphan workflow repository does not equal the re-observed authority."
      })
    }
    let predecessorState: JournalSnapshot["state"] = "Empty"
    if (event.previous === null) {
      if (event.sequence !== 1) return yield* JournalIntegrityError.make({ reason: "Orphan root event has a non-root sequence." })
    } else {
      const predecessor = entryByHeadVersion.get(event.previous.headVersionId)
      if (predecessor === undefined || predecessor.headObject.etag !== event.previous.headEtag ||
          predecessor.head.eventDigest !== event.previous.eventDigest || event.sequence !== predecessor.event.sequence + 1) {
        return yield* JournalIntegrityError.make({ reason: "Orphan event does not bind one reachable predecessor." })
      }
      predecessorState = predecessor.event.record.tag
    }
    yield* pureIntegrity(() => admitJournalTransition(predecessorState, event.record.tag))
    orphans.push({ eventObject, event })
  }
  const logicalAttemptByTransaction = new Map<string, CanonicalJournalEvent>()
  for (const event of [
    ...entries.map((entry) => entry.event),
    ...orphans.map((orphan) => orphan.event)
  ]) {
    const existing = logicalAttemptByTransaction.get(event.transactionId)
    if (existing !== undefined && !logicalRecordEquals(existing, event)) {
      return yield* JournalIntegrityError.make({
        reason: "One journal transaction ID carries divergent retained logical records."
      })
    }
    logicalAttemptByTransaction.set(event.transactionId, event)
  }
  if (!input.allowStandaloneOrphans && orphans.some((orphan) => !reachableTransactions.has(orphan.event.transactionId))) {
    return yield* JournalIntegrityError.make({ reason: "Journal contains an unacknowledged event transaction; explicit reconciliation is required." })
  }
  return { authority, operation, entries, orphans, state }
})

const acknowledgement = (loaded: LoadedJournal, entry: LoadedEntry): JournalAcknowledgement => ({
  bucketArn: loaded.authority.bucketArn,
  prefix: journalNamespace(loaded.operation),
  releasePoint: loaded.operation.releasePoint,
  operationKey: loaded.operation.operationKey,
  eventKey: entry.eventObject.key,
  eventVersionId: entry.eventObject.versionId,
  eventChecksumSha256: entry.eventObject.checksumSha256,
  headKey: entry.headObject.key,
  headVersionId: entry.headObject.versionId,
  headEtag: entry.headObject.etag,
  headChecksumSha256: entry.headObject.checksumSha256,
  recordDigest: entry.head.eventDigest,
  sequence: entry.event.sequence,
  transactionId: entry.event.transactionId,
  previousHeadVersionId: entry.head.previousHeadVersionId,
  previousHeadEtag: entry.head.previousHeadEtag
})

const snapshot = (loaded: LoadedJournal): JournalSnapshot => {
  const current = loaded.entries.at(-1)
  return {
    ...loaded.operation,
    state: loaded.state,
    records: loaded.entries.map((entry) => journalRecordFromEvent(entry.event)),
    acknowledgement: current === undefined ? null : acknowledgement(loaded, current)
  }
}

const recoverExactEvent = (input: {
  readonly loaded: LoadedJournal
  readonly client: S3JournalBoundaryShape
  readonly key: string
  readonly bytes: Uint8Array
  readonly maximum: number
}): Effect.Effect<S3JournalObjectVersion | null, JournalIntegrityError | JournalStorageOutcomeUnknown> => Effect.gen(function*() {
  const listing = yield* listOperation(input.loaded.authority, input.loaded.operation, input.maximum, input.client, true)
  if (listing.truncated || listing.deleteMarkers.length > 0) {
    return yield* JournalStorageOutcomeUnknown.make({ reason: "Event response loss could not be reconciled within the bounded namespace." })
  }
  const versions = listing.versions.filter((version) => version.key === input.key)
  if (versions.length === 0) return null
  if (versions.length !== 1) return yield* JournalIntegrityError.make({ reason: "Immutable event key has more than one version." })
  const metadata = versions[0]!
  const object = yield* getObject(input.loaded.authority, metadata.key, metadata.versionId, input.client, true)
  yield* pureIntegrity(() => validateRetainedObject(object, metadata.key, metadata.versionId, metadata.etag))
  if (!sameBytes(object.bytes, input.bytes)) {
    return yield* JournalIntegrityError.make({ reason: "Existing event key contains different canonical bytes." })
  }
  return object
})

const capturePut = (
  effect: Effect.Effect<S3JournalPutResult, S3JournalBoundaryError>
): Effect.Effect<CapturedPut> => effect.pipe(
  Effect.map((result) => ({ _tag: "Result", result } as const)),
  Effect.catch((error) => Effect.succeed({ _tag: "Error", error } as const))
)

type CapturedPut =
  | { readonly _tag: "Result", readonly result: S3JournalPutResult }
  | { readonly _tag: "Error", readonly error: S3JournalBoundaryError }

const writeEvent = (input: {
  readonly loaded: LoadedJournal
  readonly client: S3JournalBoundaryShape
  readonly event: CanonicalJournalEvent
  readonly maximum: number
}): Effect.Effect<S3JournalObjectVersion, JournalIntegrityError | JournalStorageOutcomeUnknown | JournalConflict> => Effect.gen(function*() {
  const key = journalEventKey(input.loaded.operation, input.event.sequence, input.event.transactionId)
  const bytes = encodeJournalEvent(input.event)
  const request: S3JournalPutRequest = {
    bucketName: input.loaded.authority.bucketName,
    expectedBucketOwner: input.loaded.authority.expectedBucketOwner,
    region: input.loaded.authority.region,
    key,
    bytes,
    checksumSha256: objectChecksum(bytes),
    condition: { _tag: "IfNoneMatch" }
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const outcome = yield* capturePut(input.client.putEvent(request))
    if (outcome._tag === "Result" && outcome.result._tag === "Committed") {
      const committed = outcome.result
      const object = yield* getObject(
        input.loaded.authority,
        key,
        committed.versionId,
        input.client,
        true
      )
      yield* pureIntegrity(() => validateRetainedObject(object, key, committed.versionId, committed.etag))
      if (object.checksumSha256 !== committed.checksumSha256 || !sameBytes(object.bytes, bytes)) {
        return yield* JournalIntegrityError.make({ reason: "Committed event failed its immediate exact-version re-read." })
      }
      return object
    }
    const recovered = yield* recoverExactEvent({ ...input, key, bytes })
    if (recovered !== null) return recovered
    if (outcome._tag === "Result" && outcome.result._tag === "PreconditionFailed") {
      return yield* JournalConflict.make({ reason: "Event conditional create conflicted without an exact recoverable version." })
    }
    if (outcome._tag === "Error" && outcome.error.commitment === "unknown" && attempt === 0) continue
    if (outcome._tag === "Error" && outcome.error.commitment === "not-committed" && attempt === 0) continue
    return yield* JournalStorageOutcomeUnknown.make({ reason: "Event write has no acknowledged or authoritatively absent terminal outcome." })
  }
  return yield* JournalStorageOutcomeUnknown.make({ reason: "Event write exceeded its bounded reconciliation." })
})

const putHeadOnce = (input: {
  readonly loaded: LoadedJournal
  readonly client: S3JournalBoundaryShape
  readonly event: CanonicalJournalEvent
  readonly eventObject: S3JournalObjectVersion
}): Effect.Effect<{
  readonly outcome: CapturedPut
  readonly head: CanonicalJournalHead
}, never> => {
  const previous = input.loaded.entries.at(-1)
  const head = makeJournalHead({
    event: input.event,
    eventKey: input.eventObject.key,
    eventVersionId: input.eventObject.versionId,
    eventChecksumSha256: input.eventObject.checksumSha256,
    eventDigest: eventDigest(input.eventObject.bytes),
    previousHeadVersionId: previous?.headObject.versionId ?? null,
    previousHeadEtag: previous?.headObject.etag ?? null
  })
  const bytes = encodeJournalHead(head)
  const request: S3JournalPutRequest = {
    bucketName: input.loaded.authority.bucketName,
    expectedBucketOwner: input.loaded.authority.expectedBucketOwner,
    region: input.loaded.authority.region,
    key: journalHeadKey(input.loaded.operation),
    bytes,
    checksumSha256: objectChecksum(bytes),
    condition: previous === undefined
      ? { _tag: "IfNoneMatch" }
      : { _tag: "IfMatch", etag: previous.headObject.etag }
  }
  return capturePut(input.client.putHead(request)).pipe(Effect.map((outcome) => ({ outcome, head })))
}

const logicalRecordEquals = (left: CanonicalJournalEvent, right: CanonicalJournalEvent): boolean =>
  encodeCanonicalJson(left.record) === encodeCanonicalJson(right.record) &&
  encodeCanonicalJson(left.workflow) === encodeCanonicalJson(right.workflow)

const commitTransaction = (input: {
  readonly loaded: LoadedJournal
  readonly client: S3JournalBoundaryShape
  readonly record: CanonicalJournalRecord
  readonly workflow: CanonicalJournalEvent["workflow"]
  readonly transactionId: string
  readonly maximum: number
  readonly allowRebase: boolean
}): Effect.Effect<JournalAcknowledgement, JournalAppendError> => Effect.gen(function*() {
  const current = input.loaded.entries.at(-1)
  yield* pureTransition(() => admitJournalTransition(input.loaded.state, input.record.tag))
  const event = makeJournalEvent({
    releasePoint: input.loaded.operation.releasePoint,
    operationKey: input.loaded.operation.operationKey,
    sequence: (current?.event.sequence ?? 0) + 1,
    transactionId: input.transactionId,
    previous: current?.event ?? null,
    previousHead: current === undefined ? null : {
      versionId: current.headObject.versionId,
      etag: current.headObject.etag,
      eventDigest: current.head.eventDigest
    },
    workflow: input.workflow,
    record: input.record
  })
  const eventObject = yield* writeEvent({ ...input, event })
  const first = yield* putHeadOnce({ ...input, event, eventObject })
  if (first.outcome._tag === "Result" && first.outcome.result._tag === "Committed") {
    const verified = yield* loadJournal({
      expectedAuthority: input.loaded.authority,
      client: input.client,
      operation: input.loaded.operation,
      maximum: input.maximum,
      allowStandaloneOrphans: false,
      afterMutation: true
    })
    const entry = verified.entries.find((candidate) => candidate.event.transactionId === input.transactionId)
    if (entry === undefined) {
      return yield* JournalStorageOutcomeUnknown.make({ reason: "Head response succeeded but exact transaction is not reachable after re-read." })
    }
    return acknowledgement(verified, entry)
  }

  let recovered = yield* loadJournal({
    expectedAuthority: input.loaded.authority,
    client: input.client,
    operation: input.loaded.operation,
    maximum: input.maximum,
    allowStandaloneOrphans: true,
    afterMutation: true
  })
  const reached = recovered.entries.find((candidate) => candidate.event.transactionId === input.transactionId)
  if (reached !== undefined) return acknowledgement(recovered, reached)
  const recoveredCurrent = recovered.entries.at(-1)
  const oldCurrent = input.loaded.entries.at(-1)
  const predecessorUnchanged = recoveredCurrent?.headObject.versionId === oldCurrent?.headObject.versionId &&
    recoveredCurrent?.headObject.etag === oldCurrent?.headObject.etag &&
    (recoveredCurrent !== undefined) === (oldCurrent !== undefined)

  if (predecessorUnchanged) {
    const retry = yield* putHeadOnce({ loaded: recovered, client: input.client, event, eventObject })
    recovered = yield* loadJournal({
      expectedAuthority: input.loaded.authority,
      client: input.client,
      operation: input.loaded.operation,
      maximum: input.maximum,
      allowStandaloneOrphans: true,
      afterMutation: true
    })
    const retried = recovered.entries.find((candidate) => candidate.event.transactionId === input.transactionId)
    if (retried !== undefined) return acknowledgement(recovered, retried)
    if (retry.outcome._tag === "Error" || retry.outcome.result._tag === "PreconditionFailed") {
      if (!input.allowRebase) {
        return yield* JournalStorageOutcomeUnknown.make({ reason: "Head CAS did not acknowledge the transaction within its bounded retry." })
      }
    }
    const afterRetry = recovered.entries.at(-1)
    const stillUnchanged = afterRetry?.headObject.versionId === oldCurrent?.headObject.versionId &&
      afterRetry?.headObject.etag === oldCurrent?.headObject.etag &&
      (afterRetry !== undefined) === (oldCurrent !== undefined)
    if (stillUnchanged) {
      return yield* JournalStorageOutcomeUnknown.make({
        reason: "Head CAS remained authoritatively absent after its one bounded retry."
      })
    }
  }

  if (!input.allowRebase) {
    return yield* JournalStorageOutcomeUnknown.make({ reason: "Head transaction is absent after its bounded reconciliation." })
  }
  yield* pureTransition(() => admitJournalTransition(recovered.state, input.record.tag)).pipe(Effect.mapError((error) =>
    error instanceof JournalTransitionError
      ? JournalConflict.make({ reason: "A concurrent journal transition made this append inadmissible." })
      : error
  ))
  const rebasedCurrent = recovered.entries.at(-1)
  const rebasedEvent = makeJournalEvent({
    releasePoint: recovered.operation.releasePoint,
    operationKey: recovered.operation.operationKey,
    sequence: (rebasedCurrent?.event.sequence ?? 0) + 1,
    transactionId: input.transactionId,
    previous: rebasedCurrent?.event ?? null,
    previousHead: rebasedCurrent === undefined ? null : {
      versionId: rebasedCurrent.headObject.versionId,
      etag: rebasedCurrent.headObject.etag,
      eventDigest: rebasedCurrent.head.eventDigest
    },
    workflow: input.workflow,
    record: input.record
  })
  const rebasedObject = yield* writeEvent({ loaded: recovered, client: input.client, event: rebasedEvent, maximum: input.maximum })
  yield* putHeadOnce({ loaded: recovered, client: input.client, event: rebasedEvent, eventObject: rebasedObject })
  const terminal = yield* loadJournal({
    expectedAuthority: input.loaded.authority,
    client: input.client,
    operation: input.loaded.operation,
    maximum: input.maximum,
    allowStandaloneOrphans: true,
    afterMutation: true
  })
  const committed = terminal.entries.find((candidate) => candidate.event.transactionId === input.transactionId)
  if (committed === undefined) {
    return yield* JournalStorageOutcomeUnknown.make({ reason: "Rebased head CAS did not acknowledge the transaction." })
  }
  return acknowledgement(terminal, committed)
})

const orphanBindsCurrent = (loaded: LoadedJournal, orphan: LoadedOrphan): boolean => {
  const current = loaded.entries.at(-1)
  if (current === undefined) {
    return orphan.event.sequence === 1 && orphan.event.previous === null
  }
  return orphan.event.sequence === current.event.sequence + 1 && orphan.event.previous !== null &&
    orphan.event.previous.headVersionId === current.headObject.versionId &&
    orphan.event.previous.headEtag === current.headObject.etag &&
    orphan.event.previous.eventDigest === current.head.eventDigest
}

const acknowledgeExistingOrphan = (input: {
  readonly loaded: LoadedJournal
  readonly orphan: LoadedOrphan
  readonly client: S3JournalBoundaryShape
  readonly maximum: number
}): Effect.Effect<LoadedJournal, JournalAppendError> => Effect.gen(function*() {
  yield* putHeadOnce({
    loaded: input.loaded,
    client: input.client,
    event: input.orphan.event,
    eventObject: input.orphan.eventObject
  })
  let recovered = yield* loadJournal({
    expectedAuthority: input.loaded.authority,
    client: input.client,
    operation: input.loaded.operation,
    maximum: input.maximum,
    allowStandaloneOrphans: true,
    afterMutation: true
  })
  if (recovered.entries.some((entry) => entry.event.transactionId === input.orphan.event.transactionId)) {
    return recovered
  }
  if (!orphanBindsCurrent(recovered, input.orphan)) {
    yield* commitTransaction({
      loaded: recovered,
      client: input.client,
      record: input.orphan.event.record,
      workflow: input.orphan.event.workflow,
      transactionId: input.orphan.event.transactionId,
      maximum: input.maximum,
      allowRebase: true
    })
    return yield* loadJournal({
      expectedAuthority: input.loaded.authority,
      client: input.client,
      operation: input.loaded.operation,
      maximum: input.maximum,
      allowStandaloneOrphans: false,
      afterMutation: true
    })
  }
  yield* putHeadOnce({
    loaded: recovered,
    client: input.client,
    event: input.orphan.event,
    eventObject: input.orphan.eventObject
  })
  recovered = yield* loadJournal({
    expectedAuthority: input.loaded.authority,
    client: input.client,
    operation: input.loaded.operation,
    maximum: input.maximum,
    allowStandaloneOrphans: true,
    afterMutation: true
  })
  if (!recovered.entries.some((entry) => entry.event.transactionId === input.orphan.event.transactionId)) {
    return yield* JournalStorageOutcomeUnknown.make({
      reason: "Existing orphan event did not acquire an acknowledged head within its bounded CAS retry."
    })
  }
  return recovered
})

const reconcileLoaded = (input: {
  readonly loaded: LoadedJournal
  readonly client: S3JournalBoundaryShape
  readonly maximum: number
}): Effect.Effect<LoadedJournal, JournalAppendError> => Effect.gen(function*() {
  const reachableTransactions = new Set(input.loaded.entries.map((entry) => entry.event.transactionId))
  const standalone = input.loaded.orphans.filter((orphan) => !reachableTransactions.has(orphan.event.transactionId))
  if (standalone.length === 0) return input.loaded
  const transactions = new Map<string, Array<LoadedOrphan>>()
  for (const orphan of standalone) {
    const attempts = transactions.get(orphan.event.transactionId) ?? []
    attempts.push(orphan)
    transactions.set(orphan.event.transactionId, attempts)
  }
  if (transactions.size !== 1) {
    return yield* JournalConflict.make({ reason: "More than one unacknowledged journal transaction requires adjudication." })
  }
  const [transactionId, attempts] = [...transactions.entries()][0]!
  const basis = attempts[0]!
  if (attempts.some((attempt) => !logicalRecordEquals(basis.event, attempt.event))) {
    return yield* JournalIntegrityError.make({ reason: "One orphan transaction carries multiple logical records." })
  }
  const directlyAdoptable = attempts.filter((attempt) => orphanBindsCurrent(input.loaded, attempt))
  if (directlyAdoptable.length > 1) {
    return yield* JournalIntegrityError.make({ reason: "One orphan transaction has multiple attempts for the current predecessor." })
  }
  if (directlyAdoptable.length === 1) {
    yield* acknowledgeExistingOrphan({
      loaded: input.loaded,
      orphan: directlyAdoptable[0]!,
      client: input.client,
      maximum: input.maximum
    })
  } else {
    yield* commitTransaction({
      loaded: input.loaded,
      client: input.client,
      record: basis.event.record,
      workflow: basis.event.workflow,
      transactionId,
      maximum: input.maximum,
      allowRebase: true
    })
  }
  return yield* loadJournal({
    expectedAuthority: input.loaded.authority,
    client: input.client,
    operation: input.loaded.operation,
    maximum: input.maximum,
    allowStandaloneOrphans: false,
    afterMutation: true
  })
})

export interface S3CanonicalOperationJournalOptions {
  readonly authority: S3JournalAuthority
  readonly client: S3JournalBoundaryShape
}

export const makeS3CanonicalOperationJournal = (
  options: S3CanonicalOperationJournalOptions
): CanonicalOperationJournalShape => {
  const maximum = 512

  const load = (
    operation: JournalOperation,
    allowStandaloneOrphans: boolean
  ) => loadJournal({
    expectedAuthority: options.authority,
    client: options.client,
    operation,
    maximum,
    allowStandaloneOrphans
  })

  return {
    read: (operation) => load(operation, false).pipe(
      Effect.mapError((error) => error instanceof JournalStorageOutcomeUnknown
        ? JournalStorageUnavailable.make({ reason: error.reason })
        : error),
      Effect.map(snapshot)
    ),
    reconcile: (operation) => Effect.gen(function*() {
      const loaded = yield* load(operation, true)
      return snapshot(yield* reconcileLoaded({ loaded, client: options.client, maximum }))
    }),
    append: (request: JournalAppendRequest) => Effect.gen(function*() {
      const operation = yield* pureInput(() => validateJournalOperation(request))
      const record = yield* pureInput(() => makeCanonicalJournalRecord(request))
      const transactionId = yield* pureInput(() => validateTransactionId(randomUUID()))
      const initial = yield* load(operation, true)
      const loaded = yield* reconcileLoaded({ loaded: initial, client: options.client, maximum })
      const workflow = yield* pureInput(() => validateJournalWorkflow({
        repositoryId: loaded.authority.oidc.repositoryId,
        runId: loaded.authority.oidc.runId,
        runAttempt: loaded.authority.oidc.runAttempt
      }))
      return yield* commitTransaction({
        loaded,
        client: options.client,
        record,
        workflow,
        transactionId,
        maximum,
        allowRebase: true
      })
    })
  }
}
