import * as Effect from "effect/Effect"
import { OwnedBundle, OwnedFile } from "./ArtifactModel.js"
import type { ArtifactAccess } from "./Content.js"
import { canonical, decodeOwned, sha256 } from "./Identity.js"
import { attempt, fail, ReleaseError } from "./Error.js"

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
  const members = new Map(
    bundle.artifacts
      .filter((file) => file._tag === "OwnedFile")
      .map((file) => [file.logicalName, canonical(file)]),
  )
  const read = access.readContent.bind(access)
  const has = (input: OwnedFile) => {
    const file = decodeOwned(OwnedFile, input)
    return members.get(file.logicalName) === canonical(file)
  }
  return Object.freeze({
    has,
    read: Effect.fn("ts-release.readVerifiedArtifact")(function* (input: OwnedFile) {
      const file = yield* attempt(() => decodeOwned(OwnedFile, input))
      if (!has(file))
        return yield* new ReleaseError({
          code: "artifact-member",
          message: "File is not the exact owned Bundle member",
        })
      if (BigInt(file.content.bytes) > BigInt(maximumBytes))
        return yield* new ReleaseError({
          code: "artifact-bound",
          message: "Artifact exceeds the configured byte bound",
        })
      const bytes = new Uint8Array(yield* read(file.content))
      if (
        String(bytes.length) !== file.content.bytes ||
        (yield* sha256(bytes)) !== file.content.sha256
      )
        return yield* new ReleaseError({
          code: "artifact-content",
          message: "Owned artifact size or digest differs",
        })
      return bytes
    }),
  })
}
