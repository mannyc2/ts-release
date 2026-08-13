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
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeReleaseApi } from "../../src/api/api.js"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../../src/api/runtime.js"
import type { ReleaseApiLayer } from "../../src/api/types.js"
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
import { contextFor, materializeFixtureWorkspace, noopRun } from "../core/runtime-fixture.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  NpmTokenAuthentication
} from "../../src/recipes/config.js"
import { CredentialRef } from "../../src/model/authority.js"
import { unavailableMutationServicesLayer } from "../fixtures/mutation-services.js"
import {
  fixtureArtifactProvenance,
  fixturePreparedProvenance,
  fixtureStagingSnapshot
} from "../fixtures/prepared-provenance.js"

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value)
const temporary = (name: string): string => mkdtempSync(join(tmpdir(), `ts-release-223-${name}-`))

const runtimeLayer = (
  preparedStore: PreparedReleaseStoreShape,
  overrides: Partial<ReleaseRuntimeShape> = {},
  credentialCalls?: { value: number }
): ReleaseApiLayer => {
  const source = {
    observe: (workspace: import("../../src/model/primitives.js").WorkspaceRoot) =>
      Effect.succeed(contextFor(workspace.toString())),
    materialize: materializeFixtureWorkspace
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
    size: bytes.length, digest: hash, blob: hash, mediaType: "application/gzip", ...fixtureArtifactProvenance()
  })
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"), packageName: NonEmptyName.make("@fixture/package"),
    version: Version.make(version), registryUrl: canonicalRegistry, artifactId: artifact.id,
    distTag: NpmDistTag.make("latest"), access: "public", authentication,
    provenance: "disabled",
    authority: makeNpmPublicationAuthorityIntent({
      packageName: "@fixture/package", version, registryUrl: canonicalRegistry, distTag: "latest",
      authentication
    })
  })
  const manifest = PreparedReleaseV2.make({
    kind: "complete",
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: parseSha256Hex("a".repeat(64)),
      materialized: fixtureStagingSnapshot
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"), packageName: publication.packageName,
      version: publication.version, tag: NonEmptyName.make(`v${version}`)
    }),
    provenance: fixturePreparedProvenance,
    artifacts: [artifact], collections: [], publications: [publication]
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

  test("public config rejects catalog presets until Plan 231 restores a full vertical slice", async () => {
    const root = temporary("catalog-unreachable")
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }))
    const store = makeLocalPreparedReleaseStore(join(root, "store"))
    const api = makeReleaseApi(runtimeLayer(store))
    try {
      await expect(api.inspect({
        workspace: root,
        config: {
          project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
          publish: { homebrew: { repository: "github.com/owner/tap" }, scoop: { repository: "github.com/owner/bucket" } }
        }
      })).rejects.toMatchObject({ _tag: "ReleaseInputError" })
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("source-contract audit: runtime collections have a public producer while catalog and partial prepare remain absent", () => {
    const authored = readFileSync("src/recipes/config.ts", "utf8")
    const graph = readFileSync("src/release/graph.ts", "utf8")
    const prepared = readFileSync("src/release/prepared.ts", "utf8")
    const apiTypes = readFileSync("src/api/types.ts", "utf8")
    const runtime = readFileSync("src/api/runtime.ts", "utf8")
    expect(authored).toContain("outputs: Schema.NonEmptyArray")
    expect(authored).toContain("CandidateCollectionPreparation")
    expect(graph).toContain("outputs: Schema.NonEmptyArray(OutputDeclaration)")
    expect(graph).toContain("GraphCommandCollection")
    expect(prepared).toContain("PreparedArtifactCollection")
    expect(prepared).toContain("Schema.Union([\n  PreparedNpmPublication, PreparedGitHubPublication\n])")
    expect(apiTypes).not.toMatch(/PrepareInput[^\n]*(?:mode|partition|merge)/u)
    expect(runtime).toContain("readonly source: SourceObserver")
    expect(runtime).not.toContain("preparedStore")
    expect(runtime).not.toContain("catalog")

    const resolved = resolveConfig({
      project: {
        name: "fixture", version: "1.0.0", tag: "v1.0.0",
        repository: "owner/fixture"
      },
      preparations: [{
        kind: "artifact",
        id: "dynamic-assets",
        run: ["generate", "{collection:dynamic-assets}"],
        collection: {
          root: ".release/dynamic-assets",
          artifactKind: "archive",
          pathSuffix: ".zip",
          mediaType: "application/zip",
          cardinality: { kind: "one" }
        }
      }],
      publish: {
        github: {
          repository: "owner/fixture",
          ids: [],
          collections: [{
            collection: "dynamic-assets",
            artifactKind: "archive",
            pathSuffix: ".zip",
            mediaType: "application/zip",
            cardinality: { kind: "one" }
          }]
        }
      }
    }, ObservedFacts.make({
      commit: NonEmptyName.make("abc123"),
      manifestName: "fixture",
      manifestVersion: Version.make("1.0.0")
    }))
    const linked = compileReleaseGraph(resolved, contextFor(process.cwd()))
    expect(linked.collections.map((collection) => collection.id.toString())).toEqual(["dynamic-assets"])
    expect(linked.preparations.some((preparation) => preparation._tag === "GraphCommandCollection")).toBe(true)
    const github = linked.publications.find((publication) => publication._tag === "GraphGitHubPublication")
    expect(github?._tag === "GraphGitHubPublication" ? github.assetCollections : []).toHaveLength(1)
  })
})
