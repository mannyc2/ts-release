import * as Effect from "effect/Effect"
import { AdoptionError, OwnedArtifact, OwnedBundle } from "./ArtifactModel.js"
import { decodeOwned, sha256 } from "./Identity.js"
import { treeManifest } from "./TreeManifest.js"

export const adoptData = <A>(body: () => A): Effect.Effect<A, AdoptionError> =>
  Effect.try({
    try: body,
    catch: (error) =>
      error instanceof AdoptionError
        ? error
        : new AdoptionError({ reason: "Artifact data could not be admitted" }),
  })

/** Finalization owns all metadata and exposes no mutable builder. */
export const finalize = Effect.fn("ts-release.finalizeBundle")(function* (
  artifacts: readonly OwnedArtifact[],
) {
  const bundle = yield* adoptData(() => {
    const bundle = decodeOwned(OwnedBundle, { format: "ts-release/bundle/1", artifacts })
    const names = bundle.artifacts.map((artifact) => artifact.logicalName.toLowerCase())
    if (new Set(names).size !== names.length)
      throw new AdoptionError({ reason: "Bundle logical names must be unique, including case" })
    return bundle
  })
  for (const artifact of bundle.artifacts) {
    if (artifact._tag !== "OwnedTree") continue
    const manifest = yield* adoptData(() => treeManifest(artifact))
    const digest = yield* sha256(new TextEncoder().encode(manifest)).pipe(
      Effect.mapError(() => new AdoptionError({ reason: "Host could not verify tree identity" })),
    )
    if (digest !== artifact.upstreamManifestSha256)
      return yield* new AdoptionError({
        reason: "Durable tree manifest differs from upstream identity",
      })
  }
  return bundle
})
