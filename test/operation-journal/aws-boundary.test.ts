import { describe, expect, test } from "bun:test"
import { Readable } from "node:stream"
import { IAMClient } from "@aws-sdk/client-iam"
import { S3Client } from "@aws-sdk/client-s3"
import { STSClient } from "@aws-sdk/client-sts"
import * as Effect from "effect/Effect"
import { objectChecksum } from "../../src/operation-journal/canonical.js"
import {
  makeAwsS3JournalBoundaryFromClients,
  readBoundedObjectBody
} from "../../src/operation-journal/aws/s3-boundary.js"
import type { AwsJournalSession } from "../../src/operation-journal/aws/oidc.js"
import { awsAuthority, policyDocuments, rolePolicyName } from "./aws-fixture.js"

interface WireRequest {
  readonly method: string
  readonly hostname: string
  readonly path: string
  readonly query?: Readonly<Record<string, string | ReadonlyArray<string> | null>>
  readonly headers: Readonly<Record<string, string>>
  readonly body?: unknown
}

const credentials = {
  accessKeyId: "ASIATEMPORARY",
  secretAccessKey: "temporary-secret",
  sessionToken: "temporary-session",
  expiration: new Date("2026-09-01T12:15:00.000Z")
}

const session: AwsJournalSession = {
  credentials,
  oidc: awsAuthority.oidc,
  callerArn: "arn:aws:sts::123456789012:assumed-role/fixture-operation-journal/ts-release-journal-42-1"
}

const response = (
  statusCode: number,
  body: string | Uint8Array = "",
  headers: Readonly<Record<string, string>> = {}
) => ({
  response: {
    statusCode,
    headers,
    body: Readable.from([typeof body === "string" ? Buffer.from(body) : body])
  }
})

const makeClients = (
  handle: (request: WireRequest) => Promise<ReturnType<typeof response>>
) => {
  const requestHandler = { handle } as never
  return {
    iam: new IAMClient({ region: awsAuthority.region, credentials, maxAttempts: 1, requestHandler }),
    s3: new S3Client({
      region: awsAuthority.region,
      credentials,
      maxAttempts: 1,
      followRegionRedirects: false,
      forcePathStyle: false,
      useArnRegion: false,
      requestHandler
    }),
    sts: new STSClient({ region: awsAuthority.region, credentials, maxAttempts: 1, requestHandler })
  }
}

const makeBoundary = (handle: (request: WireRequest) => Promise<ReturnType<typeof response>>) =>
  makeAwsS3JournalBoundaryFromClients(
    { authority: awsAuthority, rolePolicyName },
    session,
    makeClients(handle)
  )

