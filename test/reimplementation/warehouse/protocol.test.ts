import { expect, test } from "bun:test"
import { Effect, Schema, Redacted } from "effect"
import { type ProviderContext, makeRequest } from "@mannyc1/ts-release"
import type { HttpResponse, TrustedPublisherHost } from "@mannyc1/ts-release/http"
import * as PyPi from "@mannyc1/ts-release-pypi"
import { scopeFor } from "../../../packages/pypi/src/Native.js"
import { fixture } from "./fixtures.js"

const response = (
  status: number,
  value: unknown = {},
  type = "application/vnd.pypi.simple.v1+json",
): HttpResponse => ({
  status,
  headers: { "content-type": type },
  body: new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)),
})
const prepared = async () => {
  const f = await fixture()
  const intent = f.intents[0]!
  let current = response(404),
    reads = 0
  const providers = PyPi.definitions({
    ...f.access,
    read: () =>
      Effect.sync(() => {
        reads++
        return current
      }),
  })
  const operation = await Effect.runPromise(PyPi.upload(intent))
  const context: ProviderContext = {
    own: { operation, receipts: [], observations: [] },
    dependencies: [],
  }
  const request = await Effect.runPromise(providers[0]!.prepare(operation, context))
  const json = () => ({
    meta: { "api-version": "1.4" },
    name: intent.project,
    files: [
      {
        filename: intent.filename,
        url: `https://files.pythonhosted.org/${intent.filename}`,
        hashes: { sha256: intent.distribution.content.sha256 },
        size: Number(intent.distribution.content.bytes),
        yanked: false,
      },
    ],
  })
  const observe = async (r: HttpResponse, receipts: readonly unknown[] = []) => {
    current = r
    const value = await Effect.runPromise(
      providers[0]!.observe!(operation, { ...context, own: { ...context.own, receipts } }),
    )
    expect(
      providers[0]!.classifyObservation!(operation, value.evidence, receipts, {
        ...context,
        own: { ...context.own, receipts },
      }),
    ).toBe(value.status)
    return value
  }
  return {
    ...f,
    intent,
    operation,
    context,
    request,
    provider: providers[0]!,
    json,
    observe,
    reads: () => reads,
  }
}

test("native upload receipt owns the complete multipart request and excludes raw responses", async () => {
  const f = await prepared()
  expect(f.request.facts.replay._tag).toBe("None")
  expect(f.provider.ownsRequest(f.request)).toBe(true)
  const native = await Effect.runPromise(
    f.provider.decodeResponse(f.request, response(200, "secret-value-must-not-persist")),
  )
  expect(native._tag).toBe("Accepted")
  if (native._tag !== "Accepted") throw new Error("receipt expected")
  expect(JSON.stringify(native)).not.toContain("secret-value")
  expect(f.provider.receiptCorresponds(f.operation, f.request.facts, native.receipt)).toBe(true)
  for (const status of [201, 202, 400, 401, 409, 429, 500]) {
    const result = await Effect.runPromise(
      f.provider.decodeResponse(f.request, response(status, "untrusted-token")),
    )
    expect(result._tag).toBe("Unknown")
    expect(JSON.stringify(result)).not.toContain("untrusted-token")
  }
  const body = new Uint8Array(f.request.body)
  body[0] = body[0]! ^ 1
  const changed = await Effect.runPromise(makeRequest({ ...f.request.facts, body }))
  expect(f.provider.ownsRequest(changed)).toBe(false)
  await expect(
    Effect.runPromise(f.provider.decodeResponse(changed, response(200))),
  ).rejects.toThrow()
  for (const fields of [
    { endpoint: "https://example.org/upload/" },
    { principal: "different" },
    { headers: [] },
  ])
    expect(
      f.provider.ownsRequest({ facts: { ...f.request.facts, ...fields }, body: f.request.body }),
    ).toBe(false)
})

test("Simple native evidence separates exact files, conflicts, absent visibility and malformed pages", async () => {
  const f = await prepared()
  expect((await f.observe(response(200, f.json()))).status).toBe("Satisfied")
  expect((await f.observe(response(404))).status).toBe("Absent")
  const native = await Effect.runPromise(f.provider.decodeResponse(f.request, response(200)))
  if (native._tag !== "Accepted") throw new Error("receipt expected")
  expect((await f.observe(response(404), [native.receipt])).status).toBe("Pending")
  const altered = (patch: Record<string, unknown>) => ({
    ...f.json(),
    files: [{ ...f.json().files[0], ...patch }],
  })
  for (const patch of [
    { yanked: true },
    { yanked: "" },
    { size: 0 },
    { hashes: { sha256: "0".repeat(64) } },
  ])
    expect((await f.observe(response(200, altered(patch)))).status).toBe("Conflict")
  expect((await f.observe(response(200, altered({ hashes: {} })))).status).toBe("Inconclusive")
  expect((await f.observe(response(200, { ...f.json(), name: "other-project" }))).status).toBe(
    "Conflict",
  )
  for (const page of [
    { ...f.json(), files: [...f.json().files, ...f.json().files] },
    {
      ...f.json(),
      files: [...f.json().files, { ...f.json().files[0], filename: "unrelated.whl" }],
    },
    altered({ url: `https://files.pythonhosted.org/wrong.whl` }),
    altered({ size: 1.5 }),
    altered({ hashes: { sha256: "invalid" } }),
    { ...f.json(), meta: { "api-version": "2.0" } },
    '{"meta":{},"meta":{}}',
  ])
    expect((await f.observe(response(200, page))).status).toBe("Inconclusive")
  const link = `<a href="https://files.pythonhosted.org/${f.intent.filename}#sha256=${f.intent.distribution.content.sha256}">${f.intent.filename}</a>`
  expect((await f.observe(response(200, link, "text/html"))).status).toBe("Satisfied")
  for (const html of [
    link + link,
    link + link.replace(`>${f.intent.filename}</a>`, ">unrelated.whl</a>"),
    link.replace('href="', 'data-yanked="" href="'),
  ]) {
    const status = (await f.observe(response(200, html, "text/html"))).status
    expect(status).toBe(html.includes("data-yanked") ? "Conflict" : "Inconclusive")
  }
  expect((await f.observe(response(503))).status).toBe("Inconclusive")
})

