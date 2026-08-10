import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { Digest, NonEmptyName, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { encodePreparedRelease, PreparedProject, PreparedReleaseV1, PreparedSource } from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import { correctPreparedRelease } from "../../src/correction/coordinator.js"
import { makeCorrectionIntent } from "../../src/correction/intent.js"

test("PyPI per-file yank is explicitly unsupported for arbitrary configured indexes", async () => {
  const manifest = PreparedReleaseV1.make({ schemaVersion: "prepared-release/v1", source: PreparedSource.make({ commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true, packageManifestPath: SafeRelativePath.make("pyproject.toml"), packageManifestDigest: Digest.make("a".repeat(64)) }), project: PreparedProject.make({ name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0") }), artifacts: [], publications: [] })
  const preparedDigest = Digest.make((await import("node:crypto")).createHash("sha256").update(encodePreparedRelease(manifest)).digest("hex"))
  const intent = makeCorrectionIntent({ schemaVersion: "correction-intent/v1", preparedDigest, correction: { _tag: "PypiFileYankCorrection", provider: "pypi", publicationId: NonEmptyName.make("pypi-release"), indexUrl: "https://index.example.test", project: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), filename: NonEmptyName.make("fixture-1.0.0-py3-none-any.whl"), fileDigest: Digest.make("b".repeat(64)), reason: "Use 1.0.1 instead." } })
  const bundle: PreparedBundle = { directory: `/tmp/prepared/${preparedDigest}`, manifest, blobs: new Map() }
  const result = await Effect.runPromise(correctPreparedRelease({ bundle, intent }))
  expect(result._tag).toBe("CorrectionUnsupported")
  expect(result._tag === "CorrectionUnsupported" ? result.provider : "").toBe("pypi")
})
