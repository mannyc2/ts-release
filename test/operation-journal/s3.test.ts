import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import {
  JournalAuthorityMismatch,
  JournalIntegrityError,
  JournalStorageOutcomeUnknown,
  JournalTransitionError,
  S3JournalBoundaryError,
  journalEventKey,
  journalNamespace,
  makeS3CanonicalOperationJournal,
  type JournalAppendRequest,
  type S3JournalAuthority,
  type S3JournalBoundaryShape,
  type S3JournalObjectVersion,
  type S3JournalPutRequest,
  type S3JournalPutResult
} from "../../src/operation-journal.js"
import {
  decodeJournalEvent,
  decodeJournalHead,
  encodeJournalEvent,
  makeCanonicalJournalRecord,
  objectChecksum
} from "../../src/operation-journal/canonical.js"
import { makeJournalEvent } from "../../src/operation-journal/reducer.js"

const authority = {
  accountId: "123456789012",
  bucketName: "effect-build-operation-journal",
  bucketArn: "arn:aws:s3:::effect-build-operation-journal",
  region: "us-east-1",
  roleArn: "arn:aws:iam::123456789012:role/effect-build-operation-journal",
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
    subject: "repo:mannyc2@126291407/effect-build@1331906770:environment:apple-certification",
    repository: "mannyc2/effect-build",
    repositoryId: "1331906770",
    repositoryOwnerId: "126291407",
    repositoryVisibility: "public",
    eventName: "workflow_dispatch",
    ref: "refs/heads/main",
    refType: "branch",
    sha: "a".repeat(40),
    environment: "apple-certification",
    runnerEnvironment: "github-hosted",
    runId: "42",
    runAttempt: "1",
    workflow: "Apple Certification",
    workflowRef: "mannyc2/effect-build/.github/workflows/apple-certification.yml@refs/heads/main",
    workflowSha: "a".repeat(40),
    jobWorkflowRef: `mannyc2/ts-release/.github/workflows/operational-journal.yml@${"c".repeat(40)}`,
    jobWorkflowSha: "c".repeat(40)
  },
  oidcTrust: {
    audience: "sts.amazonaws.com",
    subject: "repo:mannyc2@126291407/effect-build@1331906770:environment:apple-certification",
    repository: "mannyc2/effect-build",
    repositoryId: "1331906770",
    repositoryOwnerId: "126291407",
    workflow: "Apple Certification",
    ref: "refs/heads/main",
    environment: "apple-certification",
    jobWorkflowRef: `mannyc2/ts-release/.github/workflows/operational-journal.yml@${"c".repeat(40)}`
  }
} as const satisfies S3JournalAuthority

type PutFault = "before-unknown" | "after-unknown"

class FakeS3Journal {
  observedAuthority: S3JournalAuthority = authority
  readonly objects = new Map<string, Array<S3JournalObjectVersion>>()
  readonly calls = { authority: 0, list: 0, get: 0, eventPut: 0, headPut: 0, headPrecondition: 0 }
  nextEventFault: PutFault | undefined
  nextHeadFault: PutFault | undefined
  nextHeadDefect = false
  nextListFailure = false
  failRecoveryListAfterEvent = false
  nextVersionId: string | undefined
  deleteMarkers: Array<{ readonly key: string, readonly versionId: string }> = []
  private version = 0
  private headBarrierTarget = 0
  private headBarrierArrivals = 0
  private headBarrierPromise: Promise<void> | undefined
  private releaseHeadBarrier: (() => void) | undefined

  enableHeadBarrier(target: number): void {
    this.headBarrierTarget = target
    this.headBarrierArrivals = 0
    this.headBarrierPromise = new Promise((resolve) => {
      this.releaseHeadBarrier = resolve
    })
  }

  private async waitAtHeadBarrier(): Promise<void> {
    const barrier = this.headBarrierPromise
    if (barrier === undefined) return
    this.headBarrierArrivals += 1
    if (this.headBarrierArrivals === this.headBarrierTarget) {
      this.releaseHeadBarrier?.()
      this.headBarrierPromise = undefined
      this.releaseHeadBarrier = undefined
    }
    await barrier
  }

