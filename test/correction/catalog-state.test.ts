import { describe, expect, test } from "bun:test"
import * as CorrectionIntentModule from "../../src/correction/intent.js"
import { decodeAuthoredCorrection } from "../../src/correction/intent.js"

describe("catalog forward-correction grammar", () => {
  test("admits only an explicit replacement version, tag, architecture, URL, and digest", () => {
    const correction = decodeAuthoredCorrection({
      provider: "catalog-git",
      kind: "forward-catalog-state",
      publicationId: "homebrew",
      replacementVersion: "1.0.1",
      replacementTag: "v1.0.1",
      downloads: [{
        architecture: "arm64",
        url: "https://github.com/owner/tool/releases/download/v1.0.1/tool.tar.gz",
        filename: "tool.tar.gz",
        sha256: "a".repeat(64)
      }],
      reason: "Use the repaired archive."
    })
    expect(correction.provider).toBe("catalog-git")
    expect(Object.hasOwn(CorrectionIntentModule, "CatalogForwardCorrection")).toBe(true)
    expect(() => decodeAuthoredCorrection({
      provider: "catalog-git",
      kind: "forward-catalog-state",
      replacementVersion: "1.0.1",
      replacementTag: "v1.0.1",
      downloads: [],
      reason: "missing replacement evidence"
    })).toThrow()
  })
})
