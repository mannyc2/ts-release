import * as Effect from "effect/Effect"
import { validateHeaderName, validateHeaderValue } from "node:http"
import type { Client, buildConnector } from "undici"
import type { Socket } from "node:net"
// Undici8's published Client type describes this exact pinned implementation.
// The narrow entry avoids Bun's bare-undici shim and unrelated Web API startup.
// @ts-expect-error Undici does not publish declarations at its internal JS entry.
import NativeClient from "undici/lib/dispatcher/client.js"
// @ts-expect-error Same exact-version adapter for Undici's native TCP/TLS connector.
import nativeConnector from "undici/lib/core/connect.js"
const ClientConstructor: typeof Client = NativeClient
// connect.js returns the pending socket before secureConnect; the public type
// discards that return. Own it so interruption can close an unfinished handshake.
const connect: (
  options: Parameters<typeof buildConnector>[0],
) => (options: buildConnector.Options, callback: buildConnector.Callback) => Socket =
  nativeConnector
import { canonical } from "../internal/Identity.js"
import { ReleaseError, attempt, fail, reject } from "../internal/Error.js"
import { verifyProviderContracts, verifyRequest, type Transport } from "../Provider.js"
import { publicUrl } from "../Http.js"
import type { CredentialExchange, Headers, HttpExchangeOptions } from "../Http.js"
import type { HttpRead, HttpReadOptions, HttpResponse, HttpTransportOptions } from "../Http.js"

const invalid = (code: string): never =>
  fail(`http-${code}`, "HTTP authority or wire value could not be admitted")
const endpoint = (input: string): URL => {
  const url = publicUrl(input, ["http:", "https:"])
  return url?.href === input ? url : invalid("endpoint")
}
const limits = (input: HttpExchangeOptions) => {
  const { timeoutMilliseconds, maximumResponseBytes } = input
  const maximumWireResponseBytes =
    input.maximumWireResponseBytes ?? maximumResponseBytes * 2 + 65536
  if (
    ![timeoutMilliseconds, maximumResponseBytes, maximumWireResponseBytes].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 2_147_483_647,
    )
  )
    invalid("limits")
  return { timeoutMilliseconds, maximumResponseBytes, maximumWireResponseBytes }
}
const headers = (pairs: Headers): Record<string, string> => {
  const output: Record<string, string> = Object.create(null)
  for (const [name, value] of pairs) {
    validateHeaderName(name)
    validateHeaderValue(name, value)
    const key = name.toLowerCase()
    if (
      typeof value !== "string" ||
      key in output ||
      /^(host|content-length|transfer-encoding|connection|upgrade|expect|trailer|te|proxy-authorization)$/u.test(
        key,
      )
    )
      invalid("headers")
    output[key] = value
  }
  return output
}
const authorize = Effect.fn("http.authorize")(function* (
  resolve: HttpReadOptions["credentials"],
  url: URL,
  principal: string,
  scope: string,
  durable: Record<string, string>,
) {
  if (!principal || !scope) return yield* attempt(() => invalid("binding"))
  const secret = yield* Effect.suspend(() =>
    resolve(Object.freeze({ endpoint: url.href, principal, scope })),
  ).pipe(
    Effect.catchCause(() => reject("http-credentials", "HTTP credentials could not be acquired")),
  )
  return yield* attempt(() => {
    const live = headers(Object.entries(secret))
    if (Object.keys(live).length && url.protocol !== "https:") invalid("credential-tls")
    for (const name of Object.keys(live)) if (name in durable) invalid("credential-collision")
    return Object.freeze({ ...durable, ...live })
  })
})

/** One native HTTP/1.1 Client per dispatch, without interceptors, pipelining,
 * redirects, proxy discovery or reusable connections. Undici owns wire framing
 * on both hosts; Bun's node:http shim has already lost duplicate header pairs.
 * The total IO deadline covers DNS/connection/headers/body, not user callbacks. */
