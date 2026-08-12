/**
 * Deterministic containment reproductions for rejected candidate 1bc7828.
 *
 * These assertions describe evidence that invalidates the candidate. They are
 * not the target contracts: each fixing plan should delete or invert its
 * reproduction when the corresponding defect is repaired.
 *
 * Plan 224 moved the repaired CLI, Action, provider-authority, and host-sink
 * invariants into their focused suites. This file retains the unresolved
 * Plan 225/229, catalog, staging, and producer-shape reproductions, plus the
 * hard-cut verification-before-credential regressions.
 */
import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeReleaseApi } from "../../src/api/api.js"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../../src/api/runtime.js"
import type { ReleaseApiLayer } from "../../src/api/types.js"
import { DriverError } from "../../src/drivers/errors.js"
import type { RunCommand } from "../../src/drivers/process.js"
import { formatNpmSha512Sri, parseSha256Hex, sha256Digest, sha512Digest } from "../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { compileReleaseGraph } from "../../src/release/compiler.js"
import {
  canonicalizeRegistryUrl, makeNpmPublicationAuthorityIntent
} from "../../src/release/graph.js"
import {
  PreparedArtifact, PreparedNpmPublication, PreparedProject, PreparedReleaseV2,
  PreparedSource, encodePreparedRelease
} from "../../src/release/prepared.js"
import {
  makeLocalPreparedReleaseStore,
  PreparedReleaseStore,
  type PreparedBundle,
  type PreparedReleaseStoreShape
} from "../../src/release/prepared-store.js"
import { resolveConfig } from "../../src/resolve/resolve.js"
import { ObservedFacts } from "../../src/resolve/facts.js"
import { publishSubject } from "../../src/publication/observation.js"
import type { HttpResponse, PublicationHttp } from "../../src/publication/http.js"
import { HttpAuthorizer } from "../../src/publication/http.js"
import {
  CredentialProvider,
  CredentialUnavailable,
  makeCredentialProvider
} from "../../src/publication/authority.js"
import {
  encodeCorrectionIntent, makeCorrectionIntent, type CorrectionIntent
} from "../../src/correction/intent.js"
import { makeNpmDeprecationSubject } from "../../src/correction/npm.js"
import { makeCatalogCorrectionSubject } from "../../src/correction/catalog.js"
import {
  CatalogManagedState, encodeCatalogManagedState, type CatalogRepositorySnapshot,
  type CatalogRepositoryTransport
} from "../../src/publication/catalog-git.js"
import { CredentialPlatformError } from "../../src/platform/credentials.js"
import { makeNodeReleaseLayer } from "../../src/platform/node.js"
import { contextFor, noopRun } from "../core/runtime-fixture.js"

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value)
const response = (status: number, body: unknown): HttpResponse => ({
  status, headers: {}, body: typeof body === "string" ? body : JSON.stringify(body)
})
const temporary = (name: string): string => mkdtempSync(join(tmpdir(), `ts-release-223-${name}-`))

const runCaptured = (
  argv: ReadonlyArray<string>, options: { readonly cwd: string, readonly env?: Record<string, string | undefined> }
): {
  readonly status: number
  readonly signal?: string
  readonly timedOut: boolean
  readonly maxBufferExceeded: boolean
  readonly stdout: string
  readonly stderr: string
} => {
  const result = Bun.spawnSync([...argv], {
    cwd: options.cwd,
    ...(options.env === undefined ? {} : { env: options.env }),
    stdout: "pipe", stderr: "pipe", timeout: 20_000
  })
  return {
    status: result.exitCode,
    ...(result.signalCode === undefined ? {} : { signal: result.signalCode }),
    timedOut: result.exitedDueToTimeout === true,
    maxBufferExceeded: result.exitedDueToMaxBuffer === true,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr)
  }
}

