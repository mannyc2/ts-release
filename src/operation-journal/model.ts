import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export const journalRecordTags = [
  "IntentRecorded",
  "ReceiptRecorded",
  "ObservationRecorded",
  "TerminalRecorded",
  "OutcomeUnknown"
] as const

/** Fixed hashing/allocation limits for identities, payloads, and retained objects. */
export const operationJournalByteLimits = {
  operationIdentity: 65_536,
  payload: 1_048_576,
  object: 1_500_000
} as const

export type JournalRecordTag = typeof journalRecordTags[number]
export type JournalStateTag = "Empty" | JournalRecordTag

export interface JournalOperation {
  readonly releasePoint: string
  readonly operationKey: string
}

export interface JournalWorkflowCoordinate {
  readonly repositoryId: string
  readonly runId: string
  readonly runAttempt: string
}

/**
 * The payload is consumer-owned canonical data. The journal binds and returns
 * the bytes without decoding provider fields.
 */
export interface JournalAppendRequest extends JournalOperation {
  readonly tag: JournalRecordTag
  readonly codecId: string
  readonly payload: Uint8Array
}

export interface JournalRecord {
  readonly tag: JournalRecordTag
  readonly codecId: string
  readonly payload: Uint8Array
  readonly payloadDigest: string
  readonly sequence: number
  readonly transactionId: string
  readonly workflow: JournalWorkflowCoordinate
}

export interface JournalAcknowledgement extends JournalOperation {
  readonly bucketArn: string
  readonly prefix: string
  readonly eventKey: string
  readonly eventVersionId: string
  readonly eventChecksumSha256: string
  readonly headKey: string
  readonly headVersionId: string
  readonly headEtag: string
  readonly headChecksumSha256: string
  readonly recordDigest: string
  readonly sequence: number
  readonly transactionId: string
  readonly previousHeadVersionId: string | null
  readonly previousHeadEtag: string | null
}

export interface JournalSnapshot extends JournalOperation {
  readonly state: JournalStateTag
  readonly records: ReadonlyArray<JournalRecord>
  readonly acknowledgement: JournalAcknowledgement | null
}

export interface CanonicalOperationJournalShape {
  /** Re-observe governance and validate the complete reachable chain. */
  readonly read: (
    operation: JournalOperation
  ) => Effect.Effect<JournalSnapshot, JournalReadError>

  /**
   * Append one transition. A returned acknowledgment has already survived an
   * exact version re-read and complete-chain validation.
   */
  readonly append: (
    request: JournalAppendRequest
  ) => Effect.Effect<JournalAcknowledgement, JournalAppendError>

  /**
   * Finish the one unacknowledged canonical event left by a killed writer.
   * Multiple or semantically incompatible orphan transactions stop.
   */
  readonly reconcile: (
    operation: JournalOperation
  ) => Effect.Effect<JournalSnapshot, JournalAppendError>
}

export class JournalInputError
  extends Schema.TaggedErrorClass<JournalInputError>()("JournalInputError", {
    reason: Schema.NonEmptyString
  }) {}

export class JournalTransitionError
  extends Schema.TaggedErrorClass<JournalTransitionError>()("JournalTransitionError", {
    reason: Schema.NonEmptyString
  }) {}

export class JournalIntegrityError
  extends Schema.TaggedErrorClass<JournalIntegrityError>()("JournalIntegrityError", {
    reason: Schema.NonEmptyString
  }) {}

export class JournalAuthorityMismatch
  extends Schema.TaggedErrorClass<JournalAuthorityMismatch>()("JournalAuthorityMismatch", {
    reason: Schema.NonEmptyString
  }) {}

export class JournalStorageUnavailable
  extends Schema.TaggedErrorClass<JournalStorageUnavailable>()("JournalStorageUnavailable", {
    reason: Schema.NonEmptyString
  }) {}

export class JournalStorageOutcomeUnknown
  extends Schema.TaggedErrorClass<JournalStorageOutcomeUnknown>()("JournalStorageOutcomeUnknown", {
    reason: Schema.NonEmptyString
  }) {}

export class JournalConflict
  extends Schema.TaggedErrorClass<JournalConflict>()("JournalConflict", {
    reason: Schema.NonEmptyString
  }) {}

export type JournalReadError =
  | JournalInputError
  | JournalIntegrityError
  | JournalAuthorityMismatch
  | JournalStorageUnavailable

export type JournalAppendError =
  | JournalReadError
  | JournalTransitionError
  | JournalStorageOutcomeUnknown
  | JournalConflict

export const S3JournalRequestOperations = Schema.Literals([
  "observe-authority",
  "list-namespace",
  "get-object-version",
  "put-event",
  "put-head"
])
export type S3JournalRequestOperation = typeof S3JournalRequestOperations.Type

