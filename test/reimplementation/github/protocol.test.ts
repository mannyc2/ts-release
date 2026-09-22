import { expect, test } from "bun:test"
import { Effect } from "effect"
import { runRelease, observeRelease, type ProviderContext } from "@mannyc1/ts-release"
import { verifyNativeEvidence } from "../../../packages/ts-release/src/Journal.js"
import { runWithHost } from "../kernel/fixtures.js"
import { fixture, response, releaseDocument, assetDocument, base } from "./fixtures.js"
import { repositoryDocument } from "./fixtures.js"

for (const annotated of [false, true])
  for (const count of [0, 3])
    test(`GitHub native DAG has ${count} independent assets and ${annotated ? "annotated" : "lightweight"} tag steps`, async () => {
      const f = await fixture(count, annotated)
      const report = await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true }))
      expect(report.operations.every((operation) => operation.status === "Satisfied")).toBe(true)
      expect(f.state.sends).toHaveLength(count + (annotated ? 4 : 3))
      expect(f.state.sends.at(-1)!.facts.method).toBe("PATCH")
      expect(f.state.releases[0]!.draft).toBe(false)
      const snapshot = await Effect.runPromise(f.store.read(f.plan.journalId))
      expect(() => verifyNativeEvidence(f.plan, snapshot.events, f.providers)).not.toThrow()
      await runWithHost({ ...f.host }, runRelease({ plan: f.plan, authorize: true }))
      expect(f.state.sends).toHaveLength(count + (annotated ? 4 : 3))
      // After publication every asset is addressed by its tag URL; the published
      // release still binds its asset parents and observes as Satisfied.
      await runWithHost({ ...f.host }, observeRelease({ plan: f.plan }))
      const latest = new Map<string, string>()
      for (const event of (await Effect.runPromise(f.store.read(f.plan.journalId))).events)
        if (event.body._tag === "ObservationRecorded")
          latest.set(event.body.operationId, event.body.status)
      expect(latest.get(f.publish.operationId)).toBe("Satisfied")
      expect([...latest.values()].every((status) => status === "Satisfied")).toBe(true)
    })

test("response-lost hidden draft is observed by authenticated enumeration and its returned ID survives restart", async () => {
  const f = await fixture()
  f.state.lost = "github.draft"
  await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true }))
  expect(f.state.sends).toHaveLength(2)
  expect(f.state.releases).toHaveLength(1)
  f.state.hidden = true
  await runWithHost({ ...f.host }, runRelease({ plan: f.plan, authorize: true }))
  expect(f.state.sends).toHaveLength(2)
  f.state.hidden = false
  const report = await runWithHost({ ...f.host }, runRelease({ plan: f.plan, authorize: true }))
  expect(report.operations.every((operation) => operation.status === "Satisfied")).toBe(true)
  expect(
    f.state.sends.filter((request) => request.facts.endpoint === `${base}/releases`),
  ).toHaveLength(1)
  expect(
    f.state.sends
      .filter((request) => request.facts.endpoint.includes("uploads.github.com"))
      .every((request) => request.facts.endpoint.includes("/731/assets")),
  ).toBe(true)
})

test("missing native digest downloads exact bytes and publish rejects missing or extra selected assets", async () => {
  const f = await fixture()
  await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true, maxDispatches: 5 }))
  expect(f.state.sends).toHaveLength(5)
  f.state.assets.forEach((asset) => {
    asset.digest = null
  })
  await runWithHost(f.host, observeRelease({ plan: f.plan }))
  expect(
    f.state.reads.some((request) =>
      request.headers.some(
        ([name, value]) => name === "accept" && value === "application/octet-stream",
      ),
    ),
  ).toBe(true)
  f.state.assets.push(assetDocument(9999, "foreign.bin", new Uint8Array([1])))
  const blocked = await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true }))
  expect(
    blocked.operations.find((operation) => operation.operationId === f.publish.operationId)!.status,
  ).toBe("Conflict")
  expect(f.state.sends).toHaveLength(5)
})