const nativeRequest = (options: Required<HttpExchangeOptions>) =>
  Effect.fn("http.nativeRequest")(function* (
    url: URL,
    method: string,
    fields: Readonly<Record<string, string>>,
    body: Uint8Array,
  ) {
    return yield* Effect.callback<HttpResponse, ReleaseError>((resume) => {
      let client: Client | undefined,
        finished = false,
        status = 0,
        length = 0
      let wireBytes = 0
      let connection: Socket | undefined,
        socketClosed = Promise.resolve()
      const connector = connect({
        rejectUnauthorized: true,
        timeout: options.timeoutMilliseconds,
        allowH2: false,
      })
      const chunks: Buffer[] = [],
        responseHeaders: Record<string, string> = Object.create(null)
      const cleanup = async (): Promise<void> => {
        finished = true
        clearTimeout(timer)
        // Client cannot own the connection until secureConnect completes. Also
        // close the pending socket, emitting a fixed error to clear its timer.
        connection?.destroy(new Error("Native HTTP request closed"))
        await Promise.all([socketClosed, client?.destroy().catch(() => {})])
      }
      const complete = (result: Effect.Effect<HttpResponse, ReleaseError>) => {
        if (finished) return
        const closed = cleanup()
        resume(Effect.promise(() => closed).pipe(Effect.andThen(result)))
      }
      const failed = () =>
        complete(reject("http-outcome-unknown", "Native HTTP response was not completely observed"))
      const timer = setTimeout(failed, options.timeoutMilliseconds)
      try {
        client = new ClientConstructor(url.origin, {
          connect: (settings, callback) => {
            connection = connector(settings, (error, socket) => {
              if (error || !socket) {
                callback(error, socket)
                return
              }
              if (finished) {
                socket.destroy(new Error("Native HTTP request closed"))
                callback(new Error("Native HTTP request closed"), null)
                return
              }
              const count = (chunk: Buffer) => {
                wireBytes += chunk.length
                if (wireBytes > options.maximumWireResponseBytes) failed()
              }
              // Registered before Undici's parser: count discarded whitespace and
              // chunk/trailer framing as well as admitted header/body bytes.
              socket.on("data", count)
              socket.once("close", () => socket.off("data", count))
              callback(null, socket)
            })
            socketClosed = new Promise<void>((resolve) =>
              connection!.once("close", () => resolve()),
            )
          },
          pipelining: 0,
          allowH2: false,
          maxHeaderSize: 16 * 1024,
          headersTimeout: options.timeoutMilliseconds,
          bodyTimeout: options.timeoutMilliseconds,
        })
        client.dispatch(
          {
            path: url.pathname + url.search,
            method,
            headers: fields,
            body,
            idempotent: false,
            reset: true,
          },
          {
            onRequestStart() {},
            onRequestUpgrade(_control, _status, _headers, socket) {
              socket.destroy()
              failed()
            },
            onResponseStart(control, code) {
              if (finished) return
              // Interim responses never substitute for the final acknowledgement.
              if (code < 200) return
              status = code
              const raw = control.rawHeaders
              if (
                !Array.isArray(raw) ||
                raw.length % 2 ||
                raw.reduce((bytes, value) => bytes + Buffer.byteLength(value) + 2, 2) > 16 * 1024
              ) {
                failed()
                return
              }
              for (let index = 0; index < raw.length; index += 2) {
                const field = raw[index]!,
                  bytes = raw[index + 1]!
                const name = (
                    typeof field === "string" ? field : field.toString("latin1")
                  ).toLowerCase(),
                  value = typeof bytes === "string" ? bytes : bytes.toString("latin1")
                if (
                  name in responseHeaders &&
                  /^(age|authorization|content-length|content-type|content-disposition|content-encoding|content-range|digest|etag|expires|from|host|if-modified-since|if-unmodified-since|last-modified|location|max-forwards|proxy-authorization|referer|retry-after|server|user-agent)$/u.test(
                    name,
                  )
                ) {
                  failed()
                  return
                }
                responseHeaders[name] =
                  name in responseHeaders ? `${responseHeaders[name]}, ${value}` : value
              }
            },
            onResponseData(_control, chunk) {
              if (finished) return
              length += chunk.length
              if (length > options.maximumResponseBytes) {
                failed()
                return
              }
              chunks.push(Buffer.from(chunk))
            },
            onResponseEnd() {
              if (finished) return
              if (status < 200) {
                failed()
                return
              }
              complete(
                Effect.succeed({
                  status,
                  headers: Object.freeze(responseHeaders),
                  body: new Uint8Array(Buffer.concat(chunks, length)),
                }),
              )
            },
            onResponseError: failed,
          },
        )
      } catch {
        failed()
      }
      return Effect.promise(cleanup)
    })
  })

