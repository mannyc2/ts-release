import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { generateKeyPairSync, sign } from "node:crypto"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
  admitNpmPreparedBundle,
  npmOidcCertificationFailureLog,
  npmOidcDryRunArguments,
  requestAndVerifyGitHubOidcToken,
  runNpmOidcDryRun,
  snapshotNpmRegistry,
  verifyGitHubOidcToken,
  type GitHubOidcCertificationContext
} from "../apps/release-ts/scripts/certify-self-release-npm-oidc.js"
import {
  decodeNpmOidcCertificationReceipt,
  npmOidcCertificationSchemaVersion,
  npmOidcCertificationScope,
  npmOidcCertificationStatus,
  type NpmOidcCertificationReceipt
} from "../apps/release-ts/scripts/npm-oidc-certification-contract.js"
import { assertNoForbiddenNpmEnvironment } from "../apps/release-ts/scripts/check-self-release-dispatch.js"
import {
  pinnedNpmReleaseTool,
  verifyArchiveDigest
} from "../apps/release-ts/scripts/install-self-release-npm.js"
import {
  formatNpmSha512Sri,
  sha1Digest,
  sha256Digest,
  sha512Digest
} from "../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../src/model/primitives.js"
import { makeNpmPublicationAuthorityIntent } from "../src/release/graph.js"
import {
  PreparedArtifact,
  PreparedNpmPublication,
  PreparedProject,
  PreparedReleaseV2,
  PreparedSource
} from "../src/release/prepared.js"
import type { PreparedBundle } from "../src/release/prepared-store.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  NpmTrustedPublishingAuthentication
} from "../src/recipes/config.js"
import {
  fixtureArtifactProvenance,
  fixturePreparedProvenance,
  fixtureStagingSnapshot
} from "./fixtures/prepared-provenance.js"

const candidateSha = "c".repeat(40)
const preparedDigest = "d".repeat(64)
const prepared =
  `prepared:gha:mannyc2/ts-release/runs/334/attempts/1/artifacts/ts-release-prepared-1-${preparedDigest}#sha256-${preparedDigest}`
const now = 1_800_000_000
const context: GitHubOidcCertificationContext = {
  candidateSha,
  runId: "992",
  runAttempt: "2",
  nowSeconds: now
}
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const publicJwk = publicKey.export({ format: "jwk" })
const keyId = "fixture-key"
const discovery = {
  issuer: "https://token.actions.githubusercontent.com",
  jwks_uri: "https://token.actions.githubusercontent.com/.well-known/jwks",
  id_token_signing_alg_values_supported: ["RS256"]
}
const jwks = { keys: [{ ...publicJwk, kid: keyId, alg: "RS256", use: "sig" }] }
const claims = (patch: Readonly<Record<string, unknown>> = {}) => ({
  iss: "https://token.actions.githubusercontent.com",
  aud: "npm:registry.npmjs.org",
  sub: "repo:mannyc2@126291407/ts-release@1271545637:environment:npm",
  repository: "mannyc2/ts-release",
  repository_id: "1271545637",
  repository_owner: "mannyc2",
  repository_owner_id: "126291407",
  repository_visibility: "public",
  actor: "mannyc2",
  actor_id: "126291407",
  ref_protected: "true",
  ref: "refs/heads/main",
  ref_type: "branch",
  sha: candidateSha,
  workflow: "Release",
  workflow_ref: "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
  workflow_sha: candidateSha,
  event_name: "workflow_dispatch",
  environment: "npm",
  runner_environment: "github-hosted",
  run_id: "992",
  run_attempt: "2",
  jti: "fixture-jti",
  iat: now - 5,
  nbf: now - 5,
  exp: now + 300,
  ...patch
})

const base64url = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url")
const jwt = (payload: Readonly<Record<string, unknown>> = claims()): string => {
  const header = base64url({ alg: "RS256", typ: "JWT", kid: keyId })
  const body = base64url(payload)
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey).toString("base64url")
  return `${header}.${body}.${signature}`
}

