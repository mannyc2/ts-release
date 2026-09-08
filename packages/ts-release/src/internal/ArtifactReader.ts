import * as Effect from "effect/Effect"
import { OwnedArtifact, OwnedBundle, OwnedFile } from "./ArtifactModel.js"
import { type ArtifactAccess, readVerifiedContent } from "./Content.js"
import { canonical, decodeOwned } from "./Identity.js"
import { attempt, fail, reject } from "./Error.js"

/** Capture a Bundle and reader once. Derived reads verify exact membership,
 * bounded byte length and SHA-256; this capability grants no dispatch authority. */
export const verifiedArtifacts = (access: ArtifactAccess, maximumBytes: number) => {
  if (
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes <= 0 ||
    typeof access.readContent !== "function"
  )
    fail("artifact-reader", "Artifact reader and positive byte bound are required")
  const bundle = decodeOwned(OwnedBundle, access.bundle)
  const names = bundle.artifacts.map((file) => file.logicalName)
  if (new Set(names).size !== names.length) fail("artifact-members", "Bundle names must be unique")
  const members = new Map(bundle.artifacts.map((file) => [file.logicalName, canonical(file)]))
  const read = access.readContent.bind(access)
  const member = (artifact: OwnedArtifact) =>
    members.get(artifact.logicalName) === canonical(artifact)
  const has = (input: OwnedArtifact) => member(decodeOwned(OwnedArtifact, input))
  return Object.freeze({
    has,
    read: Effect.fn("ts-release.readVerifiedArtifact")(function* (input: OwnedFile) {
      const file = yield* attempt(() => decodeOwned(OwnedFile, input))
      if (!member(file))
        return yield* reject("artifact-member", "File is not the exact owned Bundle member")
      return yield* readVerifiedContent(read, file.content, maximumBytes)
    }),
  })
}
