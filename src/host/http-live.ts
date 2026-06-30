import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { HttpHeader, HttpRequestSpec } from "../domain/operation.js"
import { HttpError, HttpResult, ReleaseHttp } from "./http.js"

export type * from "../types/effect-internal.js"

const nowIso = Effect.fn("http.nowIso")(function*() {
  const millis = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  return new Date(millis).toISOString()
})

const readOptionalEnv = (name: string): Effect.Effect<string | undefined> =>
  Config.string(name).pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined)
  )

const resolveHeaders = Effect.fn("resolveHeaders")(function*(request: HttpRequestSpec) {
  const envNames = new Set([
    ...request.requiredEnv,
    ...request.envHeaders.map((header) => header.valueEnv)
  ])
  const env = new Map<string, string>()
  const missing: Array<string> = []
  for (const name of envNames) {
    const value = yield* readOptionalEnv(name)
    if (value === undefined) {
      missing.push(name)
    } else {
      env.set(name, value)
    }
  }
  if (missing.length > 0) {
    return yield* Effect.fail(
      HttpError.make({
        operation: "resolveHeaders",
        url: request.url,
        reason: `Missing required environment variables: ${missing.join(", ")}`
      })
    )
  }

  const headers: Record<string, string> = {}
  for (const header of request.headers) {
    headers[header.name] = header.value
  }
  for (const header of request.envHeaders) {
    const value = env.get(header.valueEnv)
    if (value !== undefined) {
      headers[header.name] = `${header.prefix ?? ""}${value}`
    }
  }
  return headers
})

const responseHeaders = (headers: Readonly<Record<string, string>>): ReadonlyArray<HttpHeader> =>
  Object.entries(headers).map(([name, value]) => HttpHeader.make({ name, value }))

const requestWithBody = Effect.fn("http.requestWithBody")(function*(
  request: HttpRequestSpec,
  headers: Record<string, string>,
  fileSystem: FileSystem.FileSystem
) {
  const httpRequest = HttpClientRequest.make(request.method)(request.url, { headers })
  const body = request.body
  if (body === undefined) {
    return httpRequest
  }
  switch (body._tag) {
    case "HttpJsonRequestBody":
      return yield* HttpClientRequest.bodyJson(httpRequest, body.json).pipe(
        Effect.mapError((error) =>
          HttpError.make({
            operation: "bodyJson",
            url: request.url,
            reason: "HTTP request JSON body encoding failed.",
            cause: error
          })
        )
      )
    case "HttpFileRequestBody":
      return yield* fileSystem.readFile(body.path).pipe(
        Effect.map((bytes) => HttpClientRequest.bodyUint8Array(httpRequest, bytes, body.contentType)),
        Effect.mapError((error) =>
          HttpError.make({
            operation: "bodyFile",
            url: request.url,
            reason: "HTTP request file body preparation failed.",
            cause: error
          })
        )
      )
  }
})

export const LiveReleaseHttpLayer: Layer.Layer<ReleaseHttp, never, HttpClient.HttpClient | FileSystem.FileSystem> =
  Layer.effect(ReleaseHttp)(
    Effect.gen(function*() {
      const client = yield* HttpClient.HttpClient
      const fileSystem = yield* FileSystem.FileSystem
      return {
        runJson: (request: HttpRequestSpec) =>
          Effect.gen(function*() {
            const headers = yield* resolveHeaders(request)
            const startedAt = yield* nowIso()
            const started = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
            const httpRequest = yield* requestWithBody(request, headers, fileSystem)
            const response = yield* client.execute(httpRequest).pipe(
              Effect.mapError((error) =>
                HttpError.make({
                  operation: "execute",
                  url: request.url,
                  reason: "HTTP request failed.",
                  cause: error
                })
              )
            )
            const json = request.method === "HEAD"
              ? null
              : yield* response.json.pipe(
                Effect.mapError((error) =>
                  HttpError.make({
                    operation: "json",
                    url: request.url,
                    reason: "HTTP response JSON decoding failed.",
                    cause: error
                  })
                )
              )
            const endedAt = yield* nowIso()
            const ended = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
            return HttpResult.make({
              request,
              status: response.status,
              json,
              responseHeaders: responseHeaders(response.headers),
              startedAt,
              endedAt,
              durationMillis: Math.max(0, ended - started)
            })
          })
      }
    })
  )
