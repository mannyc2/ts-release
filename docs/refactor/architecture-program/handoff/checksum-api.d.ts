/** Proposed root /bundle API emitted from bounded checksum research. */
/** Derived GNU SHA256SUMS view. No checksum identity or store is introduced. */
import { Effect } from "effect";
import { OwnedBundle, OwnedFile } from "./adoption-api/adoption.js";
import { ReleaseError } from "./kernel-api.js";
export interface ChecksumInput {
    readonly publicName: string;
    readonly file: OwnedFile;
}
export declare const renderSha256Sums: (bundle: OwnedBundle, inputs: readonly ChecksumInput[]) => Effect.Effect<Uint8Array<ArrayBuffer>, ReleaseError, never>;
export declare const verifySha256Sums: (bundle: OwnedBundle, inputs: readonly ChecksumInput[], bytes: Uint8Array<ArrayBufferLike>, verifyContent: (content: import("./adoption-api/adoption.js").Content) => Effect.Effect<void, import("./adoption-api/adoption.js").AdoptionError>) => Effect.Effect<undefined, import("./adoption-api/adoption.js").AdoptionError | ReleaseError, never>;
