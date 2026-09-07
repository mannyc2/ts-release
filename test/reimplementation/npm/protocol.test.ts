import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import {
  createPlan,
  makeRequest,
  runRelease,
  Host,
  type PreparedRequest,
  type ProviderContext,
  type Transport,
} from "@mannyc1/ts-release"
import type { HttpResponse } from "@mannyc1/ts-release/http"
import { definitions, publish, distTag, DistTagIntent } from "../../../packages/npm/src/index.js"
import { MemoryJournal } from "../kernel/fixtures.js"
import { pack, accessFor } from "./fixtures.js"
import { tarballDigests } from "../../../packages/npm/src/Wire.js"

const response = (status: number, body: unknown = {}) => ({
  status,
  headers: {},
  body: new TextEncoder().encode(JSON.stringify(body)),
})
const fixture = async (manifest: Record<string, unknown> = {}) => {
  const bytes = pack({ name: "@fixture/example", version: "1.2.3", ...manifest })
  const { publication, access } = accessFor(bytes)
  let current: HttpResponse = response(404),
    reads = 0
  const providers = definitions({
    ...access,
    read: () =>
      Effect.sync(() => {
        reads++
        return current
      }),
  })
  const operation = await Effect.runPromise(publish(publication))
  const context: ProviderContext = {
    own: { operation, receipts: [], observations: [] },
    dependencies: [],
  }
  const metadata = (version = "1.2.3", tag = "1.2.3") => ({
    name: publication.name,
    versions: {
      [publication.version]: {
        name: publication.name,
        version,
        dist: { integrity: tarballDigests(bytes).integrity, shasum: tarballDigests(bytes).shasum },
      },
    },
    "dist-tags": { latest: tag },
  })
  return {
    bytes,
    publication,
    access,
    providers,
    operation,
    context,
    metadata,
    set: (next: HttpResponse) => {
      current = next
    },
    reads: () => reads,
  }
}

test("native npm PUT preserves exact metadata, scoped URL, attachments and body identity", async () => {
  const f = await fixture({
    description: "Native package",
    dist: { custom: "retained" },
    publishConfig: {
      registry: "https://registry.npmjs.org/",
      access: "public",
      tag: "latest",
      provenance: false,
    },
  })
  const request = await Effect.runPromise(f.providers[0]!.prepare(f.operation, f.context))
  expect(request.facts.endpoint).toBe("https://registry.npmjs.org/@fixture%2fexample")
  expect(request.facts.replay._tag).toBe("None")
  expect(request.facts.headers).toEqual([["content-type", "application/json"]])
  const doc = JSON.parse(new TextDecoder().decode(request.body))
  expect(doc.versions["1.2.3"].dist).toEqual({
    custom: "retained",
    ...(({ integrity, shasum }) => ({ integrity, shasum }))(tarballDigests(f.bytes)),
    tarball: "http://registry.npmjs.org/@fixture/example/-/@fixture/example-1.2.3.tgz",
  })
  expect(doc.description).toBe("Native package")
  expect(doc["dist-tags"]).toEqual({ latest: "1.2.3" })
  const attachment = doc._attachments["@fixture/example-1.2.3.tgz"]
  expect(Buffer.from(attachment.data, "base64")).toEqual(Buffer.from(f.bytes))
  expect(attachment.length).toBe(f.bytes.length)
  expect(f.providers[0]!.ownsRequest(request)).toBe(true)
  expect(f.providers[1]!.ownsRequest(request)).toBe(false)
  for (const patch of [
    { endpoint: request.facts.endpoint + "/other" },
    { principal: "another" },
    { headers: [] },
  ])
    expect(
      f.providers[0]!.ownsRequest({ facts: { ...request.facts, ...patch }, body: request.body }),
    ).toBe(false)
  const accepted = await Effect.runPromise(
    f.providers[0]!.decodeResponse(request, response(201, { token: "must-never-be-retained" })),
  )
  expect(accepted._tag).toBe("Accepted")
  if (accepted._tag !== "Accepted") throw new Error("expected acceptance")
  expect(JSON.stringify(accepted.receipt)).not.toContain("must-never-be-retained")
  expect(f.providers[0]!.receiptCorresponds(f.operation, request.facts, accepted.receipt)).toBe(
    true,
  )
  expect(
    f.providers[0]!.receiptCorresponds(
      f.operation,
      { ...request.facts, bodyDigest: "0".repeat(64) },
      accepted.receipt,
    ),
  ).toBe(false)
  for (const status of [200, 202, 400, 401, 409, 500])
    expect(
      (await Effect.runPromise(f.providers[0]!.decodeResponse(request, response(status))))._tag,
    ).toBe("Unknown")
  const altered: PreparedRequest = { facts: request.facts, body: new Uint8Array([0]) }
  await expect(
    Effect.runPromise(f.providers[0]!.decodeResponse(altered, response(201))),
  ).rejects.toThrow()
})

