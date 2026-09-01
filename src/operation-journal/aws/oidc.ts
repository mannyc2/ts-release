import { Buffer } from "node:buffer"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  AssumeRoleWithWebIdentityCommand,
  GetCallerIdentityCommand,
  STSClient,
  type STSClientConfig
} from "@aws-sdk/client-sts"
import * as Effect from "effect/Effect"
import { parseStrictJson, type Json } from "../../model/canonical.js"
import { validateS3JournalAuthority } from "../authority.js"
import {
  S3JournalBoundaryError,
  type S3JournalAuthority,
  type S3JournalOidcClaims
} from "../model.js"
import {
  operationJournalNetworkDeadlineMilliseconds,
  withOperationJournalNetworkDeadline
} from "./deadline.js"

export interface AwsJournalCredentials {
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly sessionToken: string
  readonly expiration: Date
}

export interface AwsJournalSession {
  readonly credentials: AwsJournalCredentials
  readonly oidc: S3JournalOidcClaims
  readonly callerArn: string
}

export interface AwsJournalOidcRuntime {
  readonly environment: Record<string, string | undefined>
  readonly fileExists: (path: string) => boolean
  readonly fetch: typeof globalThis.fetch
  readonly now: () => Date
  readonly makeAnonymousSts: (config: STSClientConfig) => STSClient
  readonly makeSessionSts: (config: STSClientConfig) => STSClient
  /** Internal qualification seam; production always uses the fixed maximum. */
  readonly networkDeadlineMilliseconds?: number
}

const maximumOidcResponseBytes = 16_384
const maximumOidcTokenCharacters = 12_000
const maximumOidcHeaderCharacters = 2_048
const maximumOidcPayloadCharacters = 8_192
const maximumOidcSignatureCharacters = 2_048

const fail = (reason: string): never => {
  throw S3JournalBoundaryError.make({
    operation: "observe-authority",
    commitment: "not-applicable",
    reason
  })
}

const boundaryError = (cause: unknown, reason: string): S3JournalBoundaryError =>
  cause instanceof S3JournalBoundaryError
    ? cause
    : S3JournalBoundaryError.make({
      operation: "observe-authority",
      commitment: "not-applicable",
      reason
    })

const isObject = (value: Json): value is { readonly [key: string]: Json } =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const requireString = (
  object: { readonly [key: string]: Json },
  field: string
): string => {
  const value = object[field]
  if (typeof value !== "string" || value.length === 0) fail(`GitHub OIDC claim ${field} is missing or invalid.`)
  return value as string
}

const requireInteger = (
  object: { readonly [key: string]: Json },
  field: string
): number => {
  const value = object[field]
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    fail(`GitHub OIDC claim ${field} is missing or invalid.`)
  }
  return value as number
}

const decodeBase64Url = (value: string, maximum: number, label: string): string => {
  if (value.length > maximum || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    fail(`${label} is not bounded canonical base64url.`)
  }
  const bytes = Buffer.from(value, "base64url")
  if (bytes.toString("base64url") !== value) fail(`${label} is not canonical base64url.`)
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return fail(`${label} is not UTF-8.`)
  }
}