const response = (url: string, value: unknown, status = 200): Response => {
  const result = Response.json(value, { status })
  Object.defineProperty(result, "url", { value: url })
  return result
}

describe("self-release npm OIDC claim certification", () => {
  test("verifies RS256 and every exact direct release.yml identity claim", () => {
    expect(verifyGitHubOidcToken({ token: jwt(), discovery, jwks, context })).toMatchObject({
      issuer: "https://token.actions.githubusercontent.com",
      audience: "npm:registry.npmjs.org",
      subject: "repo:mannyc2@126291407/ts-release@1271545637:environment:npm",
      algorithm: "RS256"
    })
  })

  test("rejects identity drift, unprotected main, a different dispatcher, and reusable-workflow claims", () => {
    for (const [name, patch] of Object.entries({
      audience: { aud: "https://github.com/mannyc2" },
      subject: { sub: "repo:mannyc2/ts-release:environment:npm" },
      repositoryId: { repository_id: "1" },
      ownerId: { repository_owner_id: "1" },
      visibility: { repository_visibility: "private" },
      actor: { actor: "collaborator" },
      actorId: { actor_id: "1" },
      unprotected: { ref_protected: "false" },
      candidate: { sha: "e".repeat(40) },
      workflow: { workflow_ref: "mannyc2/ts-release/.github/workflows/other.yml@refs/heads/main" },
      event: { event_name: "push" },
      environment: { environment: "production" },
      runner: { runner_environment: "self-hosted" },
      run: { run_id: "991" },
      reusableRef: { job_workflow_ref: "mannyc2/ts-release/.github/workflows/called.yml@refs/heads/main" },
      reusableSha: { job_workflow_sha: candidateSha }
    })) {
      expect(() => verifyGitHubOidcToken({ token: jwt(claims(patch)), discovery, jwks, context }), name).toThrow()
    }
  })

  test("rejects a tampered signature, stale token, wrong key, or changed discovery", () => {
    const valid = jwt()
    expect(() => verifyGitHubOidcToken({
      token: `${valid.slice(0, -1)}${valid.endsWith("a") ? "b" : "a"}`,
      discovery,
      jwks,
      context
    })).toThrow("signature")
    expect(() => verifyGitHubOidcToken({ token: jwt(claims({ exp: now })), discovery, jwks, context })).toThrow("temporal")
    expect(() => verifyGitHubOidcToken({ token: valid, discovery, jwks: { keys: [] }, context })).toThrow("signing key")
    expect(() => verifyGitHubOidcToken({
      token: valid,
      discovery: { ...discovery, jwks_uri: "https://foreign.invalid/jwks" },
      jwks,
      context
    })).toThrow("discovery")
  })

  test("surfaces only release-owned refusal reasons and keeps unexpected errors opaque", () => {
    let refusal: unknown
    try {
      verifyGitHubOidcToken({
        token: jwt(claims({ ref_protected: "false" })),
        discovery,
        jwks,
        context
      })
    } catch (error) {
      refusal = error
    }
    expect(npmOidcCertificationFailureLog(refusal)).toBe(
      "npm OIDC certification refused: OIDC claim ref_protected is not exact\n" +
      "npm OIDC certification failed closed; no upload, publication, or provenance is claimed."
    )

    const forged = new Error(
      "npm OIDC certification refused: request-token-sentinel registry-token-sentinel"
    )
    expect(npmOidcCertificationFailureLog(forged)).toBe(
      "npm OIDC certification failed closed; no upload, publication, or provenance is claimed."
    )
    expect(npmOidcCertificationFailureLog("request-token-sentinel")).not.toContain("sentinel")
  })

  test("requests one audience-bound token from exact no-redirect endpoints without returning the request token", async () => {
    const token = jwt()
    const calls: Array<{ readonly url: string, readonly authorization?: string | null }> = []
    const request = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input)
      calls.push({ url, authorization: new Headers(init?.headers).get("authorization") })
      if (url === "https://token.actions.githubusercontent.com/.well-known/openid-configuration") {
        return response(url, discovery)
      }
      if (url === "https://token.actions.githubusercontent.com/.well-known/jwks") return response(url, jwks)
      if (url === "https://fixture.actions.githubusercontent.com/oidc?audience=npm%3Aregistry.npmjs.org") {
        return response(url, { value: token })
      }
      throw new Error(`unexpected ${url}`)
    }
    const verified = await requestAndVerifyGitHubOidcToken({
      request,
      requestUrl: "https://fixture.actions.githubusercontent.com/oidc",
      requestToken: "request-token-sentinel",
      context
    })
    expect(verified.token).toBe(token)
    expect(calls).toHaveLength(3)
    expect(calls.filter((call) => call.authorization === "Bearer request-token-sentinel")).toHaveLength(1)
    expect(JSON.stringify({ ...verified, token: undefined })).not.toContain("request-token-sentinel")
  })
})

