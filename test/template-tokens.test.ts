import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { platformTargetVariant } from "../src/grammar/platform.js"
import { renderArtifactNameEffect } from "../src/grammar/template.js"
import { makePipelineIdentity } from "./helpers.js"

const identity = makePipelineIdentity()

describe("artifact-name template tokens", () => {
  it.effect("renders present tokens, rejects absent vocabulary tokens, and preserves unknown tokens", () =>
    Effect.gen(function*() {
      const source = { pipeId: "test", field: "path" }
      const rendered = yield* Effect.all([
        renderArtifactNameEffect(
          "{os}_{arch}",
          { identity, platform: platformTargetVariant("linux-x64") },
          source
        ),
        renderArtifactNameEffect("{name}_{version}", { identity }, source),
        renderArtifactNameEffect("{weird}", { identity }, source)
      ])
      const missingOs = yield* renderArtifactNameEffect("{os}", { identity }, source).pipe(Effect.flip)
      const missingLibc = yield* renderArtifactNameEffect(
        "{libc}",
        { identity, platform: platformTargetVariant("darwin-x64") },
        source
      ).pipe(Effect.flip)

      expect(rendered).toEqual(["linux_amd64", "release_0.1.0", "{weird}"])
      expect([missingOs.reason, missingLibc.reason]).toEqual([
        "Template {os} cannot be resolved here; remove it or provide a platform context.",
        "Template {libc} cannot be resolved here; remove it or provide a platform context."
      ])
    }))
})
