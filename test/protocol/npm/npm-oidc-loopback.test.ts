import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { createHash } from "node:crypto"
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { SubjectId } from "../../../src/model/authority.js"
import {
  formatNpmSha1Shasum,
  formatNpmSha512Sri,
  sha1Digest,
  sha256Digest,
  sha512Digest
} from "../../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../../src/model/primitives.js"
import { CredentialProvider } from "../../../src/publication/authority.js"
import { publishReleaseSubjects } from "../../../src/publication/coordinator.js"
import type { HttpAuthorizerShape, PublicationHttp } from "../../../src/publication/http.js"
import { makeNpmSubject } from "../../../src/publication/npm.js"
import type { CertifiedPublisherResult, CertifiedPublisherSpawnShape } from "../../../src/publication/publisher.js"
import { makeEnvironmentCredentialPlatform } from "../../../src/platform/credentials.js"
import { makeNpmPublicationAuthorityIntent } from "../../../src/release/graph.js"
import {
  PreparedArtifact,
  PreparedNpmPublication,
  PreparedProject,
  PreparedReleaseV2,
  PreparedSource
} from "../../../src/release/prepared.js"
import type { PreparedBundle } from "../../../src/release/prepared-store.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  NpmTrustedPublishingAuthentication
} from "../../../src/recipes/config.js"
import {
  fixtureArtifactProvenance,
  fixturePreparedProvenance,
  fixtureStagingSnapshot
} from "../../fixtures/prepared-provenance.js"

const packageName = "@fixture/protocol"
const packageVersion = "1.2.3"
const distTag = "next"
const registry = CanonicalNpmRegistryEndpoint.make("https://registry.npmjs.org/")
const sourceCommit = "c".repeat(40)
setDefaultTimeout(15_000)
const authentication = NpmTrustedPublishingAuthentication.make({
  strategy: "trusted-publishing",
  attestation: {
    provider: "github-actions" as const,
    runner: "github-hosted" as const,
    repository: "fixture/protocol",
    workflow: "release.yml",
    workflowRef: "refs/heads/main",
    allowedAction: "npm-publish-direct" as const
  }
})

type LoopbackScenario =
  | "success"
  | "issuer-rejected"
  | "issuer-redirect"
  | "exchange-rejected"
  | "exchange-redirect"
  | "expired-token"
  | "package-binding-rejected"

interface LoopbackState {
  published: boolean
  issuerRequests: number
  exchangeRequests: number
  publishRequests: number
  redirectTargetRequests: number
  exactAudience: boolean
  exactIssuerBearer: boolean
  exactEnvironment: boolean
  exactPackagePath: boolean
  exactExchangeBearer: boolean
  exactPublishBearer: boolean
  exactPreparedBytes: boolean
}

const sha256Hex = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex")

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url")

const fixtureJwt = (claims: Readonly<Record<string, unknown>>): string =>
  `${base64url({ alg: "none", typ: "JWT" })}.${base64url(claims)}.fixture-signature`

const makeTarball = (root: string, embeddedPackageName = packageName): {
  readonly bytes: Uint8Array
  readonly lifecycleSentinel: string
} => {
  const packageRoot = join(root, "tar-input", "package")
  const lifecycleSentinel = join(root, "lifecycle-authority-leak")
  mkdirSync(packageRoot, { recursive: true })
  writeFileSync(join(packageRoot, "package.json"), JSON.stringify({
    name: embeddedPackageName,
    version: packageVersion,
    scripts: {
      prepublishOnly: `printf leaked > ${lifecycleSentinel}`,
      prepack: `printf leaked > ${lifecycleSentinel}`,
      prepare: `printf leaked > ${lifecycleSentinel}`,
      postpack: `printf leaked > ${lifecycleSentinel}`,
      publish: `printf leaked > ${lifecycleSentinel}`,
      postpublish: `printf leaked > ${lifecycleSentinel}`
    },
    publishConfig: {
      registry: "https://redirect.invalid/",
      tag: "latest",
      access: "restricted",
      provenance: false
    }
  }))
  const tarball = join(root, "fixture.tgz")
  const packed = Bun.spawnSync([
    "/usr/bin/tar",
    "-czf",
    tarball,
    "-C",
    join(root, "tar-input"),
    "package"
  ])
  if (packed.exitCode !== 0) throw new Error("Could not create the loopback npm tarball.")
  return { bytes: new Uint8Array(readFileSync(tarball)), lifecycleSentinel }
}