const preparedFixture = (
  repository?: string,
  kind: "archive" | "package" = "archive"
): { readonly root: string, readonly bundle: PreparedBundle } => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-npm-oidc-prepared-"))
  const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 1, 2, 3, 4])
  const digest = sha256Digest(bytes)
  const artifactId = OutputId.make("npm-package")
  const authentication = NpmTrustedPublishingAuthentication.make({
    strategy: "trusted-publishing",
    attestation: {
      provider: "github-actions",
      runner: "github-hosted",
      repository: "mannyc2/ts-release",
      workflow: "release.yml",
      workflowRef: "refs/heads/main",
      allowedAction: "npm-publish-direct"
    }
  })
  const authority = makeNpmPublicationAuthorityIntent({
    packageName: "@mannyc1/ts-release",
    version: "0.3.0",
    registryUrl: "https://registry.npmjs.org/",
    distTag: "latest",
    authentication,
    sourceCommit: candidateSha
  })
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"),
    artifactId,
    packageName: NonEmptyName.make("@mannyc1/ts-release"),
    version: Version.make("0.3.0"),
    registryUrl: CanonicalNpmRegistryEndpoint.make("https://registry.npmjs.org/"),
    distTag: NpmDistTag.make("latest"),
    access: "public",
    authentication,
    provenance: "automatic",
    authority
  })
  const artifact = PreparedArtifact.make({
    id: artifactId,
    path: SafeRelativePath.make("ts-release-0.3.0.tgz"),
    kind,
    size: bytes.length,
    digest,
    blob: digest,
    mediaType: "application/gzip",
    ...fixtureArtifactProvenance("npm-pack")
  })
  const bundleRoot = join(root, preparedDigest)
  mkdirSync(bundleRoot)
  const manifest = PreparedReleaseV2.make({
    kind: "complete",
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make(candidateSha),
      tree: NonEmptyName.make("tree"),
      clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: digest,
      materialized: fixtureStagingSnapshot
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("@mannyc1/ts-release"),
      packageName: NonEmptyName.make("@mannyc1/ts-release"),
      version: Version.make("0.3.0"),
      tag: NonEmptyName.make("v0.3.0"),
      ...(repository === undefined ? {} : { repository })
    }),
    provenance: fixturePreparedProvenance,
    artifacts: [artifact],
    collections: [],
    publications: [publication]
  })
  return { root, bundle: { directory: bundleRoot, manifest, blobs: new Map([[artifactId.toString(), bytes]]) } }
}

test("admits only the sole exact prepared npm tarball with its durable authority", () => {
  const current = preparedFixture()
  const contradictory = preparedFixture("attacker/other")
  const wrongKind = preparedFixture(undefined, "package")
  try {
    expect(admitNpmPreparedBundle(current.bundle, candidateSha, preparedDigest)).toMatchObject({
      preparedDigest,
      tarballSize: 8,
      tarballSha256: current.bundle.manifest.artifacts[0]!.digest.hex
    })
    expect(() => admitNpmPreparedBundle(current.bundle, "e".repeat(40), preparedDigest)).toThrow()
    expect(() => admitNpmPreparedBundle(contradictory.bundle, candidateSha, preparedDigest)).toThrow()
    expect(() => admitNpmPreparedBundle(wrongKind.bundle, candidateSha, preparedDigest)).toThrow()
  } finally {
    rmSync(current.root, { recursive: true, force: true })
    rmSync(contradictory.root, { recursive: true, force: true })
    rmSync(wrongKind.root, { recursive: true, force: true })
  }
})

