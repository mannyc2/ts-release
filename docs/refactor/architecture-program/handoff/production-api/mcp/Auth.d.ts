import { Effect, Redacted } from "effect";
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
export declare const authorizeOidc: (input: {
    readonly authorization: Model.OidcAuthorization;
    readonly binding: Readonly<{
        endpoint: string;
        principal: string;
        scope: string;
    }>;
}, host: Readonly<{
    oidc: Http.OidcTokenSource;
    exchange: Http.CredentialExchange;
}>) => Effect.Effect<Readonly<Record<string, string>>, import("@mannyc1/ts-release").ReleaseError, never>;