const decodeOidcToken = (token: string, now: Date): S3JournalOidcClaims => {
  if (token.length < 64 || token.length > maximumOidcTokenCharacters ||
      !/^[A-Za-z0-9_.-]+$/u.test(token)) {
    fail("GitHub OIDC response is not one bounded compact JWT.")
  }
  const segments = token.split(".")
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
    fail("GitHub OIDC response is not one compact JWT.")
  }
  const signature = segments[2]!
  if (signature.length > maximumOidcSignatureCharacters ||
      Buffer.from(signature, "base64url").toString("base64url") !== signature) {
    fail("GitHub OIDC signature is not bounded canonical base64url.")
  }
  let header: Json
  let payload: Json
  try {
    header = parseStrictJson(decodeBase64Url(
      segments[0]!,
      maximumOidcHeaderCharacters,
      "GitHub OIDC header"
    ))
    payload = parseStrictJson(decodeBase64Url(
      segments[1]!,
      maximumOidcPayloadCharacters,
      "GitHub OIDC payload"
    ))
  } catch (cause) {
    if (cause instanceof S3JournalBoundaryError) throw cause
    return fail("GitHub OIDC JWT does not contain strict JSON.")
  }
  if (!isObject(header) || header.alg !== "RS256" || header.typ !== "JWT" ||
      typeof header.kid !== "string" || header.kid.length === 0) {
    fail("GitHub OIDC JWT header is not the admitted RS256 identity.")
  }
  if (!isObject(payload)) fail("GitHub OIDC JWT payload must be an object.")
  const claimsPayload = payload as { readonly [key: string]: Json }
  const nowSeconds = Math.floor(now.getTime() / 1000)
  const issuedAt = requireInteger(claimsPayload, "iat")
  const notBefore = requireInteger(claimsPayload, "nbf")
  const expiresAt = requireInteger(claimsPayload, "exp")
  if (issuedAt > nowSeconds + 30 || notBefore > nowSeconds + 30 || expiresAt <= nowSeconds + 30 ||
      expiresAt <= issuedAt || expiresAt - issuedAt > 900) {
    fail("GitHub OIDC JWT validity window is not current and bounded.")
  }
  const claims: S3JournalOidcClaims = {
    issuer: requireString(claimsPayload, "iss") as S3JournalOidcClaims["issuer"],
    audience: requireString(claimsPayload, "aud") as S3JournalOidcClaims["audience"],
    subject: requireString(claimsPayload, "sub"),
    repository: requireString(claimsPayload, "repository"),
    repositoryId: requireString(claimsPayload, "repository_id"),
    repositoryOwnerId: requireString(claimsPayload, "repository_owner_id"),
    repositoryVisibility: requireString(claimsPayload, "repository_visibility") as S3JournalOidcClaims["repositoryVisibility"],
    eventName: requireString(claimsPayload, "event_name") as S3JournalOidcClaims["eventName"],
    ref: requireString(claimsPayload, "ref"),
    refType: requireString(claimsPayload, "ref_type") as S3JournalOidcClaims["refType"],
    sha: requireString(claimsPayload, "sha"),
    environment: requireString(claimsPayload, "environment"),
    runnerEnvironment: requireString(claimsPayload, "runner_environment") as S3JournalOidcClaims["runnerEnvironment"],
    runId: requireString(claimsPayload, "run_id"),
    runAttempt: requireString(claimsPayload, "run_attempt"),
    workflow: requireString(claimsPayload, "workflow"),
    workflowRef: requireString(claimsPayload, "workflow_ref"),
    workflowSha: requireString(claimsPayload, "workflow_sha"),
    jobWorkflowRef: requireString(claimsPayload, "job_workflow_ref"),
    jobWorkflowSha: requireString(claimsPayload, "job_workflow_sha")
  }
  if (claims.issuer !== "https://token.actions.githubusercontent.com" || claims.audience !== "sts.amazonaws.com") {
    fail("GitHub OIDC issuer or audience is not the admitted AWS exchange identity.")
  }
  const immutableJobWorkflow = claims.jobWorkflowRef.match(/@([a-f0-9]{40})$/u)
  if (immutableJobWorkflow?.[1] !== claims.jobWorkflowSha) {
    fail("GitHub OIDC called-workflow ref is not pinned to its exact source SHA.")
  }
  return claims
}

const sameClaims = (left: S3JournalOidcClaims, right: S3JournalOidcClaims): boolean => {
  const fields = Object.keys(left) as ReadonlyArray<keyof S3JournalOidcClaims>
  return fields.length === Object.keys(right).length && fields.every((field) => left[field] === right[field])
}

const requireCleanAwsEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
  fileExists: (path: string) => boolean
): void => {
  const forbiddenHostVariables = new Set([
    "ALL_PROXY",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "NODE_DEBUG",
    "NODE_DEBUG_NATIVE",
    "NODE_EXTRA_CA_CERTS",
    "NODE_OPTIONS",
    "NODE_PATH",
    "NODE_TLS_REJECT_UNAUTHORIZED",
    "NODE_USE_ENV_PROXY",
    "OPENSSL_CONF",
    "SSLKEYLOGFILE",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "all_proxy",
    "http_proxy",
    "https_proxy",
    "no_proxy"
  ])
  const ambient = Object.entries(environment)
    .filter(([key, value]) => value !== undefined && value !== "" &&
      (key.startsWith("AWS_") || forbiddenHostVariables.has(key)))
    .map(([key]) => key)
    .sort()
  if (ambient.length > 0) {
    fail(`Ambient AWS configuration is forbidden (${ambient.join(", ")}).`)
  }
  const homeDirectories = [environment.HOME, environment.USERPROFILE]
    .filter((value): value is string => value !== undefined && value.length > 0)
  const sharedFiles = [...new Set(homeDirectories)]
    .flatMap((home) => [join(home, ".aws", "credentials"), join(home, ".aws", "config")])
  if (sharedFiles.some(fileExists)) {
    fail("Ambient AWS shared credential or configuration files are forbidden.")
  }
}

