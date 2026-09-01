import { Buffer } from "node:buffer"
import {
  GetRoleCommand,
  GetRolePolicyCommand,
  IAMClient,
  ListAttachedRolePoliciesCommand,
  ListRolePoliciesCommand
} from "@aws-sdk/client-iam"
import {
  GetBucketOwnershipControlsCommand,
  GetBucketPolicyCommand,
  GetBucketPolicyStatusCommand,
  GetBucketVersioningCommand,
  GetObjectAttributesCommand,
  GetObjectCommand,
  GetObjectLockConfigurationCommand,
  GetObjectRetentionCommand,
  GetPublicAccessBlockCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3"
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts"
import * as Effect from "effect/Effect"
import { isCanonicalS3VersionId, objectChecksum } from "../canonical.js"
import {
  S3JournalBoundaryError,
  operationJournalByteLimits,
  type S3JournalAuthority,
  type S3JournalBoundaryShape,
  type S3JournalNamespaceListing,
  type S3JournalObjectVersion,
  type S3JournalPutRequest,
  type S3JournalPutResult
} from "../model.js"
import type { AwsJournalSession } from "./oidc.js"
import {
  operationJournalNetworkDeadlineMilliseconds,
  withOperationJournalNetworkDeadline
} from "./deadline.js"
import {
  assertAwsJournalPolicyDigests,
  validateAwsJournalPolicies,
  type AwsJournalPolicyCoordinates
} from "./policy.js"

export interface AwsS3JournalBoundaryOptions {
  readonly authority: S3JournalAuthority
  readonly rolePolicyName: string
}

export interface AwsJournalClients {
  readonly iam: IAMClient
  readonly s3: S3Client
  readonly sts: STSClient
}

const error = (
  operation: S3JournalBoundaryError["operation"],
  commitment: S3JournalBoundaryError["commitment"],
  reason: string
): S3JournalBoundaryError => S3JournalBoundaryError.make({ operation, commitment, reason })

const fail = (
  operation: S3JournalBoundaryError["operation"],
  reason: string
): never => {
  throw error(operation, "not-applicable", reason)
}

const boundaryError = (
  cause: unknown,
  operation: S3JournalBoundaryError["operation"],
  reason: string
): S3JournalBoundaryError => cause instanceof S3JournalBoundaryError
  ? cause
  : error(operation, "not-applicable", reason)

const statusCode = (cause: unknown): number | undefined => {
  if (typeof cause !== "object" || cause === null || !("$metadata" in cause)) return undefined
  const metadata = (cause as { readonly $metadata?: { readonly httpStatusCode?: unknown } }).$metadata
  return typeof metadata?.httpStatusCode === "number" ? metadata.httpStatusCode : undefined
}

const errorName = (cause: unknown): string => {
  if (typeof cause !== "object" || cause === null || !("name" in cause) ||
      typeof (cause as { readonly name?: unknown }).name !== "string") return "UnknownError"
  const name = (cause as { readonly name: string }).name
  return /^[A-Za-z0-9_.-]{1,128}$/u.test(name) ? name : "UnknownError"
}

const putFailure = (cause: unknown, operation: "put-event" | "put-head"): S3JournalBoundaryError => {
  if (cause instanceof S3JournalBoundaryError) return cause
  const status = statusCode(cause)
  return error(
    operation,
    status !== undefined && status >= 300 && status < 500 ? "not-committed" : "unknown",
    `AWS S3 conditional write did not return one admitted response (${errorName(cause)}).`
  )
}

const roleName = (roleArn: string): string => roleArn.slice(roleArn.lastIndexOf("/") + 1)

const journalNamespacePattern = /^operation-journal\/v1\/[a-f0-9]{40}\/[a-f0-9]{64}\/$/u
const journalEventKeyPattern = /^operation-journal\/v1\/[a-f0-9]{40}\/[a-f0-9]{64}\/events\/[0-9]{8}\/[a-f0-9-]{36}\.bin$/u
const journalHeadKeyPattern = /^operation-journal\/v1\/[a-f0-9]{40}\/[a-f0-9]{64}\/head\.bin$/u

const requireSealedInput = (
  input: { readonly bucketName: string, readonly expectedBucketOwner: string, readonly region: string },
  authority: S3JournalAuthority,
  operation: S3JournalBoundaryError["operation"]
): void => {
  if (input.bucketName !== authority.bucketName ||
      input.expectedBucketOwner !== authority.expectedBucketOwner ||
      input.region !== authority.region) {
    fail(operation, "AWS journal request coordinates escaped the sealed activation contract.")
  }
}

const requireString = (
  value: string | undefined,
  operation: S3JournalBoundaryError["operation"],
  label: string
): string => {
  if (value === undefined || value.length === 0) fail(operation, `${label} is absent.`)
  return value as string
}

const checksumToBase64 = (checksum: string, operation: "put-event" | "put-head"): string => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(checksum)) fail(operation, "Journal checksum is not canonical SHA-256.")
  return Buffer.from(checksum.slice("sha256:".length), "hex").toString("base64")
}

