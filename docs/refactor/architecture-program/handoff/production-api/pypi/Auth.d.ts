import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { type CredentialBinding, type TrustedPublisherHost } from "@mannyc1/ts-release/http";
import { Endpoint, TokenAuthorization, TrustedAuthorization, type PyPi, type TestPyPi } from "./Model.js";
export declare const authorizeToken: (input: {
    readonly authorization: TokenAuthorization;
    readonly endpoint: Endpoint;
    readonly binding: CredentialBinding;
    readonly token: Redacted.Redacted<string>;
}) => Effect.Effect<Readonly<Record<string, string>>, import("@mannyc1/ts-release").ReleaseError, never>;
export declare const authorizeTrusted: (input: {
    readonly authorization: TrustedAuthorization;
    readonly endpoint: PyPi | TestPyPi;
    readonly binding: CredentialBinding;
}, host: TrustedPublisherHost) => Effect.Effect<Readonly<Record<string, string>>, import("@mannyc1/ts-release").ReleaseError, never>;
