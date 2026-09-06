import { createHash, randomUUID } from "node:crypto"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { JournalEvent, type AppendResult, type JournalStore, type Snapshot } from "../machine/src/contracts.js"
import { canonical, parseCanonical } from "../machine/src/identity.js"
import { EVENT_BYTES, body, caught, encoder, fail, readEvent } from "./protocol.js"

/** Research protocol model. The host supplies signed, bounded, single-attempt HTTP.
 * This does not provision IAM, versioning, Object Lock, retention or AWS credentials. */
export interface S3Request {
  readonly method: "GET" | "PUT"
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body?: Uint8Array
  readonly capacity: number
}
export interface S3Response {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: Uint8Array
}
export type S3Http = (request: S3Request) => Promise<S3Response>
export class ObjectRef extends Schema.Class<ObjectRef>("S3ObjectRef")({
  key: Schema.String, versionId: Schema.String, sha256: Schema.String
}) {}
export class Segment extends Schema.Class<Segment>("S3Segment")({
  format: Schema.Literal("architecture-lab/s3-segment/1"), journalId: Schema.String,
  revision: Schema.Number, event: JournalEvent, previous: Schema.optionalKey(ObjectRef)
}) {}
export class Head extends Schema.Class<Head>("S3Head")({
  format: Schema.Literal("architecture-lab/s3-head/1"), journalId: Schema.String,
  revision: Schema.Number, tip: ObjectRef
}) {}
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const encoded = (value: unknown) => encoder.encode(canonical(value))
const parse = <A>(codec: Schema.Codec<A, unknown>, bytes: Uint8Array): A =>
  Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })(parseCanonical(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
const bounded = (response: S3Response, capacity: number) => {
  if (response.body.byteLength > capacity) fail("event-too-large", "S3 response exceeds capacity before decode")
  return response
}
interface Loaded extends Snapshot { readonly head?: Head; readonly etag?: string; readonly versionId?: string }

export class S3JournalModel implements JournalStore {
  constructor(readonly endpoint: string, readonly http: S3Http, readonly limit = EVENT_BYTES, readonly maximumEvents = 4096) {}
  prefix(journalId: string) { return `journals/${digest(encoder.encode(journalId))}/` }
  private url(key: string, versionId?: string) {
    const url = new URL(key, `${this.endpoint.replace(/\/$/, "")}/`)
    if (versionId !== undefined) url.searchParams.set("versionId", versionId)
    return url.href
  }
  private async get(key: string, capacity: number, versionId?: string) {
    return bounded(await this.http({ method: "GET", url: this.url(key, versionId), headers: {}, capacity }), capacity)
  }
  private async put(key: string, bytes: Uint8Array, condition: Readonly<Record<string, string>>) {
    // A content checksum is required for retained uploads. Retention is a qualified bucket policy.
    return bounded(await this.http({ method: "PUT", url: this.url(key), headers: {
      ...condition, "content-type": "application/json", "x-amz-sdk-checksum-algorithm": "SHA256", "x-amz-checksum-sha256": createHash("sha256").update(bytes).digest("base64")
    }, body: bytes, capacity: 8192 }), 8192)
  }
  private validateRef(ref: ObjectRef, journalId: string) {
    if (!ref.key.startsWith(`${this.prefix(journalId)}segments/`) || ref.key.length > 512 ||
      ref.versionId.length === 0 || ref.versionId === "null" || ref.versionId.length > 512 || !/^[a-f0-9]{64}$/.test(ref.sha256)) {
      fail("s3-reference", "S3 reference must pin an exact version and content hash inside this journal")
    }
  }
  private async load(journalId: string): Promise<Loaded> {
    const response = await this.get(`${this.prefix(journalId)}head`, 8192)
    if (response.status === 404 && response.headers["x-amz-delete-marker"] !== "true") return { revision: 0, events: [] }
    if (response.status !== 200) fail("s3-head", "Missing, deleted or unavailable S3 head is not writable history")
    const head = parse(Head, response.body)
    const etag = response.headers.etag ?? fail("s3-head", "Missing head ETag")
    const versionId = response.headers["x-amz-version-id"] ?? fail("s3-head", "Missing head version")
    if (head.journalId !== journalId || !Number.isSafeInteger(head.revision) || head.revision < 1 || head.revision > this.maximumEvents ||
      !etag || !versionId || versionId === "null") fail("s3-head", "Invalid versioned S3 head")
    const events: JournalEvent[] = [], ids = new Set<string>()
    let ref: ObjectRef | undefined = head.tip
    for (let revision = head.revision; revision > 0; revision--) {
      const currentRef = ref ?? fail("s3-chain", "Missing predecessor in S3 journal")
      this.validateRef(currentRef, journalId)
      const object = await this.get(currentRef.key, this.limit + 4096, currentRef.versionId)
      if (object.status !== 200 || object.headers["x-amz-version-id"] !== currentRef.versionId || digest(object.body) !== currentRef.sha256) {
        fail("s3-chain", "Pinned S3 segment version or content hash differs")
      }
      const segment = parse(Segment, object.body)
      const event = readEvent(encoded(segment.event), this.limit)
      if (segment.journalId !== journalId || segment.revision !== revision || event.journalId !== journalId || ids.has(event.eventId)) {
        fail("s3-chain", "S3 chain revision, namespace or event identity differs")
      }
      ids.add(event.eventId); events.push(event); ref = segment.previous
    }
    if (ref) fail("s3-chain", "S3 revision1 must terminate the predecessor chain")
    return { revision: head.revision, events: events.reverse(), head, etag, versionId }
  }
  read = (journalId: string) => Effect.tryPromise({ try: async (): Promise<Snapshot> => {
    const loaded = await this.load(journalId)
    return { revision: loaded.revision, events: loaded.events }
  }, catch: caught })
  append = (journalId: string, expectedRevision: number, event: JournalEvent) => Effect.tryPromise({
    try: async (): Promise<AppendResult> => {
      const eventText = body(event, journalId, this.limit)
      const loaded = await this.load(journalId)
      const existing = loaded.events.findIndex(fact => fact.eventId === event.eventId)
      if (existing >= 0) {
        if (canonical(loaded.events[existing]) !== eventText) fail("event-id-conflict", "Event ID has different facts")
        return { _tag: "AlreadyRecorded", revision: existing + 1 }
      }
      if (loaded.revision !== expectedRevision) return { _tag: "RevisionMismatch", revision: loaded.revision }
      if (expectedRevision >= this.maximumEvents) fail("s3-capacity", "Research journal event-count capacity exceeded")
      const segment = new Segment({ format: "architecture-lab/s3-segment/1", journalId, revision: expectedRevision + 1,
        event, ...(loaded.head ? { previous: loaded.head.tip } : {}) })
      const bytes = encoded(segment)
      if (bytes.byteLength > this.limit + 4096) fail("event-too-large", "S3 segment exceeds bounded metadata allowance")
      const key = `${this.prefix(journalId)}segments/${randomUUID()}`
      // Each request has a unique segment key. An orphan segment is never history.
      let uploaded: S3Response
      try { uploaded = await this.put(key, bytes, { "if-none-match": "*" }) }
      catch { return { _tag: "AmbiguousStorageOutcome" } }
      const versionId = uploaded.headers["x-amz-version-id"]
      if (uploaded.status !== 200 || !versionId || versionId === "null") return { _tag: "AmbiguousStorageOutcome" }
      const tip = new ObjectRef({ key, versionId, sha256: digest(bytes) })
      this.validateRef(tip, journalId)
      const head = new Head({ format: "architecture-lab/s3-head/1", journalId, revision: expectedRevision + 1, tip })
      let committed: S3Response
      try { committed = await this.put(`${this.prefix(journalId)}head`, encoded(head), loaded.etag ? { "if-match": loaded.etag } : { "if-none-match": "*" }) }
      catch { return { _tag: "AmbiguousStorageOutcome" } }
      if (committed.status === 412) {
        const current = await this.load(journalId)
        const position = current.events.findIndex(fact => fact.eventId === event.eventId)
        if (position >= 0) {
          if (canonical(current.events[position]) !== eventText) fail("event-id-conflict", "Event ID has different facts")
          return { _tag: "AlreadyRecorded", revision: position + 1 }
        }
        return { _tag: "RevisionMismatch", revision: current.revision }
      }
      // In particular409/404/lost response never cause a second PUT or provider send here.
      if (committed.status !== 200) return { _tag: "AmbiguousStorageOutcome" }
      try {
        const confirmed = await this.load(journalId)
        if (canonical(confirmed.events[expectedRevision]) === eventText) return { _tag: "Appended", revision: expectedRevision + 1 }
      } catch { /* Committed response with unavailable read-back remains uncertain. */ }
      return { _tag: "AmbiguousStorageOutcome" }
    }, catch: caught
  })
}