describe("production AWS S3 journal boundary", () => {
  test("re-observes exact IAM and bucket governance instead of trusting activation booleans", async () => {
    const commands: Array<{ readonly name: string, readonly input: Readonly<Record<string, unknown>> }> = []
    const send = async (command: { readonly constructor: { readonly name: string }, readonly input: Readonly<Record<string, unknown>> }) => {
      commands.push({ name: command.constructor.name, input: command.input })
      switch (command.constructor.name) {
        case "GetRoleCommand":
          return {
            Role: {
              Arn: awsAuthority.roleArn,
              RoleName: "fixture-operation-journal",
              AssumeRolePolicyDocument: encodeURIComponent(policyDocuments.trust),
              MaxSessionDuration: 900
            }
          }
        case "ListRolePoliciesCommand":
          return { IsTruncated: false, PolicyNames: [rolePolicyName] }
        case "ListAttachedRolePoliciesCommand":
          return { AttachedPolicies: [], IsTruncated: false }
        case "GetRolePolicyCommand":
          return {
            PolicyDocument: encodeURIComponent(policyDocuments.role),
            PolicyName: rolePolicyName,
            RoleName: "fixture-operation-journal"
          }
        case "GetBucketVersioningCommand":
          return { Status: "Enabled" }
        case "GetObjectLockConfigurationCommand":
          return {
            ObjectLockConfiguration: {
              ObjectLockEnabled: "Enabled",
              Rule: { DefaultRetention: { Mode: "COMPLIANCE", Years: 10 } }
            }
          }
        case "GetBucketOwnershipControlsCommand":
          return { OwnershipControls: { Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }] } }
        case "GetPublicAccessBlockCommand":
          return {
            PublicAccessBlockConfiguration: {
              BlockPublicAcls: true,
              IgnorePublicAcls: true,
              BlockPublicPolicy: true,
              RestrictPublicBuckets: true
            }
          }
        case "GetBucketPolicyCommand":
          return { Policy: policyDocuments.bucket }
        case "GetBucketPolicyStatusCommand":
          return { PolicyStatus: { IsPublic: false } }
        case "GetCallerIdentityCommand":
          return { Account: awsAuthority.accountId, Arn: session.callerArn, UserId: "AROAFIXTURE:ts-release-journal-42-1" }
        default:
          throw new Error(`Unexpected command ${command.constructor.name}`)
      }
    }
    const boundary = makeAwsS3JournalBoundaryFromClients(
      { authority: awsAuthority, rolePolicyName },
      session,
      {
        iam: { send } as unknown as IAMClient,
        s3: { send } as unknown as S3Client,
        sts: { send } as unknown as STSClient
      }
    )
    expect(await Effect.runPromise(boundary.observeAuthority())).toEqual(awsAuthority)
    expect(commands).toHaveLength(11)
    const s3Commands = commands.filter((command) => command.name.startsWith("GetBucket") ||
      command.name === "GetObjectLockConfigurationCommand" || command.name === "GetPublicAccessBlockCommand")
    expect(s3Commands).toHaveLength(6)
    for (const command of s3Commands) {
      expect(command.input.ExpectedBucketOwner).toBe(awsAuthority.expectedBucketOwner)
      expect(command.input.Bucket).toBe(awsAuthority.bucketName)
    }
    expect(commands.find((command) => command.name === "ListRolePoliciesCommand")?.input.MaxItems).toBe(2)
    expect(commands.find((command) => command.name === "ListAttachedRolePoliciesCommand")?.input.MaxItems).toBe(1)
  })

  test("serializes exact single-part conditional bytes and normalizes only the AWS checksum boundary", async () => {
    const requests: Array<WireRequest> = []
    const bytes = new TextEncoder().encode("canonical-event")
    const checksum = objectChecksum(bytes)
    const checksumBase64 = Buffer.from(checksum.slice(7), "hex").toString("base64")
    const boundary = makeBoundary(async (request) => {
      requests.push(request)
      return response(200, "", {
        etag: '"etag-1"',
        "x-amz-checksum-sha256": checksumBase64,
        "x-amz-checksum-type": "FULL_OBJECT",
        "x-amz-version-id": "version+1=/opaque"
      })
    })
    const event = await Effect.runPromise(boundary.putEvent({
      bucketName: awsAuthority.bucketName,
      expectedBucketOwner: awsAuthority.expectedBucketOwner,
      region: awsAuthority.region,
      key: `operation-journal/v1/${"a".repeat(40)}/${"b".repeat(64)}/events/00000001/12345678-1234-4123-8123-123456789abc.bin`,
      bytes,
      checksumSha256: checksum,
      condition: { _tag: "IfNoneMatch" }
    }))
    expect(event).toEqual({
      _tag: "Committed",
      versionId: "version+1=/opaque",
      etag: '"etag-1"',
      checksumSha256: checksum
    })
    expect(requests).toHaveLength(1)
    const request = requests[0]!
    expect(request.method).toBe("PUT")
    expect(request.hostname).toBe(`${awsAuthority.bucketName}.s3.${awsAuthority.region}.amazonaws.com`)
    expect(request.headers["if-none-match"]).toBe("*")
    expect(request.headers["if-match"]).toBeUndefined()
    expect(request.headers["x-amz-checksum-sha256"]).toBe(checksumBase64)
    expect(request.headers["x-amz-sdk-checksum-algorithm"]).toBe("SHA256")
    expect(request.headers["x-amz-checksum-crc32"]).toBeUndefined()
    expect(request.headers["x-amz-expected-bucket-owner"]).toBe(awsAuthority.expectedBucketOwner)
    expect(request.headers.authorization).toContain("Credential=ASIATEMPORARY/")
    expect(request.headers["x-amz-security-token"]).toBe("temporary-session")
    expect(request.headers["x-amz-object-lock-mode"]).toBeUndefined()
    expect(request.headers["x-amz-acl"]).toBeUndefined()
    expect(request.headers["x-amz-tagging"]).toBeUndefined()
    expect(new Uint8Array(request.body as Uint8Array)).toEqual(bytes)
  })

  test("serializes exact VersionId reads, checksum mode, retention reread, and bounded listing", async () => {
    const requests: Array<WireRequest> = []
    const key = `operation-journal/v1/${"a".repeat(40)}/${"b".repeat(64)}/head.bin`
    const prefix = key.slice(0, -"head.bin".length)
    const bytes = new TextEncoder().encode("head-bytes")
    const checksum = objectChecksum(bytes)
    const checksumBase64 = Buffer.from(checksum.slice(7), "hex").toString("base64")
    const retainedUntil = "2036-09-01T12:00:00.000Z"
    const boundary = makeBoundary(async (request) => {
      requests.push(request)
      if (request.query !== undefined && Object.hasOwn(request.query, "versions")) {
        return response(200, `<?xml version="1.0" encoding="UTF-8"?>
<ListVersionsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${awsAuthority.bucketName}</Name><Prefix>${prefix}</Prefix><MaxKeys>512</MaxKeys><IsTruncated>false</IsTruncated>
  <Version><Key>${key}</Key><VersionId>version+1=/opaque</VersionId><IsLatest>true</IsLatest><LastModified>2026-09-01T12:00:00.000Z</LastModified><ETag>&quot;etag-1&quot;</ETag><Size>${bytes.length}</Size><StorageClass>STANDARD</StorageClass></Version>
</ListVersionsResult>`, { "content-type": "application/xml" })
      }
      if (request.query !== undefined && Object.hasOwn(request.query, "retention")) {
        return response(200, `<?xml version="1.0" encoding="UTF-8"?>
<Retention xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Mode>COMPLIANCE</Mode><RetainUntilDate>${retainedUntil}</RetainUntilDate></Retention>`, {
          "content-type": "application/xml"
        })
      }
      if (request.query !== undefined && Object.hasOwn(request.query, "attributes")) {
        return response(200, `<?xml version="1.0" encoding="UTF-8"?>
<GetObjectAttributesOutput xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <ETag>&quot;etag-1&quot;</ETag>
  <Checksum><ChecksumSHA256>${checksumBase64}</ChecksumSHA256><ChecksumType>FULL_OBJECT</ChecksumType></Checksum>
  <ObjectSize>${bytes.length}</ObjectSize>
</GetObjectAttributesOutput>`, {
          "content-type": "application/xml",
          "last-modified": "Tue, 01 Sep 2026 12:00:00 GMT",
          "x-amz-version-id": "version+1=/opaque"
        })
      }
      return response(200, bytes, {
        "content-length": String(bytes.length),
        etag: '"etag-1"',
        "last-modified": "Tue, 01 Sep 2026 12:00:00 GMT",
        "x-amz-checksum-sha256": checksumBase64,
        "x-amz-checksum-type": "FULL_OBJECT",
        "x-amz-object-lock-mode": "COMPLIANCE",
        "x-amz-object-lock-retain-until-date": retainedUntil,
        "x-amz-version-id": "version+1=/opaque"
      })
    })
    const listing = await Effect.runPromise(boundary.listNamespace({
      bucketName: awsAuthority.bucketName,
      expectedBucketOwner: awsAuthority.expectedBucketOwner,
      region: awsAuthority.region,
      prefix,
      maximum: 512
    }))
    expect(listing).toEqual({
      versions: [{ key, versionId: "version+1=/opaque", etag: '"etag-1"', isLatest: true }],
      deleteMarkers: [],
      truncated: false
    })
    const object = await Effect.runPromise(boundary.getObjectVersion({
      bucketName: awsAuthority.bucketName,
      expectedBucketOwner: awsAuthority.expectedBucketOwner,
      region: awsAuthority.region,
      key,
      versionId: "version+1=/opaque"
    }))
    expect(object).toEqual({
      key,
      versionId: "version+1=/opaque",
      etag: '"etag-1"',
      checksumSha256: checksum,
      bytes,
      lastModified: "2026-09-01T12:00:00.000Z",
      retentionMode: "COMPLIANCE",
      retainUntil: retainedUntil
    })
    expect(requests).toHaveLength(4)
    expect(requests[0]!.query?.["max-keys"]).toBe("512")
    expect(requests[0]!.headers["x-amz-expected-bucket-owner"]).toBe(awsAuthority.expectedBucketOwner)
    expect(requests[1]!.query?.versionId).toBe("version+1=/opaque")
    expect(requests[1]!.headers["x-amz-checksum-mode"]).toBe("ENABLED")
    expect(requests[2]!.query?.versionId).toBe("version+1=/opaque")
    expect(Object.hasOwn(requests[2]!.query ?? {}, "retention")).toBe(true)
    expect(requests[3]!.query?.versionId).toBe("version+1=/opaque")
    expect(Object.hasOwn(requests[3]!.query ?? {}, "attributes")).toBe(true)
    expect(requests[3]!.headers["x-amz-object-attributes"]).toBe("Checksum, ETag, ObjectSize")
  })

  test("rejects oversized or length-smuggled S3 object streams before allocation", async () => {
    const oneChunk = (bytes: Uint8Array): AsyncIterable<Uint8Array> => ({
      async *[Symbol.asyncIterator]() {
        yield bytes
      }
    })
    try {
      await readBoundedObjectBody(oneChunk(new Uint8Array([1])), 1_500_001)
      throw new Error("Expected oversized S3 object rejection")
    } catch (cause) {
      expect((cause as { readonly reason: string }).reason).toContain("Content-Length exceeds")
    }

    try {
      await readBoundedObjectBody(oneChunk(new Uint8Array([1, 2])), 1)
      throw new Error("Expected length-smuggled S3 object rejection")
    } catch (cause) {
      expect((cause as { readonly reason: string }).reason).toContain("stream exceeded")
    }
  })

  test("aborts a hung S3 send and a hung response body at the total deadline", async () => {
    let sendSignal: AbortSignal | undefined
    const hangingClient = {
      send: (_command: unknown, options?: { readonly abortSignal?: AbortSignal }) => {
        sendSignal = options?.abortSignal
        return new Promise<never>(() => undefined)
      }
    }
    const boundary = makeAwsS3JournalBoundaryFromClients(
      { authority: awsAuthority, rolePolicyName },
      session,
      {
        iam: hangingClient as unknown as IAMClient,
        s3: hangingClient as unknown as S3Client,
        sts: hangingClient as unknown as STSClient
      },
      10
    )
    await expect(Effect.runPromise(boundary.listNamespace({
      bucketName: awsAuthority.bucketName,
      expectedBucketOwner: awsAuthority.expectedBucketOwner,
      region: awsAuthority.region,
      prefix: `operation-journal/v1/${"a".repeat(40)}/${"b".repeat(64)}/`,
      maximum: 512
    }))).rejects.toMatchObject({ operation: "list-namespace" })
    expect(sendSignal?.aborted).toBe(true)

    let returned = false
    const hangingBody: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator]: () => ({
        next: () => new Promise<IteratorResult<Uint8Array>>(() => undefined),
        return: async () => {
          returned = true
          return { done: true, value: undefined }
        }
      })
    }
    await expect(readBoundedObjectBody(hangingBody, 1, 10)).rejects.toMatchObject({
      name: "OperationJournalNetworkDeadlineExceeded"
    })
    expect(returned).toBe(true)
  })

  test("maps only 409/412 to CAS conflict and treats response loss as commitment unknown", async () => {
    const bytes = new TextEncoder().encode("head")
    const request = {
      bucketName: awsAuthority.bucketName,
      expectedBucketOwner: awsAuthority.expectedBucketOwner,
      region: awsAuthority.region,
      key: `operation-journal/v1/${"a".repeat(40)}/${"b".repeat(64)}/head.bin`,
      bytes,
      checksumSha256: objectChecksum(bytes),
      condition: { _tag: "IfMatch", etag: '"etag-0"' } as const
    }
    for (const status of [409, 412]) {
      const boundary = makeBoundary(async () => response(status, `<?xml version="1.0"?><Error><Code>PreconditionFailed</Code><Message>conflict</Message></Error>`, {
        "content-type": "application/xml"
      }))
      expect(await Effect.runPromise(boundary.putHead(request))).toEqual({ _tag: "PreconditionFailed" })
    }
    const forbidden = makeBoundary(async () => response(403, `<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>forbidden</Message></Error>`, {
      "content-type": "application/xml"
    }))
    await expect(Effect.runPromise(forbidden.putHead(request))).rejects.toMatchObject({
      _tag: "S3JournalBoundaryError",
      commitment: "not-committed",
      operation: "put-head"
    })
    const boundary = makeBoundary(async () => {
      throw Object.assign(new Error("socket closed after send"), { name: "TimeoutError" })
    })
    try {
      await Effect.runPromise(boundary.putHead(request))
      throw new Error("Expected unknown write outcome")
    } catch (cause) {
      expect(cause).toMatchObject({ _tag: "S3JournalBoundaryError", commitment: "unknown", operation: "put-head" })
      expect(String(cause)).not.toContain("socket closed after send")
    }

    let deadlineSignal: AbortSignal | undefined
    const hanging = {
      send: (_command: unknown, options?: { readonly abortSignal?: AbortSignal }) => {
        deadlineSignal = options?.abortSignal
        return new Promise<never>(() => undefined)
      }
    }
    const timedBoundary = makeAwsS3JournalBoundaryFromClients(
      { authority: awsAuthority, rolePolicyName },
      session,
      {
        iam: hanging as unknown as IAMClient,
        s3: hanging as unknown as S3Client,
        sts: hanging as unknown as STSClient
      },
      10
    )
    await expect(Effect.runPromise(timedBoundary.putHead(request))).rejects.toMatchObject({
      _tag: "S3JournalBoundaryError",
      commitment: "unknown",
      operation: "put-head"
    })
    expect(deadlineSignal?.aborted).toBe(true)
  })
})