  private boundaryError(
    operation: "list-namespace" | "get-object-version" | "put-event" | "put-head",
    commitment: "not-applicable" | "not-committed" | "unknown"
  ): S3JournalBoundaryError {
    return S3JournalBoundaryError.make({ operation, commitment, reason: "fake boundary fault" })
  }

  private latest(key: string): S3JournalObjectVersion | undefined {
    return this.objects.get(key)?.at(-1)
  }

  private commit(request: S3JournalPutRequest): S3JournalPutResult {
    expect(request.bucketName).toBe(authority.bucketName)
    expect(request.expectedBucketOwner).toBe(authority.expectedBucketOwner)
    expect(request.region).toBe(authority.region)
    expect(request.checksumSha256).toMatch(/^sha256:[a-f0-9]{64}$/u)
    const latest = this.latest(request.key)
    if (request.condition._tag === "IfNoneMatch" && latest !== undefined) {
      return { _tag: "PreconditionFailed" }
    }
    if (request.condition._tag === "IfMatch" && latest?.etag !== request.condition.etag) {
      return { _tag: "PreconditionFailed" }
    }
    this.version += 1
    const object: S3JournalObjectVersion = {
      key: request.key,
      versionId: this.nextVersionId ?? `version-${this.version}`,
      etag: `"etag-${this.version}"`,
      checksumSha256: request.checksumSha256,
      bytes: new Uint8Array(request.bytes),
      lastModified: "2026-09-01T00:00:00.000Z",
      retentionMode: "COMPLIANCE",
      retainUntil: "2036-09-01T00:00:00.000Z"
    }
    this.nextVersionId = undefined
    const versions = this.objects.get(request.key) ?? []
    versions.push(object)
    this.objects.set(request.key, versions)
    return {
      _tag: "Committed",
      versionId: object.versionId,
      etag: object.etag,
      checksumSha256: object.checksumSha256
    }
  }

  private put(
    kind: "event" | "head",
    request: S3JournalPutRequest
  ): Effect.Effect<S3JournalPutResult, S3JournalBoundaryError> {
    if (kind === "event") this.calls.eventPut += 1
    else this.calls.headPut += 1
    const fault = kind === "event" ? this.nextEventFault : this.nextHeadFault
    if (kind === "event") this.nextEventFault = undefined
    else this.nextHeadFault = undefined
    if (fault === "before-unknown") {
      return Effect.fail(this.boundaryError(kind === "event" ? "put-event" : "put-head", "unknown"))
    }
    const result = this.commit(request)
    if (kind === "head" && result._tag === "PreconditionFailed") this.calls.headPrecondition += 1
    if (kind === "event" && this.failRecoveryListAfterEvent) {
      this.failRecoveryListAfterEvent = false
      this.nextListFailure = true
    }
    if (fault === "after-unknown") {
      return Effect.fail(this.boundaryError(kind === "event" ? "put-event" : "put-head", "unknown"))
    }
    return Effect.succeed(result)
  }

  readonly boundary: S3JournalBoundaryShape = {
    observeAuthority: () => Effect.sync(() => {
      this.calls.authority += 1
      return this.observedAuthority
    }),
    listNamespace: (input) => {
      this.calls.list += 1
      if (this.nextListFailure) {
        this.nextListFailure = false
        return Effect.fail(this.boundaryError("list-namespace", "not-applicable"))
      }
      const versions = [...this.objects.entries()]
        .filter(([key]) => key.startsWith(input.prefix))
        .flatMap(([key, values]) => values.map((value, index) => ({
          key,
          versionId: value.versionId,
          etag: value.etag,
          isLatest: index === values.length - 1
        })))
        .sort((left, right) => left.key.localeCompare(right.key) || left.versionId.localeCompare(right.versionId))
      return Effect.succeed({
        versions: versions.slice(0, input.maximum),
        deleteMarkers: this.deleteMarkers,
        truncated: versions.length > input.maximum
      })
    },
    getObjectVersion: (input) => {
      this.calls.get += 1
      const object = this.objects.get(input.key)?.find((candidate) => candidate.versionId === input.versionId)
      return object === undefined
        ? Effect.fail(this.boundaryError("get-object-version", "not-applicable"))
        : Effect.succeed(object)
    },
    putEvent: (input) => this.put("event", input),
    putHead: (input) => {
      if (this.nextHeadDefect) {
        this.nextHeadDefect = false
        this.calls.headPut += 1
        return Effect.die("simulated process death before head CAS")
      }
      if (this.headBarrierPromise !== undefined) {
        this.calls.headPut += 1
        return Effect.promise(async () => {
          await this.waitAtHeadBarrier()
          const result = this.commit(input)
          if (result._tag === "PreconditionFailed") this.calls.headPrecondition += 1
          return result
        })
      }
      return this.put("head", input)
    }
  }