const runtimeLayer = (
  preparedStore: PreparedReleaseStoreShape,
  overrides: Partial<ReleaseRuntimeShape> = {},
  credentialCalls?: { value: number }
): ReleaseApiLayer => {
  const source = {
    observe: (workspace: import("../../src/model/primitives.js").WorkspaceRoot) =>
      Effect.succeed(contextFor(workspace.toString()))
  }
  const credentials = makeCredentialProvider({
    acquire: (request) => {
      if (credentialCalls !== undefined) credentialCalls.value += 1
      return Effect.fail(new CredentialUnavailable({
        subject: request.subject,
        provider: request.provider,
        purpose: request.purpose,
        reason: "remediation fixture credentials are unavailable"
      }))
    }
  })
  const http = {
    execute: () => Effect.fail(new CredentialPlatformError({
      phase: "observe",
      commitment: "before-dispatch",
      reason: "remediation fixture HTTP should not be reached"
    }))
  }
  return Layer.mergeAll(
    Layer.succeed(ReleaseRuntime, { source, run: noopRun, ...overrides }),
    Layer.succeed(PreparedReleaseStore, preparedStore),
    Layer.succeed(CredentialProvider, credentials),
    Layer.succeed(HttpAuthorizer, http)
  )
}

const localRun: RunCommand = ({ argv, cwd }) => Effect.try({
  try: () => {
    const result = runCaptured(argv, { cwd })
    return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr }
  },
  catch: (cause) => DriverError.make({
    reason: cause instanceof Error ? cause.message : String(cause), commitment: "before-commit"
  })
})

const npmFixture = (
  version = "1.0.0", registryUrl = "https://registry.example.test"
): { readonly bundle: PreparedBundle, readonly bytes: Uint8Array, readonly publication: PreparedNpmPublication } => {
  const canonicalRegistry = canonicalizeRegistryUrl(registryUrl)
  const bytes = utf8("prepared npm bytes\n")
  const hash = sha256Digest(bytes)
  const artifact = PreparedArtifact.make({
    id: OutputId.make("npm-tarball"), path: SafeRelativePath.make("package.tgz"), kind: "archive",
    size: bytes.length, digest: hash, blob: hash, mediaType: "application/gzip"
  })
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"), packageName: NonEmptyName.make("@fixture/package"),
    version: Version.make(version), registryUrl: canonicalRegistry, artifactId: artifact.id,
    authority: makeNpmPublicationAuthorityIntent({
      packageName: "@fixture/package", version, registryUrl: canonicalRegistry
    })
  })
  const manifest = PreparedReleaseV2.make({
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: parseSha256Hex("a".repeat(64))
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"), packageName: publication.packageName,
      version: publication.version, tag: NonEmptyName.make(`v${version}`)
    }),
    artifacts: [artifact], publications: [publication]
  })
  return {
    bundle: { directory: "/not-stored", manifest, blobs: new Map([[artifact.id.toString(), bytes]]) },
    bytes, publication
  }
}

const commitFixture = async (root: string, bundle: PreparedBundle) => {
  const store = makeLocalPreparedReleaseStore(join(root, "store"))
  const committed = await Effect.runPromise(store.commit(bundle.manifest, bundle.blobs))
  return { store, committed }
}

const correctionFor = (bundle: PreparedBundle, message = "Use 1.0.1 instead."): CorrectionIntent => {
  const publication = bundle.manifest.publications[0] as PreparedNpmPublication
  const bytes = bundle.blobs.get(publication.artifactId.toString())!
  return makeCorrectionIntent({
    schemaVersion: "correction-intent/v2", preparedDigest: sha256Digest(encodePreparedRelease(bundle.manifest)),
    correction: {
      _tag: "NpmDeprecationCorrection", provider: "npm", publicationId: publication.id,
      registryUrl: publication.registryUrl, packageName: publication.packageName, version: publication.version,
      tarballIntegrity: sha512Digest(bytes),
      message
    }
  })
}

