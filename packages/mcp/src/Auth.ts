import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { ReleaseError } from "@mannyc1/ts-release"
import {
  decodeJson,
  type CredentialBinding,
  type CredentialHeaders,
  type TrustedPublisherHost,
} from "@mannyc1/ts-release/http"
import {
  OidcAuthorization,
  TokenAuthorization,
  attempt,
  canonical,
  own,
} from "./Model.js"
import { observationUrl, publishUrl, readScope } from "./Protocol.js"

const bearer = (value: Redacted.Redacted<string>): CredentialHeaders => {
  const token = Redacted.value(value)
  if (!token || token.length > 65536 || /[^\x21-\x7e]/u.test(token))
    throw new ReleaseError({ code: "mcp-credential", message: "MCP credential token is invalid" })
  return Object.freeze({ authorization: `Bearer ${token}` })
}
const admit = (
  binding: CredentialBinding,
  authorization: TokenAuthorization | OidcAuthorization,
) => {
  const selected = readScope(binding.scope)
  if (
    binding.principal !== authorization.principal ||
    canonical(selected.authorization) !== canonical(authorization) ||
    ![publishUrl(selected), observationUrl(selected)].includes(binding.endpoint)
  )
    throw new ReleaseError({
      code: "mcp-credential-binding",
      message: "MCP credential is not bound to this registry operation",
    })
  return selected
}

export const authorizeToken = Effect.fn("mcp.authorizeToken")(function* (input: {
  readonly authorization: TokenAuthorization
  readonly binding: CredentialBinding
  readonly token: Redacted.Redacted<string>
}) {
  return yield* attempt("mcp-token-authorization", () => {
    const authorization = own(TokenAuthorization, input.authorization)
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
    readonly authorization: OidcAuthorization
    readonly binding: CredentialBinding
  },
  host: TrustedPublisherHost,
) {
  const selected = yield* attempt("mcp-oidc-authorization", () => {
    const authorization = own(OidcAuthorization, input.authorization), operation = admit(input.binding, authorization)
    return {
      authorization,
      operation,
      oidc: host.oidc.bind(host),
      exchange: host.exchange.bind(host),
    }
  })
  const identity = yield* selected.oidc({
    issuer: selected.authorization.issuer,
    audience: selected.authorization.audience,
    repository: selected.authorization.repository,
    workflow: selected.authorization.workflow,
    workflowRef: selected.authorization.workflowRef,
    expectedClaims: {},
  })
  const response = yield* selected.exchange({
    url: `${selected.operation.registry}/v0.1/auth/github-oidc`,
    headers: { accept: "application/json", "content-type": "application/json" },
    body: yield* attempt("mcp-oidc-token", () =>
      new TextEncoder().encode(canonical({ oidc_token: Redacted.value(identity) })),
    ),
  })
  if (response.status !== 200)
    return yield* new ReleaseError({
      code: "mcp-oidc-exchange",
      message: "MCP Registry rejected the GitHub OIDC exchange",
    })
  const value = yield* attempt("mcp-oidc-response", () =>
    Schema.decodeUnknownSync(Exchange, { onExcessProperty: "error" })(decodeJson(response.body)),
  )
  const now = Math.floor((yield* Clock.currentTimeMillis) / 1000)
  return yield* attempt("mcp-oidc-response", () => {
    if (value.expires_at <= now)
      throw new ReleaseError({
        code: "mcp-oidc-response",
        message: "MCP Registry returned an expired credential",
      })
    return bearer(Redacted.make(value.registry_token))
  })
})