  count(prefix: string): number {
    return [...this.objects.keys()].filter((key) => key.startsWith(prefix)).length
  }

  replaceLatest(
    key: string,
    replace: (value: S3JournalObjectVersion) => S3JournalObjectVersion
  ): void {
    const versions = this.objects.get(key)
    if (versions === undefined || versions.length === 0) throw new Error(`Missing fake object: ${key}`)
    versions[versions.length - 1] = replace(versions.at(-1)!)
  }
}

const operation = {
  releasePoint: "a".repeat(40),
  operationKey: "b".repeat(64)
}

const request = (
  tag: JournalAppendRequest["tag"],
  payload: string
): JournalAppendRequest => ({
  ...operation,
  tag,
  codecId: "effect-build-apple/notary-v0.6",
  payload: new TextEncoder().encode(payload)
})

const journalFor = (fake: FakeS3Journal) => makeS3CanonicalOperationJournal({
  authority,
  client: fake.boundary
})

const authorityForRepositoryId = (repositoryId: string): S3JournalAuthority => {
  const subject = `repo:mannyc2@${authority.oidc.repositoryOwnerId}/effect-build@${repositoryId}:environment:${authority.oidc.environment}`
  return {
    ...authority,
    oidc: { ...authority.oidc, repositoryId, subject },
    oidcTrust: { ...authority.oidcTrust, repositoryId, subject }
  }
}

