import { createHash, createPublicKey, verify as verifySignature } from "node:crypto"
import { spawn } from "node:child_process"
import {
  chmodSync, closeSync, constants, copyFileSync, fstatSync, fsyncSync, lstatSync,
  mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, renameSync, rmSync,
  statSync, writeFileSync
} from "node:fs"
import { createServer, type Server } from "node:http"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import * as Effect from "effect/Effect"
import { makeNodeArtifactBridgeTransport } from "../../ts-release-action/src/artifact-bridge.js"
import {
  actionProducerContextFromEnvironment,
  makeActionPreparedReleaseStore,
  makeGitHubRunAttemptAuthenticator,
  type GitHubRunAttemptResponse
} from "../../ts-release-action/src/prepared-store.js"
import { parseStrictJson } from "../../../scripts/lib/strict-json.js"
import { sha1Digest, sha256Digest, sha512Digest, formatNpmSha512Sri } from "../../../src/model/digest.js"
import { npmPublicationAuthorityIssue } from "../../../src/release/graph.js"
import type { PreparedBundle } from "../../../src/release/prepared-store.js"
import { decodeCompletePreparedReleaseRef } from "../../../src/release/prepared-ref.js"
import {
  assertNoForbiddenNpmEnvironment,
  assertNoNpmConfigurationFiles,
  assertSelectedPinnedNpm
} from "./check-self-release-dispatch.js"
import {
  assertNoToolTransportEnvironment,
  pinnedNpmClosedEnvironment,
  pinnedNpmExecutable,
  pinnedNpmReleaseTool,
  reauthenticatePinnedNpm,
  releaseBunExecutable,
  releaseNodeExecutable,
  runExactExecutable
} from "./install-self-release-npm.js"
import {
  decodeNpmOidcCertificationReceipt,
  npmOidcCertificationSchemaVersion,
  npmOidcCertificationScope,
  npmOidcCertificationStatus,
  type NpmOidcCertificationReceipt,
  type NpmOidcRegistrySnapshot
} from "./npm-oidc-certification-contract.js"

const packageName = "@mannyc1/ts-release"
const version = "0.3.0"
const registry = "https://registry.npmjs.org/"
const issuer = "https://token.actions.githubusercontent.com"
const discoveryUrl = `${issuer}/.well-known/openid-configuration`
const jwksUrl = `${issuer}/.well-known/jwks`
const audience = "npm:registry.npmjs.org"
const immutableSubject = "repo:mannyc2@126291407/ts-release@1271545637:environment:npm"
const repository = "mannyc2/ts-release"
const repositoryId = "1271545637"
const repositoryOwner = "mannyc2"
const repositoryOwnerId = "126291407"
const workflow = "Release"
const workflowRef = `${repository}/.github/workflows/release.yml@refs/heads/main`
const exactRef = "refs/heads/main"
const exactEnvironment = "npm"
const exactRunner = "github-hosted"
const dryRunCommand =
  "npm publish exact.tgz --dry-run --ignore-scripts --registry https://registry.npmjs.org/ --tag latest --access public --json --loglevel verbose" as const
const tokenMarker = "Successfully retrieved and set token"
const gitSha = /^[a-f0-9]{40}$/u
const positiveDecimal = /^[1-9][0-9]*$/u
const jwtSegment = /^[A-Za-z0-9_-]+$/u
const jwkSegment = /^[A-Za-z0-9_-]+$/u
const maximumJsonBytes = 8 * 1024 * 1024
const maximumNpmOutputBytes = 8 * 1024 * 1024
const maximumTarballBytes = 64 * 1024 * 1024
const requestTimeoutMs = 30_000
const npmTimeoutMs = 120_000
const receiptPath = ".release/ts-release/npm-oidc-certification.json"

type ObjectValue = Readonly<Record<string, unknown>>
type FetchShape = (input: string | URL, init?: RequestInit) => Promise<Response>

const fail = (reason: string): never => {
  throw new Error(`npm OIDC certification refused: ${reason}`)
}

