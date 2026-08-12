import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { formatSha256Hex, parseSha256Hex, sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { encodePreparedRelease, PreparedProject, PreparedReleaseV2, PreparedSource } from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import { correctPreparedRelease } from "../../src/correction/coordinator.js"
import { makeCorrectionIntent } from "../../src/correction/intent.js"

test("PyPI per-file yank is explicitly unsupported for arbitrary configured indexes", async () => {
  const manifest = PreparedReleaseV2.make({ schemaVersion: "prepared-release/v2", source: PreparedSource.make({ commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true, packageManifestPath: SafeRelativePath.make("pyproject.toml"), packageManifestDigest: sha256Digest(new TextEncoder().encode("pyproject manifest")) }), project: PreparedProject.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }), artifacts: [], publications: [] })
  const preparedDigest = sha256Digest(encodePreparedRelease(manifest))
  const intent = makeCorrectionIntent({ schemaVersion: "correction-intent/v2", preparedDigest, correction: { _tag: "PypiFileYankCorrection", provider: "pypi", publicationId: NonEmptyName.make("pypi-release"), indexUrl: "https://index.example.test", project: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), filename: NonEmptyName.make("fixture-1.0.0-py3-none-any.whl"), fileDigest: parseSha256Hex("b".repeat(64)), reason: "Use 1.0.1 instead." } })
  const bundle: PreparedBundle = { directory: `/tmp/prepared/${formatSha256Hex(preparedDigest)}`, manifest, blobs: new Map() }
  const result = await Effect.runPromise(correctPreparedRelease({ bundle, intent }))
  expect(result._tag).toBe("CorrectionUnsupported")
  expect(result._tag === "CorrectionUnsupported" ? result.provider : "").toBe("pypi")
})