describe("S3 canonical operation journal", () => {
  test("acknowledges the finite chain only after exact retained re-read", async () => {
    const fake = new FakeS3Journal()
    const first = journalFor(fake)
    const intent = await Effect.runPromise(first.append(request("IntentRecorded", "intent")))
    expect(intent.sequence).toBe(1)
    expect(intent.recordDigest).toMatch(/^sha256:[a-f0-9]{64}$/u)

    const fresh = journalFor(fake)
    expect((await Effect.runPromise(fresh.read(operation))).state).toBe("IntentRecorded")
    await Effect.runPromise(fresh.append(request("ReceiptRecorded", "opaque submission bytes")))
    await Effect.runPromise(fresh.append(request("ObservationRecorded", "pending")))
    await Effect.runPromise(fresh.append(request("ObservationRecorded", "accepted")))
    const terminal = await Effect.runPromise(fresh.append(request("TerminalRecorded", "accepted reference")))
    const snapshot = await Effect.runPromise(journalFor(fake).read(operation))

    expect(terminal.sequence).toBe(5)
    expect(snapshot.state).toBe("TerminalRecorded")
    expect(snapshot.records.map((record) => record.tag)).toEqual([
      "IntentRecorded",
      "ReceiptRecorded",
      "ObservationRecorded",
      "ObservationRecorded",
      "TerminalRecorded"
    ])
    expect(snapshot.records[0]?.workflow).toEqual({
      repositoryId: authority.oidc.repositoryId,
      runId: authority.oidc.runId,
      runAttempt: authority.oidc.runAttempt
    })
    const before = fake.calls.eventPut
    await expect(Effect.runPromise(fresh.append(request("ReceiptRecorded", "second receipt"))))
      .rejects.toBeInstanceOf(JournalTransitionError)
    expect(fake.calls.eventPut).toBe(before)
  })

  test("treats live S3 VersionIds as opaque URL-ready UTF-8 values", async () => {
    const fake = new FakeS3Journal()
    fake.nextVersionId = "3sL4kqtJlcpXroDTDmJ+rmSpXd3dIbrHY+MTRCxf3vjVBH40Nr8X8gdRQBpUMLUo"
    const result = await Effect.runPromise(journalFor(fake).append(request("IntentRecorded", "intent")))
    expect(result.eventVersionId).toBe(
      "3sL4kqtJlcpXroDTDmJ+rmSpXd3dIbrHY+MTRCxf3vjVBH40Nr8X8gdRQBpUMLUo"
    )
  })

  test("writes the exact canonical event envelope", async () => {
    const fake = new FakeS3Journal()
    await Effect.runPromise(journalFor(fake).append(request("IntentRecorded", "intent")))
    const event = [...fake.objects.entries()].find(([key]) => key.includes("/events/"))?.[1][0]
    expect(event).toBeDefined()
    const normalized = new TextDecoder().decode(event!.bytes).replace(
      /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/u,
      "<transaction-id>"
    )
    expect(normalized).toBe(
      `{"operationKey":"${"b".repeat(64)}","previous":null,"record":{"codecId":"effect-build-apple/notary-v0.6","payloadBase64":"aW50ZW50","payloadDigest":"sha256:282bcbc3f0a34a8a4ac6f00c276fcf66cf3757a3332e83d92208e5079af46922","tag":"IntentRecorded"},"releasePoint":"${"a".repeat(40)}","schemaVersion":"ts-release-operation-journal-event/v1","sequence":1,"transactionId":"<transaction-id>","workflow":{"repositoryId":"1331906770","runAttempt":"1","runId":"42"}}\n`
    )
  })

  test("reconciles response loss before and after S3 mutation without duplicate event versions", async () => {
    const fake = new FakeS3Journal()
    const journal = journalFor(fake)

    fake.nextEventFault = "before-unknown"
    await Effect.runPromise(journal.append(request("IntentRecorded", "intent")))
    expect(fake.calls.eventPut).toBe(2)

    fake.nextHeadFault = "after-unknown"
    await Effect.runPromise(journal.append(request("ReceiptRecorded", "receipt")))

    fake.nextEventFault = "after-unknown"
    await Effect.runPromise(journal.append(request("ObservationRecorded", "pending")))

    fake.nextHeadFault = "before-unknown"
    await Effect.runPromise(journal.append(request("ObservationRecorded", "accepted")))

    const snapshot = await Effect.runPromise(journal.read(operation))
    expect(snapshot.records).toHaveLength(4)
    for (const [key, versions] of fake.objects) {
      if (key.includes("/events/")) expect(versions).toHaveLength(1)
    }
  })

  test("fresh process reconciles the immutable orphan left by death before head CAS", async () => {
    const fake = new FakeS3Journal()
    fake.nextHeadDefect = true
    await expect(Effect.runPromise(journalFor(fake).append(request("IntentRecorded", "intent"))))
      .rejects.toThrow("simulated process death")

    const namespace = journalNamespace(operation)
    expect(fake.count(`${namespace}events/`)).toBe(1)
    expect(fake.count(`${namespace}head.bin`)).toBe(0)

    const resumed = await Effect.runPromise(journalFor(fake).reconcile(operation))
    expect(resumed.state).toBe("IntentRecorded")
    expect(resumed.records).toHaveLength(1)
    expect(fake.count(`${namespace}events/`)).toBe(1)
    expect(fake.count(`${namespace}head.bin`)).toBe(1)
  })

  test("rejects a retained orphan that reuses a reachable transaction ID with divergent logical bytes", async () => {
    const fake = new FakeS3Journal()
    await Effect.runPromise(journalFor(fake).append(request("IntentRecorded", "intent")))
    const eventObject = [...fake.objects.values()].flat().find((value) => value.key.includes("/events/"))!
    const headObject = [...fake.objects.values()].flat().find((value) => value.key.endsWith("/head.bin"))!
    const reachable = decodeJournalEvent(eventObject.bytes)
    const head = decodeJournalHead(headObject.bytes)
    const hostile = makeJournalEvent({
      ...operation,
      sequence: 2,
      transactionId: reachable.transactionId,
      previous: reachable,
      previousHead: {
        versionId: headObject.versionId,
        etag: headObject.etag,
        eventDigest: head.eventDigest
      },
      workflow: { ...reachable.workflow, runAttempt: "2" },
      record: makeCanonicalJournalRecord({
        tag: "ReceiptRecorded",
        codecId: "hostile/reused-transaction",
        payload: new TextEncoder().encode("different")
      })
    })
    const bytes = encodeJournalEvent(hostile)
    const key = journalEventKey(operation, hostile.sequence, hostile.transactionId)
    fake.objects.set(key, [{
      key,
      versionId: "hostile-version",
      etag: '"hostile-etag"',
      checksumSha256: objectChecksum(bytes),
      bytes,
      lastModified: "2026-09-01T00:00:00.000Z",
      retentionMode: "COMPLIANCE",
      retainUntil: "2036-09-01T00:00:00.000Z"
    }])

    await expect(Effect.runPromise(journalFor(fake).read(operation))).rejects.toMatchObject({
      _tag: "JournalIntegrityError",
      reason: expect.stringContaining("divergent retained logical records")
    })
  })

  test("response loss plus unavailable re-read stops unknown and later resumes exact bytes", async () => {
    const fake = new FakeS3Journal()
    const journal = journalFor(fake)
    fake.nextEventFault = "after-unknown"
    fake.failRecoveryListAfterEvent = true
    await expect(Effect.runPromise(journal.append(request("IntentRecorded", "intent"))))
      .rejects.toBeInstanceOf(JournalStorageOutcomeUnknown)
    expect(fake.calls.eventPut).toBe(1)

    const resumed = await Effect.runPromise(journalFor(fake).reconcile(operation))
    expect(resumed.state).toBe("IntentRecorded")
    expect(fake.calls.eventPut).toBe(1)
    for (const versions of fake.objects.values()) expect(versions).toHaveLength(1)
  })

  test("rebases one concurrent admissible append after exact head CAS conflict", async () => {
    const fake = new FakeS3Journal()
    const setup = journalFor(fake)
    await Effect.runPromise(setup.append(request("IntentRecorded", "intent")))
    await Effect.runPromise(setup.append(request("ReceiptRecorded", "receipt")))

    fake.enableHeadBarrier(2)
    const [left, right] = await Effect.runPromise(Effect.all([
      journalFor(fake).append(request("ObservationRecorded", "pending-left")),
      journalFor(fake).append(request("ObservationRecorded", "pending-right"))
    ], { concurrency: 2 }))
    const state = await Effect.runPromise(journalFor(fake).read(operation))

    expect(new Set([left.sequence, right.sequence])).toEqual(new Set([3, 4]))
    expect(fake.calls.headPrecondition).toBeGreaterThanOrEqual(1)
    expect(state.records.map((record) => new TextDecoder().decode(record.payload))).toEqual([
      "intent",
      "receipt",
      "pending-left",
      "pending-right"
    ])
  })

  test("fails closed when the observed governance drifts", async () => {
    const fake = new FakeS3Journal()
    const journal = journalFor(fake)
    await Effect.runPromise(journal.append(request("IntentRecorded", "intent")))
    fake.observedAuthority = { ...authority, rolePolicyDigest: `sha256:${"f".repeat(64)}` }
    await expect(Effect.runPromise(journal.read(operation))).rejects.toBeInstanceOf(JournalAuthorityMismatch)

    fake.observedAuthority = { ...authority, oidcTrustPolicyDigest: `sha256:${"0".repeat(64)}` }
    await expect(Effect.runPromise(journal.read(operation))).rejects.toBeInstanceOf(JournalAuthorityMismatch)

    fake.observedAuthority = {
      ...authority,
      oidcTrust: { ...authority.oidcTrust, workflow: "Foreign workflow" }
    }
    await expect(Effect.runPromise(journal.read(operation))).rejects.toBeInstanceOf(JournalAuthorityMismatch)
  })

  test("rejects a reachable chain retained under a different repository identity", async () => {
    const fake = new FakeS3Journal()
    await Effect.runPromise(journalFor(fake).append(request("IntentRecorded", "intent")))

    const currentAuthority = authorityForRepositoryId("987654321")
    fake.observedAuthority = currentAuthority
    const journal = makeS3CanonicalOperationJournal({
      authority: currentAuthority,
      client: fake.boundary
    })
    await expect(Effect.runPromise(journal.read(operation))).rejects.toMatchObject({
      _tag: "JournalIntegrityError",
      reason: expect.stringContaining("workflow repository")
    })
  })

  test("rejects an orphan retained under a different repository identity", async () => {
    const fake = new FakeS3Journal()
    fake.nextHeadDefect = true
    await expect(Effect.runPromise(journalFor(fake).append(request("IntentRecorded", "intent"))))
      .rejects.toThrow("simulated process death")

    const currentAuthority = authorityForRepositoryId("987654321")
    fake.observedAuthority = currentAuthority
    const journal = makeS3CanonicalOperationJournal({
      authority: currentAuthority,
      client: fake.boundary
    })
    await expect(Effect.runPromise(journal.reconcile(operation))).rejects.toMatchObject({
      _tag: "JournalIntegrityError",
      reason: expect.stringContaining("orphan workflow repository")
    })
  })

  test("keeps consumer identity in the exact activation authority rather than package code", async () => {
    const fake = new FakeS3Journal()
    const other = {
      ...authority,
      oidc: {
        ...authority.oidc,
        subject: "repo:other-owner@7654321/other-repository@987654321:environment:certification",
        repository: "other-owner/other-repository",
        repositoryId: "987654321",
        repositoryOwnerId: "7654321",
        environment: "certification",
        workflow: "External Certification",
        workflowRef: "other-owner/other-repository/.github/workflows/certification.yml@refs/heads/main",
        jobWorkflowRef: `release-owner/release-tools/.github/workflows/journal.yml@${"d".repeat(40)}`,
        jobWorkflowSha: "d".repeat(40)
      },
      oidcTrust: {
        ...authority.oidcTrust,
        subject: "repo:other-owner@7654321/other-repository@987654321:environment:certification",
        repository: "other-owner/other-repository",
        repositoryId: "987654321",
        repositoryOwnerId: "7654321",
        environment: "certification",
        workflow: "External Certification",
        jobWorkflowRef: `release-owner/release-tools/.github/workflows/journal.yml@${"d".repeat(40)}`
      }
    } as const satisfies S3JournalAuthority
    fake.observedAuthority = other
    const snapshot = await Effect.runPromise(makeS3CanonicalOperationJournal({
      authority: other,
      client: fake.boundary
    }).read(operation))
    expect(snapshot.state).toBe("Empty")

    const nameBoundSubject = "repo:other-owner/other-repository:environment:certification"
    const nameBound = {
      ...other,
      oidc: { ...other.oidc, subject: nameBoundSubject },
      oidcTrust: { ...other.oidcTrust, subject: nameBoundSubject }
    } as const satisfies S3JournalAuthority
    fake.observedAuthority = nameBound
    expect((await Effect.runPromise(makeS3CanonicalOperationJournal({
      authority: nameBound,
      client: fake.boundary
    }).read(operation))).state).toBe("Empty")
  })

  test("binds the namespace release point to the re-observed caller SHA", async () => {
    const fake = new FakeS3Journal()
    await expect(Effect.runPromise(journalFor(fake).read({
      releasePoint: "c".repeat(40),
      operationKey: operation.operationKey
    }))).rejects.toBeInstanceOf(JournalAuthorityMismatch)
    expect(fake.calls.list).toBe(0)
  })

  test("rejects byte, retention, and delete-marker tampering", async () => {
    const fake = new FakeS3Journal()
    const journal = journalFor(fake)
    await Effect.runPromise(journal.append(request("IntentRecorded", "intent")))
    const namespace = journalNamespace(operation)
    const eventKey = [...fake.objects.keys()].find((key) => key.includes("/events/"))!
    fake.replaceLatest(eventKey, (value) => ({ ...value, bytes: new TextEncoder().encode("{}") }))
    await expect(Effect.runPromise(journal.read(operation))).rejects.toBeInstanceOf(JournalIntegrityError)

    const retentionFake = new FakeS3Journal()
    const retentionJournal = journalFor(retentionFake)
    await Effect.runPromise(retentionJournal.append(request("IntentRecorded", "intent")))
    const retainedEvent = [...retentionFake.objects.keys()].find((key) => key.includes("/events/"))!
    retentionFake.replaceLatest(retainedEvent, (value) => ({
      ...value,
      retainUntil: "2035-09-01T00:00:00.000Z"
    }))
    await expect(Effect.runPromise(retentionJournal.read(operation))).rejects.toBeInstanceOf(JournalIntegrityError)

    const markerFake = new FakeS3Journal()
    markerFake.deleteMarkers = [{ key: `${namespace}head.bin`, versionId: "deleted-version" }]
    await expect(Effect.runPromise(journalFor(markerFake).read(operation)))
      .rejects.toBeInstanceOf(JournalIntegrityError)
  })
})