test("anonymous registry snapshots prove v0.3.0 and attestations absent with latest unchanged", async () => {
  const urls = {
    packument: "https://fixture.registry/package",
    distTags: "https://fixture.registry/tags",
    version: "https://fixture.registry/version",
    attestations: "https://fixture.registry/attestations"
  }
  const request = async (input: string | URL): Promise<Response> => {
    const url = String(input)
    if (url === urls.packument) return response(url, {
      name: "@mannyc1/ts-release",
      versions: { "0.2.2": { name: "@mannyc1/ts-release", version: "0.2.2" } },
      "dist-tags": { latest: "0.2.2" }
    })
    if (url === urls.distTags) return response(url, { latest: "0.2.2" })
    return response(url, { error: "Not found" }, 404)
  }
  const before = await snapshotNpmRegistry(request, urls)
  const after = await snapshotNpmRegistry(request, urls)
  expect(before).toEqual(after)
  expect(before).toMatchObject({ latest: "0.2.2", versionStatus: 404, attestationsStatus: 404 })
})

test("bounded registry reads reject declared and received length disagreement", async () => {
  const urls = {
    packument: "https://fixture.registry/package",
    distTags: "https://fixture.registry/tags",
    version: "https://fixture.registry/version",
    attestations: "https://fixture.registry/attestations"
  }
  const request = async (input: string | URL): Promise<Response> => {
    const url = String(input)
    const current = url === urls.packument
      ? response(url, { name: "@mannyc1/ts-release", versions: {}, "dist-tags": { latest: "0.2.2" } })
      : url === urls.distTags
        ? response(url, { latest: "0.2.2" })
        : response(url, { error: "Not found" }, 404)
    if (url === urls.version) current.headers.set("content-length", "999")
    return current
  }
  await expect(snapshotNpmRegistry(request, urls)).rejects.toThrow("length-disagreeing")
})

test("bounded registry reads cancel a chunked response as soon as it exceeds the byte limit", async () => {
  const urls = {
    packument: "https://fixture.registry/package",
    distTags: "https://fixture.registry/tags",
    version: "https://fixture.registry/version",
    attestations: "https://fixture.registry/attestations"
  }
  let cancelled = false
  const request = async (input: string | URL): Promise<Response> => {
    const url = String(input)
    if (url === urls.packument) {
      return response(url, { name: "@mannyc1/ts-release", versions: {}, "dist-tags": { latest: "0.2.2" } })
    }
    if (url === urls.distTags) return response(url, { latest: "0.2.2" })
    if (url === urls.version) {
      let emitted = 0
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          emitted += 1
          controller.enqueue(new Uint8Array(4 * 1024 * 1024))
          if (emitted === 3) controller.close()
        },
        cancel() {
          cancelled = true
        }
      })
      const result = new Response(body, { status: 404 })
      Object.defineProperty(result, "url", { value: url })
      expect(result.headers.has("content-length")).toBe(false)
      return result
    }
    return response(url, { error: "Not found" }, 404)
  }
  await expect(snapshotNpmRegistry(request, urls)).rejects.toThrow("oversized response")
  expect(cancelled).toBe(true)
})

test("npm dry-run argv names the adopted tarball exactly and cannot imply provenance", () => {
  expect(npmOidcDryRunArguments()).toEqual([
    "publish", "exact.tgz", "--dry-run", "--ignore-scripts", "--registry", "https://registry.npmjs.org/",
    "--tag", "latest", "--access", "public", "--json", "--loglevel", "verbose"
  ])
  expect(receiptFixture().npmDryRun.provenance).toBe("not-certified")
})

