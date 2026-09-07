import { PublishIntent } from "./Model.js";
import { type NativeScope } from "./Native.js";
export declare const tarballDigests: (bytes: Uint8Array) => {
    sha256: string;
    integrity: string;
    shasum: string;
};
/** Native npm package PUT encoding, including npm's historical HTTP tarball URL. */
export declare const publishBody: (intent: PublishIntent, tarball: Uint8Array, provenance?: Uint8Array) => Uint8Array<ArrayBuffer>;
/** Full body admission is independent of a preparation cache. Reconstruct the
 * exact native document from admitted attachment bytes and immutable intent. */
export declare const admitBody: (scope: NativeScope, body: Uint8Array) => void;
