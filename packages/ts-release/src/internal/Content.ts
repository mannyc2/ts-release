import * as Effect from "effect/Effect"
import type * as Artifact from "effect-build/Artifact"
import { Content, type AdoptionError, type OwnedBundle } from "./ArtifactModel.js"
import { type ReleaseError, attempt, fail, reject } from "./Error.js"
import { decodeOwned, sha256 } from "./Identity.js"

export interface ContentOwner {
  /** Copy before retention; return the identity of the stored copy. */
  readonly putOwned: (bytes: Uint8Array) => Effect.Effect<Content, AdoptionError>
  /** Stream an exact regular file with nonblocking/no-follow open and descriptor
   * validation. This byte-store boundary does not assert producer finalization. */
  readonly putFileOwned: (
    source: Artifact.HashedFileIdentity,
  ) => Effect.Effect<Content, AdoptionError>
  /** Iterate source names without first materializing the complete directory.
   * Stop at the first entry beyond the nonnegative bound and close the cursor. */
  readonly readDirectoryBounded: (
    directory: string,
    maximumEntries: number,
  ) => Effect.Effect<readonly string[], AdoptionError>
  readonly verify: (content: Content) => Effect.Effect<void, AdoptionError>
  readonly read: (content: Content) => Effect.Effect<Uint8Array, AdoptionError>
}
export const captureContentOwner = (owner: ContentOwner): ContentOwner =>
  Object.freeze({
    putOwned: owner.putOwned.bind(owner),
    putFileOwned: owner.putFileOwned.bind(owner),
    readDirectoryBounded: owner.readDirectoryBounded.bind(owner),
    read: owner.read.bind(owner),
    verify: owner.verify.bind(owner),
  })
export type ReadContent<E = ReleaseError> = (content: Content) => Effect.Effect<Uint8Array, E>
export type PutContent = (bytes: Uint8Array) => Effect.Effect<Content, ReleaseError>
export interface ArtifactAccess {
  readonly bundle: OwnedBundle
  readonly readContent: ReadContent
}
/** Verify owned content before an adapter uses its bytes; never grants dispatch. */
export const readVerifiedContent = Effect.fn("ts-release.readVerifiedContent")(function* <E>(
  read: ReadContent<E>,
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
    return yield* reject("content-identity", "Owned content size or digest differs")
  return bytes
})
