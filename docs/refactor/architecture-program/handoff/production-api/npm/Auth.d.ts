import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { ReleaseError } from "@mannyc1/ts-release";
import { File, type ArtifactAccess } from "@mannyc1/ts-release/bundle";
import type { CredentialBinding, TrustedPublisherHost, OidcTokenSource } from "@mannyc1/ts-release/http";
import { TokenAuthorization, TrustedAuthorization, ProvenanceSource, type Attest, type VerifyProvenance } from "./Model.js";
export declare const authorizeToken: (input: {
    readonly authorization: TokenAuthorization;
    readonly binding: CredentialBinding;
    readonly token: Redacted.Redacted<string>;
}) => Effect.Effect<Readonly<Record<string, string>>, ReleaseError, never>;
export declare const authorizeTrusted: (input: {
    readonly authorization: TrustedAuthorization;
    readonly packageName: string;
    readonly binding: CredentialBinding;
}, host: TrustedPublisherHost) => Effect.Effect<Readonly<Record<string, string>>, ReleaseError, never>;
export declare const statement: (input: {
    name: string;
    version: string;
    source: ProvenanceSource;
}, bytes: Uint8Array) => Uint8Array<ArrayBuffer>;
/** Structural/exact-byte admission only; signature trust belongs to Attest. */
export declare const validateProvenance: (bytes: Uint8Array, expected: Uint8Array) => Record<string, unknown>;
export declare const createProvenance: (input: {
    readonly authorize: true;
    readonly name: string;
    readonly version: string;
    readonly tarball: File;
    readonly source: ProvenanceSource;
}, dependencies: ArtifactAccess & {
    readonly attest: Attest;
}) => Effect.Effect<{
    mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json";
    bytes: Uint8Array<ArrayBuffer>;
}, ReleaseError, never>;
export interface SigstoreTrustOptions {
    readonly tufRootPath: string;
    readonly tufCachePath: string;
    readonly timeoutMilliseconds: number;
}
/** Actual native verification is repeatable for loaded owned provenance files. */
export declare const makeSigstoreVerifier: (input: SigstoreTrustOptions) => VerifyProvenance;
export declare const makeSigstoreAttester: (input: {
    readonly source: ProvenanceSource;
    readonly oidc: OidcTokenSource;
    readonly fulcioUrl: "https://fulcio.sigstore.dev";
    readonly rekorUrl: "https://rekor.sigstore.dev";
    readonly tufRootPath: string;
    readonly tufCachePath: string;
    readonly timeoutMilliseconds: number;
}) => Attest;
