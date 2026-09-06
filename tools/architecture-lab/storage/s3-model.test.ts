import { afterEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { createServer, request } from "node:http"
import * as Effect from "effect/Effect"
import { JournalEvent, PlanSuperseded, runRelease } from "../machine/src/index.js"
import { makeFixture, runWithHost } from "../machine/test/fixtures.js"
import { EVENT_BYTES, eventBytes } from "./protocol.js"
import { S3JournalModel, type S3Request, type S3Response } from "./s3-model.js"

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))
const run = Effect.runPromise
const fact = (id: string, reason = "native fixture") => new JournalEvent({
  format: "architecture-lab/event/1", journalId: "release", planId: "publication", eventId: id,
  body: new PlanSuperseded({ reason })
})
const closes: Array<() => Promise<void>> = []
afterEach(async () => { for (const close of closes.splice(0)) await close() })

// An independent generic versioned HTTP object service. It knows no journal schema,
// append result, machine transition or expected test outcome.
async function fixture() {
  type Version = { id: string; body: Uint8Array; etag: string; deleted: boolean }
  const objects = new Map<string, Version[]>(), calls: Array<{ method: string; key: string; condition?: string }> = []
  let sequence = 0, barrierCount = 0, releaseBarrier: (() => void) | undefined
  let nextHeadStatus = 0, loseNextHeadAcknowledgment = false, barrier = false
  const barrierPromise = new Promise<void>(resolve => { releaseBarrier = resolve })
  const server = createServer(async (incoming, response) => {
    const url = new URL(incoming.url!, "http://fixture"), key = url.pathname
    calls.push({ method: incoming.method!, key, ...(incoming.headers["if-match"] ? { condition: String(incoming.headers["if-match"]) } : {}) })
    const chunks: Buffer[] = []
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk))
    const body = Buffer.concat(chunks), versions = objects.get(key) ?? []
    const selected = url.searchParams.has("versionId") ? versions.find(v => v.id === url.searchParams.get("versionId")) : versions.at(-1)
    if (incoming.method === "GET") {
      if (!selected || selected.deleted) { response.writeHead(404, selected?.deleted ? { "x-amz-delete-marker": "true" } : {}).end(); return }
      response.writeHead(200, { etag: selected.etag, "x-amz-version-id": selected.id, "content-length": selected.body.byteLength }).end(selected.body); return
    }
    if (incoming.method === "DELETE") {
      if (url.searchParams.has("versionId")) { response.writeHead(403).end("locked version"); return }
      const marker = { id: `v${++sequence}`, body: new Uint8Array(), etag: '"deleted"', deleted: true }
      versions.push(marker); objects.set(key, versions)
      response.writeHead(204, { "x-amz-version-id": marker.id, "x-amz-delete-marker": "true" }).end(); return
    }
    if (incoming.method !== "PUT") { response.writeHead(405).end(); return }
    if (incoming.headers["x-amz-checksum-sha256"] && incoming.headers["x-amz-checksum-sha256"] !== createHash("sha256").update(body).digest("base64")) { response.writeHead(400).end(); return }
    if (key.endsWith("/head") && barrier && ++barrierCount <= 2) {
      if (barrierCount === 2) releaseBarrier!()
      await barrierPromise
    }
    if (key.endsWith("/head") && nextHeadStatus) { const status = nextHeadStatus; nextHeadStatus = 0; response.writeHead(status).end(); return }
    // Re-read after the race barrier; conditional checks and commit are indivisible.
    const current = objects.get(key)?.at(-1)
    if ((incoming.headers["if-none-match"] === "*" && current && !current.deleted) ||
      (incoming.headers["if-match"] && current?.etag !== incoming.headers["if-match"])) { response.writeHead(412).end(); return }
    const version = { id: `v${++sequence}`, body: new Uint8Array(body), etag: `"${hash(body)}"`, deleted: false }
    const latest = objects.get(key) ?? []; latest.push(version); objects.set(key, latest)
    if (key.endsWith("/head") && loseNextHeadAcknowledgment) { loseNextHeadAcknowledgment = false; response.destroy(); return }
    response.writeHead(200, { etag: version.etag, "x-amz-version-id": version.id }).end()
  })
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
  closes.push(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Expected local TCP address")
  const endpoint = `http://127.0.0.1:${address.port}/`
  const wire = (input: Omit<S3Request, "method"> & { method: string }): Promise<S3Response> => new Promise((resolve, reject) => {
    const outgoing = request(input.url, { method: input.method, headers: input.headers, agent: false }, incoming => {
      const chunks: Buffer[] = []; let size = 0
      if (Number(incoming.headers["content-length"] ?? 0) > input.capacity) { outgoing.destroy(new Error("HTTP body exceeds capacity before decode")); return }
      incoming.on("data", (chunk: Buffer) => {
        size += chunk.byteLength
        if (size > input.capacity) { outgoing.destroy(new Error("HTTP body exceeds streaming capacity")); return }
        chunks.push(chunk)
      })
      incoming.on("error", reject)
      incoming.on("end", () => resolve({ status: incoming.statusCode!, body: new Uint8Array(Buffer.concat(chunks)),
        headers: Object.fromEntries(Object.entries(incoming.headers).map(([key, value]) => [key, String(value)])) }))
    })
    outgoing.on("error", reject); outgoing.end(input.body)
  })
  const store = new S3JournalModel(endpoint, wire)
  const headKey = `/${store.prefix("release")}head`
  return { store, endpoint, wire, objects, calls, headKey,
    race: () => { barrier = true }, failHead: (status: number) => { nextHeadStatus = status },
    loseHead: () => { loseNextHeadAcknowledgment = true } }
}

