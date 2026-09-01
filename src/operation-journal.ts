/**
 * Provider-neutral durable operation journal.
 *
 * Consumers own payload codecs and provider semantics. This subpath owns only
 * the canonical envelope, finite transition machine, S3 conditional commit,
 * durable acknowledgment, and exact-chain replay.
 */
export {
  JournalAuthorityMismatch,
  JournalConflict,
  JournalInputError,
  JournalIntegrityError,
  JournalStorageOutcomeUnknown,
  JournalStorageUnavailable,
  JournalTransitionError,
  S3JournalBoundaryError,
  journalRecordTags,
  operationJournalByteLimits
} from "./operation-journal/model.js"
export type {
  CanonicalOperationJournalShape,
  JournalAcknowledgement,
  JournalAppendError,
  JournalAppendRequest,
  JournalOperation,
  JournalReadError,
  JournalRecord,
  JournalRecordTag,
  JournalSnapshot,
  JournalStateTag,
  JournalWorkflowCoordinate,
  S3JournalAuthority,
  S3JournalBoundaryShape,
  S3JournalDeleteMarker,
  S3JournalNamespaceListing,
  S3JournalObjectVersion,
  S3JournalOidcClaims,
  S3JournalOidcTrustConditions,
  S3JournalPutCondition,
  S3JournalPutRequest,
  S3JournalPutResult
} from "./operation-journal/model.js"
export {
  deriveOperationKey,
  journalEventKey,
  journalHeadKey,
  journalNamespace
} from "./operation-journal/canonical.js"
export { admitJournalTransition } from "./operation-journal/reducer.js"
export { makeS3CanonicalOperationJournal } from "./operation-journal/s3.js"
export type { S3CanonicalOperationJournalOptions } from "./operation-journal/s3.js"
