import { expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import * as CorrectionIntentModule from "../../src/correction/intent.js"
import { CorrectionVariant } from "../../src/correction/intent.js"

test("PyPI correction is absent until a prepared PyPI subject is installed", () => {
  expect(() => Schema.decodeUnknownSync(CorrectionVariant, {
    onExcessProperty: "error"
  })({
    _tag: "PypiFileYankCorrection",
    provider: "pypi",
    publicationId: "pypi-release",
    indexUrl: "https://pypi.org",
    project: "fixture",
    version: "1.0.0",
    filename: "fixture-1.0.0-py3-none-any.whl",
    fileDigest: { _tag: "Sha256Digest", algorithm: "sha256", hex: "b".repeat(64) },
    reason: "Use 1.0.1."
  })).toThrow()
  expect(Object.hasOwn(CorrectionIntentModule, "PypiFileYankCorrection")).toBe(false)
})