const consumeGitHubOidcCoordinates = (
  environment: Record<string, string | undefined>
): { readonly requestUrl: string, readonly requestToken: string } => {
  const requestUrl = environment.ACTIONS_ID_TOKEN_REQUEST_URL
  const requestToken = environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  delete environment.ACTIONS_ID_TOKEN_REQUEST_URL
  delete environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  if (environment.ACTIONS_ID_TOKEN_REQUEST_URL !== undefined ||
      environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN !== undefined) {
    return fail("GitHub OIDC request coordinates could not be consumed from the process environment.")
  }
  if (requestUrl === undefined || requestUrl === "" || requestToken === undefined || requestToken === "") {
    return fail("GitHub OIDC request coordinates are unavailable.")
  }
  if (requestUrl.length > 4_096 || requestToken.length > 8_192 ||
      !/^[!-~]+$/u.test(requestUrl) || !/^[!-~]+$/u.test(requestToken)) {
    return fail("GitHub OIDC request coordinates exceed their canonical bounds.")
  }
  return { requestUrl, requestToken }
}

const readOidcResponse = async (response: Response): Promise<Json> => {
  const rawLength = response.headers.get("content-length")
  if (rawLength === null || !/^[1-9][0-9]{0,5}$/u.test(rawLength)) {
    return fail("GitHub OIDC token response lacks one bounded Content-Length.")
  }
  const contentLength = Number(rawLength)
  if (contentLength > maximumOidcResponseBytes || response.body === null) {
    return fail("GitHub OIDC token response exceeds its byte bound.")
  }
  const bytes = new Uint8Array(contentLength)
  const reader = response.body.getReader()
  let offset = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (offset + chunk.value.length > bytes.length) {
        return fail("GitHub OIDC token response stream exceeded Content-Length.")
      }
      bytes.set(chunk.value, offset)
      offset += chunk.value.length
    }
  } finally {
    reader.releaseLock()
  }
  if (offset !== bytes.length) {
    return fail("GitHub OIDC token response stream disagrees with Content-Length.")
  }
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    return parseStrictJson(text)
  } catch {
    return fail("GitHub OIDC token response is not strict UTF-8 JSON.")
  }
}

const requestGitHubOidcToken = async (
  requestUrl: string,
  requestToken: string,
  fetchImpl: typeof globalThis.fetch,
  deadlineMilliseconds: number
): Promise<string> => {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return fail("GitHub OIDC request URL is invalid.")
  }
  const rawAuthority = requestUrl.slice(requestUrl.indexOf("//") + 2).split(/[/?#]/u, 1)[0] ?? ""
  if (url.protocol !== "https:" ||
      !/^[a-z0-9-]+\.actions\.githubusercontent\.com$/u.test(url.hostname) ||
      rawAuthority.includes(":") || url.port !== "" ||
      url.username !== "" || url.password !== "" || url.hash !== "") {
    return fail("GitHub OIDC request URL is not one authenticated Actions HTTPS endpoint.")
  }
  url.searchParams.set("audience", "sts.amazonaws.com")
  if (url.href.length > 4_096 || !/^[!-~]+$/u.test(url.href)) {
    return fail("GitHub OIDC request URL exceeds its canonical bounds after audience binding.")
  }
  return withOperationJournalNetworkDeadline(async (signal) => {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "identity",
        Authorization: `bearer ${requestToken}`
      },
      redirect: "error",
      signal
    })
    if (!response.ok || response.redirected || response.url !== url.href) {
      fail("GitHub OIDC token request did not return the exact requested endpoint.")
    }
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
    if (contentType !== "application/json") fail("GitHub OIDC token response is not JSON.")
    const body = await readOidcResponse(response)
    if (!isObject(body) || Object.keys(body).length !== 1 || typeof body.value !== "string") {
      return fail("GitHub OIDC token response fields are not the exact admitted set.")
    }
    return body.value as string
  }, deadlineMilliseconds)
}

const roleName = (roleArn: string): string => roleArn.slice(roleArn.lastIndexOf("/") + 1)

export const defaultAwsJournalOidcRuntime: AwsJournalOidcRuntime = {
  environment: process.env,
  fileExists: existsSync,
  fetch: globalThis.fetch,
  now: () => new Date(),
  makeAnonymousSts: (config) => new STSClient(config),
  makeSessionSts: (config) => new STSClient(config)
}

