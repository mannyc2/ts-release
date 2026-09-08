import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Http from "@mannyc1/ts-release/http";
import { Endpoint, TokenAuthorization, TrustedAuthorization } from "./Model.js";
import type { PyPi, TestPyPi } from "./Model.js";
export declare const authorizeToken: (input: {
    readonly authorization: TokenAuthorization;
    readonly endpoint: Endpoint;
    readonly binding: Readonly<{
        endpoint: string;
        principal: string;
        scope: string;
    }>;
    readonly token: Redacted.Redacted<string>;
}) => Effect.Effect<Readonly<Record<string, string>>, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const authorizeTrusted: (input: {
    readonly authorization: TrustedAuthorization;
    readonly endpoint: PyPi | TestPyPi;
    readonly binding: Readonly<{
        endpoint: string;
        principal: string;
        scope: string;
    }>;
}, host: Readonly<{
    oidc: Http.OidcTokenSource;
    exchange: Http.CredentialExchange;
}>) => Effect.Effect<Readonly<Record<string, string>>, import("@mannyc1/ts-release").ReleaseError, never>;
