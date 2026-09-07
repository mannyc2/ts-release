import * as Effect from "effect/Effect"
import * as Config from "effect/Config"
import * as Clock from "effect/Clock"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { createPublicKey, verify } from "node:crypto"
import type {
  HttpExchangeOptions,
  OidcTokenRequest,
  OidcTokenSource,
  TrustedPublisherHost,
} from "../Http.js"
import { makeHttpRead, makeCredentialExchange } from "./HttpTransport.js"
import { ReleaseError, attempt, fail } from "../internal/Error.js"
import { decodeOwned } from "../internal/Identity.js"
import { decodeJson } from "../internal/NativeJson.js"

const issuer = "https://token.actions.githubusercontent.com"
const invalid = (): never => fail("github-oidc", "GitHub workload identity could not be verified")
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
const text = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(4096))
const Request = Schema.Struct({
  issuer: Schema.Literal(issuer),
  audience: text,
  repository: text,
  workflow: text,
  workflowRef: text,
  expectedClaims: Schema.Record(Schema.String, text),
})
const expected = (request: OidcTokenRequest) => {
  const required = {
    iss: issuer,
    aud: request.audience,
    repository: request.repository,
    workflow_ref: `${request.repository}/${request.workflow}@${request.workflowRef}`,
  }
  for (const [name, value] of Object.entries(required)) {
    if (name in request.expectedClaims && request.expectedClaims[name] !== value) invalid()
  }
  return { ...request.expectedClaims, ...required }
}
const base64url = (input: string) => {
  if (!input || !/^[A-Za-z0-9_-]+$/u.test(input)) return invalid()
  const bytes = Buffer.from(input, "base64url")
  if (bytes.toString("base64url") !== input) invalid()
  return bytes
}
/** RS256 verification against issuer-owned JWKS, exact claims and native time.
 * Exposed only inside the host module for native cryptographic conformance. */
export const verifyGithubToken = (
  token: string,
  jwks: unknown,
  input: OidcTokenRequest,
  now: number,
): void => {
  const request = decodeOwned(Request, input)
  if (typeof token !== "string" || token.length > 64 * 1024) invalid()
  const parts = token.split(".")
  if (parts.length !== 3) invalid()
  const header = object(decodeJson(base64url(parts[0]!))),
    claims = object(decodeJson(base64url(parts[1]!)))
  if (
    header.alg !== "RS256" ||
    header.typ !== "JWT" ||
    typeof header.kid !== "string" ||
    !header.kid ||
    ["crit", "jku", "jwk", "x5u", "b64"].some((name) => name in header)
  )
    invalid()
  const keys = object(jwks).keys
  if (!Array.isArray(keys) || !keys.length || keys.length > 32) invalid()
  const matches = (keys as unknown[]).map(object).filter((key) => key.kid === header.kid)
  if (matches.length !== 1) invalid()
  const key = matches[0]!
  if (
    key.kty !== "RSA" ||
    key.use !== "sig" ||
    (key.alg !== undefined && key.alg !== "RS256") ||
    typeof key.n !== "string" ||
    key.n.length > 1400 ||
    typeof key.e !== "string" ||
    key.e.length > 12
  )
    invalid()
  const modulus = base64url(key.n as string)
  if (modulus.length < 256 || modulus.length > 1024 || modulus[0] === 0) invalid()
  base64url(key.e as string)
  const publicKey = createPublicKey({
    key: { kty: "RSA", n: key.n as string, e: key.e as string },
    format: "jwk",
  })
  if (
    !verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, base64url(parts[2]!))
  )
    invalid()
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    ![claims.exp, claims.iat, claims.nbf].every(Number.isSafeInteger)
  )
    invalid()
  const seconds = Math.floor(now / 1000)
  if (
    Number(claims.iat) > seconds ||
    Number(claims.nbf) > seconds ||
    Number(claims.exp) <= seconds ||
    Number(claims.exp) <= Number(claims.iat) ||
    typeof claims.sub !== "string" ||
    !claims.sub
  )
    invalid()
  for (const [name, value] of Object.entries(expected(request)))
    if (claims[name] !== value) invalid()
}

const readEnvironment = (name: string) =>
  Config.string(name).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "github-oidc",
          message: "GitHub workload configuration is unavailable",
        }),
    ),
  )
const hostClaims = {
  sha: "GITHUB_SHA",
  ref: "GITHUB_REF",
  repository_id: "GITHUB_REPOSITORY_ID",
  repository_owner_id: "GITHUB_REPOSITORY_OWNER_ID",
  run_id: "GITHUB_RUN_ID",
  run_attempt: "GITHUB_RUN_ATTEMPT",
  event_name: "GITHUB_EVENT_NAME",
  runner_environment: "RUNNER_ENVIRONMENT",
} as const