for (const identical of [false, true]) test(`S3 protocol: two writers upload2 segments; one head winner, identical=${identical}`, async () => {
  const f = await fixture(); f.race()
  const second = new S3JournalModel(f.endpoint, f.wire)
  const outcomes = await Promise.all([run(f.store.append("release", 0, fact("a"))), run(second.append("release", 0, fact(identical ? "a" : "b")))])
  expect(outcomes.filter(result => result._tag === "Appended")).toHaveLength(1)
  expect(outcomes.filter(result => result._tag === (identical ? "AlreadyRecorded" : "RevisionMismatch"))).toHaveLength(1)
  expect([...f.objects.keys()].filter(key => key.includes("/segments/"))).toHaveLength(2)
  expect((await run(second.read("release"))).events).toHaveLength(1)
  expect(f.calls.filter(call => call.method === "PUT" && call.key.endsWith("/head"))).toHaveLength(2)
})

test("S3 protocol: lost head acknowledgment reads exact history; fresh append is AlreadyRecorded", async () => {
  const f = await fixture(); f.loseHead()
  expect((await run(f.store.append("release", 0, fact("a"))))._tag).toBe("AmbiguousStorageOutcome")
  const fresh = new S3JournalModel(f.endpoint, f.wire)
  expect((await run(fresh.read("release"))).events).toEqual([fact("a")])
  expect(await run(fresh.append("release", 0, fact("a")))).toEqual({ _tag: "AlreadyRecorded", revision: 1 })
  expect(f.calls.filter(call => call.method === "PUT" && call.key.endsWith("/head"))).toHaveLength(1)
  await expect(run(fresh.append("release", 1, fact("a", "forged")))).rejects.toThrow("different facts")
})

for (const status of [409, 404, 503]) test(`S3 protocol: head${status} yields uncertainty without automatic PUT retry`, async () => {
  const f = await fixture(); f.failHead(status)
  expect((await run(f.store.append("release", 0, fact("a"))))._tag).toBe("AmbiguousStorageOutcome")
  expect((await run(f.store.read("release"))).revision).toBe(0)
  expect(f.calls.filter(call => call.method === "PUT" && call.key.endsWith("/head"))).toHaveLength(1)
  expect([...f.objects.keys()].filter(key => key.includes("/segments/"))).toHaveLength(1)
})

test("S3 protocol: Object Lock allows new versions/delete markers; pinned history remains exact", async () => {
  const f = await fixture()
  await run(f.store.append("release", 0, fact("a")))
  await run(f.store.append("release", 1, fact("b")))
  const head = JSON.parse(new TextDecoder().decode(f.objects.get(f.headKey)!.at(-1)!.body))
  const segmentUrl = new URL(head.tip.key, f.endpoint).href
  expect((await f.wire({ method: "PUT", url: segmentUrl, headers: {}, body: bytes({ forged: true }), capacity: 8192 })).status).toBe(200)
  expect((await f.wire({ method: "DELETE", url: segmentUrl, headers: {}, capacity: 8192 })).status).toBe(204)
  expect((await f.wire({ method: "GET", url: segmentUrl, headers: {}, capacity: 8192 })).status).toBe(404)
  expect((await run(new S3JournalModel(f.endpoint, f.wire).read("release"))).events).toEqual([fact("a"), fact("b")])
  expect((await f.wire({ method: "DELETE", url: `${segmentUrl}?versionId=${head.tip.versionId}`, headers: {}, capacity: 8192 })).status).toBe(403)
  expect(f.calls.some(call => call.method === "PUT" && call.key.endsWith("/head") && call.condition !== undefined)).toBe(true)
  await f.wire({ method: "DELETE", url: new URL(f.headKey, f.endpoint).href, headers: {}, capacity: 8192 })
  await expect(run(f.store.read("release"))).rejects.toThrow("deleted")
  await expect(run(f.store.append("release", 0, fact("c")))).rejects.toThrow("deleted")
})

