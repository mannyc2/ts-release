import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import {
  PreparedArtifact, PreparedGitHubPublication, PreparedManifestError, PreparedProject, PreparedReleaseV2, PreparedSource,
  decodePreparedRelease, encodePreparedRelease
} from "../../src/release/prepared.js"
import {
  GitHubActionsPreparedStoreProvenance,
  LocalPreparedStoreProvenance,
  loadPreparedRelease,
  makeLocalPreparedReleaseStore,
  PreparedStoreError,
  PreparedStoreProvenanceError,
  storePreparedRelease,
  verifyPreparedStoreProvenance
} from "../../src/release/prepared-store.js"
import type { PreparedStoreFaultPoint } from "../../src/release/prepared-store.js"
import { makeGitHubActionsCompletePreparedReleaseRef } from "../../src/release/prepared-ref.js"
import { inspectPreparedRelease } from "../../src/release/inspect.js"
import { makeGitHubPublicationAuthorityIntent } from "../../src/release/graph.js"
import {
  fixtureArtifactProvenance,
  fixturePreparedProvenance,
  fixtureStagingSnapshot
} from "../fixtures/prepared-provenance.js"

const fixture = () => {
  const bytes = new TextEncoder().encode("release bytes\n")
  const digest = sha256Digest(bytes)
  const artifact = PreparedArtifact.make({ id: OutputId.make("cli"), path: SafeRelativePath.make("cli.tgz"), kind: "archive",
    size: bytes.length, digest, blob: digest, mediaType: "application/gzip", ...fixtureArtifactProvenance() })
  const manifest = PreparedReleaseV2.make({ kind: "complete", schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({ commit: NonEmptyName.make("abc123"), tree: NonEmptyName.make("tree123"), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: digest,
      materialized: fixtureStagingSnapshot }),
    project: PreparedProject.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }),
    provenance: fixturePreparedProvenance,
    artifacts: [artifact], collections: [], publications: [PreparedGitHubPublication.make({ id: NonEmptyName.make("github"), repository: "owner/fixture",
      tag: NonEmptyName.make("v1.0.0"), title: NonEmptyName.make("fixture 1.0.0"), draft: false, prerelease: false, targetCommit: NonEmptyName.make("abc123"),
      assets: [{ artifactId: artifact.id, name: "cli.tgz", mediaType: "application/gzip" }],
      authority: makeGitHubPublicationAuthorityIntent({ repository: "owner/fixture", tag: "v1.0.0" }) })] })
  return { manifest, bytes }
}

