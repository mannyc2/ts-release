import * as Effect from "effect/Effect";
import type * as Artifact from "effect-build/Artifact";
import { Content, type AdoptionError, type OwnedBundle } from "./ArtifactModel.js";
import { type ReleaseError } from "./Error.js";
export interface ContentOwner {
    /** Copy before retention; return the identity of the stored copy. */
    readonly putOwned: (bytes: Uint8Array) => Effect.Effect<Content, AdoptionError>;
    /** Stream an exact regular file with nonblocking/no-follow open and descriptor
     * validation. This byte-store boundary does not assert producer finalization. */
    readonly putFileOwned: (source: Artifact.HashedFileIdentity) => Effect.Effect<Content, AdoptionError>;
    /** Iterate source names without first materializing the complete directory.
     * Stop at the first entry beyond the nonnegative bound and close the cursor. */
    readonly readDirectoryBounded: (directory: string, maximumEntries: number) => Effect.Effect<readonly string[], AdoptionError>;
    readonly verify: (content: Content) => Effect.Effect<void, AdoptionError>;
    readonly read: (content: Content) => Effect.Effect<Uint8Array, AdoptionError>;
}
export declare const captureContentOwner: (owner: ContentOwner) => ContentOwner;
export type ReadContent<E = ReleaseError> = (content: Content) => Effect.Effect<Uint8Array, E>;
export type PutContent = (bytes: Uint8Array) => Effect.Effect<Content, ReleaseError>;
export interface ArtifactAccess {
    readonly bundle: OwnedBundle;
    readonly readContent: ReadContent;
}
/** Verify owned content before an adapter uses its bytes; never grants dispatch. */
export declare const readVerifiedContent: <E>(read: ReadContent<E>, input: Content, maximumBytes: number) => Effect.Effect<Uint8Array<ArrayBuffer>, ReleaseError | E, never>;
