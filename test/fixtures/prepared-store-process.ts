import * as Effect from "effect/Effect"
import { sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import {
  PreparedArtifact,
  PreparedProject,
  PreparedReleaseV2,
  PreparedSource
} from "../../src/release/prepared.js"
import {
  loadPreparedRelease,
  storePreparedRelease
} from "../../src/release/prepared-store.js"
import {
  fixtureArtifactProvenance,
  fixturePreparedProvenance,
  fixtureStagingSnapshot
} from "./prepared-provenance.js"

const [mode, storeDirectory, bundleDirectory] = process.argv.slice(2)

if (mode === "write" && storeDirectory !== undefined) {
  const bytes = new TextEncoder().encode("concurrent prepared bytes\n")
  const digest = sha256Digest(bytes)
  const artifact = PreparedArtifact.make({
    id: OutputId.make("payload"),
    path: SafeRelativePath.make("payload.tgz"),
    kind: "archive",
    size: bytes.length,
    digest,
    blob: digest,
    mediaType: "application/gzip",
    ...fixtureArtifactProvenance()
  })
  const manifest = PreparedReleaseV2.make({
    kind: "complete",
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make("abc123"),
      tree: NonEmptyName.make("tree123"),
      clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: sha256Digest(new TextEncoder().encode("package manifest")),
      materialized: fixtureStagingSnapshot
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"),
      version: Version.make("1.0.0"),
      tag: NonEmptyName.make("v1.0.0")
    }),
    provenance: fixturePreparedProvenance,
    artifacts: [artifact],
    collections: [],
    publications: []
  })
  const stored = await Effect.runPromise(storePreparedRelease(
    storeDirectory,
    manifest,
    new Map([[artifact.id.toString(), bytes]])
  ))
  process.stdout.write(`${stored.directory}\n`)
} else if (mode === "load" && bundleDirectory !== undefined) {
  const loaded = await Effect.runPromise(loadPreparedRelease(bundleDirectory))
  process.stdout.write(`${loaded.manifest.schemaVersion}:${loaded.manifest.artifacts.length}\n`)
} else {
  throw new Error("Usage: prepared-store-process.ts write <store> | load <unused> <bundle>")
}