test("ambiguous paginated draft records and foreign pagination routes remain inconclusive", async () => {
  const f = await fixture(0)
  await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true, maxDispatches: 1 }))
  const snapshot = await Effect.runPromise(f.store.read(f.plan.journalId)),
    receipt = snapshot.events.find((event) => event.body._tag === "ReceiptAccepted")!.body
  if (receipt._tag !== "ReceiptAccepted") throw new Error("fixture receipt")
  const context: ProviderContext = {
    own: { operation: f.draft, receipts: [], observations: [] },
    dependencies: [{ operation: f.ref, receipts: [receipt.receipt], observations: [] }],
  }
  const provider = f.providers.find((provider) => provider.definitionId === "github.draft")!
  f.state.override = (request) =>
    request.url === `${base}/releases?per_page=100&page=1`
      ? response(200, [releaseDocument()], {
          link: `<${base}/releases?per_page=100&page=2>; rel="next"`,
        })
      : request.url === `${base}/releases?per_page=100&page=2`
        ? response(200, [releaseDocument(732)])
        : undefined
  expect((await Effect.runPromise(provider.observe!(f.draft, context))).status).toBe("Inconclusive")
  expect(f.state.reads.some((request) => request.url.endsWith("page=2"))).toBe(true)
  f.state.override = (request) =>
    request.url.includes("?per_page")
      ? response(200, [], { link: '<https://evil.invalid/?page=2>; rel="next"' })
      : undefined
  expect((await Effect.runPromise(provider.observe!(f.draft, context))).status).toBe("Inconclusive")
  expect(f.state.reads.some((request) => request.url.startsWith("https://evil.invalid"))).toBe(
    false,
  )
})

test("asset response loss and native starter state never permit a second upload", async () => {
  const f = await fixture(1)
  f.state.lost = "github.asset"
  await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true }))
  expect(f.state.sends).toHaveLength(3)
  f.state.assets[0]!.state = "starter"
  f.state.assets[0]!.digest = null
  const blocked = await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true }))
  expect(
    blocked.operations.find((operation) => operation.operationId === f.assets[0]!.operationId)!
      .status,
  ).toBe("Conflict")
  expect(f.state.sends).toHaveLength(3)
})

test("asset prepare rechecks a published or vanished parent even when observation is disabled", async () => {
  for (const hidden of [false, true]) {
    const f = await fixture(1)
    await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true, maxDispatches: 2 }))
    f.state.releases[0]!.draft = false
    f.state.hidden = hidden
    await expect(
      runWithHost(f.host, runRelease({ plan: f.plan, authorize: true, observe: false })),
    ).rejects.toThrow("asset parent")
    expect(f.state.sends).toHaveLength(2)
  }
})

test("missing-digest download follows one explicit public redirect and keeps signed URLs out of journal evidence", async () => {
  const f = await fixture(1)
  await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true, maxDispatches: 3 }))
  f.state.assets[0]!.digest = null
  const location =
    "https://release-assets.githubusercontent.com/github-production-release-asset/1/file?signature=ephemeral-fixture"
  f.state.override = (request) =>
    request.url === f.state.assets[0]!.url
      ? { status: 302, headers: { location }, body: new Uint8Array() }
      : request.url === location
        ? {
            status: 200,
            headers: { "content-type": "application/octet-stream" },
            body: f.bytes[0]!,
          }
        : undefined
  const report = await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true }))
  expect(report.operations.every((operation) => operation.status === "Satisfied")).toBe(true)
  expect(
    f.state.reads
      .filter((request) => request.url === location)
      .every((request) => request.principal === "github:public-download"),
  ).toBe(true)
  expect(JSON.stringify(await Effect.runPromise(f.store.read(f.plan.journalId)))).not.toContain(
    "ephemeral-fixture",
  )
})