const object = (value: unknown, name: string): ObjectValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${name} is not an object`)
  return value as ObjectValue
}

const boundedText = (value: unknown, name: string, maximum = 4096): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    return fail(`${name} is not one bounded nonempty string`)
  }
  return value
}

const positive = (value: string, name: string): string => {
  if (!positiveDecimal.test(value)) fail(`${name} is not one canonical positive decimal`)
  return value
}

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")

const parseJsonBytes = (bytes: Uint8Array, name: string): unknown => {
  try {
    return parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch {
    return fail(`${name} is not strict UTF-8 JSON`)
  }
}

const boundedResponseBytes = async (
  response: Response,
  maximumBytes: number,
  declaredLength: number | undefined
): Promise<Uint8Array> => {
  if (response.body === null) {
    if (declaredLength !== undefined && declaredLength !== 0) {
      return fail("an endpoint returned a length-disagreeing response")
    }
    return new Uint8Array(0)
  }
  const reader = response.body.getReader()
  const chunks: Array<Uint8Array> = []
  let received = 0
  const readNext = async () => {
    try {
      return await reader.read()
    } catch {
      return fail("an endpoint response body could not be read")
    }
  }
  try {
    while (true) {
      const next = await readNext()
      if (next.done) break
      if (!(next.value instanceof Uint8Array)) return fail("an endpoint returned a non-byte response body")
      if (next.value.byteLength > maximumBytes - received) {
        void reader.cancel("response exceeds the admitted byte limit").catch(() => undefined)
        return fail("an endpoint returned an oversized response")
      }
      received += next.value.byteLength
      chunks.push(next.value.slice())
    }
  } finally {
    reader.releaseLock()
  }
  if (declaredLength !== undefined && received !== declaredLength) {
    return fail("an endpoint returned a length-disagreeing response")
  }
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

const boundedResponse = async (
  request: FetchShape,
  url: string,
  input: RequestInit,
  maximumBytes: number,
  expectedStatuses: ReadonlyArray<number>
): Promise<{ readonly status: number, readonly bytes: Uint8Array }> => {
  const signal = AbortSignal.timeout(requestTimeoutMs)
  const response = await request(url, {
    ...input,
    headers: { "accept-encoding": "identity", ...Object.fromEntries(new Headers(input.headers).entries()) },
    redirect: "error",
    signal
  })
  if (!expectedStatuses.includes(response.status) || response.url !== url || response.redirected ||
      response.headers.has("location")) {
    return fail("an exact no-redirect HTTPS endpoint returned an unexpected response")
  }
  const declaredText = response.headers.get("content-length")
  let declaredLength: number | undefined
  if (declaredText !== null) {
    const declared = Number(declaredText)
    if (!Number.isSafeInteger(declared) || declared < 0 || declared > maximumBytes) {
      return fail("an endpoint declared an invalid response length")
    }
    declaredLength = declared
  }
  const bytes = await boundedResponseBytes(response, maximumBytes, declaredLength)
  return { status: response.status, bytes }
}

const decodeBase64Url = (value: string, name: string, maximumBytes = 64 * 1024): Uint8Array => {
  if (!jwtSegment.test(value) || value.includes("=")) fail(`${name} is not canonical base64url`)
  const bytes = new Uint8Array(Buffer.from(value, "base64url"))
  if (bytes.length === 0 || bytes.length > maximumBytes || Buffer.from(bytes).toString("base64url") !== value) {
    return fail(`${name} changed during base64url decoding`)
  }
  return bytes
}

export interface GitHubOidcCertificationContext {
  readonly candidateSha: string
  readonly runId: string
  readonly runAttempt: string
  readonly nowSeconds: number
}

export interface VerifiedGitHubOidcToken {
  readonly token: string
  readonly issuer: typeof issuer
  readonly audience: typeof audience
  readonly subject: typeof immutableSubject
  readonly algorithm: "RS256"
}

const expectedClaim = (claims: ObjectValue, name: string, expected: string): void => {
  if (claims[name] !== expected) fail(`OIDC claim ${name} is not exact`)
}

export const verifyGitHubOidcToken = (input: {
  readonly token: string
  readonly discovery: unknown
  readonly jwks: unknown
  readonly context: GitHubOidcCertificationContext
}): VerifiedGitHubOidcToken => {
  if (!gitSha.test(input.context.candidateSha) || !positiveDecimal.test(input.context.runId) ||
      !positiveDecimal.test(input.context.runAttempt) || !Number.isSafeInteger(input.context.nowSeconds)) {
    return fail("OIDC verification context is not canonical")
  }
  const discovery = object(input.discovery, "OIDC discovery")
  if (discovery.issuer !== issuer || discovery.jwks_uri !== jwksUrl ||
      !Array.isArray(discovery.id_token_signing_alg_values_supported) ||
      !discovery.id_token_signing_alg_values_supported.includes("RS256")) {
    return fail("OIDC discovery does not bind the exact GitHub issuer/JWKS/RS256 contract")
  }
  if (input.token.length === 0 || input.token.length > 128 * 1024) fail("OIDC token is absent or oversized")
  const segments = input.token.split(".")
  if (segments.length !== 3) fail("OIDC token is not one compact JWT")
  const [headerSegment, claimsSegment, signatureSegment] = segments as [string, string, string]
  const header = object(parseJsonBytes(decodeBase64Url(headerSegment, "JWT header"), "JWT header"), "JWT header")
  const claims = object(parseJsonBytes(decodeBase64Url(claimsSegment, "JWT claims"), "JWT claims"), "JWT claims")
  if (header.alg !== "RS256" || header.typ !== "JWT") fail("OIDC JWT is not exact RS256/JWT")
  const keyId = boundedText(header.kid, "JWT key id", 1024)
  const keysValue = object(input.jwks, "JWKS").keys
  if (!Array.isArray(keysValue)) fail("JWKS keys is not an array")
  const keys = keysValue as ReadonlyArray<unknown>
  const matching = keys.filter((candidate) => {
    const key = object(candidate, "JWK")
    return key.kid === keyId
  })
  if (matching.length !== 1) fail("JWKS does not contain exactly one selected signing key")
  const key = object(matching[0], "selected JWK")
  if (key.kty !== "RSA" || key.alg !== "RS256" || (key.use !== undefined && key.use !== "sig") ||
      typeof key.n !== "string" || !jwkSegment.test(key.n) ||
      typeof key.e !== "string" || !jwkSegment.test(key.e)) {
    return fail("selected JWK is not one canonical RS256 signing key")
  }
  let publicKey: ReturnType<typeof createPublicKey>
  try {
    publicKey = createPublicKey({
      key: { kty: "RSA", n: key.n, e: key.e },
      format: "jwk"
    })
  } catch {
    return fail("selected JWK could not be admitted as an RSA public key")
  }
  const signature = decodeBase64Url(signatureSegment, "JWT signature", 4096)
  if (!verifySignature(
    "RSA-SHA256",
    Buffer.from(`${headerSegment}.${claimsSegment}`),
    publicKey,
    signature
  )) fail("OIDC JWT signature is invalid")

  const expected = {
    iss: issuer,
    aud: audience,
    sub: immutableSubject,
    repository,
    repository_id: repositoryId,
    repository_owner: repositoryOwner,
    repository_owner_id: repositoryOwnerId,
    repository_visibility: "public",
    actor: repositoryOwner,
    actor_id: repositoryOwnerId,
    ref_protected: "true",
    ref: exactRef,
    ref_type: "branch",
    sha: input.context.candidateSha,
    workflow,
    workflow_ref: workflowRef,
    workflow_sha: input.context.candidateSha,
    event_name: "workflow_dispatch",
    environment: exactEnvironment,
    runner_environment: exactRunner,
    run_id: input.context.runId,
    run_attempt: input.context.runAttempt
  } as const
  for (const [name, value] of Object.entries(expected)) expectedClaim(claims, name, value)
  if ("job_workflow_ref" in claims || "job_workflow_sha" in claims) {
    fail("direct release.yml job unexpectedly delegated OIDC authority to a reusable workflow")
  }
  for (const name of ["iat", "nbf", "exp"] as const) {
    if (typeof claims[name] !== "number" || !Number.isSafeInteger(claims[name])) {
      fail(`OIDC claim ${name} is not an integer NumericDate`)
    }
  }
  const issued = claims.iat as number
  const notBefore = claims.nbf as number
  const expires = claims.exp as number
  if (issued > input.context.nowSeconds + 30 || notBefore > input.context.nowSeconds + 30 ||
      expires <= input.context.nowSeconds || input.context.nowSeconds - issued > 300 ||
      expires - issued <= 0 || expires - issued > 900) {
    fail("OIDC token temporal validity is outside the short-lived GitHub boundary")
  }
  boundedText(claims.jti, "OIDC jti", 4096)
  return { token: input.token, issuer, audience, subject: immutableSubject, algorithm: "RS256" }
}

export const requestAndVerifyGitHubOidcToken = async (input: {
  readonly request?: FetchShape
  readonly requestUrl: string
  readonly requestToken: string
  readonly context: GitHubOidcCertificationContext
}): Promise<VerifiedGitHubOidcToken> => {
  const request = input.request ?? fetch
  let tokenUrl: URL
  try { tokenUrl = new URL(input.requestUrl) } catch { return fail("GitHub OIDC request URL is malformed") }
  if (tokenUrl.protocol !== "https:" || tokenUrl.username !== "" || tokenUrl.password !== "" ||
      tokenUrl.hash !== "" || (!tokenUrl.hostname.endsWith(".actions.githubusercontent.com") &&
        tokenUrl.hostname !== "actions.githubusercontent.com") ||
      input.requestToken.length < 8 || input.requestToken.length > 128 * 1024) {
    return fail("GitHub OIDC request authority is not one bounded HTTPS Actions endpoint")
  }
  if (tokenUrl.searchParams.has("audience")) fail("GitHub OIDC request URL already contains an audience")
  tokenUrl.searchParams.append("audience", audience)
  const [discoveryResponse, jwksResponse, tokenResponse] = await Promise.all([
    boundedResponse(request, discoveryUrl, { headers: { accept: "application/json" } }, 256 * 1024, [200]),
    boundedResponse(request, jwksUrl, { headers: { accept: "application/json" } }, 1024 * 1024, [200]),
    boundedResponse(request, tokenUrl.href, {
      headers: { accept: "application/json", authorization: `Bearer ${input.requestToken}` }
    }, 256 * 1024, [200])
  ])
  const tokenBody = object(parseJsonBytes(tokenResponse.bytes, "GitHub OIDC response"), "GitHub OIDC response")
  const token = boundedText(tokenBody.value, "GitHub OIDC response value", 128 * 1024)
  return verifyGitHubOidcToken({
    token,
    discovery: parseJsonBytes(discoveryResponse.bytes, "OIDC discovery"),
    jwks: parseJsonBytes(jwksResponse.bytes, "OIDC JWKS"),
    context: input.context
  })
}

export interface AdmittedNpmPreparedBytes {
  readonly bytes: Uint8Array
  readonly preparedDigest: string
  readonly tarballSize: number
  readonly tarballSha1: string
  readonly tarballSha256: string
  readonly tarballIntegrity: string
}

export const admitNpmPreparedBundle = (
  bundle: PreparedBundle,
  candidateSha: string,
  preparedDigest: string
): AdmittedNpmPreparedBytes => {
  const manifest = bundle.manifest
  if (!gitSha.test(candidateSha) || !/^[a-f0-9]{64}$/u.test(preparedDigest) ||
      basename(bundle.directory) !== preparedDigest || manifest.source.commit.toString() !== candidateSha ||
      manifest.project.name.toString() !== packageName || manifest.project.packageName?.toString() !== packageName ||
      manifest.project.version.toString() !== version || manifest.project.tag.toString() !== `v${version}` ||
      manifest.project.repository !== repository || manifest.collections.length !== 0 ||
      manifest.publications.length !== 1 || manifest.artifacts.length !== 1) {
    return fail("prepared bundle is not the sole exact npm v0.3.0 candidate")
  }
  const publication = manifest.publications[0]
  const artifact = manifest.artifacts[0]
  if (publication?._tag !== "PreparedNpmPublication" || artifact === undefined ||
      publication.artifactId.toString() !== artifact.id.toString() ||
      publication.packageName.toString() !== packageName || publication.version.toString() !== version ||
      publication.registryUrl !== registry || publication.distTag.toString() !== "latest" ||
      publication.access !== "public" || publication.provenance !== "automatic" ||
      publication.authentication.strategy !== "trusted-publishing" ||
      publication.authentication.attestation.provider !== "github-actions" ||
      publication.authentication.attestation.runner !== "github-hosted" ||
      publication.authentication.attestation.repository !== repository ||
      publication.authentication.attestation.workflow !== "release.yml" ||
      publication.authentication.attestation.workflowRef !== exactRef ||
      publication.authentication.attestation.allowedAction !== "npm-publish-direct" ||
      publication.authority.publishStrategy.kind !== "trusted-publishing" ||
      publication.authority.publishStrategy.sourceCommit.toString() !== candidateSha ||
      npmPublicationAuthorityIssue(publication) !== undefined || artifact.kind !== "package" ||
      artifact.mediaType !== "application/gzip" || artifact.size <= 0 || artifact.size > maximumTarballBytes ||
      artifact.digest.hex !== artifact.blob.hex) {
    return fail("prepared npm publication or tarball identity is not exact")
  }
  const bytes = bundle.blobs.get(artifact.id.toString())
  if (bytes === undefined || bytes.length !== artifact.size || sha256Digest(bytes).hex !== artifact.digest.hex ||
      bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    return fail("prepared npm tarball bytes failed exact size/digest/gzip verification")
  }
  return {
    bytes: new Uint8Array(bytes),
    preparedDigest,
    tarballSize: bytes.length,
    tarballSha1: sha1Digest(bytes).hex,
    tarballSha256: sha256Digest(bytes).hex,
    tarballIntegrity: formatNpmSha512Sri(sha512Digest(bytes))
  }
}

const registryUrls = {
  packument: `${registry}@mannyc1%2fts-release`,
  distTags: `${registry}-/package/@mannyc1%2fts-release/dist-tags`,
  version: `${registry}@mannyc1%2fts-release/${version}`,
  attestations: `${registry}-/npm/v1/attestations/@mannyc1%2fts-release@${version}`
} as const

export const snapshotNpmRegistry = async (
  request: FetchShape = fetch,
  urls: Readonly<{ packument: string, distTags: string, version: string, attestations: string }> = registryUrls
): Promise<NpmOidcRegistrySnapshot> => {
  const init = { headers: { accept: "application/json", "cache-control": "no-cache" } } as const
  const [packument, distTags, publishedVersion, attestations] = await Promise.all([
    boundedResponse(request, urls.packument, init, maximumJsonBytes, [200]),
    boundedResponse(request, urls.distTags, init, 256 * 1024, [200]),
    boundedResponse(request, urls.version, init, 256 * 1024, [404]),
    boundedResponse(request, urls.attestations, init, 256 * 1024, [404])
  ])
  const packumentValue = object(parseJsonBytes(packument.bytes, "npm packument"), "npm packument")
  const versions = object(packumentValue.versions, "npm packument versions")
  const tags = object(parseJsonBytes(distTags.bytes, "npm dist-tags"), "npm dist-tags")
  const latest = boundedText(tags.latest, "npm latest", 128)
  if (packumentValue.name !== packageName || version in versions || latest === version) {
    return fail("npm public baseline does not prove v0.3.0 absent with a different latest")
  }
  return {
    packumentStatus: 200,
    packumentSha256: sha256(packument.bytes),
    distTagsStatus: 200,
    distTagsSha256: sha256(distTags.bytes),
    latest,
    versionStatus: 404,
    versionSha256: sha256(publishedVersion.bytes),
    attestationsStatus: 404,
    attestationsSha256: sha256(attestations.bytes)
  }
}

interface NpmDryRunResult {
  readonly packageId: "@mannyc1/ts-release@0.3.0"
  readonly packageSize: number
  readonly tokenExchangeMarkers: 1
}

export const npmOidcDryRunArguments = (registryUrl = registry): ReadonlyArray<string> => [
  "publish", "exact.tgz", "--dry-run", "--ignore-scripts", "--registry", registryUrl,
  "--tag", "latest", "--access", "public", "--json", "--loglevel", "verbose"
]

const collect = async (stream: NodeJS.ReadableStream | null, maximum: number): Promise<Uint8Array<ArrayBuffer>> => {
  if (stream === null) return new Uint8Array()
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > maximum) fail("npm dry-run output exceeded its private bounded capture")
    chunks.push(bytes)
  }
  const combined = Buffer.concat(chunks)
  const result = new Uint8Array(combined.length)
  result.set(combined)
  return result
}

const listen = (server: Server): Promise<number> => new Promise((resolveListen, reject) => {
  server.once("error", reject)
  server.listen(0, "127.0.0.1", () => {
    const address = server.address()
    if (typeof address === "object" && address !== null) resolveListen(address.port)
    else reject(new Error("OIDC memory proxy did not bind one TCP port"))
  })
})

const closeServer = (server: Server): Promise<void> => new Promise((resolveClose) => {
  server.close(() => resolveClose())
})

export const runNpmOidcDryRun = async (input: {
  readonly npmExecutable: string
  readonly exactTarballPath: string
  readonly tarball: AdmittedNpmPreparedBytes
  readonly idToken: string
  readonly closedEnvironment: Readonly<Record<string, string>>
  readonly githubEnvironment: Readonly<Record<string, string | undefined>>
  readonly registryUrl?: string
}): Promise<NpmDryRunResult> => {
  const registryUrl = input.registryUrl ?? registry
  if (basename(input.exactTarballPath) !== "exact.tgz") {
    return fail("npm dry-run input is not the exact adopted filename")
  }
  const proxyAuthorization = `memory-${crypto.randomUUID()}`
  let proxyRequests = 0
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? "", "http://127.0.0.1")
      proxyRequests += 1
      if (proxyRequests !== 1 || request.method !== "GET" ||
          request.headers.authorization !== `Bearer ${proxyAuthorization}` ||
          request.headers.accept !== "application/json" || url.pathname !== "/oidc" ||
          url.searchParams.getAll("audience").join("\0") !== `npm:${new URL(registryUrl).hostname}`) {
        response.writeHead(403, { "content-type": "application/json" })
        response.end('{"message":"refused"}')
        return
      }
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
      response.end(JSON.stringify({ value: input.idToken }))
    } catch {
      response.writeHead(400, { "content-type": "application/json" })
      response.end('{"message":"refused"}')
    }
  })
  const port = await listen(server)
  const args = npmOidcDryRunArguments(registryUrl)
  const env = {
    ...input.closedEnvironment,
    ACTIONS_ID_TOKEN_REQUEST_URL: `http://127.0.0.1:${port}/oidc`,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: proxyAuthorization,
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: exactRef,
    GITHUB_REPOSITORY: repository,
    GITHUB_REPOSITORY_ID: repositoryId,
    GITHUB_REPOSITORY_OWNER_ID: repositoryOwnerId,
    GITHUB_RUN_ATTEMPT: input.githubEnvironment.GITHUB_RUN_ATTEMPT ?? "",
    GITHUB_RUN_ID: input.githubEnvironment.GITHUB_RUN_ID ?? "",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_SHA: input.githubEnvironment.CANDIDATE_SHA ?? "",
    GITHUB_WORKFLOW_REF: workflowRef,
    NPM_CONFIG_IGNORE_SCRIPTS: "true",
    RUNNER_ENVIRONMENT: exactRunner
  }
  let stdout = new Uint8Array()
  let stderr = new Uint8Array()
  let exitCode: number | null = null
  try {
    const child = spawn(input.npmExecutable, args, {
      cwd: dirname(input.exactTarballPath),
      env,
      stdio: ["ignore", "pipe", "pipe"]
    })
    const timer = setTimeout(() => child.kill("SIGKILL"), npmTimeoutMs)
    try {
      ;[stdout, stderr, exitCode] = await Promise.all([
        collect(child.stdout, maximumNpmOutputBytes),
        collect(child.stderr, maximumNpmOutputBytes),
        new Promise<number | null>((resolveExit, reject) => {
          child.once("error", reject)
          child.once("close", resolveExit)
        })
      ])
    } finally { clearTimeout(timer) }
  } finally {
    await closeServer(server)
  }
  if (exitCode !== 0 || proxyRequests !== 1) {
    fail(`npm 11.11.0 did not complete one exact OIDC dry-run (exit=${String(exitCode)}, oidcRequests=${proxyRequests})`)
  }
  let combined: string
  let output: unknown
  try {
    combined = `${new TextDecoder("utf-8", { fatal: true }).decode(stdout)}\n${
      new TextDecoder("utf-8", { fatal: true }).decode(stderr)
    }`
    output = parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(stdout))
  } catch {
    return fail("npm 11.11.0 did not return bounded strict UTF-8 JSON")
  }
  if (combined.split(tokenMarker).length - 1 !== 1) {
    return fail("npm 11.11.0 did not emit exactly one private OIDC exchange marker")
  }
  const result = object(output, "npm dry-run JSON")
  const id = boundedText(result.id, "npm dry-run id", 256)
  if (id !== `${packageName}@${version}` || result.name !== packageName || result.version !== version ||
      result.size !== input.tarball.tarballSize || result.shasum !== input.tarball.tarballSha1 ||
      result.integrity !== input.tarball.tarballIntegrity ||
      !equalBytes(new Uint8Array(readFileSync(input.exactTarballPath)), input.tarball.bytes)) {
    return fail("npm dry-run JSON or post-run tarball bytes differ from the exact prepared package")
  }
  return { packageId: `${packageName}@${version}`, packageSize: input.tarball.tarballSize, tokenExchangeMarkers: 1 }
}

