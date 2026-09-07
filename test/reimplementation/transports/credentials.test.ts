import { expect, test } from "bun:test"
import { generateKeyPairSync, sign } from "node:crypto"
import { ConfigProvider, Effect } from "effect"
import { makeCredentialResolver, type OidcTokenRequest } from "@mannyc1/ts-release/http"
import { makeGithubOidcTokenSource } from "@mannyc1/ts-release/node"
import { verifyGithubToken } from "../../../packages/ts-release/src/platform/GithubOidc.js"

const request: OidcTokenRequest = {
  issuer: "https://token.actions.githubusercontent.com",
  audience: "sigstore",
  repository: "fixture/release",
  workflow: ".github/workflows/release.yml",
  workflowRef: "refs/tags/v0.4.0",
  expectedClaims: { sha: "a".repeat(40) },
}
const claims = {
  iss: request.issuer,
  aud: request.audience,
  repository: request.repository,
  workflow_ref: `${request.repository}/${request.workflow}@${request.workflowRef}`,
  sha: "a".repeat(40),
  iat: 1000,
  nbf: 1000,
  exp: 1300,
  sub: "repo:fixture@12/release@34:ref:refs/tags/v0.4.0",
}
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 })
const jwk = {
  ...pair.publicKey.export({ format: "jwk" }),
  kid: "native-rsa",
  use: "sig",
  alg: "RS256",
}
const token = (
  body: unknown = claims,
  header: unknown = { alg: "RS256", typ: "JWT", kid: jwk.kid },
) => {
  const payload = [header, body]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".")
  return `${payload}.${sign("RSA-SHA256", Buffer.from(payload), pair.privateKey).toString("base64url")}`
}

test("native RSA JWT verifies exact issuer, audience, workflow, source and clock without reconstructing subject", () => {
  expect(() => verifyGithubToken(token(), { keys: [jwk] }, request, 1100_000)).not.toThrow()
  expect(() =>
    verifyGithubToken(
      token({ ...claims, sub: "repo:fixture/release:environment:Production" }),
      { keys: [jwk] },
      request,
      1100_000,
    ),
  ).not.toThrow()
  for (const wrong of [
    { iss: "https://wrong.invalid" },
    { aud: "pypi" },
    { aud: [request.audience] },
    { repository: "wrong/repo" },
    { workflow_ref: claims.workflow_ref + "-other" },
    { sha: "b".repeat(40) },
    { iat: 1200 },
    { nbf: 1200 },
    { exp: 1100 },
    { exp: "1300" },
    { sub: "" },
  ])
    expect(() =>
      verifyGithubToken(token({ ...claims, ...wrong }), { keys: [jwk] }, request, 1100_000),
    ).toThrow()
  expect(() =>
    verifyGithubToken(
      token(),
      { keys: [jwk] },
      { ...request, expectedClaims: { iss: "override" } },
      1100_000,
    ),
  ).toThrow()
})

test("native RSA signature, JOSE algorithm/key admission and duplicate-key controls fail closed", () => {
  const good = token(),
    changed = good.split("."),
    bytes = Buffer.from(changed[2]!, "base64url")
  bytes[0] = bytes[0]! ^ 1
  changed[2] = bytes.toString("base64url")
  expect(() => verifyGithubToken(changed.join("."), { keys: [jwk] }, request, 1100_000)).toThrow()
  for (const header of [
    { alg: "none", typ: "JWT", kid: jwk.kid },
    { alg: "HS256", typ: "JWT", kid: jwk.kid },
    { alg: "RS256", typ: "JWT", kid: "missing" },
    { alg: "RS256", typ: "JWT", kid: jwk.kid, crit: [] },
    { alg: "RS256", typ: "JWT", kid: jwk.kid, jku: "https://wrong.invalid" },
  ])
    expect(() =>
      verifyGithubToken(token(claims, header), { keys: [jwk] }, request, 1100_000),
    ).toThrow()
  for (const keys of [
    [jwk, jwk],
    [{ ...jwk, use: "enc" }],
    [{ ...jwk, n: "AQAB" }],
    [],
    Array.from({ length: 33 }, () => jwk),
  ])
    expect(() => verifyGithubToken(good, { keys }, request, 1100_000)).toThrow()
  const header = Buffer.from(
    `{"alg":"RS256","alg":"none","typ":"JWT","kid":"${jwk.kid}"}`,
  ).toString("base64url")
  expect(() =>
    verifyGithubToken(
      [header, ...good.split(".").slice(1)].join("."),
      { keys: [jwk] },
      request,
      1100_000,
    ),
  ).toThrow()
})