const makePrepared = (root: string, bytes: Uint8Array): {
  readonly bundle: PreparedBundle
  readonly publication: PreparedNpmPublication
} => {
  const artifactId = OutputId.make("npm-package")
  const digest = sha256Digest(bytes)
  const authority = makeNpmPublicationAuthorityIntent({
    packageName,
    version: packageVersion,
    registryUrl: registry,
    distTag,
    authentication,
    sourceCommit
  })
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"),
    packageName: NonEmptyName.make(packageName),
    version: Version.make(packageVersion),
    registryUrl: registry,
    artifactId,
    distTag: NpmDistTag.make(distTag),
    access: "public",
    authentication,
    provenance: "automatic",
    authority
  })
  const artifact = PreparedArtifact.make({
    id: artifactId,
    path: SafeRelativePath.make("package.tgz"),
    kind: "package",
    size: bytes.length,
    digest,
    blob: digest,
    mediaType: "application/gzip",
    ...fixtureArtifactProvenance("npm-oidc-loopback-pack")
  })
  const manifest = PreparedReleaseV2.make({
    kind: "complete",
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make(sourceCommit),
      tree: NonEmptyName.make("tree"),
      clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: digest,
      materialized: fixtureStagingSnapshot
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"),
      packageName: NonEmptyName.make(packageName),
      version: Version.make(packageVersion),
      tag: NonEmptyName.make("v1.2.3")
    }),
    provenance: fixturePreparedProvenance,
    artifacts: [artifact],
    collections: [],
    publications: [publication]
  })
  const directory = join(root, "prepared")
  const blobPath = join(directory, "blobs", artifact.blob.hex)
  mkdirSync(dirname(blobPath), { recursive: true })
  writeFileSync(blobPath, bytes)
  return {
    bundle: { directory, manifest, blobs: new Map([[artifactId.toString(), bytes]]) },
    publication
  }
}

const makeMetadata = (bytes: Uint8Array, state: LoopbackState): HttpAuthorizerShape => ({
  execute: () => Effect.sync(() => ({
    status: 200,
    headers: {},
    body: JSON.stringify({
      name: packageName,
      versions: state.published
        ? {
          [packageVersion]: {
            name: packageName,
            version: packageVersion,
            dist: {
              integrity: formatNpmSha512Sri(sha512Digest(bytes)),
              shasum: formatNpmSha1Shasum(sha1Digest(bytes))
            }
          }
        }
        : {},
      "dist-tags": state.published ? { [distTag]: packageVersion } : {}
    })
  }))
})

const expectedEnvironment = [
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "GITHUB_ACTIONS",
  "GITHUB_EVENT_NAME",
  "GITHUB_REF",
  "GITHUB_REPOSITORY",
  "GITHUB_REPOSITORY_ID",
  "GITHUB_REPOSITORY_OWNER_ID",
  "GITHUB_RUN_ATTEMPT",
  "GITHUB_RUN_ID",
  "GITHUB_SERVER_URL",
  "GITHUB_SHA",
  "GITHUB_WORKFLOW_REF",
  "HOME",
  "NPM_CONFIG_GLOBALCONFIG",
  "NPM_CONFIG_IGNORE_SCRIPTS",
  "NPM_CONFIG_USERCONFIG",
  "PATH",
  "RUNNER_ENVIRONMENT"
].join(",")