export class S3JournalBoundaryError
  extends Schema.TaggedErrorClass<S3JournalBoundaryError>()("S3JournalBoundaryError", {
    operation: S3JournalRequestOperations,
    commitment: Schema.Literals(["not-applicable", "not-committed", "unknown"]),
    reason: Schema.NonEmptyString
  }) {}

export interface S3JournalOidcClaims {
  readonly issuer: "https://token.actions.githubusercontent.com"
  readonly audience: "sts.amazonaws.com"
  readonly subject: string
  /** Standard GitHub claims describe the caller workflow. */
  readonly repository: string
  readonly repositoryId: string
  readonly repositoryOwnerId: string
  readonly repositoryVisibility: "public"
  readonly eventName: "workflow_dispatch"
  readonly ref: string
  readonly refType: "branch"
  readonly sha: string
  readonly environment: string
  readonly runnerEnvironment: "github-hosted"
  readonly runId: string
  readonly runAttempt: string
  readonly workflow: string
  readonly workflowRef: string
  readonly workflowSha: string
  /** `job_workflow_*` claims describe the called reusable workflow. */
  readonly jobWorkflowRef: string
  readonly jobWorkflowSha: string
}

/** Exact values parsed from the AWS role's GitHub OIDC trust conditions. */
export interface S3JournalOidcTrustConditions {
  readonly audience: "sts.amazonaws.com"
  readonly subject: string
  readonly repository: string
  readonly repositoryId: string
  readonly repositoryOwnerId: string
  readonly workflow: string
  readonly ref: string
  readonly environment: string
  readonly jobWorkflowRef: string
}

export interface S3JournalAuthority {
  readonly accountId: string
  readonly bucketName: string
  readonly bucketArn: string
  readonly region: string
  readonly roleArn: string
  readonly prefix: "operation-journal/v1"
  readonly expectedBucketOwner: string
  readonly versioning: "Enabled"
  readonly objectLock: "Enabled"
  readonly retentionMode: "COMPLIANCE"
  readonly retentionYears: 10
  readonly bucketOwnerEnforced: true
  readonly publicAccessBlocked: true
  readonly deleteDenied: true
  readonly multipartDenied: true
  readonly conditionalWritesEnforced: true
  readonly bucketPolicyDigest: string
  readonly rolePolicyDigest: string
  readonly oidcTrustPolicyDigest: string
  readonly oidc: S3JournalOidcClaims
  readonly oidcTrust: S3JournalOidcTrustConditions
}

export interface S3JournalObjectVersion {
  readonly key: string
  readonly versionId: string
  readonly etag: string
  readonly checksumSha256: string
  readonly bytes: Uint8Array
  readonly lastModified: string
  readonly retentionMode: "COMPLIANCE"
  readonly retainUntil: string
}

export interface S3JournalDeleteMarker {
  readonly key: string
  readonly versionId: string
}

export interface S3JournalNamespaceListing {
  readonly versions: ReadonlyArray<{
    readonly key: string
    readonly versionId: string
    readonly etag: string
    readonly isLatest: boolean
  }>
  readonly deleteMarkers: ReadonlyArray<S3JournalDeleteMarker>
  readonly truncated: boolean
}

export type S3JournalPutCondition =
  | { readonly _tag: "IfNoneMatch" }
  | { readonly _tag: "IfMatch", readonly etag: string }

export interface S3JournalPutRequest {
  readonly bucketName: string
  readonly expectedBucketOwner: string
  readonly region: string
  readonly key: string
  readonly bytes: Uint8Array
  readonly checksumSha256: string
  readonly condition: S3JournalPutCondition
}

export type S3JournalPutResult =
  | {
    readonly _tag: "Committed"
    readonly versionId: string
    readonly etag: string
    readonly checksumSha256: string
  }
  | { readonly _tag: "PreconditionFailed" }

/**
 * Credential acquisition and SigV4 stay outside this structural boundary.
 * A live adapter must close over one already-issued, purpose-scoped session;
 * callers cannot supply endpoints, profiles, or credentials per request.
 */
export interface S3JournalBoundaryShape {
  readonly observeAuthority: () => Effect.Effect<S3JournalAuthority, S3JournalBoundaryError>
  readonly listNamespace: (input: {
    readonly bucketName: string
    readonly expectedBucketOwner: string
    readonly region: string
    readonly prefix: string
    readonly maximum: number
  }) => Effect.Effect<S3JournalNamespaceListing, S3JournalBoundaryError>
  readonly getObjectVersion: (input: {
    readonly bucketName: string
    readonly expectedBucketOwner: string
    readonly region: string
    readonly key: string
    readonly versionId: string
  }) => Effect.Effect<S3JournalObjectVersion, S3JournalBoundaryError>
  readonly putEvent: (
    input: S3JournalPutRequest
  ) => Effect.Effect<S3JournalPutResult, S3JournalBoundaryError>
  readonly putHead: (
    input: S3JournalPutRequest
  ) => Effect.Effect<S3JournalPutResult, S3JournalBoundaryError>
}
