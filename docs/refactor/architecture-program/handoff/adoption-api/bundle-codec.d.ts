/** Compiler-derived research shape adapted to the proposed production contract.
 * Target durable formats and selected producer pin differ from the frozen research
 * bytes. No production implementation or native acceptance is claimed. */
import { Crypto, Effect, FileSystem, Schema } from "effect";
import * as Artifact from "effect-build/Artifact";
import * as Tree from "effect-build/Author/Tree";
import { AdoptionError, OwnedBundle, OwnedTree, type ContentOwner } from "./adoption.js";
export declare const encodeBundle: (bundle: OwnedBundle) => Uint8Array<ArrayBuffer>;
export declare const loadBundle: (owner: ContentOwner, bytes: Uint8Array<ArrayBufferLike>) => Effect.Effect<OwnedBundle, Schema.SchemaError | import("effect/PlatformError").PlatformError | AdoptionError, Crypto.Crypto>;
/** Durable tree restoration passes through the actual public finalizer again. */
export declare const restoreTree: (owner: ContentOwner, tree: OwnedTree, outdir: string, provenance: Artifact.Provenance) => Effect.Effect<Artifact.HashedTree, Schema.SchemaError | Tree.Failure<import("effect/PlatformError").PlatformError | AdoptionError, never>, FileSystem.FileSystem | import("effect/Path").Path | Crypto.Crypto>;
