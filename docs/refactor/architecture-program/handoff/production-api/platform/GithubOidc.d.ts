import type { HttpExchangeOptions, OidcTokenRequest, OidcTokenSource, TrustedPublisherHost } from "../Http.js";
/** RS256 verification against issuer-owned JWKS, exact claims and native time.
 * Exposed only inside the host module for native cryptographic conformance. */
export declare const verifyGithubToken: (token: string, jwks: unknown, input: OidcTokenRequest, now: number) => void;
/** GitHub-hosted Actions default. Config layers supply environment at the host
 * boundary. Validate public host facts before reading either OIDC secret value;
 * reacquire and verify a token per call. Cloud exchanges still enforce their own
 * trusted-publisher policy. No token or raw credential response enters history. */
export declare const makeGithubOidcTokenSource: (options: HttpExchangeOptions) => OidcTokenSource;
export declare const makeGithubTrustedPublisherHost: (options: HttpExchangeOptions) => TrustedPublisherHost;
