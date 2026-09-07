export type {} from "./internal/EffectTypes.js"
import * as Schema from "effect/Schema"
import type * as Effect from "effect/Effect"
import type * as Redacted from "effect/Redacted"
import type { ReleaseError } from "./internal/Error.js"
import type { ProviderDefinition, PreparedRequest, SendResult } from "./Provider.js"
import { RequestFacts } from "./internal/ReleaseModel.js"

/** Native response envelope binds the observed acknowledgement to exact send facts. */
export class HttpReceipt extends Schema.Class<HttpReceipt>("HttpReceipt")({
  status: Schema.Number,
  body: Schema.String,
  endpoint: Schema.String,
  method: Schema.String,
  bodyDigest: Schema.String,
}) {}
export const corresponds = (request: RequestFacts, receipt: unknown): boolean => {
  const value = Schema.decodeUnknownSync(HttpReceipt)(receipt)
  return (
    value.status >= 200 &&
    value.status < 300 &&
    value.endpoint === request.endpoint &&
    value.method === request.method &&
    value.bodyDigest === request.bodyDigest
  )
}

export type Headers = readonly (readonly [string, string])[]
export interface HttpReadRequest {
  readonly method: "GET" | "HEAD"
  readonly url: string
  readonly headers: Headers
  readonly principal: string
  readonly scope: string
}
export interface HttpResponse {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: Uint8Array
}
export type HttpRead = (request: HttpReadRequest) => Effect.Effect<HttpResponse, ReleaseError>
export interface HttpProviderDefinition extends ProviderDefinition {
  /** Exactly one definition must own full request authority before credentials. */
  readonly ownsRequest: (request: PreparedRequest) => boolean
  readonly decodeResponse: (
    request: PreparedRequest,
    response: HttpResponse,
  ) => Effect.Effect<SendResult, ReleaseError>
}
export interface CredentialBinding {
  readonly endpoint: string
  readonly principal: string
  readonly scope: string
}
/** Live secret headers, never durable intent/request/journal fields. */
export type CredentialHeaders = Readonly<Record<string, string>>
export interface OidcTokenRequest {
  readonly issuer: "https://token.actions.githubusercontent.com"
  readonly audience: string
  readonly repository: string
  readonly workflow: string
  readonly workflowRef: string
  readonly expectedClaims: Readonly<Record<string, string>>
}
export type OidcTokenSource = (
  request: OidcTokenRequest,
) => Effect.Effect<Redacted.Redacted<string>, ReleaseError>
export type CredentialExchange = (request: {
  readonly url: string
  readonly headers: CredentialHeaders
  readonly body: Uint8Array
}) => Effect.Effect<HttpResponse, ReleaseError>
export interface TrustedPublisherHost {
  readonly oidc: OidcTokenSource
  readonly exchange: CredentialExchange
}
export type CredentialRequest = CredentialBinding
export type ResolveCredentials = (
  request: CredentialRequest,
) => Effect.Effect<CredentialHeaders, ReleaseError>
export interface HttpTransportOptions {
  readonly credentials: ResolveCredentials
  readonly providers: readonly HttpProviderDefinition[]
  readonly timeoutMilliseconds: number
  readonly maximumResponseBytes: number
}
