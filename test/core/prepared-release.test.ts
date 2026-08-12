import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { Digest, NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import {
  PreparedArtifact, PreparedGitHubPublication, PreparedProject, PreparedReleaseV1, PreparedSource,
  decodePreparedRelease, encodePreparedRelease
} from "../../src/release/prepared.js"
import { loadPreparedRelease, makeLocalPreparedReleaseStore, PreparedStoreError, storePreparedRelease } from "../../src/release/prepared-store.js"
import { makeGitHubActionsCompletePreparedReleaseRef } from "../../src/release/prepared-ref.js"
import { inspectPreparedRelease } from "../../src/release/inspect.js"
import { makeGitHubPublicationAuthorityIntent } from "../../src/release/graph.js"

const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")
const fixture = () => {
  const bytes = new TextEncoder().encode("release bytes\n")
  const hash = digest(bytes)
  const artifact = PreparedArtifact.make({ id: OutputId.make("cli"), path: SafeRelativePath.make("cli.tgz"), kind: "archive",
    size: bytes.length, digest: Digest.make(hash), blob: Digest.make(hash), mediaType: "application/gzip" })
  const manifest = PreparedReleaseV1.make({ schemaVersion: "prepared-release/v1",
    source: PreparedSource.make({ commit: NonEmptyName.make("abc123"), tree: NonEmptyName.make("tree123"), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: Digest.make(hash) }),
    project: PreparedProject.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }),
    artifacts: [artifact], publications: [PreparedGitHubPublication.make({ id: NonEmptyName.make("github"), repository: "owner/fixture",
      tag: NonEmptyName.make("v1.0.0"), title: NonEmptyName.make("fixture 1.0.0"), draft: false, prerelease: false, targetCommit: NonEmptyName.make("abc123"),
      assets: [{ artifactId: artifact.id, name: "cli.tgz", mediaType: "application/gzip" }],
      authority: makeGitHubPublicationAuthorityIntent({ repository: "owner/fixture", tag: "v1.0.0" }) })] })
  return { manifest, bytes }
}

describe("PreparedReleaseV1 manifest and store", () => {
  test("canonical encoding rejects duplicates and noncanonical bytes", () => {
    const { manifest } = fixture()
    const bytes = encodePreparedRelease(manifest)
    expect(decodePreparedRelease(bytes).schemaVersion).toBe("prepared-release/v1")
    const github = manifest.publications[0]!
    if (github._tag !== "PreparedGitHubPublication") throw new Error("expected GitHub fixture")
    expect(() => encodePreparedRelease(PreparedReleaseV1.make({
      ...manifest,
      publications: [PreparedGitHubPublication.make({
        ...github,
        authority: makeGitHubPublicationAuthorityIntent({ repository: "owner/fixture", tag: "v2.0.0" })
      })]
    }))).toThrow()
    const duplicate = new TextEncoder().encode('{"schemaVersion":"prepared-release/v1","schemaVersion":"prepared-release/v1"}')
    expect(() => decodePreparedRelease(duplicate)).toThrow()
    const reordered = new TextEncoder().encode(`${JSON.stringify({ schemaVersion: "prepared-release/v1", source: {}, project: {}, artifacts: [], publications: [] })}\n`)
    expect(() => decodePreparedRelease(reordered)).toThrow()
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

  test("refuses missing, altered, extra, and symlinked blobs", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-prepared-"))
    try {
      const { manifest, bytes } = fixture()
      const missing = await Effect.runPromise(storePreparedRelease(join(root, "missing"), manifest, new Map([["cli", bytes]])))
      unlinkSync(join(missing.directory, "blobs", manifest.artifacts[0]!.blob.toString()))
      await expect(Effect.runPromise(loadPreparedRelease(missing.directory))).rejects.toBeInstanceOf(PreparedStoreError)
      const extra = await Effect.runPromise(storePreparedRelease(join(root, "extra"), manifest, new Map([["cli", bytes]])))
      writeFileSync(join(extra.directory, "blobs", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), "extra")
      await expect(Effect.runPromise(loadPreparedRelease(extra.directory))).rejects.toBeInstanceOf(PreparedStoreError)
      const linked = await Effect.runPromise(storePreparedRelease(join(root, "linked"), manifest, new Map([["cli", bytes]])))
      const linkedBlob = join(linked.directory, "blobs", manifest.artifacts[0]!.blob.toString())
      unlinkSync(linkedBlob)
      symlinkSync("../prepared-release.json", linkedBlob)
      await expect(Effect.runPromise(loadPreparedRelease(linked.directory))).rejects.toBeInstanceOf(PreparedStoreError)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
