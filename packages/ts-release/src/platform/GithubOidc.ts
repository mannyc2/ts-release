import { Clock, Config, Effect, Redacted, Result, Schema } from "effect"
import { createPublicKey, verify } from "node:crypto"
import type { HttpExchangeOptions, OidcTokenRequest } from "../Http.js"
import type { OidcTokenSource, TrustedPublisherHost } from "../Http.js"
import { makeHttpRead, makeCredentialExchange } from "./HttpTransport.js"
import { attempt, fail, failure } from "../internal/Error.js"
import { decodeOwned } from "../internal/Identity.js"
import { decodeJson } from "../internal/NativeJson.js"

const issuer = "https://token.actions.githubusercontent.com"
const invalid = (): never => fail("github-oidc", "GitHub workload identity could not be verified")
const decodeOidcJson = (bytes: Uint8Array): unknown => {
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let text: string
  try {
    text = decoder.decode(bytes)
  } catch {
    return fail("invalid-data", "Value could not be admitted")
  }
  return decodeJson(text)
}
const decode = <A, I>(codec: Schema.Codec<A, I>, value: unknown): A => {
  const decoded = Schema.decodeUnknownResult(codec)(value)
  return Result.isFailure(decoded) ? invalid() : decoded.success
}
const nonempty = Schema.String.check(Schema.isMinLength(1))
const TokenParts = Schema.Tuple([Schema.String, Schema.String, Schema.String])
const Header = Schema.Struct({
  alg: Schema.Literal("RS256"),
  typ: Schema.Literal("JWT"),
  kid: nonempty,
  crit: Schema.optionalKey(Schema.Never),
  jku: Schema.optionalKey(Schema.Never),
  jwk: Schema.optionalKey(Schema.Never),
  x5u: Schema.optionalKey(Schema.Never),
  b64: Schema.optionalKey(Schema.Never),
})
const Claims = Schema.StructWithRest(
  Schema.Struct({ exp: Schema.Int, iat: Schema.Int, nbf: Schema.Int, sub: nonempty }),
  [Schema.Record(Schema.String, Schema.Unknown)],
)
const KeySet = Schema.Struct({
  keys: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(32),
  ),
})
const PublicKey = Schema.Struct({
  kty: Schema.Literal("RSA"),
  use: Schema.Literal("sig"),
  alg: Schema.optional(Schema.Literal("RS256")),
  n: Schema.String.check(Schema.isMaxLength(1400)),
  e: Schema.String.check(Schema.isMaxLength(12)),
})
const TokenResponse = Schema.Struct({ value: nonempty.check(Schema.isMaxLength(65536)) })
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
  const [rawHeader, rawClaims, signature] = decode(TokenParts, token.split("."))
  const header = decode(Header, decodeOidcJson(base64url(rawHeader))),
    claims = decode(Claims, decodeOidcJson(base64url(rawClaims)))
  const matches = decode(KeySet, jwks).keys.filter((key) => key.kid === header.kid)
  const [selected] = matches
  if (matches.length !== 1 || selected === undefined) return invalid()
  const key = decode(PublicKey, selected)
  const modulus = base64url(key.n)
  if (modulus.length < 256 || modulus.length > 1024 || modulus[0] === 0) invalid()
  base64url(key.e)
  let publicKey: ReturnType<typeof createPublicKey>
  try {
    publicKey = createPublicKey({
      key: { kty: "RSA", n: key.n, e: key.e },
      format: "jwk",
    })
  } catch {
    return fail("invalid-data", "Value could not be admitted")
  }
  const signed = Buffer.from(`${rawHeader}.${rawClaims}`),
    signatureBytes = base64url(signature)
  let verified: boolean
  try {
    verified = verify("RSA-SHA256", signed, publicKey, signatureBytes)
  } catch {
    return fail("invalid-data", "Value could not be admitted")
  }
  if (!verified) invalid()
  if (!Number.isSafeInteger(now) || now < 0) invalid()
  const seconds = Math.floor(now / 1000)
  if (
    claims.iat > seconds ||
    claims.nbf > seconds ||
    claims.exp <= seconds ||
    claims.exp <= claims.iat
  )
    invalid()
  for (const [name, value] of Object.entries(expected(request)))
    if (claims[name] !== value) invalid()
}

const readEnvironment = (name: string) =>
  Config.String(name).pipe(
    Effect.mapError(() => failure("github-oidc", "GitHub workload configuration is unavailable")),
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
        !/^(?:refs\/(?:heads|tags)\/[^\s~^:?*[\\]+|[0-9a-f]{40}(?:[0-9a-f]{24})?)$/u.test(
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
      if (!URL.canParse(rawUrl)) fail("invalid-data", "Value could not be admitted")
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
    const secret = yield* Config.Redacted("ACTIONS_ID_TOKEN_REQUEST_TOKEN").pipe(
      Effect.mapError(() => failure("github-oidc", "GitHub OIDC credential is unavailable")),
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
      return decode(TokenResponse, decodeOidcJson(response.body)).value
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
      verifyGithubToken(
        token,
        decodeOidcJson(keys.body),
        { ...request, expectedClaims: claims },
        now,
      )
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