describe("PreparedReleaseV2 manifest and store", () => {
  test("canonical encoding rejects duplicates and noncanonical bytes", () => {
    const { manifest } = fixture()
    const bytes = encodePreparedRelease(manifest)
    expect(decodePreparedRelease(bytes).schemaVersion).toBe("prepared-release/v2")
    const github = manifest.publications[0]!
    if (github._tag !== "PreparedGitHubPublication") throw new Error("expected GitHub fixture")
    expect(() => encodePreparedRelease(PreparedReleaseV2.make({
      ...manifest,
      publications: [PreparedGitHubPublication.make({
        ...github,
        authority: makeGitHubPublicationAuthorityIntent({ repository: "owner/fixture", tag: "v2.0.0" })
      })]
    }))).toThrow()
    const duplicate = new TextEncoder().encode('{"schemaVersion":"prepared-release/v2","schemaVersion":"prepared-release/v2"}')
    expect(() => decodePreparedRelease(duplicate)).toThrow()
    const reordered = new TextEncoder().encode(`${JSON.stringify({ schemaVersion: "prepared-release/v2", source: {}, project: {}, artifacts: [], publications: [] })}\n`)
    expect(() => decodePreparedRelease(reordered)).toThrow()
    const partial = new TextEncoder().encode(new TextDecoder().decode(bytes).replace('"kind":"complete"', '"kind":"partial"'))
    expect(() => decodePreparedRelease(partial)).toThrow(PreparedManifestError)
  })

  test("stores exact blobs atomically and loads them without config or graph state", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepared-"))
    try {
      const { manifest, bytes } = fixture()
      const directory = join(root, "prepared")
      const first = await Effect.runPromise(storePreparedRelease(directory, manifest, new Map([["cli", bytes]])))
      const second = await Effect.runPromise(storePreparedRelease(directory, manifest, new Map([["cli", bytes]])))
      expect(second.directory).toBe(first.directory)
      const loaded = await Effect.runPromise(loadPreparedRelease(first.directory))
      expect(loaded.manifest.project.version.toString()).toBe("1.0.0")
      expect(new TextDecoder().decode(loaded.blobs.get("cli")!)).toBe("release bytes\n")
      expect(existsSync(join(first.directory, "prepared-release.json"))).toBe(true)
      const inspection = inspectPreparedRelease(loaded)
      expect(inspection.bundleDirectory).toBe(first.directory)
      expect(inspection.publications[0]?.subject).toContain("owner/fixture#v1.0.0")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("commits and reloads through a digest-only durable local reference", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepared-"))
    try {
      const { manifest, bytes } = fixture()
      const store = makeLocalPreparedReleaseStore(join(root, "prepared"))
      const committed = await Effect.runPromise(store.commit(manifest, new Map([["cli", bytes]])))
      expect(committed.ref.scheme).toBe("local")
      expect(committed.ref.digest.toString()).toBe(basename(committed.bundle.directory))
      const loaded = await Effect.runPromise(store.load(committed.ref))
      expect(loaded.manifest).toEqual(committed.bundle.manifest)

      const hosted = await Effect.runPromise(makeGitHubActionsCompletePreparedReleaseRef({
        owner: "owner", repository: "repo", runId: "1", attempt: "1",
        artifactName: "prepared", digest: committed.ref.digest
      }))
      await expect(Effect.runPromise(store.load(hosted))).rejects.toMatchObject({
        _tag: "PreparedStoreError",
        reason: expect.stringContaining("not loadable by the local store")
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("canonicalizes an aliased ancestor while refusing a symlinked store root", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepared-alias-"))
    const aliasRoot = mkdtempSync(join(tmpdir(), "ts-release-prepared-alias-link-"))
    try {
      const { manifest, bytes } = fixture()
      const ancestorAlias = join(aliasRoot, "ancestor")
      symlinkSync(root, ancestorAlias, "dir")
      const aliasedStore = join(ancestorAlias, "prepared")
      const store = makeLocalPreparedReleaseStore(aliasedStore)
      const committed = await Effect.runPromise(store.commit(manifest, new Map([["cli", bytes]])))
      const loaded = await Effect.runPromise(store.load(committed.ref))
      expect(loaded.directory).toBe(committed.bundle.directory)
      expect(loaded.manifest).toEqual(manifest)

      const realStore = join(root, "direct-store")
      mkdirSync(realStore)
      const directAlias = join(aliasRoot, "direct-store")
      symlinkSync(realStore, directAlias, "dir")
      await expect(Effect.runPromise(
        makeLocalPreparedReleaseStore(directAlias).commit(manifest, new Map([["cli", bytes]]))
      )).rejects.toMatchObject({ reason: "Prepared store root must not be a symlink." })
    } finally {
      rmSync(aliasRoot, { recursive: true, force: true })
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("keeps local trust explicit and requires exact hosted producer provenance", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepared-provenance-"))
    try {
      const { manifest, bytes } = fixture()
      const storeRoot = join(root, "prepared")
      const committed = await Effect.runPromise(
        makeLocalPreparedReleaseStore(storeRoot).commit(manifest, new Map([["cli", bytes]]))
      )
      const local = LocalPreparedStoreProvenance.make({
        scheme: "local", filesystemRoot: storeRoot, operatorBoundary: "current local operator"
      })
      expect((await Effect.runPromise(verifyPreparedStoreProvenance({
        reference: committed.ref, bundle: committed.bundle, evidence: local
      }))).scheme).toBe("local")

      const artifactName = `ts-release-prepared-2-${committed.ref.digest}`
      const hosted = await Effect.runPromise(makeGitHubActionsCompletePreparedReleaseRef({
        owner: "owner", repository: "fixture", runId: "7", attempt: "2", artifactName,
        digest: committed.ref.digest
      }))
      await expect(Effect.runPromise(verifyPreparedStoreProvenance({
        reference: hosted, bundle: committed.bundle, evidence: local
      }))).rejects.toBeInstanceOf(PreparedStoreProvenanceError)

      const evidence = GitHubActionsPreparedStoreProvenance.make({
        scheme: "gha",
        repository: "owner/fixture",
        workflowRef: "owner/fixture/.github/workflows/release.yml@refs/heads/main",
        workflowSha: "a".repeat(40),
        runId: "7",
        attempt: "2",
        candidateCommit: manifest.source.commit,
        artifactName,
        artifactDigest: committed.ref.digest,
        allowedWriter: "repository-workflow"
      })
      expect((await Effect.runPromise(verifyPreparedStoreProvenance({
        reference: hosted, bundle: committed.bundle, evidence
      }))).scheme).toBe("gha")
      await expect(Effect.runPromise(verifyPreparedStoreProvenance({
        reference: hosted,
        bundle: committed.bundle,
        evidence: GitHubActionsPreparedStoreProvenance.make({ ...evidence, attempt: "3" })
      }))).rejects.toMatchObject({ reason: expect.stringContaining("attempt") })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("refuses missing, altered, extra, and symlinked blobs", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepared-"))
    try {
      const { manifest, bytes } = fixture()
      const missing = await Effect.runPromise(storePreparedRelease(join(root, "missing"), manifest, new Map([["cli", bytes]])))
      unlinkSync(join(missing.directory, "blobs", manifest.artifacts[0]!.blob.hex))
      await expect(Effect.runPromise(loadPreparedRelease(missing.directory))).rejects.toBeInstanceOf(PreparedStoreError)
      const extra = await Effect.runPromise(storePreparedRelease(join(root, "extra"), manifest, new Map([["cli", bytes]])))
      writeFileSync(join(extra.directory, "blobs", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), "extra")
      await expect(Effect.runPromise(loadPreparedRelease(extra.directory))).rejects.toBeInstanceOf(PreparedStoreError)
      const linked = await Effect.runPromise(storePreparedRelease(join(root, "linked"), manifest, new Map([["cli", bytes]])))
      const linkedBlob = join(linked.directory, "blobs", manifest.artifacts[0]!.blob.hex)
      unlinkSync(linkedBlob)
      symlinkSync("../prepared-release.json", linkedBlob)
      await expect(Effect.runPromise(loadPreparedRelease(linked.directory))).rejects.toBeInstanceOf(PreparedStoreError)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("faults before promotion leave no loadable complete bundle, including cleanup faults", async () => {
    const points: ReadonlyArray<PreparedStoreFaultPoint> = [
      "before-blob-write",
      "after-blob-write",
      "before-manifest-write",
      "after-manifest-write",
      "before-blob-directory-fsync",
      "after-blob-directory-fsync",
      "before-bundle-directory-fsync",
      "after-bundle-directory-fsync",
      "before-promotion"
    ]
    for (const point of points) {
      const root = mkdtempSync(join(tmpdir(), "ts-release-prepared-fault-"))
      try {
        const { manifest, bytes } = fixture()
        const manifestDigest = sha256Digest(encodePreparedRelease(manifest)).hex
        let injected = false
        await expect(Effect.runPromise(storePreparedRelease(root, manifest, new Map([["cli", bytes]]), {
          onFaultPoint: (current) => {
            if (!injected && current === point) {
              injected = true
              throw new Error(`fault:${point}`)
            }
          }
        }))).rejects.toBeInstanceOf(PreparedStoreError)
        expect(injected).toBe(true)
        expect(existsSync(join(root, manifestDigest))).toBe(false)
        expect(readdirSync(root).some((entry) => /^[a-f0-9]{64}$/u.test(entry))).toBe(false)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }

    const cleanupRoot = mkdtempSync(join(tmpdir(), "ts-release-prepared-cleanup-fault-"))
    try {
      const { manifest, bytes } = fixture()
      await expect(Effect.runPromise(storePreparedRelease(cleanupRoot, manifest, new Map([["cli", bytes]]), {
        onFaultPoint: (point) => {
          if (point === "after-manifest-write" || point === "before-cleanup") {
            throw new Error(`fault:${point}`)
          }
        }
      }))).rejects.toMatchObject({
        _tag: "PreparedStoreError",
        reason: expect.stringContaining("cleanup failed")
      })
      expect(readdirSync(cleanupRoot).some((entry) => /^[a-f0-9]{64}$/u.test(entry))).toBe(false)
    } finally {
      rmSync(cleanupRoot, { recursive: true, force: true })
    }
  })

  test("post-promotion faults are reported instead of being converted to false success", async () => {
    for (const point of ["after-promotion", "before-store-fsync", "after-store-fsync"] as const) {
      const root = mkdtempSync(join(tmpdir(), "ts-release-prepared-post-promotion-"))
      try {
        const { manifest, bytes } = fixture()
        const manifestDigest = sha256Digest(encodePreparedRelease(manifest)).hex
        await expect(Effect.runPromise(storePreparedRelease(root, manifest, new Map([["cli", bytes]]), {
          onFaultPoint: (current) => {
            if (current === point) throw new Error(`fault:${point}`)
          }
        }))).rejects.toBeInstanceOf(PreparedStoreError)
        const recovered = await Effect.runPromise(loadPreparedRelease(join(root, manifestDigest)))
        expect(recovered.manifest).toEqual(manifest)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  test("concurrent writers converge and a fresh process reloads the exact bundle", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepared-concurrent-"))
    const fixturePath = join(process.cwd(), "test", "fixtures", "prepared-store-process.ts")
    try {
      const spawnWriter = () => Bun.spawn(["bun", "run", fixturePath, "write", root], {
        cwd: process.cwd(), stdout: "pipe", stderr: "pipe"
      })
      const writers = [spawnWriter(), spawnWriter()]
      const exits = await Promise.all(writers.map((writer) => writer.exited))
      const errors = await Promise.all(writers.map((writer) => new Response(writer.stderr).text()))
      expect(exits, errors.join("\n")).toEqual([0, 0])
      const bundles = readdirSync(root).filter((entry) => /^[a-f0-9]{64}$/u.test(entry))
      expect(bundles).toHaveLength(1)

      const child = Bun.spawn([
        "bun", "run", fixturePath, "load", root, join(root, bundles[0]!)
      ], { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" })
      const [exit, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text()
      ])
      expect(exit, stderr).toBe(0)
      expect(stdout.trim()).toBe("prepared-release/v2:1")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
