// Invariant: one live adapter resolves request headers and maps each ReleaseHttp request to one platform HTTP exchange.
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { ApiError, ReleaseHttp, type HttpHeader, type HttpRequestSpec, type HttpResult } from "./http.js"
import { endTiming, readEnvironment, startTiming } from "./platform.js"


const resolveHeaders = Effect.fn("resolveHeaders")(function*(request: HttpRequestSpec) {
  const envNames = new Set(request.envHeaders.map((header) => header.valueEnv))
  const env = yield* readEnvironment(envNames)
  const missing = [...envNames].filter((name) => env.get(name) === undefined)
  if (missing.length > 0) {
    return yield* Effect.fail(
      ApiError.make({
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
  Object.entries(headers).map(([name, value]) => ({ name, value }))

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
          ApiError.make({
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
          ApiError.make({
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
            const timing = yield* startTiming()
            const httpRequest = yield* requestWithBody(request, headers, fileSystem)
            const response = yield* client.execute(httpRequest).pipe(
              Effect.mapError((error) =>
                ApiError.make({
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
                  ApiError.make({
                    operation: "json",
                    url: request.url,
                    reason: "HTTP response JSON decoding failed.",
                    cause: error
                  })
                )
              )
            return {
              request,
              status: response.status,
              json,
              responseHeaders: responseHeaders(response.headers),
              ...(yield* endTiming(timing))
            } satisfies HttpResult
          })
      }
    })
  )
