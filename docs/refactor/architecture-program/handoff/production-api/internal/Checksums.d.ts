import { Effect } from "effect";
import { OwnedBundle, OwnedFile } from "./ArtifactModel.js";
export type ChecksumInput = Readonly<{
    publicName: string;
    file: OwnedFile;
}>;
/** A derived GNU SHA256SUMS view, without another durable identity or store. */
export declare const renderSha256Sums: (bundle: OwnedBundle, inputs: readonly Readonly<{
    publicName: string;
    file: OwnedFile;
}>[]) => Effect.Effect<Uint8Array<ArrayBuffer>, import("./Error.js").ReleaseError, never>;
export declare const verifySha256Sums: (bundle: OwnedBundle, inputs: readonly Readonly<{
    publicName: string;
    file: OwnedFile;
}>[], bytes: Uint8Array<ArrayBufferLike>, verifyContent: (content: import("./ArtifactModel.js").Content) => Effect.Effect<void, import("./ArtifactModel.js").AdoptionError>) => Effect.Effect<undefined, import("./ArtifactModel.js").AdoptionError | import("./Error.js").ReleaseError, never>;
