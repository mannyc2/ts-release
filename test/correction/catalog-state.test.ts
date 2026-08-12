import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { encodeCanonicalJson } from "../../src/model/canonical.js"
import {
  formatSha256Hex,
  parseSha256Hex,
  sha256Digest
} from "../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { encodePreparedRelease, PreparedArtifact, PreparedProject, PreparedReleaseV2, PreparedSource } from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import { makeCorrectionIntent, type CorrectionIntent } from "../../src/correction/intent.js"
import { makeCatalogCorrectionSubject } from "../../src/correction/catalog.js"
import { CatalogFileIntent, CatalogManagedState, decodeCatalogManagedState, encodeCatalogManagedState, type CatalogRepositorySnapshot, type CatalogRepositoryTransport, makeCatalogSubject } from "../../src/publication/catalog-git.js"
import { PublicationError, publishSubject } from "../../src/publication/observation.js"

const fixture = () => {
  const target = new TextEncoder().encode("formula bytes\n")
  const targetId = OutputId.make("catalog")
  const stateId = OutputId.make("catalog-state")
  const activeState = encodeCatalogManagedState(CatalogManagedState.make({ schemaVersion: "ts-release/catalog-state/v2", version: Version.make("1.0.0"), manifestDigest: parseSha256Hex("a".repeat(64)), status: "active" }))
  const targetDigest = sha256Digest(target), stateDigest = sha256Digest(activeState)
  const manifest = PreparedReleaseV2.make({ schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({ commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true, packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: sha256Digest(new TextEncoder().encode("package manifest")) }),
    project: PreparedProject.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }),
    artifacts: [
      PreparedArtifact.make({ id: targetId, path: SafeRelativePath.make("Formula/fixture.rb"), kind: "catalog-file", size: target.length, digest: targetDigest, blob: targetDigest }),
      PreparedArtifact.make({ id: stateId, path: SafeRelativePath.make(".release/state.json"), kind: "catalog-file", size: activeState.length, digest: stateDigest, blob: stateDigest })
    ], publications: [] })
  const preparedDigest = sha256Digest(encodePreparedRelease(manifest))
  const correction = makeCorrectionIntent({ schemaVersion: "correction-intent/v2", preparedDigest, correction: {
    _tag: "CatalogCorrection", provider: "catalog-git", publicationId: NonEmptyName.make("homebrew"), repository: "github.com/owner/tap",
    branch: NonEmptyName.make("main"), targetPath: SafeRelativePath.make("Formula/fixture.rb"), statePath: SafeRelativePath.make(".ts-release/state/homebrew.json"),
    artifactId: targetId, stateArtifactId: stateId, version: Version.make("1.0.0"), status: "withdrawn", reason: "Use fixture 1.0.1 instead."
  } })
  const bundle: PreparedBundle = { directory: `/tmp/prepared/${formatSha256Hex(preparedDigest)}`, manifest, blobs: new Map([[targetId.toString(), target], [stateId.toString(), activeState]]) }
  const oldIntent = CatalogFileIntent.make({ id: NonEmptyName.make("homebrew"), repository: "github.com/owner/tap", branch: NonEmptyName.make("main"), targetPath: "Formula/fixture.rb", statePath: ".ts-release/state/homebrew.json", artifactId: NonEmptyName.make("catalog"), stateArtifactId: NonEmptyName.make("catalog-state"), version: Version.make("1.0.0"), commitMessage: NonEmptyName.make("Release fixture 1.0.0") })
  return { bundle, correction, target, activeState, oldIntent }
}
const snapshot = (targetBytes: Uint8Array, stateBytes: Uint8Array, revision = "r1"): CatalogRepositorySnapshot => ({ repository: "github.com/owner/tap", branch: "main", revision, targetBytes, stateBytes })

