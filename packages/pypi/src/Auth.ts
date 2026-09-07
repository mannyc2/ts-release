import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"
import {
  decodeJson,
  type CredentialBinding,
  type CredentialHeaders,
  type TrustedPublisherHost,
} from "@mannyc1/ts-release/http"
import {
  Endpoint,
  TokenAuthorization,
  TrustedAuthorization,
  type PyPi,
  type TestPyPi,
} from "./Model.js"
import { attempt, invalid, own, readScope, encode, object } from "./Native.js"

const token = (value: Redacted.Redacted<string>) => {
  const text = Redacted.value(value)
  if (!text || text.length > 65536 || /[^\x21-\x7e]/u.test(text)) invalid("credential-token")
  return text
}
const basic = (username: string, value: Redacted.Redacted<string>): CredentialHeaders =>
  Object.freeze({
    authorization: `Basic ${Buffer.from(`${username}:${token(value)}`).toString("base64")}`,
  })
const binding = (
  value: CredentialBinding,
  auth: TokenAuthorization | TrustedAuthorization,
  endpoint: Endpoint,
) => {
  const intent = readScope(value.scope)
  if (
    value.principal !== auth.principal ||
    JSON.stringify(intent.authorization) !== JSON.stringify(auth) ||
    JSON.stringify(intent.endpoint) !== JSON.stringify(endpoint) ||
    ![endpoint.uploadUrl, `${endpoint.simpleUrl}${intent.project}/`].includes(value.endpoint)
  )
    invalid("credential-binding")
}
export const authorizeToken = Effect.fn("pypi.authorizeToken")(function* (input: {
  readonly authorization: TokenAuthorization
  readonly endpoint: Endpoint
  readonly binding: CredentialBinding
  readonly token: Redacted.Redacted<string>
}) {
  return yield* attempt(() => {
    const auth = own(TokenAuthorization, input.authorization),
      endpoint = own(Endpoint, input.endpoint)
    binding(input.binding, auth, endpoint)
    return basic(auth.username, input.token)
  })
})
export const authorizeTrusted = Effect.fn("pypi.authorizeTrusted")(function* (
  input: {
    readonly authorization: TrustedAuthorization
    readonly endpoint: PyPi | TestPyPi
    readonly binding: CredentialBinding
  },
  host: TrustedPublisherHost,
) {
  const selected = yield* attempt(() => {
    const auth = own(TrustedAuthorization, input.authorization),
      endpoint = own(Endpoint, input.endpoint)
    binding(input.binding, auth, endpoint)
    if (
      endpoint._tag === "Compatible" ||
      auth.audience !== (endpoint._tag === "PyPi" ? "pypi" : "testpypi")
    )
      invalid("trusted-endpoint")
    return { auth, endpoint, oidc: host.oidc.bind(host), exchange: host.exchange.bind(host) }
  })
  const identity = yield* selected.oidc({
    issuer: selected.auth.issuer,
    audience: selected.auth.audience,
    repository: selected.auth.repository,
    workflow: selected.auth.workflow,
    workflowRef: selected.auth.workflowRef,
    expectedClaims: {},
  })
  const response = yield* selected.exchange({
    url: new URL("/_/oidc/mint-token", selected.endpoint.simpleUrl).href,
    headers: { "content-type": "application/json" },
    body: yield* attempt(() => encode({ token: token(identity) })),
  })
  return yield* attempt(() => {
    if (response.status !== 200 || response.body.length > 128 * 1024) invalid("oidc-response")
    const data = object(decodeJson(response.body))
    if (typeof data.token !== "string") invalid("oidc-token")
    return basic("__token__", Redacted.make(data.token as string))
  })
})
