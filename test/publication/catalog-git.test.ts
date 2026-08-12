import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { parseSha256Hex, sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { PreparedArtifact, PreparedProject, PreparedReleaseV2, PreparedSource } from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import { CatalogFileIntent, CatalogManagedState, encodeCatalogManagedState, makeCatalogSubject, type CatalogRepositorySnapshot, type CatalogRepositoryTransport } from "../../src/publication/catalog-git.js"
import { PublicationError, publishSubject } from "../../src/publication/observation.js"

const fixture = () => {
  const target = new TextEncoder().encode("formula bytes\n")
  const managed = encodeCatalogManagedState(CatalogManagedState.make({ schemaVersion: "ts-release/catalog-state/v2", version: Version.make("1.0.0"), manifestDigest: parseSha256Hex("a".repeat(64)), status: "active" }))
  const artifact = (id: string, path: string, bytes: Uint8Array) => PreparedArtifact.make({ id: OutputId.make(id), path: SafeRelativePath.make(path), kind: "catalog-file", size: bytes.length,
    digest: sha256Digest(bytes), blob: sha256Digest(bytes) })
  const targetArtifact = artifact("catalog", "formula.rb", target)
  const stateArtifact = artifact("catalog-state", ".release/state.json", managed)
  const manifest = PreparedReleaseV2.make({ schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({ commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true, packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: sha256Digest(new TextEncoder().encode("package manifest")) }),
    project: PreparedProject.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }), artifacts: [targetArtifact, stateArtifact], publications: [] })
  const bundle: PreparedBundle = { directory: "/tmp/prepared/catalog", manifest, blobs: new Map([["catalog", target], ["catalog-state", managed]]) }
  const intent = CatalogFileIntent.make({ id: NonEmptyName.make("homebrew"), repository: "github.com/owner/tap", branch: NonEmptyName.make("main"), targetPath: "Formula/fixture.rb", statePath: ".ts-release/state/homebrew.json",
    artifactId: NonEmptyName.make("catalog"), stateArtifactId: NonEmptyName.make("catalog-state"), version: Version.make("1.0.0"), commitMessage: NonEmptyName.make("Release fixture 1.0.0") })
  return { bundle, intent, target, managed }
}
const snapshot = (repository: string, branch: string, revision: string, targetBytes?: Uint8Array, stateBytes?: Uint8Array): CatalogRepositorySnapshot => ({ repository, branch, revision, ...(targetBytes === undefined ? {} : { targetBytes }), ...(stateBytes === undefined ? {} : { stateBytes }) })

describe("conditional catalog Git adapter", () => {
  test("exact file and managed state skip without writing", async () => {
    const { bundle, intent, target, managed } = fixture()
    let writes = 0
    const transport: CatalogRepositoryTransport = { observe: () => Effect.succeed(snapshot(intent.repository, "main", "r1", target, managed)), write: () => Effect.sync(() => { writes++; return { revision: "r2" } }) }
    const result = await Effect.runPromise(publishSubject(makeCatalogSubject(bundle, intent, transport)))
    expect(result._tag).toBe("PublicationConverged")
    expect(writes).toBe(0)
  })

  test("absence writes both exact blobs with the observed revision", async () => {
    const { bundle, intent, target, managed } = fixture()
    let current = snapshot(intent.repository, "main", "r1")
    let writeRequest: { readonly expectedRevision: string, readonly targetBytes: Uint8Array, readonly stateBytes: Uint8Array } | undefined
    const transport: CatalogRepositoryTransport = {
      observe: () => Effect.succeed(current),
      write: (request) => Effect.sync(() => { writeRequest = request; current = snapshot(intent.repository, "main", "r2", target, managed); return { revision: "r2" } })
    }
    const result = await Effect.runPromise(publishSubject(makeCatalogSubject(bundle, intent, transport)))
    expect(result._tag).toBe("PublicationConverged")
    expect(writeRequest?.expectedRevision).toBe("r1")
    expect(writeRequest?.targetBytes).toEqual(target)
    expect(writeRequest?.stateBytes).toEqual(managed)
  })

  test("wrong origin, half-present state, newer state, and transport loss never become writes", async () => {
    const { bundle, intent, target, managed } = fixture()
    const newer = encodeCatalogManagedState(CatalogManagedState.make({ schemaVersion: "ts-release/catalog-state/v2", version: Version.make("2.0.0"), manifestDigest: parseSha256Hex("b".repeat(64)), status: "active" }))
    for (const current of [
      snapshot("github.com/other/tap", "main", "r1"),
      snapshot(intent.repository, "main", "r1", target),
      snapshot(intent.repository, "main", "r1", target, newer)
    ]) {
      let writes = 0
      const transport: CatalogRepositoryTransport = { observe: () => Effect.succeed(current), write: () => Effect.sync(() => { writes++; return { revision: "r2" } }) }
      const result = await Effect.runPromise(publishSubject(makeCatalogSubject(bundle, intent, transport)))
      expect(result._tag).toBe("PublicationBlocked")
      expect(writes).toBe(0)
    }
    const unavailable: CatalogRepositoryTransport = { observe: () => Effect.fail(PublicationError.make({ phase: "observe", commitment: "unknown", reason: "rate limited" })), write: () => Effect.die("must not write") }
    const result = await Effect.runPromise(publishSubject(makeCatalogSubject(bundle, intent, unavailable)))
    expect(result._tag).toBe("PublicationBlocked")
  })

  test("a racing equivalent update converges after an unknown write", async () => {
    const { bundle, intent, target, managed } = fixture()
    let current = snapshot(intent.repository, "main", "r1")
    let observations = 0
    const transport: CatalogRepositoryTransport = {
      observe: () => Effect.sync(() => { observations++; return current }),
      write: () => Effect.sync(() => { current = snapshot(intent.repository, "main", "r2", target, managed); return Effect.fail(PublicationError.make({ phase: "mutate", commitment: "unknown", reason: "response lost" })) }).pipe(Effect.flatten)
    }
    const result = await Effect.runPromise(publishSubject(makeCatalogSubject(bundle, intent, transport)))
    expect(result._tag).toBe("PublicationConverged")
    expect(result._tag === "PublicationConverged" ? result.mutation._tag : "").toBe("OutcomeUnknown")
    expect(observations).toBe(2)
  })
})