const receiptFixture = (): NpmOidcCertificationReceipt => {
  const digest = "a".repeat(64)
  const snapshot = {
    packumentStatus: 200 as const,
    packumentSha256: digest,
    distTagsStatus: 200 as const,
    distTagsSha256: digest,
    latest: "0.2.2",
    versionStatus: 404 as const,
    versionSha256: digest,
    attestationsStatus: 404 as const,
    attestationsSha256: digest
  }
  return {
    schemaVersion: npmOidcCertificationSchemaVersion,
    status: npmOidcCertificationStatus,
    scope: npmOidcCertificationScope,
    candidateSha,
    prepared,
    package: {
      name: "@mannyc1/ts-release",
      version: "0.3.0",
      preparedDigest,
      tarballSize: 123,
      tarballSha1: "b".repeat(40),
      tarballSha256: "c".repeat(64),
      tarballIntegrity: `sha512-${Buffer.alloc(64).toString("base64")}`
    },
    toolchain: { node: "22.22.2", bun: "1.3.14", npm: "11.11.0" },
    github: {
      repository: "mannyc2/ts-release",
      repositoryId: "1271545637",
      repositoryOwner: "mannyc2",
      repositoryOwnerId: "126291407",
      repositoryVisibility: "public",
      actor: "mannyc2",
      actorId: "126291407",
      refProtected: "true",
      workflow: "Release",
      workflowRef: "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
      workflowSha: candidateSha,
      directJobWorkflowClaims: "absent",
      ref: "refs/heads/main",
      eventName: "workflow_dispatch",
      environment: "npm",
      runnerEnvironment: "github-hosted",
      runId: "992",
      runAttempt: "2"
    },
    oidc: {
      issuer: "https://token.actions.githubusercontent.com",
      audience: "npm:registry.npmjs.org",
      subject: "repo:mannyc2@126291407/ts-release@1271545637:environment:npm",
      algorithm: "RS256"
    },
    registry: { before: snapshot, after: snapshot, unchanged: true },
    npmDryRun: {
      command: "npm publish exact.tgz --dry-run --ignore-scripts --registry https://registry.npmjs.org/ --tag latest --access public --json --loglevel verbose",
      tokenExchangeMarkers: 1,
      packageId: "@mannyc1/ts-release@0.3.0",
      packageSize: 123,
      claim: npmOidcCertificationScope,
      provenance: "not-certified"
    }
  }
}

test("receipt is bounded to exact claims and unchanged public state", () => {
  const receipt = receiptFixture()
  expect(decodeNpmOidcCertificationReceipt(receipt, { candidateSha, prepared })).toEqual(receipt)
  expect(() => decodeNpmOidcCertificationReceipt({
    ...receipt,
    registry: { ...receipt.registry, unchanged: false }
  })).toThrow()
})

test("hostile token and npm configuration variables remain rejected before certification", () => {
  for (const name of ["NPM_TOKEN", "NPM_ID_TOKEN", "NODE_AUTH_TOKEN", "npm_config_userconfig"] as const) {
    expect(() => assertNoForbiddenNpmEnvironment({ [name]: "sentinel" }), name).toThrow()
  }
})

const shouldRunExactNpm = process.env.CI === "true" || process.env.TS_RELEASE_RUN_NPM_OIDC_INTEGRATION === "1"
setDefaultTimeout(120_000)

