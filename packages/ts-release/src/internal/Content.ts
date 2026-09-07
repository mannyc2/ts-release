import * as Effect from "effect/Effect"
import type * as Artifact from "effect-build/Artifact"
import { Content, type AdoptionError, type OwnedBundle } from "./ArtifactModel.js"
import { type ReleaseError, attempt, fail } from "./Error.js"
import { decodeOwned, sha256 } from "./Identity.js"

export interface ContentOwner {
  /** Copy before retention; return the identity of the stored copy. */
  readonly putOwned: (bytes: Uint8Array) => Effect.Effect<Content, AdoptionError>
  /** Stream a regular file, checking exact decimal size and SHA-256. */
  readonly putFileOwned: (
    source: Artifact.HashedFile | Artifact.HashedExecutable,
  ) => Effect.Effect<Content, AdoptionError>
  readonly verify: (content: Content) => Effect.Effect<void, AdoptionError>
  readonly read: (content: Content) => Effect.Effect<Uint8Array, AdoptionError>
}
export type ReadContent = (content: Content) => Effect.Effect<Uint8Array, ReleaseError>
export type PutContent = (bytes: Uint8Array) => Effect.Effect<Content, ReleaseError>
export interface ArtifactAccess {
  readonly bundle: OwnedBundle
  readonly readContent: ReadContent
}
/** Verify owned content before an adapter uses its bytes; never grants dispatch. */
export const readVerifiedContent = Effect.fn("ts-release.readVerifiedContent")(function* (
  read: ReadContent,
  input: Content,
  maximumBytes: number,
) {
  const content = yield* attempt(() => {
    const value = decodeOwned(Content, input)
    if (
      !Number.isSafeInteger(maximumBytes) ||
      maximumBytes <= 0 ||
      BigInt(value.bytes) > BigInt(maximumBytes)
    )
      fail("content-bound", "Owned content exceeds the configured byte bound")
    return value
  })
  const bytes = new Uint8Array(yield* read(content))
  if (String(bytes.length) !== content.bytes || (yield* sha256(bytes)) !== content.sha256)
    return yield* attempt(() => fail("content-identity", "Owned content size or digest differs"))
  return bytes
})