test("complete two/four-file authoring rejects duplicate coordinates and altered artifact metadata before native I/O", async () => {
  const f = await prepared()
  expect(PyPi.normalizeProject("Python__Release.Example")).toBe("python-release-example")
  for (const name of ["", "-project", "project ", "project/other", "project-"])
    expect(() => PyPi.normalizeProject(name)).toThrow()
  expect(await Effect.runPromise(PyPi.author(f.intents))).toHaveLength(4)
  expect(await Effect.runPromise(PyPi.author(f.intents.slice(0, 2)))).toHaveLength(2)
  await expect(Effect.runPromise(PyPi.author([...f.intents, f.intents[0]!]))).rejects.toThrow()
  await expect(Effect.runPromise(PyPi.author([]))).rejects.toThrow()
  for (const patch of [
    { version: "2.0.0" },
    { project: "other-project" },
    { metadataVersion: "2.1" },
    { filename: f.intent.filename.replace("1.2.3", "2.0.0") },
  ]) {
    const intent = Schema.decodeUnknownSync(PyPi.UploadIntent)({ ...f.intent, ...patch })
    const operation = await Effect.runPromise(PyPi.upload(intent))
    await expect(
      Effect.runPromise(
        f.provider.observe!(operation, { ...f.context, own: { ...f.context.own, operation } }),
      ),
    ).rejects.toThrow()
    expect(f.reads()).toBe(0)
  }
})

test("token and trusted credentials bind exact endpoint, principal, project set and native mint exchange", async () => {
  const f = await prepared()
  if (f.intent.authorization._tag !== "TokenAuthorization") throw new Error("token fixture")
  const token = await Effect.runPromise(
    PyPi.authorizeToken({
      authorization: f.intent.authorization,
      endpoint: f.endpoint,
      binding: f.request.facts,
      token: Redacted.make("fixture-token"),
    }),
  )
  expect(token.authorization).toBe(
    `Basic ${Buffer.from("__token__:fixture-token").toString("base64")}`,
  )
  const auth = new PyPi.TrustedAuthorization({
    principal: "trusted-fixture",
    projects: [f.intent.project],
    repository: "fixture/project",
    workflow: ".github/workflows/release.yml",
    workflowRef: "refs/heads/main",
    issuer: "https://token.actions.githubusercontent.com",
    audience: "pypi",
  })
  const intent = Schema.decodeUnknownSync(PyPi.UploadIntent)({ ...f.intent, authorization: auth })
  const binding = {
    endpoint: f.endpoint.uploadUrl,
    principal: auth.principal,
    scope: scopeFor(intent),
  }
  let oidc = 0,
    exchange = 0
  const host: TrustedPublisherHost = {
    oidc: (request) =>
      Effect.sync(() => {
        oidc++
        expect(request.repository).toBe(auth.repository)
        expect(request.workflowRef).toBe(auth.workflowRef)
        expect(request.audience).toBe("pypi")
        return Redacted.make("oidc-fixture")
      }),
    exchange: (request) =>
      Effect.sync(() => {
        exchange++
        expect(request.url).toBe("https://pypi.org/_/oidc/mint-token")
        expect(JSON.parse(new TextDecoder().decode(request.body))).toEqual({
          token: "oidc-fixture",
        })
        return response(200, { token: "minted-fixture" }, "application/json")
      }),
  }
  const selected = f.endpoint
  if (selected._tag === "Compatible") throw new Error("official endpoint fixture")
  const credentials = await Effect.runPromise(
    PyPi.authorizeTrusted({ authorization: auth, endpoint: selected, binding }, host),
  )
  expect(credentials.authorization).toBe(
    `Basic ${Buffer.from("__token__:minted-fixture").toString("base64")}`,
  )
  for (const patch of [{ principal: "wrong" }, { endpoint: "https://example.org/" }])
    await expect(
      Effect.runPromise(
        PyPi.authorizeTrusted(
          { authorization: auth, endpoint: selected, binding: { ...binding, ...patch } },
          host,
        ),
      ),
    ).rejects.toThrow()
  for (const projects of [
    [],
    [f.intent.project, f.intent.project],
    ["not-selected"],
    ["Not_Normalized"],
  ])
    expect(() =>
      Schema.decodeUnknownSync(PyPi.UploadIntent)({
        ...intent,
        authorization: { ...auth, projects },
      }),
    ).toThrow()
  expect(oidc).toBe(1)
  expect(exchange).toBe(1)
})
