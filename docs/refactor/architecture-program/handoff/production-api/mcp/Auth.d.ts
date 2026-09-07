import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { ReleaseError } from "@mannyc1/ts-release";
import { type CredentialBinding, type TrustedPublisherHost } from "@mannyc1/ts-release/http";
import { OidcAuthorization, TokenAuthorization } from "./Model.js";
export declare const authorizeToken: (input: {
    readonly authorization: TokenAuthorization;
    readonly binding: CredentialBinding;
    readonly token: Redacted.Redacted<string>;
}) => Effect.Effect<Readonly<Record<string, string>>, ReleaseError, never>;
export declare const authorizeOidc: (input: {
    readonly authorization: OidcAuthorization;
    readonly binding: CredentialBinding;
}, host: TrustedPublisherHost) => Effect.Effect<Readonly<Record<string, string>>, ReleaseError, never>;