const checksumFromBase64 = (
  checksum: string | undefined,
  operation: S3JournalBoundaryError["operation"]
): string => {
  if (checksum === undefined || !/^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{3}=$/u.test(checksum)) {
    fail(operation, "AWS S3 response lacks one canonical SHA-256 checksum.")
  }
  const canonicalChecksum = checksum as string
  const bytes = Buffer.from(canonicalChecksum, "base64")
  if (bytes.length !== 32 || bytes.toString("base64") !== canonicalChecksum) {
    fail(operation, "AWS S3 response SHA-256 checksum is malformed.")
  }
  return `sha256:${bytes.toString("hex")}`
}

export const readBoundedObjectBody = async (
  body: unknown,
  contentLength: number,
  deadlineMilliseconds = operationJournalNetworkDeadlineMilliseconds
): Promise<Uint8Array> => {
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 ||
      contentLength > operationJournalByteLimits.object) {
    fail("get-object-version", "AWS S3 exact object Content-Length exceeds the admitted byte bound.")
  }
  if (typeof body !== "object" || body === null ||
      typeof (body as { readonly [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] !== "function") {
    fail("get-object-version", "AWS S3 exact object body is not one bounded byte stream.")
  }
  const stream = body as AsyncIterable<unknown>
  const iterator = stream[Symbol.asyncIterator]()
  return withOperationJournalNetworkDeadline(async (signal) => {
    const stop = (): void => {
      try {
        const destroy = (body as { readonly destroy?: (cause?: unknown) => void }).destroy
        if (typeof destroy === "function") destroy.call(body, signal.reason)
      } catch {
        // The deadline result is authoritative; cleanup failures are not a fallback result.
      }
      try {
        const completion = iterator.return?.()
        if (completion !== undefined) void Promise.resolve(completion).catch(() => undefined)
      } catch {
        // The deadline result is authoritative; cleanup failures are not a fallback result.
      }
    }
    signal.addEventListener("abort", stop, { once: true })
    const bytes = new Uint8Array(contentLength)
    let offset = 0
    try {
      while (true) {
        const result = await iterator.next()
        if (result.done === true) break
        const byteChunk = result.value instanceof Uint8Array
          ? result.value
          : fail("get-object-version", "AWS S3 exact object stream emitted a non-byte chunk.")
        if (offset + byteChunk.length > bytes.length) {
          fail("get-object-version", "AWS S3 exact object stream exceeded its admitted Content-Length.")
        }
        bytes.set(byteChunk, offset)
        offset += byteChunk.length
      }
      if (offset !== bytes.length) {
        fail("get-object-version", "AWS S3 exact object stream length disagrees with Content-Length.")
      }
      return bytes
    } finally {
      signal.removeEventListener("abort", stop)
    }
  }, deadlineMilliseconds)
}

const makePolicyCoordinates = (options: AwsS3JournalBoundaryOptions): AwsJournalPolicyCoordinates => ({
  accountId: options.authority.accountId,
  bucketArn: options.authority.bucketArn,
  roleArn: options.authority.roleArn,
  rolePolicyName: options.rolePolicyName,
  oidcTrust: options.authority.oidcTrust
})

const observeAuthority = (
  options: AwsS3JournalBoundaryOptions,
  session: AwsJournalSession,
  clients: AwsJournalClients,
  deadlineMilliseconds: number
): Effect.Effect<S3JournalAuthority, S3JournalBoundaryError> => Effect.tryPromise({
  try: async () => {
    const authority = options.authority
    if (!/^[A-Za-z0-9+=,.@_-]{1,128}$/u.test(options.rolePolicyName)) {
      fail("observe-authority", "Journal inline role policy name is not canonical.")
    }
    const name = roleName(authority.roleArn)
    const [
      roleResponse,
      inlineResponse,
      attachedResponse,
      versioningResponse,
      lockResponse,
      ownershipResponse,
      publicAccessResponse,
      bucketPolicyResponse,
      bucketPolicyStatusResponse,
      callerIdentityResponse
    ] = await Promise.all([
      withOperationJournalNetworkDeadline((signal) => clients.iam.send(
        new GetRoleCommand({ RoleName: name }), { abortSignal: signal }
      ), deadlineMilliseconds),
      withOperationJournalNetworkDeadline((signal) => clients.iam.send(
        new ListRolePoliciesCommand({ RoleName: name, MaxItems: 2 }), { abortSignal: signal }
      ), deadlineMilliseconds),
      withOperationJournalNetworkDeadline((signal) => clients.iam.send(
        new ListAttachedRolePoliciesCommand({ RoleName: name, MaxItems: 1 }), { abortSignal: signal }
      ), deadlineMilliseconds),
      withOperationJournalNetworkDeadline((signal) => clients.s3.send(new GetBucketVersioningCommand({
        Bucket: authority.bucketName,
        ExpectedBucketOwner: authority.expectedBucketOwner
      }), { abortSignal: signal }), deadlineMilliseconds),
      withOperationJournalNetworkDeadline((signal) => clients.s3.send(new GetObjectLockConfigurationCommand({
        Bucket: authority.bucketName,
        ExpectedBucketOwner: authority.expectedBucketOwner
      }), { abortSignal: signal }), deadlineMilliseconds),
      withOperationJournalNetworkDeadline((signal) => clients.s3.send(new GetBucketOwnershipControlsCommand({
        Bucket: authority.bucketName,
        ExpectedBucketOwner: authority.expectedBucketOwner
      }), { abortSignal: signal }), deadlineMilliseconds),
      withOperationJournalNetworkDeadline((signal) => clients.s3.send(new GetPublicAccessBlockCommand({
        Bucket: authority.bucketName,
        ExpectedBucketOwner: authority.expectedBucketOwner
      }), { abortSignal: signal }), deadlineMilliseconds),
      withOperationJournalNetworkDeadline((signal) => clients.s3.send(new GetBucketPolicyCommand({
        Bucket: authority.bucketName,
        ExpectedBucketOwner: authority.expectedBucketOwner
      }), { abortSignal: signal }), deadlineMilliseconds),
      withOperationJournalNetworkDeadline((signal) => clients.s3.send(new GetBucketPolicyStatusCommand({
        Bucket: authority.bucketName,
        ExpectedBucketOwner: authority.expectedBucketOwner
      }), { abortSignal: signal }), deadlineMilliseconds),
      withOperationJournalNetworkDeadline((signal) => clients.sts.send(
        new GetCallerIdentityCommand({}), { abortSignal: signal }
      ), deadlineMilliseconds)
    ])
    const role = roleResponse.Role
    if (role?.Arn !== authority.roleArn || role.RoleName !== name ||
        role.AssumeRolePolicyDocument === undefined || role.PermissionsBoundary !== undefined ||
        role.MaxSessionDuration === undefined || role.MaxSessionDuration < 900) {
      fail("observe-authority", "AWS journal role identity or session governance drifted.")
    }
    if (inlineResponse.IsTruncated === true || inlineResponse.PolicyNames?.length !== 1 ||
        inlineResponse.PolicyNames[0] !== options.rolePolicyName ||
        attachedResponse.IsTruncated === true || (attachedResponse.AttachedPolicies?.length ?? 0) !== 0) {
      fail("observe-authority", "AWS journal role does not contain exactly one inline policy and zero managed policies.")
    }
    const rolePolicyResponse = await withOperationJournalNetworkDeadline((signal) => clients.iam.send(
      new GetRolePolicyCommand({
        RoleName: name,
        PolicyName: options.rolePolicyName
      }),
      { abortSignal: signal }
    ), deadlineMilliseconds)
    if (rolePolicyResponse.RoleName !== name || rolePolicyResponse.PolicyName !== options.rolePolicyName ||
        rolePolicyResponse.PolicyDocument === undefined) {
      fail("observe-authority", "AWS journal inline role policy response is incomplete.")
    }
    if (versioningResponse.Status !== "Enabled") {
      fail("observe-authority", "AWS journal bucket versioning is not enabled.")
    }
    const retention = lockResponse.ObjectLockConfiguration?.Rule?.DefaultRetention
    if (lockResponse.ObjectLockConfiguration?.ObjectLockEnabled !== "Enabled" ||
        retention?.Mode !== "COMPLIANCE" || retention.Years !== 10 || retention.Days !== undefined) {
      fail("observe-authority", "AWS journal bucket Object Lock is not ten-year COMPLIANCE retention.")
    }
    const ownershipRules = ownershipResponse.OwnershipControls?.Rules
    if (ownershipRules?.length !== 1 || ownershipRules[0]?.ObjectOwnership !== "BucketOwnerEnforced") {
      fail("observe-authority", "AWS journal bucket ownership is not BucketOwnerEnforced.")
    }
    const publicBlock = publicAccessResponse.PublicAccessBlockConfiguration
    if (publicBlock?.BlockPublicAcls !== true || publicBlock.IgnorePublicAcls !== true ||
        publicBlock.BlockPublicPolicy !== true || publicBlock.RestrictPublicBuckets !== true ||
        bucketPolicyStatusResponse.PolicyStatus?.IsPublic !== false) {
      fail("observe-authority", "AWS journal bucket public access is not completely blocked.")
    }
    if (callerIdentityResponse.Account !== authority.accountId ||
        callerIdentityResponse.Arn !== session.callerArn ||
        callerIdentityResponse.UserId === undefined || callerIdentityResponse.UserId.length === 0) {
      fail("observe-authority", "AWS STS caller identity drifted from the exact journal role session.")
    }
    const policyDigests = validateAwsJournalPolicies({
      coordinates: makePolicyCoordinates(options),
      trustPolicyDocument: role!.AssumeRolePolicyDocument as string,
      rolePolicyDocument: rolePolicyResponse.PolicyDocument as string,
      bucketPolicyDocument: requireString(bucketPolicyResponse.Policy, "observe-authority", "AWS journal bucket policy")
    })
    assertAwsJournalPolicyDigests(authority, policyDigests)
    const oidcTrust = {
      audience: session.oidc.audience,
      subject: session.oidc.subject,
      repository: session.oidc.repository,
      repositoryId: session.oidc.repositoryId,
      repositoryOwnerId: session.oidc.repositoryOwnerId,
      workflow: session.oidc.workflow,
      ref: session.oidc.ref,
      environment: session.oidc.environment,
      jobWorkflowRef: session.oidc.jobWorkflowRef
    }
    return {
      accountId: authority.accountId,
      bucketName: authority.bucketName,
      bucketArn: authority.bucketArn,
      region: authority.region,
      roleArn: authority.roleArn,
      prefix: "operation-journal/v1",
      expectedBucketOwner: authority.expectedBucketOwner,
      versioning: "Enabled",
      objectLock: "Enabled",
      retentionMode: "COMPLIANCE",
      retentionYears: 10,
      bucketOwnerEnforced: true,
      publicAccessBlocked: true,
      deleteDenied: true,
      multipartDenied: true,
      conditionalWritesEnforced: true,
      ...policyDigests,
      oidc: session.oidc,
      oidcTrust
    }
  },
  catch: (cause) => boundaryError(cause, "observe-authority", "AWS journal authority observation failed.")
})

const listNamespace = (
  options: AwsS3JournalBoundaryOptions,
  client: S3Client,
  input: Parameters<S3JournalBoundaryShape["listNamespace"]>[0],
  deadlineMilliseconds: number
): Effect.Effect<S3JournalNamespaceListing, S3JournalBoundaryError> => Effect.tryPromise({
  try: async () => {
    requireSealedInput(input, options.authority, "list-namespace")
    if (!journalNamespacePattern.test(input.prefix) || input.maximum !== 512) {
      fail("list-namespace", "AWS journal namespace read escaped its exact bound.")
    }
    const response = await withOperationJournalNetworkDeadline((signal) => client.send(
      new ListObjectVersionsCommand({
        Bucket: input.bucketName,
        Prefix: input.prefix,
        MaxKeys: input.maximum,
        ExpectedBucketOwner: input.expectedBucketOwner
      }),
      { abortSignal: signal }
    ), deadlineMilliseconds)
    if (response.Name !== input.bucketName || response.Prefix !== input.prefix ||
        response.MaxKeys !== input.maximum || typeof response.IsTruncated !== "boolean") {
      fail("list-namespace", "AWS S3 version listing identity or bound drifted from the exact request.")
    }
    if ((response.Versions?.length ?? 0) + (response.DeleteMarkers?.length ?? 0) > input.maximum) {
      fail("list-namespace", "AWS S3 version listing exceeded its exact response bound.")
    }
    const versions = (response.Versions ?? []).map((version, index) => {
      const key = requireString(version.Key, "list-namespace", `AWS S3 version ${index} key`)
      const versionId = requireString(version.VersionId, "list-namespace", `AWS S3 version ${index} VersionId`)
      const etag = requireString(version.ETag, "list-namespace", `AWS S3 version ${index} ETag`)
      if ((!journalEventKeyPattern.test(key) && !journalHeadKeyPattern.test(key)) ||
          !isCanonicalS3VersionId(versionId) || !/^"[!#-~]{1,1024}"$/u.test(etag)) {
        fail("list-namespace", `AWS S3 version ${index} identity is not canonical.`)
      }
      return { key, versionId, etag, isLatest: version.IsLatest === true }
    })
    const deleteMarkers = (response.DeleteMarkers ?? []).map((marker, index) => {
      const key = requireString(marker.Key, "list-namespace", `AWS S3 delete marker ${index} key`)
      const versionId = requireString(marker.VersionId, "list-namespace", `AWS S3 delete marker ${index} VersionId`)
      if ((!journalEventKeyPattern.test(key) && !journalHeadKeyPattern.test(key)) ||
          !isCanonicalS3VersionId(versionId)) {
        fail("list-namespace", `AWS S3 delete marker ${index} identity is not canonical.`)
      }
      return { key, versionId }
    })
    if (versions.some((version) => !version.key.startsWith(input.prefix)) ||
        deleteMarkers.some((marker) => !marker.key.startsWith(input.prefix))) {
      fail("list-namespace", "AWS S3 returned an object outside the exact journal prefix.")
    }
    return { versions, deleteMarkers, truncated: response.IsTruncated === true }
  },
  catch: (cause) => boundaryError(cause, "list-namespace", `AWS S3 journal namespace read failed (${errorName(cause)}).`)
})

const getObjectVersion = (
  options: AwsS3JournalBoundaryOptions,
  client: S3Client,
  input: Parameters<S3JournalBoundaryShape["getObjectVersion"]>[0],
  deadlineMilliseconds: number
): Effect.Effect<S3JournalObjectVersion, S3JournalBoundaryError> => Effect.tryPromise({
  try: async () => {
    requireSealedInput(input, options.authority, "get-object-version")
    if ((!journalEventKeyPattern.test(input.key) && !journalHeadKeyPattern.test(input.key)) ||
        !isCanonicalS3VersionId(input.versionId)) {
      fail("get-object-version", "AWS journal exact-version read escaped its sealed namespace.")
    }
    const response = await withOperationJournalNetworkDeadline((signal) => client.send(
      new GetObjectCommand({
        Bucket: input.bucketName,
        Key: input.key,
        VersionId: input.versionId,
        ExpectedBucketOwner: input.expectedBucketOwner,
        ChecksumMode: "ENABLED"
      }),
      { abortSignal: signal }
    ), deadlineMilliseconds)
    if (response.Body === undefined || response.ContentLength === undefined || response.LastModified === undefined ||
        response.ObjectLockMode !== "COMPLIANCE" || response.ObjectLockRetainUntilDate === undefined ||
        (response.ChecksumType !== undefined && response.ChecksumType !== "FULL_OBJECT")) {
      fail("get-object-version", "AWS S3 exact object response lacks bytes, time, checksum, or COMPLIANCE retention.")
    }
    const retainUntil = response.ObjectLockRetainUntilDate as Date
    const body = response.Body!
    const lastModified = response.LastModified as Date
    const retention = await withOperationJournalNetworkDeadline((signal) => client.send(
      new GetObjectRetentionCommand({
        Bucket: input.bucketName,
        Key: input.key,
        VersionId: input.versionId,
        ExpectedBucketOwner: input.expectedBucketOwner
      }),
      { abortSignal: signal }
    ), deadlineMilliseconds)
    if (retention.Retention?.Mode !== "COMPLIANCE" || retention.Retention.RetainUntilDate === undefined ||
        retention.Retention.RetainUntilDate.getTime() !== retainUntil.getTime()) {
      fail("get-object-version", "AWS S3 exact object retention disagrees with its independent retention read.")
    }
    const bytes = await readBoundedObjectBody(body, response.ContentLength as number, deadlineMilliseconds)
    const attributes = await withOperationJournalNetworkDeadline((signal) => client.send(
      new GetObjectAttributesCommand({
        Bucket: input.bucketName,
        Key: input.key,
        VersionId: input.versionId,
        ExpectedBucketOwner: input.expectedBucketOwner,
        ObjectAttributes: ["Checksum", "ETag", "ObjectSize"]
      }),
      { abortSignal: signal }
    ), deadlineMilliseconds)
    const responseVersionId = requireString(response.VersionId, "get-object-version", "AWS S3 exact object VersionId")
    const checksumSha256 = checksumFromBase64(response.ChecksumSHA256, "get-object-version")
    if (responseVersionId !== input.versionId || attributes.DeleteMarker === true || attributes.VersionId !== input.versionId ||
        attributes.ETag !== response.ETag || attributes.ObjectSize !== bytes.length ||
        attributes.Checksum?.ChecksumType !== "FULL_OBJECT" ||
        checksumFromBase64(attributes.Checksum.ChecksumSHA256, "get-object-version") !== checksumSha256) {
      fail("get-object-version", "AWS S3 exact object attributes disagree with its retained bytes and version.")
    }
    return {
      key: input.key,
      versionId: responseVersionId,
      etag: requireString(response.ETag, "get-object-version", "AWS S3 exact object ETag"),
      checksumSha256,
      bytes,
      lastModified: lastModified.toISOString(),
      retentionMode: "COMPLIANCE",
      retainUntil: retainUntil.toISOString()
    }
  },
  catch: (cause) => boundaryError(cause, "get-object-version", `AWS S3 exact journal object read failed (${errorName(cause)}).`)
})

const putObject = (
  options: AwsS3JournalBoundaryOptions,
  client: S3Client,
  input: S3JournalPutRequest,
  operation: "put-event" | "put-head",
  deadlineMilliseconds: number
): Effect.Effect<S3JournalPutResult, S3JournalBoundaryError> => Effect.tryPromise({
  try: async () => {
    requireSealedInput(input, options.authority, operation)
    if (operation === "put-event" ? !journalEventKeyPattern.test(input.key) : !journalHeadKeyPattern.test(input.key)) {
      fail(operation, "AWS S3 conditional write key is outside its exact journal object class.")
    }
    if (!(input.bytes instanceof Uint8Array) || input.bytes.length < 1 ||
        input.bytes.length > operationJournalByteLimits.object) {
      fail(operation, "AWS S3 conditional write bytes exceed the admitted object bound.")
    }
    if (objectChecksum(input.bytes) !== input.checksumSha256) {
      fail(operation, "AWS S3 conditional write checksum does not match its exact bytes.")
    }
    if (input.condition._tag === "IfMatch" && !/^"[!#-~]{1,1024}"$/u.test(input.condition.etag)) {
      fail(operation, "AWS S3 If-Match ETag is not canonical.")
    }
    const checksum = checksumToBase64(input.checksumSha256, operation)
    let response
    try {
      response = await withOperationJournalNetworkDeadline((signal) => client.send(
        new PutObjectCommand({
          Bucket: input.bucketName,
          Key: input.key,
          Body: new Uint8Array(input.bytes),
          ContentLength: input.bytes.length,
          ContentType: "application/octet-stream",
          ChecksumAlgorithm: "SHA256",
          ChecksumSHA256: checksum,
          ExpectedBucketOwner: input.expectedBucketOwner,
          ...(input.condition._tag === "IfNoneMatch"
            ? { IfNoneMatch: "*" }
            : { IfMatch: input.condition.etag })
        }),
        { abortSignal: signal }
      ), deadlineMilliseconds)
    } catch (cause) {
      const status = statusCode(cause)
      if (status === 409 || status === 412) return { _tag: "PreconditionFailed" }
      throw cause
    }
    const versionId = requireString(response.VersionId, operation, "AWS S3 committed object VersionId")
    const etag = requireString(response.ETag, operation, "AWS S3 committed object ETag")
    const responseChecksum = checksumFromBase64(response.ChecksumSHA256, operation)
    if (responseChecksum !== input.checksumSha256 ||
        (response.ChecksumType !== undefined && response.ChecksumType !== "FULL_OBJECT")) {
      fail(operation, "AWS S3 committed object checksum disagrees with the exact request bytes.")
    }
    return { _tag: "Committed", versionId, etag, checksumSha256: responseChecksum }
  },
  catch: (cause) => putFailure(cause, operation)
})

export const makeAwsS3JournalBoundaryFromClients = (
  options: AwsS3JournalBoundaryOptions,
  session: AwsJournalSession,
  clients: AwsJournalClients,
  deadlineMilliseconds = operationJournalNetworkDeadlineMilliseconds
): S3JournalBoundaryShape => ({
  observeAuthority: () => observeAuthority(options, session, clients, deadlineMilliseconds),
  listNamespace: (input) => listNamespace(options, clients.s3, input, deadlineMilliseconds),
  getObjectVersion: (input) => getObjectVersion(options, clients.s3, input, deadlineMilliseconds),
  putEvent: (input) => putObject(options, clients.s3, input, "put-event", deadlineMilliseconds),
  putHead: (input) => putObject(options, clients.s3, input, "put-head", deadlineMilliseconds)
})