const catalogCorrectionFixture = (): {
  readonly bundle: PreparedBundle
  readonly correction: CorrectionIntent
  readonly target: Uint8Array
  readonly activeState: Uint8Array
} => {
  const target = utf8("class Fixture < Formula\nend\n")
  const activeState = encodeCatalogManagedState(CatalogManagedState.make({
    schemaVersion: "ts-release/catalog-state/v2", version: Version.make("1.0.0"),
    manifestDigest: parseSha256Hex("a".repeat(64)), status: "active"
  }))
  const targetHash = sha256Digest(target)
  const stateHash = sha256Digest(activeState)
  const targetId = OutputId.make("catalog-target")
  const stateId = OutputId.make("catalog-state")
  const manifest = PreparedReleaseV2.make({
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: parseSha256Hex("a".repeat(64))
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0")
    }),
    artifacts: [
      PreparedArtifact.make({ id: targetId, path: SafeRelativePath.make("Formula/fixture.rb"), kind: "catalog-file", size: target.length, digest: targetHash, blob: targetHash }),
      PreparedArtifact.make({ id: stateId, path: SafeRelativePath.make(".release/state.json"), kind: "catalog-file", size: activeState.length, digest: stateHash, blob: stateHash })
    ],
    publications: []
  })
  const bundle: PreparedBundle = {
    directory: "/not-stored", manifest,
    blobs: new Map([[targetId.toString(), target], [stateId.toString(), activeState]])
  }
  const correction = makeCorrectionIntent({
    schemaVersion: "correction-intent/v2", preparedDigest: sha256Digest(encodePreparedRelease(manifest)),
    correction: {
      _tag: "CatalogCorrection", provider: "catalog-git", publicationId: NonEmptyName.make("homebrew"),
      repository: "github.com/owner/tap", branch: NonEmptyName.make("main"),
      targetPath: SafeRelativePath.make("Formula/fixture.rb"), statePath: SafeRelativePath.make(".ts-release/state/homebrew.json"),
      artifactId: targetId, stateArtifactId: stateId, version: Version.make("1.0.0"),
      status: "withdrawn", reason: "Use fixture 1.0.1 instead."
    }
  })
  return { bundle, correction, target, activeState }
}

