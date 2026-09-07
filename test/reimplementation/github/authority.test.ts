import { expect, test } from "bun:test"
import { Effect, Redacted } from "effect"
import { makeRequest, type ProviderContext } from "@mannyc1/ts-release"
import * as GitHub from "../../../packages/github/src/index.js"
import { bindScope } from "../../../packages/github/src/Binding.js"
import { makeHttpTransport } from "@mannyc1/ts-release/node"
import { nativeRequest } from "../../../packages/github/src/Wire.js"
import { repository, fixture, response, releaseDocument, commit, tagger } from "./fixtures.js"

const empty = (operation: ProviderContext["own"]["operation"]): ProviderContext => ({
  own: { operation, receipts: [], observations: [] },
  dependencies: [],
})
test("GitHub requests prepare through the actual shared HTTP boundary with transport-owned framing", async () => {
  const f = await fixture(0),
    request = await Effect.runPromise(makeRequest(nativeRequest(bindScope(f.tag, empty(f.tag)))))
  let credentials = 0
  const transport = makeHttpTransport({
    providers: f.providers,
    credentials: () =>
      Effect.sync(() => {
        credentials++
        return {}
      }),
    timeoutMilliseconds: 1000,
    maximumResponseBytes: 1024,
  })
  expect(typeof (await Effect.runPromise(transport.prepare!(request)))).toBe("function")
  expect(credentials).toBe(1)
  expect(
    request.facts.headers.some(([name]) => /^(content-length|transfer-encoding)$/u.test(name)),
  ).toBe(false)
})
test("draft creation cannot accept an already-public native acknowledgement", async () => {
  const f = await fixture(0),
    operation = await Effect.runPromise(
      GitHub.draft(
        new GitHub.DraftIntent({
          ...(f.draft.intent as GitHub.DraftIntent),
          tagSource: new GitHub.ExistingTag({ commit }),
        }),
      ),
    ),
    request = await Effect.runPromise(
      makeRequest(nativeRequest(bindScope(operation, empty(operation)))),
    ),
    provider = f.providers.find((p) => p.definitionId === "github.draft")!
  expect(
    (
      await Effect.runPromise(
        provider.decodeResponse(request, response(201, releaseDocument(731, true))),
      )
    )._tag,
  ).toBe("Accepted")
  expect(
    (
      await Effect.runPromise(
        provider.decodeResponse(request, response(201, releaseDocument(731, false))),
      )
    )._tag,
  ).toBe("Unknown")
})
test("GitHub credentials admit exact repository and principal routes before opening a token; download redirects receive none", async () => {
  const f = await fixture(0),
    request = await Effect.runPromise(makeRequest(nativeRequest(bindScope(f.tag, empty(f.tag)))))
  const binding = {
    endpoint: request.facts.endpoint,
    principal: request.facts.principal,
    scope: request.facts.scope,
  }
  const authorize = (patch: Partial<typeof binding> = {}) =>
    Effect.runPromise(
      GitHub.authorizeToken({
        repository,
        binding: { ...binding, ...patch },
        token: Redacted.make("fixture-token"),
      }),
    )
  expect(await authorize()).toEqual({ authorization: "Bearer fixture-token" })
  for (const patch of [
    { endpoint: binding.endpoint.replace("api.github.com", "api.github.com.evil.invalid") },
    { endpoint: binding.endpoint.replace("owner/repo", "other/repo") },
    { endpoint: binding.endpoint + "?token=must-not-leak" },
    { endpoint: "https://api.github.com/user" },
    { principal: "other" },
    { scope: "{}" },
  ])
    await expect(authorize(patch)).rejects.toThrow()
  const publicInput = {
    repository,
    binding: {
      ...binding,
      endpoint:
        "https://release-assets.githubusercontent.com/github-production-release-asset/1/asset?signature=ephemeral",
      principal: "github:public-download",
    },
    get token(): Redacted.Redacted<string> {
      throw new Error("secret must remain unopened")
    },
  }
  expect(await Effect.runPromise(GitHub.authorizeToken(publicInput))).toEqual({})
  await expect(
    Effect.runPromise(
      GitHub.authorizeToken({
        repository,
        token: Redacted.make("fixture"),
        binding: { ...publicInput.binding, endpoint: "https://evil.invalid/file" },
      }),
    ),
  ).rejects.toThrow()
})

test("native acknowledgement must bind exact tag facts, status and full request, without archiving raw errors", async () => {
  const f = await fixture(0, true),
    operation = await Effect.runPromise(
      GitHub.annotatedTag(
        new GitHub.AnnotatedTag({
          ...(f.tag.intent as GitHub.AnnotatedTag),
          tagger: new GitHub.Tagger({ ...tagger, date: "2026-09-07T05:30:00+05:30" }),
        }),
      ),
    ),
    request = await Effect.runPromise(
      makeRequest(nativeRequest(bindScope(operation, empty(operation)))),
    ),
    provider = f.providers.find((provider) => provider.definitionId === "github.annotated-tag")!,
    raw = {
      sha: "b".repeat(40),
      tag: "v1.0.0",
      message: "Release tag\n",
      tagger,
      url: `https://api.github.com/repos/owner/repo/git/tags/${"b".repeat(40)}`,
      object: {
        sha: commit,
        type: "commit",
        url: `https://api.github.com/repos/owner/repo/git/commits/${commit}`,
      },
    }
  const accepted = await Effect.runPromise(provider.decodeResponse(request, response(201, raw)))
  expect(accepted._tag).toBe("Accepted")
  for (const patch of [
    { tag: "v2.0.0" },
    { message: "different" },
    { object: { ...raw.object, sha: "c".repeat(40) } },
    { tagger: { ...tagger, date: "2026-09-07T00:00:01Z" } },
    { url: raw.url.replace("repo/", "foreign/") },
  ]) {
    const unknown = await Effect.runPromise(
      provider.decodeResponse(
        request,
        response(201, { ...raw, ...patch, token: "never archive this" }),
      ),
    )
    expect(unknown._tag).toBe("Unknown")
    expect(JSON.stringify(unknown)).not.toContain("never archive this")
  }
  for (const status of [200, 202, 401, 409, 422, 502])
    expect(
      (
        await Effect.runPromise(
          provider.decodeResponse(request, response(status, { token: "secret" })),
        )
      )._tag,
    ).toBe("Unknown")
  expect(f.providers.filter((provider) => provider.ownsRequest(request))).toHaveLength(1)
})