test("S3 protocol: native full-event bound is symmetric; forged predecessor hash rejects", async () => {
  const f = await fixture()
  const empty = fact("boundary", "")
  const reason = "x".repeat(EVENT_BYTES - eventBytes(empty).byteLength)
  const exact = fact("boundary", reason)
  expect(eventBytes(exact).byteLength).toBe(EVENT_BYTES)
  expect((await run(f.store.append("release", 0, exact)))._tag).toBe("Appended")
  expect((await run(new S3JournalModel(f.endpoint, f.wire).read("release"))).events[0]).toEqual(exact)
  await expect(run(f.store.append("release", 1, fact("boundary", reason + "x")))).rejects.toThrow("byte limit")
  await expect(run(new S3JournalModel(f.endpoint, f.wire, EVENT_BYTES - 1).read("release"))).rejects.toThrow("byte limit")
  await run(f.store.append("release", 1, fact("b")))
  const head = JSON.parse(new TextDecoder().decode(f.objects.get(f.headKey)!.at(-1)!.body))
  const segment = JSON.parse(new TextDecoder().decode(f.objects.get(`/${head.tip.key}`)!.at(-1)!.body))
  segment.previous.sha256 = "0".repeat(64)
  const changedBytes = bytes(segment)
  const changed = await f.wire({ method: "PUT", url: new URL(head.tip.key, f.endpoint).href, headers: {}, body: changedBytes, capacity: 8192 })
  head.tip.versionId = changed.headers["x-amz-version-id"]; head.tip.sha256 = hash(changedBytes)
  // JSON insertion order differs from canonical; use existing exact-key encoder only
  // for a well-formed hostile input, so the predecessor integrity check is reached.
  const { canonical } = await import("../machine/src/identity.js")
  const canonicalSegment = new TextEncoder().encode(canonical(segment))
  const canonicalWrite = await f.wire({ method: "PUT", url: new URL(head.tip.key, f.endpoint).href, headers: {}, body: canonicalSegment, capacity: 8192 })
  head.tip.versionId = canonicalWrite.headers["x-amz-version-id"]; head.tip.sha256 = hash(canonicalSegment)
  await f.wire({ method: "PUT", url: new URL(f.headKey, f.endpoint).href, headers: {}, body: new TextEncoder().encode(canonical(head)), capacity: 8192 })
  await expect(run(f.store.read("release"))).rejects.toThrow("content hash")
})

for (const candidate of ["M1", "M2"] as const) test(`S3 protocol/${candidate}: actual machine unknown provider result never resends on new store`, async () => {
  const f = await fixture(), machine = await makeFixture(); let sends = 0
  f.loseHead() // The same live interpreter reconciles its own append before dispatch.
  const host = { ...machine.host, store: f.store, transport: { send: () => Effect.sync(() => { sends++; return { _tag: "Unknown", reason: "native response loss" } as const }) } }
  const first = await runWithHost(host, runRelease({ candidate, plan: machine.plan, authorize: true }))
  expect(first.operations[0]?.status).toBe("Inconclusive")
  const resumed = await runWithHost({ ...host, store: new S3JournalModel(f.endpoint, f.wire) }, runRelease({ candidate, plan: machine.plan, authorize: true }))
  expect(resumed.operations[0]?.status).toBe("Inconclusive")
  expect(sends).toBe(1)
})


test("S3 protocol: hostile stored full event1MiB+1 rejects at the default bound before use", async () => {
  const f = await fixture(), { canonical } = await import("../machine/src/identity.js")
  const valid = fact("boundary", "x".repeat(EVENT_BYTES - eventBytes(fact("boundary", "")).byteLength))
  await run(f.store.append("release", 0, valid))
  const head = JSON.parse(new TextDecoder().decode(f.objects.get(f.headKey)!.at(-1)!.body))
  const segment = JSON.parse(new TextDecoder().decode(f.objects.get(`/${head.tip.key}`)!.at(-1)!.body))
  segment.event.body.reason += "x"
  expect(new TextEncoder().encode(canonical(segment.event)).byteLength).toBe(EVENT_BYTES + 1)
  const changed = new TextEncoder().encode(canonical(segment))
  const version = await f.wire({ method: "PUT", url: new URL(head.tip.key, f.endpoint).href, headers: {}, body: changed, capacity: 8192 })
  head.tip.versionId = version.headers["x-amz-version-id"]; head.tip.sha256 = hash(changed)
  await f.wire({ method: "PUT", url: new URL(f.headKey, f.endpoint).href, headers: {}, body: new TextEncoder().encode(canonical(head)), capacity: 8192 })
  await expect(run(new S3JournalModel(f.endpoint, f.wire).read("release"))).rejects.toThrow("byte limit")
})