test("native npm rejects manifest/intent disagreement before registry I/O", async () => {
  for (const manifest of [
    { name: "wrong-name" },
    { version: "9.0.0" },
    { private: true },
    { packageExtensions: {} },
    { dist: [] },
    { publishConfig: { access: "restricted" } },
    { publishConfig: { tag: "next" } },
    { publishConfig: { provenance: true } },
    { publishConfig: { registry: "https://other.invalid/" } },
    { publishConfig: { directory: "dist" } },
  ]) {
    const f = await fixture(manifest)
    await expect(
      Effect.runPromise(f.providers[0]!.observe!(f.operation, f.context)),
    ).rejects.toThrow()
    expect(f.reads()).toBe(0)
  }
})

test("version and tag facets classify independently with strict bounded native evidence", async () => {
  const f = await fixture()
  const observe = async (body: unknown, status = 200) => {
    f.set(response(status, body))
    const value = await Effect.runPromise(f.providers[0]!.observe!(f.operation, f.context))
    expect(f.providers[0]!.classifyObservation!(f.operation, value.evidence, [])).toBe(value.status)
    return value
  }
  expect((await observe(f.metadata())).status).toBe("Satisfied")
  const moved = await observe(f.metadata("1.2.3", "1.0.0"))
  expect(moved.status).toBe("Conflict")
  expect((moved.evidence as { version: { _tag: string } }).version._tag).toBe("VersionFacts")
  expect((await observe({ ...f.metadata(), "dist-tags": {} })).status).toBe("Pending")
  expect((await observe({ ...f.metadata(), versions: {} })).status).toBe("Absent")
  expect((await observe(f.metadata("2.0.0"))).status).toBe("Conflict")
  const changed = f.metadata()
  changed.versions["1.2.3"]!.dist.shasum = "0".repeat(40)
  expect((await observe(changed)).status).toBe("Conflict")
  const missing = f.metadata()
  delete (missing.versions["1.2.3"]!.dist as Partial<{ integrity: string }>).integrity
  expect((await observe(missing)).status).toBe("Inconclusive")
  expect((await observe({}, 404)).status).toBe("Absent")
  expect((await observe({ token: "secret-response" }, 500)).status).toBe("Inconclusive")
  f.set({ status: 200, headers: {}, body: new TextEncoder().encode('{"name":"a","name":"b"}') })
  const malformed = await Effect.runPromise(f.providers[0]!.observe!(f.operation, f.context))
  expect(malformed.status).toBe("Inconclusive")
  expect(JSON.stringify(malformed.evidence)).not.toContain('"name":"b"')
})

test("native dist-tag sends only the JSON version and accepts a 2xx acknowledgement", async () => {
  const f = await fixture()
  const input = new DistTagIntent({
    registry: f.publication.registry,
    name: f.publication.name,
    version: f.publication.version,
    tag: "next",
    authorization: f.publication.authorization,
  })
  const op = await Effect.runPromise(distTag(input))
  const request = await Effect.runPromise(
    f.providers[1]!.prepare(op, { ...f.context, own: { ...f.context.own, operation: op } }),
  )
  expect(new TextDecoder().decode(request.body)).toBe('"1.2.3"')
  expect(request.facts.endpoint).toBe(
    "https://registry.npmjs.org/-/package/@fixture%2fexample/dist-tags/next",
  )
  expect(f.providers[1]!.ownsRequest(request)).toBe(true)
  for (const status of [200, 201, 202, 204, 299]) {
    const accepted = await Effect.runPromise(
      f.providers[1]!.decodeResponse(request, response(status)),
    )
    expect(accepted._tag).toBe("Accepted")
    if (accepted._tag === "Accepted")
      expect(f.providers[1]!.receiptCorresponds(op, request.facts, accepted.receipt)).toBe(true)
  }
})

