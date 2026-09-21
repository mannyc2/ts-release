import { readFile } from "node:fs/promises"
import { Effect, Redacted } from "effect"
import type { Operation, PreparedRequest, ReleaseError, RequestFacts } from "@mannyc1/ts-release"
import * as Http from "@mannyc1/ts-release/http"
import { makeHttpRead } from "@mannyc1/ts-release/node"
import * as Model from "./Model.js"
import * as Native from "./Native.js"
import * as Evidence from "./Evidence.js"
import { authorizeToken } from "./Auth.js"

/** Ephemeral host data. Neither URL is a release artifact or journal evidence. */
export interface AuthenticationChallenge {
  readonly request: RequestFacts
  readonly authUrl: Redacted.Redacted<string>
  readonly doneUrl: Redacted.Redacted<string>
}
const challengeUrl = (input: unknown, origin: string): string => {
  if (typeof input !== "string" || input.length > 4096) return Native.invalid("authentication-url")
  const url = Http.publicUrl(input)
  if (!url || url.origin !== origin || url.pathname === "/")
    return Native.invalid("authentication-url")
  return url.href
}
/** Only an exact native 401/OTP response can supply a browser challenge. */
export const authenticationChallenge = (
  request: PreparedRequest,
  response: Http.HttpResponse,
): AuthenticationChallenge | undefined => {
  try {
    if (!Evidence.isAuthenticationRejection(response) || response.body.length > 65536)
      return undefined
    const owned = Native.ownRequest(request),
      scope = Native.readScope(owned.facts.scope)
    if (
      scope.intent.authorization._tag !== "TokenAuthorization" ||
      !Evidence.ownsRequest(scope.definitionId, owned)
    )
      return undefined
    const body = Native.object(Native.parseJson(response.body))
    const authUrl = challengeUrl(body.authUrl, "https://www.npmjs.com")
    const doneUrl = challengeUrl(body.doneUrl, "https://registry.npmjs.org")
    return Object.freeze({
      request: owned.facts,
      authUrl: Redacted.make(authUrl),
      doneUrl: Redacted.make(doneUrl),
    })
  } catch {
    return undefined
  }
}
export interface LocalAuthenticationOptions {
  readonly authorization: Model.TokenAuthorization
  /** Explicit npm user config containing one literal npmjs-scoped _authToken. */
  readonly configFile: string
  readonly notify: (url: Redacted.Redacted<string>) => Effect.Effect<void, ReleaseError>
  readonly timeoutMilliseconds?: number
}
export interface LocalAuthentication {
  readonly credentials: Http.ResolveCredentials
  readonly capture: (request: PreparedRequest, response: Http.HttpResponse) => void
  /** Call only after the kernel has durably recorded this operation as Rejected.
   * This authenticates only; the caller must re-enter the kernel for another send. */
  readonly complete: (operation: Operation) => Effect.Effect<boolean, ReleaseError>
}
const eraseChallenge = (challenge: AuthenticationChallenge) => {
  Redacted.wipeUnsafe(challenge.authUrl)
  Redacted.wipeUnsafe(challenge.doneUrl)
}
const keyFor = (binding: Http.CredentialBinding): string => {
  if (
    binding.method !== "PUT" ||
    !binding.bodyDigest ||
    !/^[a-f0-9]{64}$/u.test(binding.bodyDigest)
  )
    return Native.invalid("authentication-write-binding")
  const scope = Native.readScope(binding.scope)
  if (binding.endpoint !== Native.endpointFor(scope))
    return Native.invalid("authentication-write-binding")
  return JSON.stringify({
    endpoint: binding.endpoint,
    principal: binding.principal,
    scope: binding.scope,
    method: binding.method,
    bodyDigest: binding.bodyDigest,
  })
}
const configToken = (contents: string): Redacted.Redacted<string> => {
  if (Buffer.byteLength(contents) > 65536) return Native.invalid("local-authentication-config")
  const values = contents
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .flatMap((line) => {
      const match = /^[ \t]*\/\/registry\.npmjs\.org\/:_authToken[ \t]*=[ \t]*(.*?)[ \t]*$/u.exec(
        line,
      )
      return match ? [match[1]!] : []
    })
  if (values.length !== 1 || /["'\s]|\$\{/u.test(values[0]!))
    return Native.invalid("local-authentication-config")
  const token = Redacted.make(values[0]!)
  Http.credentialToken(token, () => Native.invalid("local-authentication-config"))
  return token
}
interface LocalAuthenticationHost {
  readonly readConfig: (file: string) => Effect.Effect<string, ReleaseError>
  readonly read: (token: Redacted.Redacted<string>) => Http.HttpRead
}
/** Host seam used by deterministic qualification; the public factory uses native IO. */
export const makeLocalAuthenticationWith = Effect.fn("npm.makeLocalAuthentication")(function* (
  input: LocalAuthenticationOptions,
  host: LocalAuthenticationHost,
) {
  const selected = yield* Native.attempt(() => {
    const timeoutMilliseconds = input.timeoutMilliseconds ?? 300000
    if (
      !Number.isSafeInteger(timeoutMilliseconds) ||
      timeoutMilliseconds <= 0 ||
      timeoutMilliseconds > 600000 ||
      typeof input.configFile !== "string" ||
      !input.configFile ||
      input.configFile.includes("\0")
    )
      Native.invalid("local-authentication-options")
    return {
      authorization: Native.own(Model.TokenAuthorization, input.authorization),
      configFile: input.configFile,
      notify: input.notify.bind(input),
      timeoutMilliseconds,
      readConfig: host.readConfig.bind(host),
      read: host.read.bind(host),
    }
  })
  const contents = yield* selected.readConfig(selected.configFile)
  const token = yield* Native.attempt(() => configToken(contents))
  const challenges = new Map<string, AuthenticationChallenge>()
  const passwords = new Map<string, Redacted.Redacted<string>>()
  let closed = false
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      closed = true
      Redacted.wipeUnsafe(token)
      for (const challenge of challenges.values()) eraseChallenge(challenge)
      for (const password of passwords.values()) Redacted.wipeUnsafe(password)
      challenges.clear()
      passwords.clear()
    }),
  )
  const credentials: Http.ResolveCredentials = Effect.fn("npm.localCredentials")(
    function* (binding) {
      const owned = yield* Native.attempt(() => {
        if (closed) Native.invalid("authentication-session-closed")
        const scope = Native.readScope(binding.scope)
        if (
          binding.principal !== selected.authorization.principal ||
          !Http.sameData(scope.intent.authorization, selected.authorization) ||
          ![Native.endpointFor(scope), Native.endpointFor(scope, true)].includes(binding.endpoint)
        )
          Native.invalid("credential-binding")
        if (binding.method === "GET" || binding.method === "HEAD") return null
        return keyFor(binding)
      })
      if (owned === null) return {}
      const headers = yield* authorizeToken({
        authorization: selected.authorization,
        binding,
        token,
      })
      return yield* Native.attempt(() => {
        const password = passwords.get(owned)
        passwords.delete(owned)
        const otp =
          password && Http.credentialToken(password, () => Native.invalid("authentication-token"))
        if (password) Redacted.wipeUnsafe(password)
        return Object.freeze({ ...headers, "npm-auth-type": "web", ...(otp && { "npm-otp": otp }) })
      })
    },
  )
  const capture = (request: PreparedRequest, response: Http.HttpResponse): void => {
    if (closed) return
    const challenge = authenticationChallenge(request, response)
    if (!challenge) return
    if (
      !Http.sameData(
        Native.readScope(challenge.request.scope).intent.authorization,
        selected.authorization,
      )
    ) {
      eraseChallenge(challenge)
      return
    }
    const key = keyFor(challenge.request),
      previous = challenges.get(key),
      password = passwords.get(key)
    if (previous) eraseChallenge(previous)
    if (password) Redacted.wipeUnsafe(password)
    passwords.delete(key)
    if (challenges.size >= 128 && !previous) {
      eraseChallenge(challenge)
      return
    }
    challenges.set(key, challenge)
  }
  const complete: LocalAuthentication["complete"] = Effect.fn("npm.completeAuthentication")(
    function* (operation) {
      if (closed)
        return yield* Native.reject(
          "authentication-session-closed",
          "npm authentication session is closed",
        )
      const found = yield* Native.attempt(() =>
        Array.from(challenges.entries()).find(([, value]) =>
          Evidence.requestMatches(operation, value.request),
        ),
      )
      if (!found) return false
      const [key, challenge] = found
      challenges.delete(key)
      const authenticate = Effect.gen(function* () {
        yield* selected
          .notify(challenge.authUrl)
          .pipe(
            Effect.mapError(() =>
              Native.failure(
                "authentication-notification",
                "npm authentication could not be presented",
              ),
            ),
          )
        const read = selected.read(token)
        while (true) {
          const response = yield* read({
            url: Redacted.value(challenge.doneUrl),
            method: "GET",
            headers: [],
            principal: "npm-local-authentication",
            scope: "npm-browser-otp",
          })
          if (response.body.length > 65536)
            return yield* Native.reject(
              "authentication-response",
              "npm authentication response exceeded its bound",
            )
          if (response.status === 200) {
            const password = yield* Native.attempt(() => {
              const value = Native.object(Native.parseJson(response.body)).token
              if (typeof value !== "string") return Native.invalid("authentication-token")
              const password = Redacted.make(value)
              Http.credentialToken(password, () => Native.invalid("authentication-token"))
              return password
            })
            if (closed) {
              Redacted.wipeUnsafe(password)
              return false
            }
            const previous = passwords.get(key)
            if (previous) Redacted.wipeUnsafe(previous)
            passwords.set(key, password)
            return true
          }
          if (response.status !== 202)
            return yield* Native.reject(
              "authentication-response",
              "npm authentication was not completed",
            )
          const delay = yield* Native.attempt(() => {
            const raw = response.headers["retry-after"]
            if (raw === undefined) return 1000
            if (!/^[1-9][0-9]{0,2}$/u.test(raw) || Number(raw) > 60)
              return Native.invalid("authentication-retry-after")
            return Number(raw) * 1000
          })
          yield* Effect.sleep(delay)
        }
      })
      return yield* authenticate.pipe(
        Effect.timeoutOrElse({
          duration: selected.timeoutMilliseconds,
          orElse: () =>
            Native.reject(
              "authentication-timeout",
              "npm authentication timed out; rerun to request a fresh challenge",
            ),
        }),
        Effect.ensuring(Effect.sync(() => eraseChallenge(challenge))),
      )
    },
  )
  return Object.freeze({ credentials, capture, complete }) satisfies LocalAuthentication
})

export const makeLocalAuthentication = (input: LocalAuthenticationOptions) =>
  makeLocalAuthenticationWith(input, {
    readConfig: (file) =>
      Effect.tryPromise({
        try: (signal) => readFile(file, { encoding: "utf8", signal }),
        catch: () =>
          Native.failure(
            "local-authentication-config",
            "Explicit npm user configuration could not be read",
          ),
      }),
    read: (token) =>
      makeHttpRead({
        timeoutMilliseconds: 15000,
        maximumResponseBytes: 65536,
        credentials: (binding) =>
          Native.attempt(() => {
            if (
              binding.method !== "GET" ||
              binding.principal !== "npm-local-authentication" ||
              binding.scope !== "npm-browser-otp"
            )
              Native.invalid("authentication-poll-binding")
            challengeUrl(binding.endpoint, "https://registry.npmjs.org")
            return Http.bearerCredentials(token, () => Native.invalid("credential-token"))
          }),
      }),
  })