/** GitHub-hosted Actions default. Config layers supply environment at the host
 * boundary. Validate public host facts before reading either OIDC secret value;
 * reacquire and verify a token per call. Cloud exchanges still enforce their own
 * trusted-publisher policy. No token or raw credential response enters history. */
export const makeGithubOidcTokenSource = (options: HttpExchangeOptions): OidcTokenSource => {
  const bounds = {
    timeoutMilliseconds: options.timeoutMilliseconds,
    maximumResponseBytes: options.maximumResponseBytes,
    ...(options.maximumWireResponseBytes !== undefined && {
      maximumWireResponseBytes: options.maximumWireResponseBytes,
    }),
  }
  const publicRead = makeHttpRead({ ...bounds, credentials: () => Effect.succeed({}) })
  return Effect.fn("github.oidc")(function* (input) {
    const request = yield* attempt(() => {
      const value = decodeOwned(Request, input)
      if (
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value.repository) ||
        !/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/u.test(value.workflow) ||
        !/^(?:refs\/(?:heads|tags)\/[^\s~^:?*\[\\]+|[0-9a-f]{40}(?:[0-9a-f]{24})?)$/u.test(
          value.workflowRef,
        )
      )
        invalid()
      expected(value)
      return value
    })
    for (const [name, value] of Object.entries({
      GITHUB_ACTIONS: "true",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: request.repository,
      GITHUB_WORKFLOW_REF: `${request.repository}/${request.workflow}@${request.workflowRef}`,
      RUNNER_ENVIRONMENT: "github-hosted",
    })) {
      if ((yield* readEnvironment(name)) !== value) return yield* attempt(invalid)
    }
    const claims: Record<string, string> = { ...request.expectedClaims }
    for (const [claim, name] of Object.entries(hostClaims)) {
      const value = yield* readEnvironment(name)
      if (claims[claim] !== undefined && claims[claim] !== value) return yield* attempt(invalid)
      const pattern =
        claim === "sha"
          ? /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u
          : claim === "ref"
            ? /^refs\/(?:heads|tags)\/[^\s]+$/u
            : claim.endsWith("_id") || claim === "run_attempt"
              ? /^[1-9][0-9]*$/u
              : /^[a-z][a-z0-9_-]*$/u
      if (!pattern.test(value)) return yield* attempt(invalid)
      claims[claim] = value
    }
    const rawUrl = yield* readEnvironment("ACTIONS_ID_TOKEN_REQUEST_URL")
    const url = yield* attempt(() => {
      const url = new URL(rawUrl)
      // GitHub.com runner service endpoint, independent of the JWT issuer URL.
      // Refuse a substituted origin before reading the runner request token.
      if (
        url.protocol !== "https:" ||
        !url.hostname.endsWith(".actions.githubusercontent.com") ||
        url.port !== "" ||
        url.username ||
        url.password ||
        url.hash ||
        url.href !== rawUrl ||
        url.searchParams.has("audience")
      )
        invalid()
      url.searchParams.set("audience", request.audience)
      return url.href
    })
    const secret = yield* Config.redacted("ACTIONS_ID_TOKEN_REQUEST_TOKEN").pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "github-oidc",
            message: "GitHub OIDC request credential is unavailable",
          }),
      ),
    )
    const fields = yield* attempt(() => {
      const value = Redacted.value(secret)
      if (!value || value.length > 65536 || /[^\x21-\x7e]/u.test(value)) invalid()
      return { authorization: `Bearer ${value}` }
    })
    const response = yield* makeHttpRead({ ...bounds, credentials: () => Effect.succeed(fields) })({
      url,
      method: "GET",
      headers: [],
      principal: "github-actions-oidc",
      scope: request.audience,
    })
    const token = yield* attempt(() => {
      if (response.status !== 200) invalid()
      const value = object(decodeJson(response.body)).value
      if (typeof value !== "string" || !value || value.length > 65536) invalid()
      return value as string
    })
    const keys = yield* publicRead({
      url: `${issuer}/.well-known/jwks`,
      method: "GET",
      headers: [],
      principal: "github-oidc-keys",
      scope: issuer,
    })
    const now = yield* Clock.currentTimeMillis
    yield* attempt(() => {
      if (keys.status !== 200) invalid()
      verifyGithubToken(token, decodeJson(keys.body), { ...request, expectedClaims: claims }, now)
    })
    return Redacted.make(token)
  })
}
export const makeGithubTrustedPublisherHost = (
  options: HttpExchangeOptions,
): TrustedPublisherHost =>
  Object.freeze({
    oidc: makeGithubOidcTokenSource(options),
    exchange: makeCredentialExchange(options),
  })