export const acquireAwsJournalSession = (
  authority: S3JournalAuthority,
  runtime: AwsJournalOidcRuntime = defaultAwsJournalOidcRuntime
): Effect.Effect<AwsJournalSession, S3JournalBoundaryError> => Effect.tryPromise({
  try: async () => {
    try {
      validateS3JournalAuthority(authority)
    } catch {
      fail("AWS journal activation contract is malformed.")
    }
    const coordinates = consumeGitHubOidcCoordinates(runtime.environment)
    let runnerRequestToken = coordinates.requestToken
    let webIdentityToken = ""
    try {
      requireCleanAwsEnvironment(runtime.environment, runtime.fileExists)
      const deadlineMilliseconds = runtime.networkDeadlineMilliseconds ??
        operationJournalNetworkDeadlineMilliseconds
      webIdentityToken = await requestGitHubOidcToken(
        coordinates.requestUrl,
        runnerRequestToken,
        runtime.fetch,
        deadlineMilliseconds
      )
      const observedClaims = decodeOidcToken(webIdentityToken, runtime.now())
      if (!sameClaims(observedClaims, authority.oidc)) {
        fail("GitHub OIDC claims drifted from the exact activation contract.")
      }
      const sessionName = `ts-release-journal-${observedClaims.runId}-${observedClaims.runAttempt}`
      if (!/^[A-Za-z0-9+=,.@-]{2,64}$/u.test(sessionName)) {
        fail("Derived AWS journal session name is not canonical.")
      }
      const noAmbientCredentials = async (): Promise<never> => {
        throw new Error("Ambient AWS credential resolution is disabled.")
      }
      const anonymous = runtime.makeAnonymousSts({
        region: authority.region,
        maxAttempts: 1,
        credentials: noAmbientCredentials
      })
      const assumed = await withOperationJournalNetworkDeadline((signal) => anonymous.send(
        new AssumeRoleWithWebIdentityCommand({
          RoleArn: authority.roleArn,
          RoleSessionName: sessionName,
          WebIdentityToken: webIdentityToken,
          DurationSeconds: 900
        }),
        { abortSignal: signal }
      ), deadlineMilliseconds)
      const accessKeyId = assumed.Credentials?.AccessKeyId
      const secretAccessKey = assumed.Credentials?.SecretAccessKey
      const sessionToken = assumed.Credentials?.SessionToken
      const expiration = assumed.Credentials?.Expiration
      if (accessKeyId === undefined || secretAccessKey === undefined ||
          sessionToken === undefined || expiration === undefined ||
          accessKeyId.length === 0 || secretAccessKey.length === 0 || sessionToken.length === 0) {
        fail("AWS STS did not return one complete temporary credential set.")
      }
      const now = runtime.now().getTime()
      const validExpiration = expiration as Date
      if (validExpiration.getTime() <= now + 5 * 60_000 || validExpiration.getTime() > now + 20 * 60_000) {
        fail("AWS STS journal session expiration is not current and bounded.")
      }
      const sessionCredentials: AwsJournalCredentials = {
        accessKeyId: accessKeyId as string,
        secretAccessKey: secretAccessKey as string,
        sessionToken: sessionToken as string,
        expiration: validExpiration
      }
      const authenticated = runtime.makeSessionSts({
        region: authority.region,
        maxAttempts: 1,
        credentials: sessionCredentials
      })
      const caller = await withOperationJournalNetworkDeadline((signal) => authenticated.send(
        new GetCallerIdentityCommand({}),
        { abortSignal: signal }
      ), deadlineMilliseconds)
      const expectedArn = `arn:aws:sts::${authority.accountId}:assumed-role/${roleName(authority.roleArn)}/${sessionName}`
      if (caller.Account !== authority.accountId || caller.Arn !== expectedArn ||
          assumed.AssumedRoleUser?.Arn !== expectedArn || caller.UserId === undefined || caller.UserId.length === 0) {
        fail("AWS STS caller identity does not equal the exact admitted journal role session.")
      }
      return {
        credentials: sessionCredentials,
        oidc: observedClaims,
        callerArn: expectedArn
      }
    } finally {
      runnerRequestToken = ""
      webIdentityToken = ""
    }
  },
  catch: (cause) => boundaryError(cause, "GitHub OIDC to AWS STS journal authentication failed.")
})