const startLoopback = (
  scenario: LoopbackScenario,
  bytes: Uint8Array,
  sentinels: { readonly request: string, id: string, readonly exchange: string }
) => {
  const state: LoopbackState = {
    published: false,
    issuerRequests: 0,
    exchangeRequests: 0,
    publishRequests: 0,
    redirectTargetRequests: 0,
    exactAudience: false,
    exactIssuerBearer: false,
    exactEnvironment: false,
    exactPackagePath: false,
    exactExchangeBearer: false,
    exactPublishBearer: false,
    exactPreparedBytes: false
  }
  const idToken = fixtureJwt({
    aud: "npm:registry.npmjs.org",
    repository: "fixture/protocol",
    workflow: "release.yml",
    exp: Math.floor(Date.now() / 1_000) + 300
  })
  sentinels.id = idToken
  const exchangePath = "/-/npm/v1/oidc/token/exchange/package/@fixture%2fprotocol"
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url)
      if (url.pathname.startsWith("/redirect-target/")) {
        state.redirectTargetRequests += 1
        return new Response("redirect followed", { status: 500 })
      }
      if (url.pathname === "/oidc") {
        state.issuerRequests += 1
        state.exactAudience = url.searchParams.get("audience") === "npm:registry.npmjs.org" &&
          url.searchParams.get("api-version") === "fixture"
        state.exactIssuerBearer = request.headers.get("authorization") === `Bearer ${sentinels.request}`
        state.exactEnvironment = request.headers.get("x-fixture-environment") === expectedEnvironment
        if (scenario === "issuer-rejected") return Response.json({ message: "rejected" }, { status: 401 })
        if (scenario === "issuer-redirect") {
          return new Response(null, { status: 302, headers: { location: "/redirect-target/issuer" } })
        }
        return Response.json({ value: idToken })
      }
      if (url.pathname.startsWith("/-/npm/v1/oidc/token/exchange/package/")) {
        state.exchangeRequests += 1
        state.exactPackagePath = url.pathname === exchangePath
        state.exactExchangeBearer = request.headers.get("authorization") === `Bearer ${idToken}`
        if (scenario === "package-binding-rejected" || !state.exactPackagePath) {
          return Response.json({ message: "package binding rejected" }, { status: 404 })
        }
        if (scenario === "exchange-rejected") return Response.json({ message: "rejected" }, { status: 403 })
        if (scenario === "exchange-redirect") {
          return new Response(null, { status: 307, headers: { location: "/redirect-target/exchange" } })
        }
        return Response.json({ token: sentinels.exchange })
      }
      if (url.pathname === `/fixture/publish/${encodeURIComponent(packageName)}/${packageVersion}`) {
        state.publishRequests += 1
        state.exactPublishBearer = request.headers.get("authorization") === `Bearer ${sentinels.exchange}`
        const received = new Uint8Array(await request.arrayBuffer())
        state.exactPreparedBytes = sha256Hex(received) === sha256Hex(bytes) && received.length === bytes.length
        if (scenario === "expired-token") {
          return Response.json({ message: "short-lived token expired" }, { status: 401 })
        }
        if (!state.exactPublishBearer || !state.exactPreparedBytes) {
          return Response.json({ message: "publish binding rejected" }, { status: 403 })
        }
        state.published = true
        return Response.json({ ok: true }, { status: 201 })
      }
      return Response.json({ message: "not found" }, { status: 404 })
    }
  })
  return { server, state, requestUrl: `http://127.0.0.1:${server.port}/oidc?api-version=fixture` }
}

const spawner = Effect.runSync(Effect.scoped(Layer.build(BunServices.layer).pipe(
  Effect.map((context) => Context.get(context, ChildProcessSpawner))
)))

const noNetworkHttp: PublicationHttp = {
  request: () => Effect.die("The OIDC loopback test must not use production HTTP transport.")
}

const configureBin = (root: string): string => {
  const bin = join(root, "bin")
  mkdirSync(bin, { recursive: true })
  const publisher = join(bin, "npm")
  copyFileSync(fileURLToPath(new URL("../../fixtures/npm-oidc-loopback-publisher.ts", import.meta.url)), publisher)
  chmodSync(publisher, 0o755)
  const bun = Bun.which("bun")
  const node = Bun.which("node")
  if (bun === null || node === null) throw new Error("The loopback test requires Bun and supported Node on PATH.")
  symlinkSync(bun, join(bin, "bun"))
  symlinkSync(node, join(bin, "node"))
  symlinkSync("/usr/bin/gzip", join(bin, "gzip"))
  return bin
}

const fileContains = (root: string, needles: ReadonlyArray<string>): boolean => {
  const visit = (path: string): boolean => {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) return false
    if (stat.isDirectory()) return readdirSync(path).some((entry) => visit(join(path, entry)))
    const bytes = readFileSync(path)
    return needles.some((needle) => bytes.includes(Buffer.from(needle)))
  }
  return visit(root)
}