/** Capture definition methods once; each owner sees its own bytes. Resolving
 * credentials creates no dispatch permission. The kernel still owns fresh CAS. */
export const makeHttpTransport = (options: HttpTransportOptions): Transport => {
  const native = nativeRequest(limits(options)),
    resolve = options.credentials.bind(options)
  verifyProviderContracts(options.providers)
  const providers = options.providers.map((provider) => ({
    ownsRequest: provider.ownsRequest.bind(provider),
    decodeResponse: provider.decodeResponse.bind(provider),
  }))
  const prepare: NonNullable<Transport["prepare"]> = Effect.fn("http.prepare")(function* (input) {
    const request = yield* verifyRequest(input)
    const { url, durable, key } = yield* attempt(() => {
      if (
        request.facts.transport !== "core.http/1" ||
        request.facts.replay._tag !== "None" ||
        !/^(GET|HEAD|PUT|POST|PATCH|DELETE|OPTIONS)$/u.test(request.facts.method)
      )
        invalid("request")
      if (["GET", "HEAD"].includes(request.facts.method) && request.body.length)
        invalid("read-body")
      return {
        url: endpoint(request.facts.endpoint),
        durable: headers(request.facts.headers),
        key: canonical(request.facts),
      }
    })
    const owners: typeof providers = []
    for (const provider of providers) {
      const copy = yield* verifyRequest(request)
      if (yield* attempt(() => provider.ownsRequest(copy) === true)) owners.push(provider)
    }
    if (owners.length !== 1) return yield* attempt(() => invalid("request-owner"))
    const fields = yield* authorize(
      resolve,
      url,
      request.facts.principal,
      request.facts.scope,
      durable,
    )
    return Effect.fn("http.sendPrepared")(function* (actual) {
      const verified = yield* verifyRequest(actual)
      if (canonical(verified.facts) !== key)
        return yield* attempt(() => invalid("prepared-binding"))
      const response = yield* native(url, request.facts.method, fields, request.body)
      return yield* owners[0]!.decodeResponse(request, response)
    })
  })
  return Object.freeze({
    prepare,
    send: Effect.fn("http.send")(function* (request) {
      return yield* (yield* prepare(request))(request)
    }),
  })
}

/** Observation uses the same bounded native reader and exact credential binding. */
export const makeHttpRead = (options: HttpReadOptions): HttpRead => {
  const native = nativeRequest(limits(options)),
    resolve = options.credentials.bind(options)
  return Effect.fn("http.read")(function* (input) {
    const selected = yield* attempt(() => {
      if (input.method !== "GET" && input.method !== "HEAD") invalid("read-method")
      const durable = headers(input.headers)
      if (
        Object.keys(durable).some((name) =>
          /^(authorization|cookie|set-cookie|x-api-key|x-auth-token)$/u.test(name),
        )
      )
        invalid("secret-header")
      return {
        url: endpoint(input.url),
        method: input.method,
        principal: input.principal,
        scope: input.scope,
        durable,
      }
    })
    const fields = yield* authorize(
      resolve,
      selected.url,
      selected.principal,
      selected.scope,
      selected.durable,
    )
    return yield* native(selected.url, selected.method, fields, new Uint8Array())
  })
}

/** Host-only live credential exchange. Response/token bytes are never journaled. */
export const makeCredentialExchange = (options: HttpExchangeOptions): CredentialExchange => {
  const native = nativeRequest(limits(options))
  return Effect.fn("http.exchange")(function* (input) {
    const selected = yield* attempt(() => {
      const url = endpoint(input.url)
      if (url.protocol !== "https:") invalid("credential-tls")
      return {
        url,
        fields: headers(Object.entries(input.headers)),
        body: new Uint8Array(input.body),
      }
    })
    return yield* native(selected.url, "POST", selected.fields, selected.body)
  })
}
