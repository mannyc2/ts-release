import { describe, expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import * as CorrectionIntentModule from "../../src/correction/intent.js"
import { CorrectionVariant } from "../../src/correction/intent.js"

describe("catalog correction interim hard cut", () => {
  test("rejects catalog coordinates before a prepared catalog publication exists", () => {
    expect(() => Schema.decodeUnknownSync(CorrectionVariant, {
      onExcessProperty: "error"
    })({
      _tag: "CatalogCorrection",
      provider: "catalog-git",
      publicationId: "homebrew",
      repository: "owner/tap",
      branch: "main",
      targetPath: "Formula/fixture.rb",
      statePath: ".ts-release/state/homebrew.json",
      artifactId: "catalog",
      stateArtifactId: "catalog-state",
      version: "1.0.0",
      status: "withdrawn",
      reason: "Use 1.0.1."
    })).toThrow()
    expect(Object.hasOwn(CorrectionIntentModule, "CatalogCorrection")).toBe(false)
  })
})
