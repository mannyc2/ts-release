import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { Digest, NonEmptyName, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { encodePreparedRelease, PreparedGitHubPublication, PreparedProject, PreparedReleaseV1, PreparedSource } from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import { correctPreparedRelease } from "../../src/correction/coordinator.js"
import { makeCorrectionIntent } from "../../src/correction/intent.js"

test("GitHub correction remains explicitly unsupported without a durable conditional marker", async () => {
  const publication = PreparedGitHubPublication.make({ id: NonEmptyName.make("github-release"), repository: "github.com/owner/repo", tag: NonEmptyName.make("v1.0.0"), title: NonEmptyName.make("Fixture 1.0.0"), draft: false, prerelease: false, targetCommit: NonEmptyName.make("commit"), assets: [] })
  const manifest = PreparedReleaseV1.make({ schemaVersion: "prepared-release/v1", source: PreparedSource.make({ commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true, packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: Digest.make("a".repeat(64)) }), project: PreparedProject.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }), artifacts: [], publications: [publication] })
  const preparedDigest = Digest.make(createHash("sha256").update(encodePreparedRelease(manifest)).digest("hex"))
  const intent = makeCorrectionIntent({ schemaVersion: "correction-intent/v1", preparedDigest, correction: { _tag: "GithubReleaseCorrection", provider: "github", publicationId: publication.id, repository: publication.repository, tag: publication.tag, marker: "Withdrawn: use v1.0.1." } })
  const bundle: PreparedBundle = { directory: `/tmp/prepared/${preparedDigest}`, manifest, blobs: new Map() }
  const result = await import("effect/Effect").then(({ runPromise }) => runPromise(correctPreparedRelease({ bundle, intent })))
  expect(result._tag).toBe("CorrectionUnsupported")
  expect(result._tag === "CorrectionUnsupported" ? result.provider : "").toBe("github")
})
