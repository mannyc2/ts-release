import { Effect, Redacted } from "effect";
import * as Bundle from "@mannyc1/ts-release/bundle";
import * as Http from "@mannyc1/ts-release/http";
import * as Model from "./Model.js";
export declare const authorizeToken: (input: {
    readonly authorization: Model.TokenAuthorization;
    readonly binding: Readonly<{
        endpoint: string;
        principal: string;
        scope: string;
    }>;
    readonly token: Redacted.Redacted<string>;
}) => Effect.Effect<Readonly<Record<string, string>>, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const authorizeTrusted: (input: {
    readonly authorization: Model.TrustedAuthorization;
    readonly packageName: string;
    readonly binding: Readonly<{
        endpoint: string;
        principal: string;
        scope: string;
    }>;
}, host: Readonly<{
    oidc: Http.OidcTokenSource;
    exchange: Http.CredentialExchange;
}>) => Effect.Effect<Readonly<Record<string, string>>, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const statement: (input: {
    name: string;
    version: string;
    source: Model.ProvenanceSource;
}, bytes: Uint8Array) => Uint8Array<ArrayBuffer>;
/** Structural/exact-byte admission only; signature trust belongs to Attest. */
export declare const validateProvenance: (bytes: Uint8Array, expected?: Uint8Array) => {
    bundle: unknown;
    payload: Uint8Array;
};
export declare const createProvenance: (input: {
    readonly authorize: true;
    readonly name: string;
    readonly version: string;
    readonly tarball: Bundle.File;
    readonly source: Model.ProvenanceSource;
}, dependencies: Bundle.ArtifactAccess & {
    readonly attest: Model.Attest;
}) => Effect.Effect<{
    mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json";
    bytes: Uint8Array<ArrayBuffer>;
}, import("@mannyc1/ts-release").ReleaseError, never>;
export interface SigstoreTrustOptions {
    readonly tufRootPath: string;
    readonly tufCachePath: string;
    readonly timeoutMilliseconds: number;
}
/** Actual native verification is repeatable for loaded owned provenance files. */
export declare const makeSigstoreVerifier: (input: SigstoreTrustOptions) => Model.VerifyProvenance;
export declare const makeSigstoreAttester: (input: {
    readonly source: Model.ProvenanceSource;
    readonly oidc: Http.OidcTokenSource;
    readonly fulcioUrl: "https://fulcio.sigstore.dev";
    readonly rekorUrl: "https://rekor.sigstore.dev";
    readonly tufRootPath: string;
    readonly tufCachePath: string;
    readonly timeoutMilliseconds: number;
}) => Model.Attest;