const runScenario = async (scenario: LoopbackScenario) => {
  const root = mkdtempSync(join(tmpdir(), `ts-release-oidc-${scenario}-`))
  const sentinels = {
    request: `request-token-${crypto.randomUUID()}`,
    id: "",
    exchange: `short-lived-token-${crypto.randomUUID()}`
  }
  let server: ReturnType<typeof Bun.serve> | undefined
  try {
    const embeddedName = scenario === "package-binding-rejected" ? "@fixture/wrong-package" : packageName
    const packed = makeTarball(root, embeddedName)
    const prepared = makePrepared(root, packed.bytes)
    const loopback = startLoopback(scenario, packed.bytes, sentinels)
    server = loopback.server
    const bin = configureBin(root)
    const ambientHome = join(root, "ambient-runner-home")
    mkdirSync(ambientHome, { mode: 0o700 })
    writeFileSync(join(ambientHome, ".npmrc"), "//registry.npmjs.org/:_authToken=ambient-hostile-token\n", {
      mode: 0o600
    })
    const releaseHomePath = join(root, "private-release-home")
    mkdirSync(releaseHomePath, { mode: 0o700 })
    const releaseHome = realpathSync(releaseHomePath)
    writeFileSync(join(releaseHome, "npm-userconfig"), "", { mode: 0o600 })
    writeFileSync(join(releaseHome, "npm-globalconfig"), "", { mode: 0o600 })
    const temporaryRoot = join(root, "credentials")
    mkdirSync(temporaryRoot)
    const platform = makeEnvironmentCredentialPlatform(noNetworkHttp, spawner, { temporaryRoot })
    let sinkResult: CertifiedPublisherResult | undefined
    const publisher: CertifiedPublisherSpawnShape = {
      preflightTrustedNpm: platform.certifiedPublisherSpawn.preflightTrustedNpm,
      spawn: (spec, grant) => platform.certifiedPublisherSpawn.spawn(spec, grant).pipe(
        Effect.tap((result) => Effect.sync(() => { sinkResult = result }))
      )
    }
    const subject = makeNpmSubject(
      prepared.bundle,
      prepared.publication,
      makeMetadata(packed.bytes, loopback.state),
      platform.npmUserConfigResource,
      publisher
    )
    const environment = {
      PATH: bin,
      HOME: ambientHome,
      TS_RELEASE_HOME: releaseHome,
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: authentication.attestation.repository,
      GITHUB_WORKFLOW_REF:
        `${authentication.attestation.repository}/.github/workflows/${authentication.attestation.workflow}@${authentication.attestation.workflowRef}`,
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REPOSITORY_ID: "123456789",
      GITHUB_REPOSITORY_OWNER_ID: "1234567",
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: sourceCommit,
      RUNNER_ENVIRONMENT: "github-hosted",
      GITHUB_RUN_ID: "987654321",
      GITHUB_RUN_ATTEMPT: "1",
      ACTIONS_ID_TOKEN_REQUEST_URL: loopback.requestUrl,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: sentinels.request,
      NPM_TOKEN: `forbidden-npm-token-${crypto.randomUUID()}`,
      NODE_AUTH_TOKEN: `forbidden-node-token-${crypto.randomUUID()}`,
      AMBIENT_AUTHORITY_SENTINEL: `ambient-${crypto.randomUUID()}`
    }
    const providerLayer = ConfigProvider.layer(ConfigProvider.fromEnv({ env: environment }))
    const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect.pipe(Effect.provide(providerLayer)))

    let result: unknown
    if (scenario === "success") {
      result = await run(publishReleaseSubjects({
        prepared: SubjectId.make("prepared:sha256-oidc-loopback"),
        subjects: [subject]
      }).pipe(Effect.provideService(CredentialProvider, platform.credentialProvider)))
    } else {
      const observationGrant = await run(platform.credentialProvider.acquireForObservation(
        subject.observationRequests[0]
      ))
      const observation = await run(subject.observe(observationGrant, { phase: "pre-mutation" }))
      const decision = subject.decide(observation)
      if (decision._tag !== "NeedsMutation") throw new Error("Expected version-absence mutation authority.")
      const mutationGrant = await run(platform.credentialProvider.acquireForMutation(
        subject.mutationRequest,
        decision
      ))
      result = await run(subject.mutate(decision, mutationGrant))
    }

    const serialized = JSON.stringify({ result, sinkResult })
    const secretValues = [
      sentinels.request,
      sentinels.id,
      sentinels.exchange,
      environment.NPM_TOKEN,
      environment.NODE_AUTH_TOKEN,
      environment.AMBIENT_AUTHORITY_SENTINEL
    ]
    expect(serialized).not.toContain(sentinels.request)
    expect(serialized).not.toContain(sentinels.id)
    expect(serialized).not.toContain(sentinels.exchange)
    expect(serialized).not.toContain(environment.NPM_TOKEN)
    expect(serialized).not.toContain(environment.NODE_AUTH_TOKEN)
    expect(serialized).not.toContain(environment.AMBIENT_AUTHORITY_SENTINEL)
    expect(fileContains(root, secretValues)).toBe(false)
    expect(readdirSync(temporaryRoot)).toEqual([])
    expect(Bun.file(packed.lifecycleSentinel).size).toBe(0)

    return { state: loopback.state, result, sinkResult }
  } finally {
    server?.stop(true)
    rmSync(root, { recursive: true, force: true })
  }
}