test("unquoted next links are followed and malformed or foreign pagination cannot authorize publication", async () => {
  for (const link of [
    `<${base}/releases/731/assets?per_page=100&page=2>; rel=next`,
    `<${base}/releases/731/assets?per_page=100&page=2>; rel=last`,
    "<https://evil.invalid/assets?page=2>; rel=next",
    'garbage rel="next"',
    "",
  ]) {
    const f = await fixture(0)
    f.state.override = (request) =>
      request.url === `${base}/releases/731/assets?per_page=100&page=1`
        ? response(200, [], { link })
        : request.url.endsWith("/731/assets?per_page=100&page=2")
          ? response(200, [assetDocument(9999, "undeclared.bin", new Uint8Array([1]))])
          : undefined
    const result = await runWithHost(
      f.host,
      Effect.exit(runRelease({ plan: f.plan, authorize: true })),
    )
    expect(f.state.sends).toHaveLength(2)
    expect(f.state.releases[0]!.draft).toBe(true)
    if (result._tag === "Success")
      expect(
        result.value.operations.find(
          (operation) => operation.operationId === f.publish.operationId,
        )!.status,
      ).not.toBe("Satisfied")
    else expect(JSON.stringify(result.cause)).toContain("github-pagination-link")
    expect(
      f.state.reads.some((request) => request.url.endsWith("/731/assets?per_page=100&page=2")),
    ).toBe(link.startsWith(`<${base}/`))
  }
})

test("draft preparation independently requires complete absence when observations are disabled", async () => {
  for (const malformed of [false, true]) {
    const f = await fixture(0)
    await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true, maxDispatches: 1 }))
    if (malformed)
      f.state.override = (request) =>
        request.url.includes("/releases?per_page")
          ? response(200, [], { link: 'garbage rel="next"' })
          : undefined
    else f.state.releases.push(releaseDocument())
    await expect(
      runWithHost(f.host, runRelease({ plan: f.plan, authorize: true, observe: false })),
    ).rejects.toThrow(malformed ? "pagination link" : "draft precondition")
    expect(f.state.sends).toHaveLength(1)
  }
})

test("last-page evidence persists across short intermediate pages and bounds complete enumeration", async () => {
  const f = await fixture(0)
  await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true, maxDispatches: 1 }))
  const snapshot = await Effect.runPromise(f.store.read(f.plan.journalId)),
    body = snapshot.events.find((event) => event.body._tag === "ReceiptAccepted")!.body
  if (body._tag !== "ReceiptAccepted") throw new Error("fixture receipt")
  const context: ProviderContext = {
      own: { operation: f.draft, receipts: [], observations: [] },
      dependencies: [{ operation: f.ref, receipts: [body.receipt], observations: [] }],
    },
    provider = f.providers.find((provider) => provider.definitionId === "github.draft")!
  f.state.override = (request) =>
    request.url.endsWith("/releases?per_page=100&page=1")
      ? response(200, [], { link: `<${base}/releases?per_page=100&page=3>; rel=last` })
      : request.url.endsWith("/releases?per_page=100&page=3")
        ? response(200, [releaseDocument()])
        : undefined
  expect((await Effect.runPromise(provider.observe!(f.draft, context))).status).toBe("Satisfied")
  expect(f.state.reads.some((request) => request.url.endsWith("page=3"))).toBe(true)
  f.state.reads = []
  const unrelated = Array.from({ length: 100 }, (_, i) => ({
    ...releaseDocument(i + 1000),
    tag_name: `v0.${i}.0`,
  }))
  f.state.override = (request) =>
    request.url.includes("/releases?per_page")
      ? response(200, unrelated, { link: `<${base}/releases?per_page=100&page=1>; rel=last` })
      : undefined
  expect((await Effect.runPromise(provider.observe!(f.draft, context))).status).toBe("Absent")
  expect(
    f.state.reads.filter((request) => request.url.includes("/releases?per_page")),
  ).toHaveLength(1)
})

test("populated release pages above the single-object limit remain complete across publication and restart", async () => {
  const f = await fixture(0)
  const populated = response(
    200,
    Array.from({ length: 100 }, (_, index) => ({
      ...releaseDocument(index + 1000),
      tag_name: `v0.${index}.0`,
      body: "x".repeat(11_000),
    })),
    { link: `<${base}/releases?per_page=100&page=2>; rel="last"` },
  )
  expect(populated.body.length).toBeGreaterThan(1024 * 1024)
  f.state.override = (request) =>
    request.url === `${base}/releases?per_page=100&page=1`
      ? populated
      : request.url === `${base}/releases?per_page=100&page=2`
        ? response(200, f.state.releases)
        : undefined
  for (let invocation = 0; invocation < 2; invocation++) {
    const report = await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true }))
    expect(report.operations.every((operation) => operation.status === "Satisfied")).toBe(true)
    expect(f.state.sends).toHaveLength(3)
  }
  expect(
    f.state.reads.some((request) => request.url === `${base}/releases?per_page=100&page=2`),
  ).toBe(true)
  expect(f.state.releases).toHaveLength(1)
  expect(f.state.releases[0]!.draft).toBe(false)
})