describe("catalog provider correction", () => {
  test("writes a retained target and corrected managed state atomically", async () => {
    const { bundle, correction, target, activeState } = fixture()
    let current = snapshot(target, activeState)
    let writes = 0
    const transport: CatalogRepositoryTransport = {
      observe: () => Effect.succeed(current),
      write: (request) => Effect.sync(() => { writes++; expect(request.expectedRevision).toBe("r1"); expect(request.targetBytes).toEqual(target); current = snapshot(target, request.stateBytes, "r2"); return { revision: "r2" } })
    }
    const result = await Effect.runPromise(publishSubject(makeCatalogCorrectionSubject(bundle, correction, transport)))
    expect(result._tag).toBe("PublicationConverged")
    expect(writes).toBe(1)
    expect(new TextDecoder().decode(current.stateBytes)).toContain("withdrawn")
  })

  test("an existing different correction or newer generation never mutates", async () => {
    const { bundle, correction, target, activeState } = fixture()
    const corrected = encodeCatalogManagedState(CatalogManagedState.make({ schemaVersion: "ts-release/catalog-state/v2", version: Version.make("1.0.0"), manifestDigest: parseSha256Hex("a".repeat(64)), status: "corrected", correctionId: parseSha256Hex("b".repeat(64)), reason: "Other correction." }))
    const newer = encodeCatalogManagedState(CatalogManagedState.make({ schemaVersion: "ts-release/catalog-state/v2", version: Version.make("2.0.0"), manifestDigest: parseSha256Hex("c".repeat(64)), status: "active" }))
    for (const stateBytes of [corrected, newer]) {
      let writes = 0
      const transport: CatalogRepositoryTransport = { observe: () => Effect.succeed(snapshot(target, stateBytes)), write: () => Effect.sync(() => { writes++; return { revision: "r2" } }) }
      const result = await Effect.runPromise(publishSubject(makeCatalogCorrectionSubject(bundle, correction, transport)))
      expect(result._tag).toBe("PublicationBlocked")
      expect(writes).toBe(0)
    }
  })

  test("managed-state decoder hard-cuts V1 and rejects algorithm-mixed digest fields", () => {
    const legacy = new TextEncoder().encode(encodeCanonicalJson({
      schemaVersion: "ts-release/catalog-state/v1",
      version: "1.0.0",
      manifestDigest: { _tag: "Sha256Digest", algorithm: "sha256", hex: "a".repeat(64) },
      status: "active"
    }))
    const mixed = new TextEncoder().encode(encodeCanonicalJson({
      schemaVersion: "ts-release/catalog-state/v2",
      version: "1.0.0",
      manifestDigest: { _tag: "Sha512Digest", algorithm: "sha512", hex: "d".repeat(128) },
      status: "active"
    }))
    expect(decodeCatalogManagedState(legacy)).toBeUndefined()
    expect(decodeCatalogManagedState(mixed)).toBeUndefined()
  })

  test("unknown commit response converges only through the corrected state", async () => {
    const { bundle, correction, target, activeState } = fixture()
    let current = snapshot(target, activeState)
    const transport: CatalogRepositoryTransport = {
      observe: () => Effect.succeed(current),
      write: (request) => Effect.sync(() => { current = snapshot(target, request.stateBytes, "r2"); return Effect.fail(PublicationError.make({ phase: "mutate", commitment: "unknown", reason: "response lost" })) }).pipe(Effect.flatten)
    }
    const result = await Effect.runPromise(publishSubject(makeCatalogCorrectionSubject(bundle, correction, transport)))
    expect(result._tag).toBe("PublicationConverged")
    expect(result._tag === "PublicationConverged" ? result.mutation._tag : "").toBe("OutcomeUnknown")
  })

  test("ordinary catalog publication conflicts after correction", async () => {
    const { bundle, correction, target, activeState, oldIntent } = fixture()
    const corrected = encodeCatalogManagedState(CatalogManagedState.make({ schemaVersion: "ts-release/catalog-state/v2", version: Version.make("1.0.0"), manifestDigest: correction.preparedDigest, status: "withdrawn", correctionId: correction.correctionId, reason: "Use fixture 1.0.1 instead." }))
    const transport: CatalogRepositoryTransport = { observe: () => Effect.succeed(snapshot(target, corrected)), write: () => Effect.die("must not publish") }
    const result = await Effect.runPromise(publishSubject(makeCatalogSubject(bundle, oldIntent, transport)))
    expect(result._tag).toBe("PublicationBlocked")
  })
})