describe("npm trusted publishing loopback protocol", () => {
  test("real host workload sink performs the exact local OIDC exchange and converges by reread", async () => {
    const outcome = await runScenario("success")
    expect(outcome.result).toMatchObject({
      subjects: [
        { _tag: "AlreadyEquivalent" },
        {
          _tag: "ConvergedAfterMutation",
          attempt: { _tag: "OutcomeUnknown" },
          postObservations: [{ _tag: "PresentEquivalent" }]
        }
      ]
    })
    expect(outcome.sinkResult).toMatchObject({ _tag: "PublisherExited", exitCode: 0 })
    expect(outcome.state).toMatchObject({
      published: true,
      issuerRequests: 1,
      exchangeRequests: 1,
      publishRequests: 1,
      redirectTargetRequests: 0,
      exactAudience: true,
      exactIssuerBearer: true,
      exactEnvironment: true,
      exactPackagePath: true,
      exactExchangeBearer: true,
      exactPublishBearer: true,
      exactPreparedBytes: true
    })
    // The packed manifest deliberately asks for a foreign registry, latest,
    // restricted access, and disabled provenance. The certified sink's exact
    // CLI options remain registry.npmjs.org, next, public, and automatic.
    expect(outcome.sinkResult?._tag === "PublisherExited" ? outcome.sinkResult.stdout : "")
      .toContain('"published":true')
  })

  test.each([
    ["issuer-rejected", { issuerRequests: 1, exchangeRequests: 0, publishRequests: 0 }],
    ["issuer-redirect", { issuerRequests: 1, exchangeRequests: 0, publishRequests: 0 }],
    ["exchange-rejected", { issuerRequests: 1, exchangeRequests: 1, publishRequests: 0 }],
    ["exchange-redirect", { issuerRequests: 1, exchangeRequests: 1, publishRequests: 0 }],
    ["expired-token", { issuerRequests: 1, exchangeRequests: 1, publishRequests: 1 }],
    ["package-binding-rejected", { issuerRequests: 1, exchangeRequests: 1, publishRequests: 0 }]
  ] as const)("%s fails closed after process start without provider convergence", async (scenario, counts) => {
    const outcome = await runScenario(scenario)
    expect(outcome.result).toMatchObject({ _tag: "OutcomeUnknown" })
    expect(outcome.sinkResult).toMatchObject({ _tag: "PublisherExited", exitCode: 1 })
    expect(outcome.state.published).toBe(false)
    expect(outcome.state.issuerRequests).toBe(counts.issuerRequests)
    expect(outcome.state.exchangeRequests).toBe(counts.exchangeRequests)
    expect(outcome.state.publishRequests).toBe(counts.publishRequests)
    expect(outcome.state.redirectTargetRequests).toBe(0)
  })
})
