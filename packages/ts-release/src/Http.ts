export { decodeJson } from "./internal/NativeJson.js"
export { canonical, compareText, decodeOwned, sameBytes, sameData } from "./internal/Identity.js"
import { Effect, Predicate, Redacted, Schema } from "effect"
import {
  ReleaseError,
  attempt as coreAttempt,
  fail,
  failure,
  reject,
  isReleaseErrorLike,
} from "./internal/Error.js"
import { canonical, decodeOwned } from "./internal/Identity.js"
import type {
  ProviderDefinition,
  ProviderDescriptor,
  PreparedRequest,
  SendResult,
} from "./Provider.js"
import { Operation, RequestFacts } from "./internal/ReleaseModel.js"

export const makeDataBoundary = (prefix: string, subject: string) => {
  const invalid = (code: string): never =>
    fail(`${prefix}-${code}`, `${subject} ${code.replaceAll("-", " ")} could not be admitted`)
  const tryBody = <A>(body: () => A, code?: string): Effect.Effect<A, ReleaseError> =>
    Effect.suspend(() => {
      try {
        return Effect.succeed(body())
      } catch (cause) {
        if (cause instanceof ReleaseError) return Effect.fail(cause)
        if (isReleaseErrorLike(cause)) return Effect.fail(failure(cause.code, cause.message))
        if (Schema.isSchemaError(cause))
          return reject(
            code ?? `${prefix}-data`,
            `${subject} ${code ? "value" : "data"} could not be admitted`,
          )
        return Effect.die(cause)
      }
    })
  const attempt = <A>(body: () => A) => tryBody(body)
  const admit = <A>(code: string, body: () => A) => tryBody(body, code)
  const matches = (body: () => boolean): boolean => {
    try {
      return body()
    } catch (cause) {
      if (cause instanceof ReleaseError || isReleaseErrorLike(cause) || Schema.isSchemaError(cause))
        return false
      throw cause
    }
  }
  const object = (value: unknown): Record<string, unknown> => {
    if (!Predicate.isObject(value)) return invalid("object")
    return value
  }
  const ownOperation = <A, I>(
    codec: Schema.Codec<A, I>,
    descriptor: Pick<ProviderDescriptor, "definitionId" | "intentVersion">,
    operation: Operation,
  ): A => {
    if (
      operation.definitionId !== descriptor.definitionId ||
      operation.intentVersion !== descriptor.intentVersion
    )
      invalid("operation-definition")
    return decodeOwned(codec, operation.intent)
  }
  const ownRequest = (request: PreparedRequest): PreparedRequest => {
    const facts = decodeOwned(RequestFacts, request.facts),
      input = request.body
    let body: Uint8Array
    try {
      body = new Uint8Array(input)
    } catch {
      return invalid("data")
    }
    return { facts, body }
  }
  return {
    failure,
    invalid,
    reject,
    attempt,
    admit,
    matches,
    object,
    own: decodeOwned,
    ownOperation,
    ownRequest,
  }
}

const secret =
  /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abps]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|npm_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY)/u
export const containsSecret = (value: string | Uint8Array): boolean =>
  secret.test(typeof value === "string" ? value : new TextDecoder().decode(value))
export const isPublicText = (value: string, maximum: number, empty = false): boolean =>
  (empty || value.length > 0) &&
  value === value.normalize("NFC") &&
  value.trim() === value &&
  [...value].length <= maximum &&
  // oxlint-disable-next-line no-control-regex -- Public text must reject literal control characters.
  !/[\u0000-\u001f\u007f]/u.test(value) &&
  !containsSecret(value)
export const PublicText = (maximum: number, empty = false) =>
  Schema.String.check(Schema.makeFilter((value) => isPublicText(value, maximum, empty)))
export const isSafePath = (value: string): boolean =>
  value.length <= 1024 &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  !value.split("/").some((part) => part === "" || part === "." || part === "..")
export const publicUrl = (value: string, protocols: readonly string[] = ["https:"]): URL | null => {
  if (!URL.canParse(value)) return null
  const url = new URL(value)
  return protocols.includes(url.protocol) &&
    !url.username &&
    !url.password &&
    !url.hash &&
    (url.href === value || (url.pathname === "/" && url.origin === value))
    ? url
    : null
}

