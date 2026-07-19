import { describe, expect, test } from "@effect/bun-test"
import { deferredContentArtifactIds, renderDeferredContent } from "../src/run/content.js"
import { FilePartsContent, Sha256Hole } from "../src/grammar/operation.js"

const hole = Sha256Hole.make({ artifactId: "archive" })

describe("deferred file parts", () => {
  test("folds literal JSON parts around measured holes in declaration order", () => {
    const content = FilePartsContent.make({ parts: ['{"sha256":"', hole, '"}\n'] })
    const resolved = renderDeferredContent(content, new Map([["archive", "abc123"]]))
    expect(deferredContentArtifactIds(content)).toEqual(["archive"])
    expect(resolved).toEqual({
      contents: '{"sha256":"abc123"}\n',
      values: [{ artifactId: "archive", sha256: "abc123" }]
    })
  })

  test("reports the existing missing-hash error", () => {
    const content = FilePartsContent.make({ parts: [hole] })
    expect(() => renderDeferredContent(content, new Map())).toThrow(
      "Missing resolved hash for artifact archive."
    )
  })

  test("leaves token-like literal text untouched", () => {
    const content = FilePartsContent.make({ parts: ["{sha256:archive}"] })
    expect(renderDeferredContent(content, new Map()).contents).toBe("{sha256:archive}")
  })
})