const artifactBridgeEnvironment = (
  environment: Readonly<Record<string, string | undefined>>
): Readonly<Record<string, string | undefined>> => Object.fromEntries([
  "ACTIONS_CACHE_URL", "ACTIONS_RESULTS_URL", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_RUNTIME_URL",
  "GITHUB_ACTIONS", "GITHUB_API_URL", "GITHUB_RUN_ID", "GITHUB_SERVER_URL", "GITHUB_TOKEN",
  "RUNNER_TEMP"
].flatMap((name) => environment[name] === undefined ? [] : [[name, environment[name]]]))

const githubRunAttemptRequest = async (input: {
  readonly token: string
  readonly owner: string
  readonly repository: string
  readonly runId: number
  readonly runAttempt: number
}): Promise<GitHubRunAttemptResponse> => {
  const url = `https://api.github.com/repos/${input.owner}/${input.repository}/actions/runs/${input.runId}/attempts/${input.runAttempt}`
  const response = await boundedResponse(fetch, url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${input.token}`,
      "x-github-api-version": "2022-11-28"
    }
  }, 1024 * 1024, [200])
  return object(parseJsonBytes(response.bytes, "GitHub run attempt"), "GitHub run attempt") as unknown as GitHubRunAttemptResponse
}

const writePrivateReceipt = (workspace: string, receipt: NpmOidcCertificationReceipt): string => {
  decodeNpmOidcCertificationReceipt(receipt, {
    candidateSha: receipt.candidateSha,
    prepared: receipt.prepared
  })
  const root = realpathSync(workspace)
  const target = resolve(root, receiptPath)
  if (!target.startsWith(`${root}/`)) fail("receipt path escapes the workspace")
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
  const temporary = `${target}.${crypto.randomUUID()}.tmp`
  const bytes = new TextEncoder().encode(`${JSON.stringify(receipt, null, 2)}\n`)
  if (bytes.length <= 0 || bytes.length > 1024 * 1024) fail("receipt is empty or oversized")
  const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try {
    writeFileSync(descriptor, bytes)
    fsyncSync(descriptor)
  } finally { closeSync(descriptor) }
  chmodSync(temporary, 0o600)
  renameSync(temporary, target)
  const metadata = lstatSync(target)
  if (!metadata.isFile() || metadata.nlink !== 1 || (metadata.mode & 0o777) !== 0o600 ||
      !equalBytes(new Uint8Array(readFileSync(target)), bytes)) {
    return fail("private receipt write could not be reread exactly")
  }
  return target
}

const main = async (): Promise<void> => {
  const environment = process.env
  assertNoForbiddenNpmEnvironment(environment)
  assertNoToolTransportEnvironment(environment)
  const candidateSha = environment.CANDIDATE_SHA ?? ""
  const preparedText = environment.PREPARED_REF ?? ""
  const runId = positive(environment.GITHUB_RUN_ID ?? "", "GITHUB_RUN_ID")
  const runAttempt = positive(environment.GITHUB_RUN_ATTEMPT ?? "", "GITHUB_RUN_ATTEMPT")
  const productionRegistry = new URL(registry)
  if (productionRegistry.href !== "https://registry.npmjs.org/" || productionRegistry.username !== "" ||
      productionRegistry.password !== "" || productionRegistry.search !== "" || productionRegistry.hash !== "") {
    return fail("production certification registry is not the exact public npm endpoint")
  }
  if (!gitSha.test(candidateSha) || environment.RELEASE_MODE !== "certify-npm-oidc" ||
      environment.NPM_PREPARED_REF !== "" || environment.GITHUB_REPOSITORY !== repository ||
      environment.GITHUB_REPOSITORY_ID !== repositoryId ||
      environment.GITHUB_REPOSITORY_OWNER_ID !== repositoryOwnerId || environment.GITHUB_REF !== exactRef ||
      environment.GITHUB_SHA !== candidateSha || environment.GITHUB_WORKFLOW !== workflow ||
      environment.GITHUB_WORKFLOW_REF !== workflowRef || environment.GITHUB_WORKFLOW_SHA !== candidateSha ||
      environment.GITHUB_EVENT_NAME !== "workflow_dispatch" || environment.GITHUB_JOB !== "certify-npm-oidc" ||
      environment.RUNNER_ENVIRONMENT !== exactRunner) {
    return fail("runtime context is not the exact current-main npm certification job")
  }
  const githubToken = boundedText(environment.GITHUB_TOKEN, "GITHUB_TOKEN", 128 * 1024)
  const requestUrl = boundedText(environment.ACTIONS_ID_TOKEN_REQUEST_URL, "ACTIONS_ID_TOKEN_REQUEST_URL", 128 * 1024)
  const requestToken = boundedText(environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN, "ACTIONS_ID_TOKEN_REQUEST_TOKEN", 128 * 1024)
  const nodeExecutable = releaseNodeExecutable(environment)
  const bunExecutable = releaseBunExecutable(environment)
  const npmBin = pinnedNpmExecutable()
  reauthenticatePinnedNpm(process.cwd(), nodeExecutable)
  const closedEnvironment = pinnedNpmClosedEnvironment(process.cwd(), `${dirname(nodeExecutable)}:/usr/bin:/bin`)
  assertNoNpmConfigurationFiles([
    resolve(".npmrc"), join(closedEnvironment.HOME!, ".npmrc"),
    closedEnvironment.NPM_CONFIG_USERCONFIG!, closedEnvironment.NPM_CONFIG_GLOBALCONFIG!,
    "/etc/npmrc", "/usr/local/etc/npmrc"
  ])
  assertSelectedPinnedNpm(npmBin, npmBin)
  if (runExactExecutable(nodeExecutable, ["--version"], closedEnvironment) !== "v22.22.2" ||
      runExactExecutable(bunExecutable, ["--version"], closedEnvironment) !== "1.3.14" ||
      runExactExecutable(npmBin, ["--version"], closedEnvironment) !== pinnedNpmReleaseTool.version) {
    return fail("release toolchain is not exact Node 22.22.2/Bun 1.3.14/npm 11.11.0")
  }

  const reference = await Effect.runPromise(decodeCompletePreparedReleaseRef(preparedText))
  if (reference.scheme !== "gha" || reference.owner !== "mannyc2" || reference.repository !== "ts-release") {
    return fail("certification requires one canonical hosted npm prepared reference")
  }
  const bridgePath = realpathSync(resolve("apps/ts-release-action/dist/artifact-bridge.cjs"))
  const store = makeActionPreparedReleaseStore({
    workspace: process.cwd(),
    context: actionProducerContextFromEnvironment(environment),
    artifacts: makeNodeArtifactBridgeTransport({
      nodeExecutable,
      bridgePath,
      environment: artifactBridgeEnvironment(environment)
    }),
    token: githubToken,
    runAttempts: makeGitHubRunAttemptAuthenticator(githubRunAttemptRequest)
  })
  const bundle = await Effect.runPromise(store.load(reference))
  const tarball = admitNpmPreparedBundle(bundle, candidateSha, reference.digest.toString())
  const oidc = await requestAndVerifyGitHubOidcToken({
    requestUrl,
    requestToken,
    context: { candidateSha, runId, runAttempt, nowSeconds: Math.floor(Date.now() / 1000) }
  })
  const before = await snapshotNpmRegistry()
  const staging = mkdtempSync(join(tmpdir(), "ts-release-npm-oidc-certification-"))
  try {
    chmodSync(staging, 0o700)
    const exactTarballPath = join(staging, "exact.tgz")
    copyFileSync(join(bundle.directory, "blobs", tarball.tarballSha256), exactTarballPath, constants.COPYFILE_EXCL)
    chmodSync(exactTarballPath, 0o400)
    const metadata = statSync(exactTarballPath)
    if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== tarball.tarballSize ||
        !equalBytes(new Uint8Array(readFileSync(exactTarballPath)), tarball.bytes)) {
      return fail("exact prepared tarball could not be materialized without repacking")
    }
    const dryRun = await runNpmOidcDryRun({
      npmExecutable: npmBin,
      exactTarballPath,
      tarball,
      idToken: oidc.token,
      closedEnvironment,
      githubEnvironment: environment,
      registryUrl: productionRegistry.href
    })
    const after = await snapshotNpmRegistry()
    if (JSON.stringify(before) !== JSON.stringify(after)) fail("npm registry state changed during the dry-run")
    const receipt: NpmOidcCertificationReceipt = {
      schemaVersion: npmOidcCertificationSchemaVersion,
      status: npmOidcCertificationStatus,
      scope: npmOidcCertificationScope,
      candidateSha,
      prepared: preparedText,
      package: {
        name: packageName,
        version,
        preparedDigest: tarball.preparedDigest,
        tarballSize: tarball.tarballSize,
        tarballSha1: tarball.tarballSha1,
        tarballSha256: tarball.tarballSha256,
        tarballIntegrity: tarball.tarballIntegrity
      },
      toolchain: { node: "22.22.2", bun: "1.3.14", npm: "11.11.0" },
      github: {
        repository,
        repositoryId,
        repositoryOwner,
        repositoryOwnerId,
        repositoryVisibility: "public",
        actor: repositoryOwner,
        actorId: repositoryOwnerId,
        refProtected: "true",
        workflow,
        workflowRef,
        workflowSha: candidateSha,
        directJobWorkflowClaims: "absent",
        ref: exactRef,
        eventName: "workflow_dispatch",
        environment: exactEnvironment,
        runnerEnvironment: exactRunner,
        runId,
        runAttempt
      },
      oidc: { issuer, audience, subject: immutableSubject, algorithm: "RS256" },
      registry: { before, after, unchanged: true },
      npmDryRun: {
        command: dryRunCommand,
        tokenExchangeMarkers: dryRun.tokenExchangeMarkers,
        packageId: dryRun.packageId,
        packageSize: dryRun.packageSize,
        claim: npmOidcCertificationScope,
        provenance: "not-certified"
      }
    }
    writePrivateReceipt(process.cwd(), receipt)
    console.log(JSON.stringify({
      schemaVersion: npmOidcCertificationSchemaVersion,
      status: npmOidcCertificationStatus,
      scope: npmOidcCertificationScope,
      candidateSha,
      prepared: preparedText,
      report: receiptPath
    }))
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  try { await main() } catch {
    console.error("npm OIDC certification failed closed; no upload, publication, or provenance is claimed.")
    process.exitCode = 1
  }
}
