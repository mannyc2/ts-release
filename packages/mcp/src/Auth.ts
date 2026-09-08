import { Clock, Effect, Redacted, Schema } from "effect"
import * as Http from "@mannyc1/ts-release/http"
import * as Model from "./Model.js"
import { observationUrl, publishUrl, readScope } from "./Protocol.js"

const bearer = (value: Redacted.Redacted<string>): Http.CredentialHeaders =>
  Http.bearerCredentials(value, () => {
    throw Model.failure("mcp-credential", "MCP credential token is invalid")
  })
const admit = (
  binding: Http.CredentialBinding,
  authorization: Model.TokenAuthorization | Model.OidcAuthorization,
) => {
  const selected = readScope(binding.scope)
  if (
    binding.principal !== authorization.principal ||
    Model.canonical(selected.authorization) !== Model.canonical(authorization) ||
    ![publishUrl(selected), observationUrl(selected)].includes(binding.endpoint)
  )
    throw Model.failure("mcp-credential-binding", "MCP credential is not bound to this operation")
  return selected
}

export const authorizeToken = Effect.fn("mcp.authorizeToken")(function* (input: {
  readonly authorization: Model.TokenAuthorization
  readonly binding: Http.CredentialBinding
  readonly token: Redacted.Redacted<string>
}) {
  return yield* Model.attempt("mcp-token-authorization", () => {
    const authorization = Model.own(Model.TokenAuthorization, input.authorization)
    admit(input.binding, authorization)
    return bearer(input.token)
  })
})

const Exchange = Schema.Struct({
  registry_token: Schema.String,
  expires_at: Schema.Int,
})
export const authorizeOidc = Effect.fn("mcp.authorizeOidc")(function* (
  input: {
    readonly authorization: Model.OidcAuthorization
    readonly binding: Http.CredentialBinding
  },
  host: Http.TrustedPublisherHost,
) {
  const selected = yield* Model.attempt("mcp-oidc-authorization", () => {
    const authorization = Model.own(Model.OidcAuthorization, input.authorization),
      operation = admit(input.binding, authorization)
    return {
      authorization,
      operation,
      ...Http.captureTrustedPublisher(host),
    }
  })
  const identity = yield* selected.oidc(Http.oidcRequest(selected.authorization))
  const response = yield* selected.exchange({
    url: `${selected.operation.registry}/v0.1/auth/github-oidc`,
    headers: { accept: "application/json", "content-type": "application/json" },
    body: yield* Model.attempt("mcp-oidc-token", () =>
      new TextEncoder().encode(Model.canonical({ oidc_token: Redacted.value(identity) })),
    ),
  })
  if (response.status !== 200)
    return yield* Model.reject("mcp-oidc-exchange", "MCP Registry rejected the OIDC exchange")
  const value = yield* Model.attempt("mcp-oidc-response", () =>
    Model.own(Exchange, Http.decodeJson(response.body)),
  )
  const now = Math.floor((yield* Clock.currentTimeMillis) / 1000)
  return yield* Model.attempt("mcp-oidc-response", () => {
    if (value.expires_at <= now)
      throw Model.failure("mcp-oidc-response", "MCP Registry returned an expired credential")
    return bearer(Redacted.make(value.registry_token))
  })
})