test.skipIf(!shouldRunExactNpm)("npm 11.11.0 performs exactly one OIDC exchange and zero publish mutations", async () => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-exact-npm-oidc-"))
  let server: ReturnType<typeof createServer> | undefined
  try {
    const npmResponse = await fetch(pinnedNpmReleaseTool.tarballUrl, { redirect: "error" })
    const npmBytes = new Uint8Array(await npmResponse.arrayBuffer())
    verifyArchiveDigest(npmBytes, pinnedNpmReleaseTool)
    const npmRoot = join(root, "npm")
    mkdirSync(npmRoot)
    const npmArchive = join(root, "npm.tgz")
    writeFileSync(npmArchive, npmBytes)
    const extracted = Bun.spawnSync(["/usr/bin/tar", "-xzf", npmArchive, "-C", npmRoot, "--no-same-owner"])
    expect(extracted.exitCode).toBe(0)
    const npmExecutable = join(npmRoot, "package", "bin", "npm-cli.js")
    chmodSync(npmExecutable, 0o700)

    const packageRoot = join(root, "input", "package")
    mkdirSync(packageRoot, { recursive: true })
    writeFileSync(join(packageRoot, "package.json"), JSON.stringify({
      name: "@mannyc1/ts-release",
      version: "0.3.0",
      files: ["index.js"]
    }))
    writeFileSync(join(packageRoot, "index.js"), "export const fixture = true\n")
    const exactTarballPath = join(root, "exact.tgz")
    const packed = Bun.spawnSync(["/usr/bin/tar", "-czf", exactTarballPath, "-C", join(root, "input"), "package"])
    expect(packed.exitCode).toBe(0)
    const bytes = new Uint8Array(await Bun.file(exactTarballPath).arrayBuffer())
    const tarball = {
      bytes,
      preparedDigest,
      tarballSize: bytes.length,
      tarballSha1: sha1Digest(bytes).hex,
      tarballSha256: sha256Digest(bytes).hex,
      tarballIntegrity: formatNpmSha512Sri(sha512Digest(bytes))
    }
    let exchanges = 0
    let mutations = 0
    server = createServer(async (request, responseValue) => {
      const url = new URL(request.url ?? "", "http://127.0.0.1")
      if (request.method === "POST" && url.pathname.startsWith("/-/npm/v1/oidc/token/exchange/package/")) {
        exchanges += 1
        responseValue.writeHead(200, { "content-type": "application/json" })
        responseValue.end('{"token":"short-lived-fixture"}')
        return
      }
      if (request.method !== "GET") mutations += 1
      responseValue.writeHead(200, { "content-type": "application/json" })
      responseValue.end(url.pathname.endsWith("/visibility") ? JSON.stringify({ public: true }) : JSON.stringify({
        name: "@mannyc1/ts-release",
        versions: { "0.2.2": { name: "@mannyc1/ts-release", version: "0.2.2" } },
        "dist-tags": { latest: "0.2.2" }
      }))
    })
    await new Promise<void>((resolveListen) => server!.listen(0, "127.0.0.1", resolveListen))
    const address = server.address()
    if (typeof address !== "object" || address === null) throw new Error("loopback did not bind")
    const home = join(root, "home")
    mkdirSync(home, { mode: 0o700 })
    const userConfig = join(home, "npm-userconfig")
    const globalConfig = join(home, "npm-globalconfig")
    writeFileSync(userConfig, "", { mode: 0o600 })
    writeFileSync(globalConfig, "", { mode: 0o600 })
    const nodeExecutable = process.env.TS_RELEASE_NODE_BIN ?? Bun.which("node")
    if (nodeExecutable === null) throw new Error("exact npm loopback requires Node on PATH")
    const idToken = `${base64url({ alg: "none" })}.${base64url({ repository_visibility: "public" })}.fixture`
    const result = await runNpmOidcDryRun({
      npmExecutable,
      exactTarballPath,
      tarball,
      idToken,
      closedEnvironment: {
        HOME: home,
        LANG: "C.UTF-8",
        PATH: `${dirname(nodeExecutable)}:/usr/bin:/bin`,
        NPM_CONFIG_USERCONFIG: userConfig,
        NPM_CONFIG_GLOBALCONFIG: globalConfig
      },
      githubEnvironment: {
        GITHUB_RUN_ID: "992",
        GITHUB_RUN_ATTEMPT: "2",
        CANDIDATE_SHA: candidateSha
      },
      registryUrl: `http://127.0.0.1:${address.port}/`
    })
    expect(result).toEqual({
      packageId: "@mannyc1/ts-release@0.3.0",
      packageSize: bytes.length,
      tokenExchangeMarkers: 1
    })
    expect(exchanges).toBe(1)
    expect(mutations).toBe(0)
  } finally {
    if (server !== undefined) await new Promise<void>((resolveClose) => server!.close(() => resolveClose()))
    rmSync(root, { recursive: true, force: true })
  }
})