describe("Plan 223 rejected-candidate containment reproductions", () => {
  test("invalid public prepared inputs acquire zero credentials", async () => {
    const root = temporary("invalid-ref")
    const calls = { value: 0 }
    const store = makeLocalPreparedReleaseStore(join(root, "store"))
    const api = makeReleaseApi(runtimeLayer(store, {}, calls))
    try {
      await expect(api.publish({ prepared: join(root, "plaintext-path") } as never)).rejects.toMatchObject({
        _tag: "ReleaseInputError"
      })
      expect(calls.value).toBe(0)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("a corrupt durable bundle aborts with its exact reference before credential acquisition", async () => {
    const root = temporary("corrupt-ref")
    const fixture = npmFixture()
    const calls = { value: 0 }
    const { store, committed } = await commitFixture(root, fixture.bundle)
    const artifact = committed.bundle.manifest.artifacts[0]!
    const blob = join(committed.bundle.directory, "blobs", artifact.blob.hex)
    chmodSync(blob, 0o600)
    writeFileSync(blob, "corrupt prepared bytes")
    const api = makeReleaseApi(runtimeLayer(store, {}, calls))
    try {
      await expect(api.publish({ prepared: committed.ref })).rejects.toMatchObject({
        _tag: "ReleaseAbortedError",
        prepared: committed.ref
      })
      expect(calls.value).toBe(0)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("Plan 224 preserves npm authority fields while Plan 225 policy gaps remain characterized", () => {
    const facts = ObservedFacts.make({ commit: NonEmptyName.make("abc123"), manifestName: NonEmptyName.make("fixture"), manifestVersion: Version.make("1.0.0-beta.1") })
    const base = {
      project: { name: "fixture", version: "1.0.0-beta.1", tag: "v1.0.0-beta.1", commit: "abc123" },
      npmPackage: { path: "." }, publish: { npm: {} }
    }
    const graphFor = (npm: Record<string, unknown>) => compileReleaseGraph(resolveConfig({
      ...base, publish: { npm }
    }, facts), contextFor("/tmp/ts-release-223-graph"))
    const publication = graphFor({}).publications[0]!
    expect(publication._tag).toBe("GraphNpmPublication")
    if (publication._tag !== "GraphNpmPublication") throw new Error("expected npm publication")
    expect(publication.authority.publishStrategy).toMatchObject({ kind: "token", credential: "NPM_TOKEN" })
    const token = graphFor({ tokenEnv: "CUSTOM_NPM_TOKEN" }).publications[0]!
    expect(token._tag === "GraphNpmPublication" ? token.authority.publishStrategy : undefined)
      .toMatchObject({ kind: "token", credential: "CUSTOM_NPM_TOKEN" })
    const trustedDefault = graphFor({ trustedPublishing: { provider: "github-actions" } }).publications[0]!
    expect(trustedDefault._tag === "GraphNpmPublication" ? trustedDefault.authority.publishStrategy : undefined)
      .toMatchObject({
        kind: "trusted-publishing",
        identityProvider: "github-actions",
        runnerClass: "github-hosted",
        workflow: ".github/workflows/release.yml"
      })
    const trustedWorkflow = graphFor({ trustedPublishing: { workflow: "release.yml" } }).publications[0]!
    expect(trustedWorkflow._tag === "GraphNpmPublication" ? trustedWorkflow.authority.publishStrategy : undefined)
      .toMatchObject({
        kind: "trusted-publishing",
        identityProvider: "github-actions",
        runnerClass: "github-hosted",
        workflow: ".github/workflows/release.yml"
      })
    expect(JSON.stringify(graphFor({ trustedPublishing: {} })))
      .toBe(JSON.stringify(graphFor({ trustedPublishing: { verifyPackageExists: true } })))
    expect(JSON.stringify(graphFor({}))).toBe(JSON.stringify(graphFor({ access: "restricted" })))
    expect(JSON.stringify(graphFor({}))).toBe(JSON.stringify(graphFor({ provenance: false })))
    expect(Object.keys(publication)).not.toContain("distTag")
    expect(Object.keys(publication)).not.toContain("provenance")
    expect(Object.keys(publication)).not.toContain("access")
  })

  test("two npm correction actors pass the same observation and issue unconditional updates", async () => {
    const fixture = npmFixture()
    const correctionA = correctionFor(fixture.bundle, "Use 1.0.1 instead.").correction as Extract<CorrectionIntent["correction"], { _tag: "NpmDeprecationCorrection" }>
    const correctionB = correctionFor(fixture.bundle, "Use 2.0.0 instead.").correction as Extract<CorrectionIntent["correction"], { _tag: "NpmDeprecationCorrection" }>
    const integrity = formatNpmSha512Sri(correctionA.tarballIntegrity)
    const http: PublicationHttp = {
      request: () => Effect.succeed(response(200, { dist: { integrity } }))
    }
    const requests: unknown[] = []
    const process = {
      deprecate: (request: unknown) => Effect.sync(() => {
        requests.push(request)
        return { started: true, exitCode: 0 }
      })
    }
    const first = makeNpmDeprecationSubject(fixture.bundle, correctionA, http, { read: "read", publish: "publish" }, process)
    const second = makeNpmDeprecationSubject(fixture.bundle, correctionB, http, { read: "read", publish: "publish" }, process)
    const firstObservation = await Effect.runPromise(first.observe())
    const secondObservation = await Effect.runPromise(second.observe())
    expect(firstObservation).toMatchObject({ _tag: "NeedsMutation", precondition: "deprecation-absent" })
    expect(secondObservation).toMatchObject({ _tag: "NeedsMutation", precondition: "deprecation-absent" })
    if (firstObservation._tag !== "NeedsMutation" || secondObservation._tag !== "NeedsMutation") throw new Error("fixture did not produce the race")
    await Effect.runPromise(first.mutate(firstObservation))
    await Effect.runPromise(second.mutate(secondObservation))
    expect(requests).toHaveLength(2)
    expect(requests.map((request) => (request as { readonly message: string }).message)).toEqual([
      "Use 1.0.1 instead.", "Use 2.0.0 instead."
    ])
    expect(requests.every((request) => !Object.keys(request as object).some((key) => /revision|etag|precondition/iu.test(key)))).toBe(true)
  })

  test("catalog withdrawal mutates only managed sidecar while preserving ecosystem target bytes", async () => {
    const fixture = catalogCorrectionFixture()
    let current: CatalogRepositorySnapshot = {
      repository: "github.com/owner/tap", branch: "main", revision: "r1",
      targetBytes: fixture.target, stateBytes: fixture.activeState
    }
    let writtenTarget: Uint8Array | undefined
    const transport: CatalogRepositoryTransport = {
      observe: () => Effect.succeed(current),
      write: (request) => Effect.sync(() => {
        writtenTarget = request.targetBytes
        current = {
          repository: request.repository, branch: request.branch, revision: "r2",
          targetBytes: request.targetBytes, stateBytes: request.stateBytes
        }
        return { revision: "r2" }
      })
    }
    const result = await Effect.runPromise(publishSubject(makeCatalogCorrectionSubject(fixture.bundle, fixture.correction, transport)))
    expect(result._tag).toBe("PublicationConverged")
    expect(writtenTarget).toEqual(fixture.target)
    expect(current.targetBytes).toEqual(fixture.target)
    expect(new TextDecoder().decode(current.stateBytes)).toContain('"status":"withdrawn"')
  })

  test("ignored package input changes prepared npm bytes under identical verified source facts", async () => {
    const prepare = async (contents: string): Promise<Uint8Array> => {
      const root = temporary("ignored-input")
      writeFileSync(join(root, ".gitignore"), "payload.txt\n")
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0", files: ["payload.txt"] }))
      writeFileSync(join(root, "payload.txt"), contents)
      const store = makeLocalPreparedReleaseStore(join(root, "store"))
      const api = makeReleaseApi(runtimeLayer(store, { run: localRun }))
      try {
        const prepared = await api.prepare({
          workspace: root,
          config: {
            project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
            npmPackage: { path: "." }, publish: { npm: {} }
          }
        })
        const bundle = await Effect.runPromise(store.load(prepared))
        const publication = bundle.manifest.publications[0] as PreparedNpmPublication
        return bundle.blobs.get(publication.artifactId.toString())!
      } finally {
        await api.dispose()
        rmSync(root, { recursive: true, force: true })
      }
    }
    const first = await prepare("first ignored bytes\n")
    const second = await prepare("second ignored bytes\n")
    expect(sha256Digest(first).hex).not.toBe(sha256Digest(second).hex)
  }, 20_000)

  test("public config accepts catalog publication presets but inspection exposes no catalog destination", async () => {
    const root = temporary("catalog-unreachable")
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }))
    const store = makeLocalPreparedReleaseStore(join(root, "store"))
    const api = makeReleaseApi(runtimeLayer(store))
    try {
      const inspection = await api.inspect({
        workspace: root,
        config: {
          project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
          publish: { homebrew: { repository: "github.com/owner/tap" }, scoop: { repository: "github.com/owner/bucket" } }
        }
      })
      expect(inspection.publications).toEqual([])
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("public correction verifies a durable reference and returns explicit unsupported data", async () => {
    const root = temporary("catalog-default")
    const fixture = catalogCorrectionFixture()
    const { store, committed } = await commitFixture(root, fixture.bundle)
    const api = makeReleaseApi(makeNodeReleaseLayer(store))
    try {
      const result = await api.correct({
        prepared: committed.ref,
        correction: new TextDecoder().decode(encodeCorrectionIntent(fixture.correction))
      })
      expect(result).toMatchObject({
        prepared: committed.ref,
        status: "unsupported"
      })
      expect(result.reason).not.toMatch(/credential|token|path/iu)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("source-contract audit: catalog/runtime-collection/partial-prepare paths have no public producer", () => {
    const authored = readFileSync("src/recipes/config.ts", "utf8")
    const graph = readFileSync("src/release/graph.ts", "utf8")
    const prepared = readFileSync("src/release/prepared.ts", "utf8")
    const apiTypes = readFileSync("src/api/types.ts", "utf8")
    const runtime = readFileSync("src/api/runtime.ts", "utf8")
    expect(authored).toContain("outputs: Schema.NonEmptyArray")
    expect(graph).toContain("outputs: Schema.NonEmptyArray(OutputDeclaration)")
    expect(prepared).toContain("Schema.Union([\n  PreparedNpmPublication, PreparedGitHubPublication\n])")
    expect(apiTypes).not.toMatch(/PrepareInput[^\n]*(?:mode|partition|merge)/u)
    expect(runtime).toContain("readonly source: SourceObserver")
    expect(runtime).not.toContain("preparedStore")
    expect(runtime).not.toContain("catalog")
  })
})
