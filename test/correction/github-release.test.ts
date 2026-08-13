import { expect, test } from "bun:test"
import { formatSha256Hex, sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { encodePreparedRelease, PreparedGitHubPublication, PreparedProject, PreparedReleaseV2, PreparedSource } from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import { makeGitHubPublicationAuthorityIntent } from "../../src/release/graph.js"
import { bindAuthoredCorrection, correctPreparedRelease } from "../../src/correction/coordinator.js"
import { decodeAuthoredCorrection } from "../../src/correction/intent.js"
import { digestEquals } from "../../src/model/digest.js"
import {
  fixturePreparedProvenance,
  fixtureStagingSnapshot
} from "../fixtures/prepared-provenance.js"

test("GitHub correction remains explicitly unsupported without a durable conditional marker", async () => {
  const publication = PreparedGitHubPublication.make({ id: NonEmptyName.make("github-release"), repository: "owner/repo", tag: NonEmptyName.make("v1.0.0"), title: NonEmptyName.make("Fixture 1.0.0"), draft: false, prerelease: false, targetCommit: NonEmptyName.make("commit"), assets: [], authority: makeGitHubPublicationAuthorityIntent({ repository: "owner/repo", tag: "v1.0.0" }) })
  const manifest = PreparedReleaseV2.make({ kind: "complete", schemaVersion: "prepared-release/v2", source: PreparedSource.make({ commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true, packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: sha256Digest(new TextEncoder().encode("package manifest")), materialized: fixtureStagingSnapshot }), project: PreparedProject.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }), provenance: fixturePreparedProvenance, artifacts: [], collections: [], publications: [publication] })
  const preparedDigest = sha256Digest(encodePreparedRelease(manifest))
  const bundle: PreparedBundle = { directory: `/tmp/prepared/${formatSha256Hex(preparedDigest)}`, manifest, blobs: new Map() }
  const intent = bindAuthoredCorrection(bundle, decodeAuthoredCorrection({
    provider: "github",
    kind: "amend-release-metadata",
    message: "Withdrawn: use v1.0.1."
  }))
  const result = await import("effect/Effect").then(({ runPromise }) => runPromise(correctPreparedRelease({ bundle, intent })))
  expect(result._tag).toBe("CorrectionUnsupported")
  expect(result._tag === "CorrectionUnsupported" ? result.provider : "").toBe("github")
})

test("authored correction derives a stable id and cannot introduce destination coordinates", () => {
  const publication = PreparedGitHubPublication.make({ id: NonEmptyName.make("github-release"), repository: "owner/repo", tag: NonEmptyName.make("v1.0.0"), title: NonEmptyName.make("Fixture 1.0.0"), draft: false, prerelease: false, targetCommit: NonEmptyName.make("commit"), assets: [], authority: makeGitHubPublicationAuthorityIntent({ repository: "owner/repo", tag: "v1.0.0" }) })
  const manifest = PreparedReleaseV2.make({ kind: "complete", schemaVersion: "prepared-release/v2", source: PreparedSource.make({ commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true, packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: sha256Digest(new TextEncoder().encode("package manifest")), materialized: fixtureStagingSnapshot }), project: PreparedProject.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }), provenance: fixturePreparedProvenance, artifacts: [], collections: [], publications: [publication] })
  const bundle: PreparedBundle = { directory: "/tmp/prepared/bound", manifest, blobs: new Map() }
  const authored = decodeAuthoredCorrection({
    provider: "github",
    kind: "amend-release-metadata",
    message: "Use v1.0.1."
  })
  const first = bindAuthoredCorrection(bundle, authored)
  const second = bindAuthoredCorrection(bundle, authored)
  expect(digestEquals(first.correctionId, second.correctionId)).toBe(true)
  expect(first.correction).toMatchObject({
    provider: "github",
    publicationId: "github-release",
    repository: "owner/repo",
    tag: "v1.0.0"
  })
  expect(() => decodeAuthoredCorrection({
    provider: "github",
    kind: "amend-release-metadata",
    message: "Use v1.0.1.",
    repository: "attacker/other"
  })).toThrow()
  expect(() => bindAuthoredCorrection(bundle, decodeAuthoredCorrection({
    provider: "github",
    kind: "amend-release-metadata",
    publicationId: "missing",
    message: "Use v1.0.1."
  }))).toThrow()
})
