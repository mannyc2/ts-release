import { Buffer } from "node:buffer"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import * as Effect from "effect/Effect"
import {
  S3JournalBoundaryError,
  makeS3CanonicalOperationJournal,
  type S3JournalAuthority,
  type S3JournalBoundaryShape,
  type S3JournalObjectVersion,
  type S3JournalPutRequest,
  type S3JournalPutResult
} from "../../src/operation-journal.js"

type Mode = "crash-before-head" | "crash-after-head" | "reconcile" | "read"

interface PersistedObject extends Omit<S3JournalObjectVersion, "bytes"> {
  readonly bytesBase64: string
}

interface PersistedState {
  readonly version: number
  readonly objects: Readonly<Record<string, ReadonlyArray<PersistedObject>>>
}

const [modeValue, statePath] = process.argv.slice(2)
if (statePath === undefined || ![
  "crash-before-head",
  "crash-after-head",
  "reconcile",
  "read"
].includes(modeValue ?? "")) {
  throw new Error("Expected one child mode and state path.")
}
const mode = modeValue as Mode

const authority = {
  accountId: "123456789012",
  bucketName: "journal-process-fixture",
  bucketArn: "arn:aws:s3:::journal-process-fixture",
  region: "us-east-1",
  roleArn: "arn:aws:iam::123456789012:role/journal-process-fixture",
  prefix: "operation-journal/v1",
  expectedBucketOwner: "123456789012",
  versioning: "Enabled",
  objectLock: "Enabled",
  retentionMode: "COMPLIANCE",
  retentionYears: 10,
  bucketOwnerEnforced: true,
  publicAccessBlocked: true,
  deleteDenied: true,
  multipartDenied: true,
  conditionalWritesEnforced: true,
  bucketPolicyDigest: `sha256:${"d".repeat(64)}`,
  rolePolicyDigest: `sha256:${"e".repeat(64)}`,
  oidcTrustPolicyDigest: `sha256:${"f".repeat(64)}`,
  oidc: {
    issuer: "https://token.actions.githubusercontent.com",
    audience: "sts.amazonaws.com",
    subject: "repo:fixture@1234567/consumer@123456789:environment:certification",
    repository: "fixture/consumer",
    repositoryId: "123456789",
    repositoryOwnerId: "1234567",
    repositoryVisibility: "public",
    eventName: "workflow_dispatch",
    ref: "refs/heads/main",
    refType: "branch",
    sha: "a".repeat(40),
    environment: "certification",
    runnerEnvironment: "github-hosted",
    runId: "42",
    runAttempt: "1",
    workflow: "Certification",
    workflowRef: "fixture/consumer/.github/workflows/certification.yml@refs/heads/main",
    workflowSha: "a".repeat(40),
    jobWorkflowRef: `fixture/owner/.github/workflows/journal.yml@${"c".repeat(40)}`,
    jobWorkflowSha: "c".repeat(40)
  },
  oidcTrust: {
    audience: "sts.amazonaws.com",
    subject: "repo:fixture@1234567/consumer@123456789:environment:certification",
    repository: "fixture/consumer",
    repositoryId: "123456789",
    repositoryOwnerId: "1234567",
    workflow: "Certification",
    ref: "refs/heads/main",
    environment: "certification",
    jobWorkflowRef: `fixture/owner/.github/workflows/journal.yml@${"c".repeat(40)}`
  }
} as const satisfies S3JournalAuthority

const emptyState = (): PersistedState => ({ version: 0, objects: {} })
const readState = (): PersistedState => existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8")) as PersistedState
  : emptyState()
