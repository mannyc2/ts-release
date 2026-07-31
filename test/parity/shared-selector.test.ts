import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { decodeConfig } from "../../src/config/config.js"
import { OutputId, SafeRelativePath } from "../../src/model/primitives.js"
import { CandidateSelection, selectOutputs } from "../../src/recipes/selection.js"

describe("closed shared artifact selection", () => {
  test("selects exact typed output facts and rejects arbitrary expressions", async () => {
    const outputs = [
      { id: "cli", format: "binary", path: "dist/cli" },
      { id: "notes", format: "file", path: "notes/release.md" }
    ]
    const selected = selectOutputs(CandidateSelection.make({
      ids: [OutputId.make("cli")], formats: ["binary"], pathPrefixes: [SafeRelativePath.make("dist")]
    }), outputs)
    expect(selected.map((item) => item.id)).toEqual(["cli"])
    await expect(Effect.runPromise(decodeConfig({
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
      artifacts: [{ id: "cli", path: "dist/cli", format: "binary" }],
      publish: { selection: { expression: "artifact.secret" } }
    }))).rejects.toBeDefined()
  })
})