test("lost native response and moved tag never resend a package PUT after a fresh runner", async () => {
  const f = await fixture(),
    store = new MemoryJournal()
  const plan = await Effect.runPromise(createPlan("npm-native-owned-fixture", [f.operation]))
  let sends = 0
  const transport: Transport = {
    send: () =>
      Effect.sync(() => {
        sends++
        f.set(response(200, f.metadata()))
        return { _tag: "Unknown", reason: "response lost after native commit" }
      }),
  }
  const run = () =>
    Effect.runPromise(
      runRelease({ plan: JSON.parse(JSON.stringify(plan)), authorize: true }).pipe(
        Effect.provide(
          Layer.succeed(Host, {
            providers: definitions({
              ...f.access,
              read: () => Effect.succeed(response(200, f.metadata("1.2.3", "1.0.0"))),
            }),
            store,
            transport,
            now: Date.now,
            uniqueId: () => crypto.randomUUID(),
          }),
        ),
      ),
    )
  const initial = await Effect.runPromise(
    runRelease({ plan, authorize: true }).pipe(
      Effect.provide(
        Layer.succeed(Host, {
          providers: f.providers,
          store,
          transport,
          now: Date.now,
          uniqueId: () => crypto.randomUUID(),
        }),
      ),
    ),
  )
  expect(initial.operations[0]?.status).toBe("Inconclusive")
  expect(sends).toBe(1)
  expect((await run()).operations[0]?.status).toBe("Conflict")
  expect((await run()).operations[0]?.status).toBe("Conflict")
  expect(sends).toBe(1)
  const events = (await Effect.runPromise(store.read(plan.journalId))).events
  expect(events.filter((event) => event.body._tag === "DispatchStarted")).toHaveLength(1)
})

test("native admission rejects a self-consistent digest for a substituted package body", async () => {
  const f = await fixture(),
    provider = f.providers[0]!
  const request = await Effect.runPromise(provider.prepare(f.operation, f.context))
  const document = JSON.parse(new TextDecoder().decode(request.body))
  for (const altered of [
    { ...document, name: "wrong-package" },
    { ...document, access: "restricted" },
    { ...document, "dist-tags": { latest: "9.9.9" } },
    { ...document, _attachments: {} },
    { ...document, versions: { "9.9.9": document.versions["1.2.3"] } },
  ]) {
    const changed = await Effect.runPromise(
      makeRequest({ ...request.facts, body: Buffer.from(JSON.stringify(altered)) }),
    )
    expect(provider.ownsRequest(changed)).toBe(false)
    await expect(
      Effect.runPromise(provider.decodeResponse(changed, response(201))),
    ).rejects.toThrow()
  }
})

test("native digest intent mismatch rejects before reads; observations cannot invent expected hashes", async () => {
  const f = await fixture(),
    provider = f.providers[0]!
  const operation = await Effect.runPromise(publish({ ...f.publication, shasum: "0".repeat(40) }))
  await expect(
    Effect.runPromise(
      provider.observe!(operation, { ...f.context, own: { ...f.context.own, operation } }),
    ),
  ).rejects.toThrow("native digests")
  expect(f.reads()).toBe(0)
  f.set(response(200, f.metadata()))
  const observed = await Effect.runPromise(provider.observe!(f.operation, f.context))
  const evidence = JSON.parse(JSON.stringify(observed.evidence))
  expect(() =>
    provider.classifyObservation!(f.operation, { ...evidence, status: 404 }, []),
  ).toThrow("status")
  expect(() =>
    provider.classifyObservation!(
      f.operation,
      {
        ...evidence,
        version: {
          ...evidence.version,
          expected: {
            sha256: f.publication.tarball.content.sha256,
            shasum: "0".repeat(40),
            integrity: f.publication.integrity,
          },
        },
      },
      [],
    ),
  ).toThrow()
  const altered = { ...evidence, version: { ...evidence.version, shasum: "0".repeat(40) } }
  expect(provider.classifyObservation!(f.operation, altered, [])).toBe("Conflict")
})

test("a new dist-tag operation can move an existing tag; later drift cannot resend it", async () => {
  const f = await fixture(),
    store = new MemoryJournal()
  const input = new DistTagIntent({
    registry: f.publication.registry,
    name: f.publication.name,
    version: f.publication.version,
    tag: "latest",
    authorization: f.publication.authorization,
  })
  const operation = await Effect.runPromise(distTag(input)),
    plan = await Effect.runPromise(createPlan("tag-fixture", [operation]))
  f.set(response(200, f.metadata("1.2.3", "1.0.0")))
  let sends = 0
  const host = {
    providers: f.providers,
    store,
    now: Date.now,
    uniqueId: () => crypto.randomUUID(),
    transport: {
      send: (request: PreparedRequest) =>
        Effect.gen(function* () {
          sends++
          f.set(response(200, f.metadata()))
          return yield* f.providers[1]!.decodeResponse(request, response(204))
        }),
    },
  }
  const run = () =>
    Effect.runPromise(
      runRelease({ plan, authorize: true }).pipe(Effect.provide(Layer.succeed(Host, host))),
    )
  expect((await run()).operations[0]?.status).toBe("Satisfied")
  expect(sends).toBe(1)
  f.set(response(200, f.metadata("1.2.3", "1.0.0")))
  expect((await run()).operations[0]?.status).toBe("Conflict")
  f.set(response(200, { ...f.metadata(), "dist-tags": {} }))
  expect((await run()).operations[0]?.status).toBe("Pending")
  expect(sends).toBe(1)
})
