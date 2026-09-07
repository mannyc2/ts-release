export type {} from "./internal/EffectTypes.js";
import { Effect, FileSystem, Path, PlatformError } from "effect";
import * as Artifact from "effect-build/Artifact";
import * as Tree from "effect-build/Author/Tree";
import { AdoptionError, OwnedFile, OwnedTree } from "./internal/ArtifactModel.js";
import { type ContentOwner } from "./internal/Content.js";
/** Recreate an owned tree through the real producer finalizer. effect-build
 * 0.6.3 publishes 0755 roots; other root modes reject before I/O. Nested modes
 * are preserved. The application owns the destination lifetime. */
export declare const restoreTree: (contentOwner: ContentOwner, tree: OwnedTree, outdir: string, provenance: Artifact.Provenance) => Effect.Effect<Artifact.HashedTree, Tree.Failure<PlatformError.PlatformError | AdoptionError | import("./index.js").ReleaseError, AdoptionError>, FileSystem.FileSystem | Path.Path | import("effect/Crypto").Crypto>;
/** Copy finalized producer bytes into release ownership; retain no borrowed path. */
export declare const adoptFile: (owner: ContentOwner, logicalName: string, input: Artifact.HashedFile | Artifact.HashedExecutable) => Effect.Effect<OwnedFile, AdoptionError, never>;
/** Verify the producer's exact private snapshot, then own each regular file. */
export declare const adoptTree: (owner: ContentOwner, logicalName: string, input: Artifact.HashedTree) => Effect.Effect<OwnedTree, Tree.TreeVerificationFailed | AdoptionError, FileSystem.FileSystem | Path.Path | import("effect/Crypto").Crypto>;
