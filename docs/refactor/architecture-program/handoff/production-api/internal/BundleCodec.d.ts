import { Effect } from "effect";
import { AdoptionError, OwnedBundle } from "./ArtifactModel.js";
import type { ContentOwner } from "./Content.js";
export declare const encodeBundle: (bundle: OwnedBundle) => Uint8Array;
export declare const loadBundle: (owner: ContentOwner, bytes: Uint8Array<ArrayBufferLike>) => Effect.Effect<OwnedBundle, AdoptionError, never>;
