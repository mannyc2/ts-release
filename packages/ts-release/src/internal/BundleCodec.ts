import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { AdoptionError, OwnedBundle } from "./ArtifactModel.js"
import type { ContentOwner } from "./Content.js"
import { adoptData, finalize } from "./BundleFinalize.js"
import { decodeOwned } from "./Identity.js"

export const encodeBundle = (bundle: OwnedBundle): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(Schema.encodeSync(OwnedBundle)(bundle)))

export const loadBundle = Effect.fn("ts-release.loadBundle")(function* (
  owner: ContentOwner,
  bytes: Uint8Array,
) {
  const decoded = yield* adoptData(() => {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const value = decodeOwned(OwnedBundle, JSON.parse(text))
    if (new TextDecoder().decode(encodeBundle(value)) !== text)
      throw new AdoptionError({ reason: "Bundle encoding is not the exact canonical codec output" })
    return value
  })
  const bundle = yield* finalize(decoded.artifacts)
  for (const artifact of bundle.artifacts) {
    if (artifact._tag === "OwnedFile") yield* owner.verify(artifact.content)
    else
      for (const entry of artifact.entries)
        if (entry._tag === "TreeFile") yield* owner.verify(entry.content)
  }
  return bundle
})
