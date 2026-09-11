import * as Effect from "effect/Effect"
import { Content, type AdoptionError, type OwnedBundle } from "./ArtifactModel.js"
import { type ReleaseError, attempt, fail, reject } from "./Error.js"
import { decodeOwned, sha256 } from "./Identity.js"

/** A regular file on disk together with the identity its producer recorded for it. */
export interface SourceFile {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}
export interface ContentOwner {
  /** Copy before retention; return the identity of the stored copy. */
  readonly putOwned: (bytes: Uint8Array) => Effect.Effect<Content, AdoptionError>
  /** Stream a regular file into ownership while checking it against its recorded
   * identity. Symbolic links, special files and changed bytes are refused. */
  readonly putFileOwned: (source: SourceFile) => Effect.Effect<Content, AdoptionError>
  readonly verify: (content: Content) => Effect.Effect<void, AdoptionError>
  readonly read: (content: Content) => Effect.Effect<Uint8Array, AdoptionError>
}
/** Bind an owner's operations once so a caller cannot swap them mid-operation. */
export const captureContentOwner = (owner: ContentOwner): ContentOwner =>
  Object.freeze({
    putOwned: owner.putOwned.bind(owner),
    putFileOwned: owner.putFileOwned.bind(owner),
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
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0 || value.bytes > maximumBytes)
      fail("content-bound", "Owned content exceeds the configured byte bound")
    return value
  })
  const bytes = new Uint8Array(yield* read(content))
  if (bytes.length !== content.bytes || (yield* sha256(bytes)) !== content.sha256)
    return yield* reject("content-identity", "Owned content size or digest differs")
  return bytes
})
