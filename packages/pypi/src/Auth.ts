import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"
import * as Http from "@mannyc1/ts-release/http"
import { Endpoint, TokenAuthorization, TrustedAuthorization } from "./Model.js"
import type { PyPi, TestPyPi } from "./Model.js"
import { attempt, invalid, own, readScope, encode, object } from "./Native.js"

const token = (value: Redacted.Redacted<string>) =>
  Http.credentialToken(value, () => invalid("credential-token"))
const basic = (username: string, value: Redacted.Redacted<string>): Http.CredentialHeaders =>
  Object.freeze({
    authorization: `Basic ${Buffer.from(`${username}:${token(value)}`).toString("base64")}`,
  })
const binding = (
  value: Http.CredentialBinding,
  auth: TokenAuthorization | TrustedAuthorization,
  endpoint: Endpoint,
) => {
  const intent = readScope(value.scope)
  if (
    value.principal !== auth.principal ||
    !Http.sameData(intent.authorization, auth) ||
    !Http.sameData(intent.endpoint, endpoint) ||
    ![endpoint.uploadUrl, `${endpoint.simpleUrl}${intent.project}/`].includes(value.endpoint)
  )
    invalid("credential-binding")
}
export const authorizeToken = Effect.fn("pypi.authorizeToken")(function* (input: {
  readonly authorization: TokenAuthorization
  readonly endpoint: Endpoint
  readonly binding: Http.CredentialBinding
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
    readonly binding: Http.CredentialBinding
  },
  host: Http.TrustedPublisherHost,
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
    return { auth, endpoint, ...Http.captureTrustedPublisher(host) }
  })
  const identity = yield* selected.oidc(Http.oidcRequest(selected.auth))
  const response = yield* selected.exchange({
    url: new URL("/_/oidc/mint-token", selected.endpoint.simpleUrl).href,
    headers: { "content-type": "application/json" },
    body: yield* attempt(() => encode({ token: token(identity) })),
  })
  return yield* attempt(() => {
    if (response.status !== 200 || response.body.length > 128 * 1024) invalid("oidc-response")
    const data = object(Http.decodeJson(response.body))
    if (typeof data.token !== "string") invalid("oidc-token")
    return basic("__token__", Redacted.make(data.token as string))
  })
})
