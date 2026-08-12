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
import { parseSha256Hex, sha256Digest } from "../../src/model/digest.js"
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
import { HttpAuthorizer } from "../../src/publication/http.js"
import {
  CredentialProvider,
  CredentialUnavailable,
  makeCredentialProvider
} from "../../src/publication/authority.js"
import { CredentialPlatformError } from "../../src/platform/credentials.js"
import { contextFor, noopRun } from "../core/runtime-fixture.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  NpmTokenAuthentication
} from "../../src/recipes/config.js"
import { CredentialRef } from "../../src/model/authority.js"
import { unavailableMutationServicesLayer } from "../fixtures/mutation-services.js"

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value)
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
    Layer.succeed(HttpAuthorizer, http),
    unavailableMutationServicesLayer
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
  const canonicalRegistry = CanonicalNpmRegistryEndpoint.make(canonicalizeRegistryUrl(registryUrl))
  const authentication = NpmTokenAuthentication.make({
    strategy: "token",
    credential: CredentialRef.make("NPM_TOKEN")
  })
  const bytes = utf8("prepared npm bytes\n")
  const hash = sha256Digest(bytes)
  const artifact = PreparedArtifact.make({
    id: OutputId.make("npm-tarball"), path: SafeRelativePath.make("package.tgz"), kind: "archive",
    size: bytes.length, digest: hash, blob: hash, mediaType: "application/gzip"
  })
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"), packageName: NonEmptyName.make("@fixture/package"),
    version: Version.make(version), registryUrl: canonicalRegistry, artifactId: artifact.id,
    distTag: NpmDistTag.make("latest"), access: "public", authentication,
    provenance: "disabled", publicationMode: "direct",
    authority: makeNpmPublicationAuthorityIntent({
      packageName: "@fixture/package", version, registryUrl: canonicalRegistry, distTag: "latest",
      authentication
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
            npmPackage: { path: "." },
            publish: { npm: { authentication: { strategy: "token", credential: "NPM_TOKEN" } } }
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
