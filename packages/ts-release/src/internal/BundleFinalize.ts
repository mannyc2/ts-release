import * as Effect from "effect/Effect"
import { AdoptionError, BUNDLE_FORMAT, OwnedArtifact, OwnedBundle } from "./ArtifactModel.js"
import { decodeOwned } from "./Identity.js"
import { checkTree } from "./TreeLayout.js"

/** Run synchronous admission; any failure other than an explicit refusal is reported generically. */
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
  return yield* adoptData(() => {
    const bundle = decodeOwned(OwnedBundle, { format: BUNDLE_FORMAT, artifacts })
    const names = bundle.artifacts.map((artifact) => artifact.logicalName.toLowerCase())
    if (new Set(names).size !== names.length)
      throw new AdoptionError({ reason: "Bundle logical names must be unique, including case" })
    for (const artifact of bundle.artifacts) if (artifact._tag === "OwnedTree") checkTree(artifact)
    return bundle
  })
})
