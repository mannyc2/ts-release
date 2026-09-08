export type {} from "./internal/EffectTypes.js";
export { decodeJson } from "./internal/NativeJson.js";
export { canonical, compareText, decodeOwned, sameBytes, sameData } from "./internal/Identity.js";
import { Effect, Redacted, Schema } from "effect";
import { ReleaseError } from "./internal/Error.js";
import type { ProviderDefinition, ProviderDescriptor, PreparedRequest, SendResult } from "./Provider.js";
import { Operation, RequestFacts } from "./internal/ReleaseModel.js";
export declare const makeDataBoundary: (prefix: string, subject: string) => {
    failure: (code: string, message: string) => ReleaseError;
    invalid: (code: string) => never;
    reject: (code: string, message: string) => Effect.Effect<never, ReleaseError>;
    attempt: <A>(body: () => A) => Effect.Effect<A, ReleaseError, never>;
    admit: <A>(code: string, body: () => A) => Effect.Effect<A, ReleaseError, never>;
    matches: (body: () => boolean) => boolean;
    object: (value: unknown) => Record<string, unknown>;
    own: <A, I>(codec: Schema.Codec<A, I>, input: unknown) => A;
    ownOperation: <A, I>(codec: Schema.Codec<A, I>, descriptor: Pick<ProviderDescriptor, "definitionId" | "intentVersion">, operation: Operation) => A;
    ownRequest: (request: PreparedRequest) => PreparedRequest;
};
export declare const containsSecret: (value: string | Uint8Array) => boolean;
export declare const isPublicText: (value: string, maximum: number, empty?: boolean) => boolean;
export declare const PublicText: (maximum: number, empty?: boolean) => Schema.String;
export declare const isSafePath: (value: string) => boolean;
export declare const publicUrl: (value: string, protocols?: readonly string[]) => URL | null;
declare const HttpReceipt_base: Schema.Class<HttpReceipt, Schema.Struct<{
    readonly status: Schema.Number;
    readonly body: Schema.String;
    readonly endpoint: Schema.String;
    readonly method: Schema.String;
    readonly bodyDigest: Schema.String;
}>, {}>;
/** Native response envelope binds the observed acknowledgement to exact send facts. */
export declare class HttpReceipt extends HttpReceipt_base {
}
export declare const corresponds: (request: RequestFacts, receipt: unknown) => boolean;
export type Headers = readonly (readonly [string, string])[];
export interface HttpReadRequest {
    readonly method: "GET" | "HEAD";
    readonly url: string;
    readonly headers: Headers;
    readonly principal: string;
    readonly scope: string;
}
export interface HttpResponse {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: Uint8Array;
}
export type HttpRead = (request: HttpReadRequest) => Effect.Effect<HttpResponse, ReleaseError>;
export interface HttpProviderDefinition extends ProviderDefinition {
    /** Exactly one definition must own full request authority before credentials. */
    readonly ownsRequest: (request: PreparedRequest) => boolean;
    readonly decodeResponse: (request: PreparedRequest, response: HttpResponse) => Effect.Effect<SendResult, ReleaseError>;
}
export type CredentialBinding = Readonly<{
    endpoint: string;
    principal: string;
    scope: string;
}>;
/** Live secret headers, never durable intent/request/journal fields. */
export type CredentialHeaders = Readonly<Record<string, string>>;
export declare const credentialToken: (value: Redacted.Redacted<string>, invalid: () => never) => string;
export declare const bearerCredentials: (value: Redacted.Redacted<string>, invalid: () => never) => CredentialHeaders;
export interface OidcTokenRequest {
    readonly issuer: "https://token.actions.githubusercontent.com";
    readonly audience: string;
    readonly repository: string;
    readonly workflow: string;
    readonly workflowRef: string;
    readonly expectedClaims: Readonly<Record<string, string>>;
}
export type OidcAuthorization = Omit<OidcTokenRequest, "expectedClaims">;
export declare const oidcRequest: (authorization: OidcAuthorization, expectedClaims?: Readonly<Record<string, string>>) => OidcTokenRequest;
export type OidcTokenSource = (request: OidcTokenRequest) => Effect.Effect<Redacted.Redacted<string>, ReleaseError>;
export type CredentialExchange = (request: {
    readonly url: string;
    readonly headers: CredentialHeaders;
    readonly body: Uint8Array;
}) => Effect.Effect<HttpResponse, ReleaseError>;
export type TrustedPublisherHost = Readonly<{
    oidc: OidcTokenSource;
    exchange: CredentialExchange;
}>;
export declare const captureTrustedPublisher: (host: TrustedPublisherHost) => TrustedPublisherHost;
export type CredentialRequest = CredentialBinding;
export type ResolveCredentials = (request: CredentialRequest) => Effect.Effect<CredentialHeaders, ReleaseError>;
export interface BoundCredentials {
    readonly binding: CredentialBinding;
    /** Called only after one exact endpoint/principal/scope match. */
    readonly acquire: () => Effect.Effect<CredentialHeaders, ReleaseError>;
}
/** Explicit application composition; no discovery or provider allowlist. */
export declare const makeCredentialResolver: (bindings: readonly BoundCredentials[]) => ResolveCredentials;
export interface HttpTransportOptions {
    readonly credentials: ResolveCredentials;
    readonly providers: readonly HttpProviderDefinition[];
    readonly timeoutMilliseconds: number;
    readonly maximumResponseBytes: number;
    /** Total decrypted HTTP input, including framing, headers and trailers.
     * Defaults to twice the body limit plus64KiB. */
    readonly maximumWireResponseBytes?: number;
}
export type HttpReadOptions = Omit<HttpTransportOptions, "providers">;
export type HttpExchangeOptions = Pick<HttpTransportOptions, "timeoutMilliseconds" | "maximumResponseBytes" | "maximumWireResponseBytes">;
