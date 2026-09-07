import type * as Effect from "effect/Effect"
import type * as Artifact from "effect-build/Artifact"
import type { AdoptionError, Content, OwnedBundle } from "./ArtifactModel.js"
import type { ReleaseError } from "./Error.js"

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
