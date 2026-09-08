import * as Effect from "effect/Effect"
import * as Redacted from "effect/Redacted"
import { bearerCredentials, publicUrl, type CredentialBinding } from "@mannyc1/ts-release/http"
import type { CredentialHeaders } from "@mannyc1/ts-release/http"
import { Repository } from "./Model.js"
import { intentOf } from "./Graph.js"
import { readScope } from "./Binding.js"
import { api, attempt, invalid, own } from "./Native.js"
import { nativeRequest } from "./Wire.js"
import { PUBLIC_DOWNLOAD, publicDownload } from "./Observe.js"

/** Repository/API routes are validated before the redacted token is opened.
 * Asset redirect reads have an explicit public principal and receive no token. */
export const authorizeToken = Effect.fn("github.authorizeToken")(function* (input: {
  readonly repository: Repository
  readonly binding: CredentialBinding
  readonly token: Redacted.Redacted<string>
}) {
  return yield* attempt((): CredentialHeaders => {
    const repository = own(Repository, input.repository),
      scope = readScope(input.binding.scope),
      intent = intentOf(scope.operation),
      binding = input.binding
    if (api(repository).toLowerCase() !== api(intent.repository).toLowerCase())
      invalid("credential-repository")
    if (binding.principal === PUBLIC_DOWNLOAD && publicDownload(binding.endpoint))
      return Object.freeze({})
    if (binding.principal !== intent.principal) invalid("credential-principal")
    const url = publicUrl(binding.endpoint) ?? invalid("credential-url"),
      base = api(repository),
      prefix = `${base}/`
    let allowed = false
    try {
      allowed = binding.endpoint === nativeRequest(scope).endpoint
    } catch {
      /* Published parents still permit exact read routes. */
    }
    if (
      url.origin === repository.apiUrl &&
      (url.href.toLowerCase() === base.toLowerCase() ||
        url.href.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase())
    ) {
      const path = url.pathname.slice(new URL(base).pathname.length),
        query = url.search
      allowed ||=
        !query &&
        (path === "" ||
          /^\/git\/tags\/(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(path) ||
          /^\/releases\/(?:assets\/)?[1-9][0-9]*$/u.test(path))
      const tag =
        "tag" in intent
          ? intent.tag
          : scope.parents.flatMap((p) => ("tag" in p.facts ? [p.facts.tag] : []))[0]
      allowed ||=
        !query && typeof tag === "string" && path === `/git/ref/tags/${encodeURIComponent(tag)}`
      allowed ||=
        (path === "/releases" || /^\/releases\/[1-9][0-9]*\/assets$/u.test(path)) &&
        /^\?per_page=100&page=[1-9][0-9]{0,3}$/u.test(query) &&
        Number(url.searchParams.get("page")) <= 1000
    }
    if (!allowed) invalid("credential-route")
    return bearerCredentials(input.token, () => invalid("credential-token"))
  })
})