test("oversized release pages remain inconclusive and cannot authorize draft creation", async () => {
  const f = await fixture(0)
  await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true, maxDispatches: 1 }))
  const snapshot = await Effect.runPromise(f.store.read(f.plan.journalId)),
    receipt = snapshot.events.find((event) => event.body._tag === "ReceiptAccepted")!.body
  if (receipt._tag !== "ReceiptAccepted") throw new Error("fixture receipt")
  const context: ProviderContext = {
      own: { operation: f.draft, receipts: [], observations: [] },
      dependencies: [{ operation: f.ref, receipts: [receipt.receipt], observations: [] }],
    },
    provider = f.providers.find((provider) => provider.definitionId === "github.draft")!,
    oversized = { ...response(200, []), body: new Uint8Array(16 * 1024 * 1024 + 1) }
  f.state.override = (request) =>
    request.url.includes("/releases?per_page") ? oversized : undefined
  expect((await Effect.runPromise(provider.observe!(f.draft, context))).status).toBe("Inconclusive")
  await expect(Effect.runPromise(provider.prepare(f.draft, context))).rejects.toThrow(
    "json response",
  )
  expect(f.state.sends).toHaveLength(1)
  expect(f.state.releases).toHaveLength(0)
})

test("complete release enumeration has an aggregate byte bound even when each page is admitted", async () => {
  const f = await fixture(0)
  await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true, maxDispatches: 1 }))
  const snapshot = await Effect.runPromise(f.store.read(f.plan.journalId)),
    receipt = snapshot.events.find((event) => event.body._tag === "ReceiptAccepted")!.body
  if (receipt._tag !== "ReceiptAccepted") throw new Error("fixture receipt")
  const context: ProviderContext = {
      own: { operation: f.draft, receipts: [], observations: [] },
      dependencies: [{ operation: f.ref, receipts: [receipt.receipt], observations: [] }],
    },
    provider = f.providers.find((provider) => provider.definitionId === "github.draft")!,
    populated = {
      ...response(200, []),
      body: new TextEncoder().encode("[]" + " ".repeat(8 * 1024 * 1024)),
    }
  expect(populated.body.length).toBeLessThan(16 * 1024 * 1024)
  f.state.reads = []
  f.state.override = (request) => {
    if (!request.url.includes("/releases?per_page")) return undefined
    const page = Number(new URL(request.url).searchParams.get("page"))
    return {
      ...populated,
      headers: {
        ...populated.headers,
        link: `<${base}/releases?per_page=100&page=${page + 1}>; rel="next"`,
      },
    }
  }
  expect((await Effect.runPromise(provider.observe!(f.draft, context))).status).toBe("Inconclusive")
  expect(
    f.state.reads.filter((request) => request.url.includes("/releases?per_page")),
  ).toHaveLength(Math.floor((64 * 1024 * 1024) / populated.body.length) + 1)
  expect(f.state.sends).toHaveLength(1)
  expect(f.state.releases).toHaveLength(0)
})

test("namespace authority is an authenticated exact repository view and requires no reported grant", async () => {
  const f = await fixture(1)
  const provider = f.providers.find((provider) => provider.definitionId === f.ref.definitionId)!
  const context: ProviderContext = {
    own: { operation: f.ref, receipts: [], observations: [] },
    dependencies: [],
  }
  // The double answers as GitHub does for the Actions installation token: every grant false.
  expect((await Effect.runPromise(provider.observe!(f.ref, context))).status).toBe("Absent")
  for (const document of [
    { full_name: "owner/repo", url: base },
    { ...repositoryDocument(), full_name: "owner/other" },
    { ...repositoryDocument(), permissions: [] },
  ]) {
    f.state.override = (request) => (request.url === base ? response(200, document) : undefined)
    expect((await Effect.runPromise(provider.observe!(f.ref, context))).status).toBe("Inconclusive")
  }
})