/** Native response envelope binds the observed acknowledgement to exact send facts. */
export class HttpReceipt extends Schema.Class<HttpReceipt>("HttpReceipt")({
  status: Schema.Finite,
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
export type CredentialBinding = Readonly<{
  endpoint: string
  principal: string
  scope: string
  /** Native readers supply the method; native writes also supply the body digest. */
  method?: string
  bodyDigest?: string
}>
/** Live secret headers, never durable intent/request/journal fields. */
export type CredentialHeaders = Readonly<Record<string, string>>
export const credentialToken = (value: Redacted.Redacted<string>, invalid: () => never): string => {
  const token = Redacted.value(value)
  if (!token || token.length > 65536 || /[^\x21-\x7e]/u.test(token)) invalid()
  return token
}
export const bearerCredentials = (
  value: Redacted.Redacted<string>,
  invalid: () => never,
): CredentialHeaders =>
  Object.freeze({ authorization: `Bearer ${credentialToken(value, invalid)}` })
export interface OidcTokenRequest {
  readonly issuer: "https://token.actions.githubusercontent.com"
  readonly audience: string
  readonly repository: string
  readonly workflow: string
  readonly workflowRef: string
  readonly expectedClaims: Readonly<Record<string, string>>
}
export type OidcAuthorization = Omit<OidcTokenRequest, "expectedClaims">
export const oidcRequest = (
  authorization: OidcAuthorization,
  expectedClaims: Readonly<Record<string, string>> = {},
): OidcTokenRequest => {
  const { issuer, audience, repository, workflow, workflowRef } = authorization
  return Object.freeze({ issuer, audience, repository, workflow, workflowRef, expectedClaims })
}
export type OidcTokenSource = (
  request: OidcTokenRequest,
) => Effect.Effect<Redacted.Redacted<string>, ReleaseError>
export type CredentialExchange = (request: {
  readonly url: string
  readonly headers: CredentialHeaders
  readonly body: Uint8Array
}) => Effect.Effect<HttpResponse, ReleaseError>
export type TrustedPublisherHost = Readonly<{ oidc: OidcTokenSource; exchange: CredentialExchange }>
export const captureTrustedPublisher = (host: TrustedPublisherHost): TrustedPublisherHost =>
  Object.freeze({ oidc: host.oidc.bind(host), exchange: host.exchange.bind(host) })
export type CredentialRequest = CredentialBinding
export type ResolveCredentials = (
  request: CredentialRequest,
) => Effect.Effect<CredentialHeaders, ReleaseError>
export interface BoundCredentials {
  readonly binding: CredentialBinding
  /** Called only after one exact endpoint/principal/scope match. */
  // Public callback compatibility includes receiver capture; do not replace with an eager property read.
  // @effect-diagnostics-next-line lazyEffect:off
  readonly acquire: () => Effect.Effect<CredentialHeaders, ReleaseError>
}
/** Explicit application composition; no discovery or provider allowlist. */
export const makeCredentialResolver = (
  bindings: readonly BoundCredentials[],
): ResolveCredentials => {
  const key = (binding: CredentialBinding) => {
    const { endpoint, principal, scope } = binding
    if (publicUrl(endpoint, ["https:", "http:"])?.href !== endpoint || !principal || !scope)
      fail("credential-binding", "Credential binding must identify an exact public HTTP authority")
    return canonical({ endpoint, principal, scope })
  }
  const entries = new Map(bindings.map((entry) => [key(entry.binding), entry.acquire.bind(entry)]))
  if (entries.size !== bindings.length)
    fail("credential-binding", "Credential authority is registered twice")
  return Effect.fn("http.resolveCredentials")((request) =>
    coreAttempt(
      () =>
        entries.get(key(request)) ??
        fail("credential-binding", "No exact credential authority is registered"),
    ).pipe(Effect.flatMap((acquire) => acquire())),
  )
}
export interface HttpTransportOptions {
  readonly credentials: ResolveCredentials
  readonly providers: readonly HttpProviderDefinition[]
  readonly timeoutMilliseconds: number
  readonly maximumResponseBytes: number
  /** Total decrypted HTTP input, including framing, headers and trailers.
   * Defaults to twice the body limit plus64KiB. */
  readonly maximumWireResponseBytes?: number
}
export type HttpReadOptions = Omit<HttpTransportOptions, "providers">
export type HttpExchangeOptions = Pick<
  HttpTransportOptions,
  "timeoutMilliseconds" | "maximumResponseBytes" | "maximumWireResponseBytes"
>
