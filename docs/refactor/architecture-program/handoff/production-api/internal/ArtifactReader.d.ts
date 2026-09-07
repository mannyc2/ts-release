import * as Effect from "effect/Effect";
import { OwnedFile } from "./ArtifactModel.js";
import type { ArtifactAccess } from "./Content.js";
import { ReleaseError } from "./Error.js";
/** Capture a Bundle and reader once. Derived reads verify exact membership,
 * bounded byte length and SHA-256; this capability grants no dispatch authority. */
export declare const verifiedArtifacts: (access: ArtifactAccess, maximumBytes: number) => Readonly<{
    has: (input: OwnedFile) => boolean;
    read: (input: OwnedFile) => Effect.Effect<Uint8Array<ArrayBuffer>, ReleaseError, never>;
}>;