test("exact credential routes acquire only after full binding, capture receivers and reject duplicate authority", async () => {
  const binding = {
    endpoint: "https://registry.npmjs.org/pkg",
    principal: "publisher",
    scope: "immutable/pkg@1",
  }
  class Route {
    #reads = 0
    binding = { ...binding }
    acquire() {
      return Effect.sync(() => {
        this.#reads++
        return { authorization: `fixture-${this.#reads}` }
      })
    }
  }
  const route = new Route(),
    resolver = makeCredentialResolver([route])
  Object.assign(route.binding, { scope: "replaced" })
  Object.assign(route, {
    acquire: () => {
      throw new Error("replaced")
    },
  })
  for (const changed of [
    { endpoint: "https://registry.npmjs.org/pkg2" },
    { endpoint: "https://wrong.invalid/pkg" },
    { principal: "other" },
    { scope: "mutable/latest" },
  ])
    await expect(Effect.runPromise(resolver({ ...binding, ...changed }))).rejects.toThrow()
  expect(await Effect.runPromise(resolver(binding))).toEqual({ authorization: "fixture-1" })
  expect(() =>
    makeCredentialResolver([
      { binding, acquire: () => Effect.succeed({}) },
      { binding, acquire: () => Effect.succeed({}) },
    ]),
  ).toThrow()
})

const environment = {
  GITHUB_ACTIONS: "true",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: request.repository,
  GITHUB_WORKFLOW_REF: claims.workflow_ref,
  RUNNER_ENVIRONMENT: "github-hosted",
  GITHUB_SHA: claims.sha,
  GITHUB_REF: request.workflowRef,
  GITHUB_REPOSITORY_ID: "34",
  GITHUB_REPOSITORY_OWNER_ID: "12",
  GITHUB_RUN_ID: "123",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_EVENT_NAME: "push",
  ACTIONS_ID_TOKEN_REQUEST_URL:
    "https://vstoken.actions.githubusercontent.com/fixture?api-version=2.0",
}
test("GitHub host mismatches reject before reading either OIDC credential value", async () => {
  for (const changed of [
    { GITHUB_REPOSITORY: "wrong/repo" },
    { GITHUB_SHA: "b".repeat(40) },
    { RUNNER_ENVIRONMENT: "self-hosted" },
    { GITHUB_RUN_ID: "0" },
  ]) {
    const reads: string[] = [],
      values: Record<string, string> = { ...environment, ...changed }
    const provider = ConfigProvider.make((path) =>
      Effect.sync(() => {
        const name = path.join("_")
        reads.push(name)
        return values[name] === undefined ? undefined : ConfigProvider.makeValue(values[name]!)
      }),
    )
    const source = makeGithubOidcTokenSource({
      timeoutMilliseconds: 100,
      maximumResponseBytes: 1024,
    })
    await expect(
      Effect.runPromise(Effect.provide(source(request), ConfigProvider.layer(provider))),
    ).rejects.toThrow()
    expect(reads).not.toContain("ACTIONS_ID_TOKEN_REQUEST_URL")
    expect(reads).not.toContain("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
  }
})

test("substituted OIDC request origins reject before the runner bearer is read", async () => {
  for (const url of [
    "https://wrong.invalid/",
    "https://evil-actions.githubusercontent.com/",
    "https://vstoken.actions.githubusercontent.com.evil.invalid/",
    "http://vstoken.actions.githubusercontent.com/",
    "https://vstoken.actions.githubusercontent.com:8443/",
    environment.ACTIONS_ID_TOKEN_REQUEST_URL + "&audience=other",
  ]) {
    const reads: string[] = [],
      values: Record<string, string> = { ...environment, ACTIONS_ID_TOKEN_REQUEST_URL: url }
    const provider = ConfigProvider.make((path) =>
      Effect.sync(() => {
        const name = path.join("_")
        reads.push(name)
        return values[name] === undefined ? undefined : ConfigProvider.makeValue(values[name]!)
      }),
    )
    const source = makeGithubOidcTokenSource({
      timeoutMilliseconds: 100,
      maximumResponseBytes: 1024,
    })
    await expect(
      Effect.runPromise(Effect.provide(source(request), ConfigProvider.layer(provider))),
    ).rejects.toThrow()
    expect(reads).toContain("ACTIONS_ID_TOKEN_REQUEST_URL")
    expect(reads).not.toContain("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
  }
})
