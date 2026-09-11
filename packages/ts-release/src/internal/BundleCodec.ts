import { Effect, Schema } from "effect"
import { AdoptionError, BUNDLE_FORMAT, OwnedBundle } from "./ArtifactModel.js"
import type { ContentOwner } from "./Content.js"
import { adoptData, finalize } from "./BundleFinalize.js"
import { decodeOwned } from "./Identity.js"

export const encodeBundle = (bundle: OwnedBundle): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(Schema.encodeSync(OwnedBundle)(bundle)))

/** Formats this release system once wrote and deliberately no longer reads. */
const RETIRED_FORMATS: ReadonlyMap<string, string> = new Map([
  [
    "ts-release/bundle/1",
    "records effect-build 0.6 identities; adopt the artifacts again with effect-build 0.7",
  ],
])
const formatOf = (value: unknown): string | undefined =>
  typeof value === "object" && value !== null && "format" in value
    ? String(value.format)
    : undefined

export const loadBundle = Effect.fn("ts-release.loadBundle")(function* (
  owner: ContentOwner,
  bytes: Uint8Array,
) {
  const decoded = yield* adoptData(() => {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const value: unknown = JSON.parse(text)
    const format = formatOf(value)
    if (format !== undefined && format !== BUNDLE_FORMAT) {
      const retired = RETIRED_FORMATS.get(format)
      throw new AdoptionError({
        reason: retired
          ? `Bundle format ${format} ${retired}`
          : `Bundle format ${format} is not supported; expected ${BUNDLE_FORMAT}`,
      })
    }
    const bundle = decodeOwned(OwnedBundle, value)
    if (new TextDecoder().decode(encodeBundle(bundle)) !== text)
      throw new AdoptionError({ reason: "Bundle encoding is not the exact canonical codec output" })
    return bundle
  })
  const bundle = yield* finalize(decoded.artifacts)
  for (const artifact of bundle.artifacts) {
    if (artifact._tag === "OwnedFile") yield* owner.verify(artifact.content)
    else
      for (const entry of artifact.entries)
        if (entry.kind === "file") yield* owner.verify({ bytes: entry.bytes, sha256: entry.sha256 })
  }
  return bundle
})
