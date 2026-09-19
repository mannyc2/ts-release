import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { makeRequest, type ProviderContext } from "@mannyc1/ts-release"
import { File } from "@mannyc1/ts-release/bundle"
import * as GitHub from "../../../packages/github/src/index.js"
import { bindScope, readScope } from "../../../packages/github/src/Binding.js"
import {
  nativeRequest,
  ownsRequest,
  requestCorresponds,
  sha256,
} from "../../../packages/github/src/Wire.js"

async function fixture() {
  const repository = new GitHub.Repository({
    apiUrl: "https://api.github.com",
    owner: "owner",
    name: "repo",
  })
  const draft = await Effect.runPromise(
    GitHub.draft(
      new GitHub.DraftIntent({
        repository,
        principal: "draft-authority",
        tag: "v1.0.0",
        tagSource: new GitHub.ExistingTag({ commit: "a".repeat(40) }),
        title: "Release",
        body: "Notes",
        prerelease: false,
      }),
    ),
  )
  const draftContext: ProviderContext = {
    own: { operation: draft, receipts: [], observations: [] },
    dependencies: [],
  }
  const draftRequest = await Effect.runPromise(
    makeRequest(nativeRequest(bindScope(draft, draftContext))),
  )
  const facts = new GitHub.ReleaseFacts({
    releaseId: "123",
    tag: "v1.0.0",
    title: "Release",
    body: "Notes",
    prerelease: false,
    draft: true,
    uploadUrlTemplate:
      "https://uploads.github.com/repos/owner/repo/releases/123/assets{?name,label}",
  })
  const bytes = new TextEncoder().encode("owned asset bytes")
  const file = Schema.decodeUnknownSync(File)({
    _tag: "OwnedFile",
    logicalName: "asset.bin",
    content: { bytes: bytes.length, sha256: sha256(bytes) },
    deliveryMode: 420,
    executable: null,
    producedBy: { name: "wire-fixture", version: "fixture" },
  })
  const asset = await Effect.runPromise(
    GitHub.uploadAsset(
      new GitHub.AssetIntent({
        repository,
        principal: "asset-authority",
        draftOperation: draft.operationId,
        file,
        publicName: "asset + name.bin",
        mediaType: "application/octet-stream",
      }),
    ),
  )
  const context: ProviderContext = {
    own: { operation: asset, receipts: [], observations: [] },
    dependencies: [
      {
        operation: draft,
        receipts: [{ request: draftRequest.facts, status: 201, facts }],
        observations: [],
      },
    ],
  }
  return { repository, draft, draftContext, draftRequest, facts, bytes, asset, context }
}
test("GitHub wire uses exact JSON or owned binary bodies and the returned parent upload template", async () => {
  const f = await fixture(),
    scope = bindScope(f.asset, f.context)
  const request = await Effect.runPromise(makeRequest(nativeRequest(scope, f.bytes)))
  expect(request.facts.endpoint).toBe(
    "https://uploads.github.com/repos/owner/repo/releases/123/assets?name=asset+%2B+name.bin",
  )
  expect(request.facts.principal).toBe("asset-authority")
  expect(request.body).toEqual(f.bytes)
  expect(request.facts.bodyDigest).toBe(sha256(f.bytes))
  expect(request.facts.byteLength).toBe(String(f.bytes.length))
  expect(request.facts.headers.some(([name]) => name === "content-length")).toBe(false)
  expect(ownsRequest(request)).toBe(true)
  expect(requestCorresponds(f.asset, request.facts, f.context)).toBe(true)
  expect(readScope(request.facts.scope)).toEqual(scope)
  expect(JSON.parse(new TextDecoder().decode(f.draftRequest.body))).toEqual({
    tag_name: "v1.0.0",
    target_commitish: "a".repeat(40),
    name: "Release",
    body: "Notes",
    draft: true,
    prerelease: false,
    generate_release_notes: false,
  })
  expect(ownsRequest(f.draftRequest)).toBe(true)
})
test("exact wire admission rejects changed method, endpoint, bytes, headers and foreign parent evidence", async () => {
  const f = await fixture(),
    request = await Effect.runPromise(
      makeRequest(nativeRequest(bindScope(f.asset, f.context), f.bytes)),
    )
  for (const facts of [
    { ...request.facts, method: "PUT" },
    { ...request.facts, endpoint: request.facts.endpoint.replace("123", "124") },
    { ...request.facts, headers: [...request.facts.headers, ["authorization", "fixture"]] },
    { ...request.facts, bodyDigest: "f".repeat(64) },
  ])
    expect(ownsRequest({ facts: facts as typeof request.facts, body: request.body })).toBe(false)
  expect(ownsRequest({ ...request, body: new Uint8Array([0]) })).toBe(false)
  const conflicting = {
    ...f.context,
    dependencies: [
      {
        ...f.context.dependencies[0]!,
        receipts: [
          ...f.context.dependencies[0]!.receipts,
          { request: f.draftRequest.facts, status: 201, facts: { ...f.facts, releaseId: "124" } },
        ],
      },
    ],
  }
  expect(() => bindScope(f.asset, conflicting)).toThrow("parent evidence")
  expect(() => bindScope(f.asset, { ...f.context, dependencies: [] })).toThrow("undeclared parent")
})
test("published-parent observation cannot authorize an asset write through a stale draft receipt", async () => {
  const f = await fixture()
  const context: ProviderContext = {
    ...f.context,
    dependencies: [
      {
        ...f.context.dependencies[0]!,
        observations: [
          {
            status: "Satisfied",
            evidence: {
              _tag: "Present",
              scope: f.draftRequest.facts.scope,
              facts: { ...f.facts, draft: false },
            },
          },
        ],
      },
    ],
  }
  expect(() => nativeRequest(bindScope(f.asset, context), f.bytes)).toThrow(
    "asset parent published",
  )
  const restored: ProviderContext = {
    ...context,
    dependencies: [
      {
        ...context.dependencies[0]!,
        observations: [
          ...context.dependencies[0]!.observations,
          {
            status: "Satisfied",
            evidence: { _tag: "Present", scope: f.draftRequest.facts.scope, facts: f.facts },
          },
        ],
      },
    ],
  }
  expect(() => nativeRequest(bindScope(f.asset, restored), f.bytes)).toThrow(
    "asset parent published",
  )
})