const writeState = (state: PersistedState): void => writeFileSync(statePath, `${JSON.stringify(state)}\n`)
const decodeObject = (object: PersistedObject): S3JournalObjectVersion => ({
  key: object.key,
  versionId: object.versionId,
  etag: object.etag,
  checksumSha256: object.checksumSha256,
  bytes: new Uint8Array(Buffer.from(object.bytesBase64, "base64")),
  lastModified: object.lastModified,
  retentionMode: object.retentionMode,
  retainUntil: object.retainUntil
})
const encodeObject = (object: S3JournalObjectVersion): PersistedObject => ({
  key: object.key,
  versionId: object.versionId,
  etag: object.etag,
  checksumSha256: object.checksumSha256,
  bytesBase64: Buffer.from(object.bytes).toString("base64"),
  lastModified: object.lastModified,
  retentionMode: object.retentionMode,
  retainUntil: object.retainUntil
})

const boundaryFailure = (
  operation: "get-object-version"
): S3JournalBoundaryError => S3JournalBoundaryError.make({
  operation,
  commitment: "not-applicable",
  reason: "Persistent fake object was absent."
})

const commit = (request: S3JournalPutRequest): S3JournalPutResult => {
  const state = readState()
  const versions = state.objects[request.key] ?? []
  const latest = versions.at(-1)
  if (request.condition._tag === "IfNoneMatch" && latest !== undefined) {
    return { _tag: "PreconditionFailed" }
  }
  if (request.condition._tag === "IfMatch" && latest?.etag !== request.condition.etag) {
    return { _tag: "PreconditionFailed" }
  }
  const nextVersion = state.version + 1
  const object: S3JournalObjectVersion = {
    key: request.key,
    versionId: `version-${nextVersion}`,
    etag: `"etag-${nextVersion}"`,
    checksumSha256: request.checksumSha256,
    bytes: new Uint8Array(request.bytes),
    lastModified: "2026-09-01T00:00:00.000Z",
    retentionMode: "COMPLIANCE",
    retainUntil: "2036-09-01T00:00:00.000Z"
  }
  writeState({
    version: nextVersion,
    objects: { ...state.objects, [request.key]: [...versions, encodeObject(object)] }
  })
  return {
    _tag: "Committed",
    versionId: object.versionId,
    etag: object.etag,
    checksumSha256: object.checksumSha256
  }
}

const boundary: S3JournalBoundaryShape = {
  observeAuthority: () => Effect.succeed(authority),
  listNamespace: (input) => Effect.sync(() => {
    const state = readState()
    const versions = Object.entries(state.objects)
      .filter(([key]) => key.startsWith(input.prefix))
      .flatMap(([key, values]) => values.map((value, index) => ({
        key,
        versionId: value.versionId,
        etag: value.etag,
        isLatest: index === values.length - 1
      })))
      .sort((left, right) => left.key.localeCompare(right.key) || left.versionId.localeCompare(right.versionId))
    return {
      versions: versions.slice(0, input.maximum),
      deleteMarkers: [],
      truncated: versions.length > input.maximum
    }
  }),
  getObjectVersion: (input) => {
    const object = readState().objects[input.key]?.find((value) => value.versionId === input.versionId)
    return object === undefined
      ? Effect.fail(boundaryFailure("get-object-version"))
      : Effect.succeed(decodeObject(object))
  },
  putEvent: (input) => Effect.sync(() => commit(input)),
  putHead: (input) => Effect.sync(() => {
    if (mode === "crash-before-head") process.exit(86)
    const result = commit(input)
    if (mode === "crash-after-head" && result._tag === "Committed") process.exit(87)
    return result
  })
}

const operation = { releasePoint: "a".repeat(40), operationKey: "b".repeat(64) }
const journal = makeS3CanonicalOperationJournal({ authority, client: boundary })
const result = mode === "reconcile"
  ? await Effect.runPromise(journal.reconcile(operation))
  : mode === "read"
  ? await Effect.runPromise(journal.read(operation))
  : await Effect.runPromise(journal.append({
    ...operation,
    tag: "IntentRecorded",
    codecId: "fixture/child-process-v1",
    payload: new TextEncoder().encode("intent")
  }))

console.log(JSON.stringify(result))
