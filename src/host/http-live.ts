import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { HttpRequestSpec } from "../domain/operation.js"
import { ReleaseHost, ReleaseHostShape } from "./host.js"
import { HttpError, HttpResult, ReleaseHttp } from "./http.js"

export type * from "../types/effect-internal.js"

const formatUnknown = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const resolveHeaders = Effect.fn("resolveHeaders")(function*(host: ReleaseHostShape, request: HttpRequestSpec) {
  const envNames = new Set([
    ...request.requiredEnv,
    ...request.envHeaders.map((header) => header.valueEnv)
  ])
  const env = new Map<string, string>()
  const missing: Array<string> = []
  for (const name of envNames) {
    const value = yield* host.readEnv(name)
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

export const LiveReleaseHttpLayer: Layer.Layer<ReleaseHttp, never, ReleaseHost | HttpClient.HttpClient> =
  Layer.effect(ReleaseHttp)(
    Effect.gen(function*() {
      const host = yield* ReleaseHost
      const client = yield* HttpClient.HttpClient
      return {
        runJson: (request: HttpRequestSpec) =>
          Effect.gen(function*() {
            const headers = yield* resolveHeaders(host, request)
            const startedAt = new Date().toISOString()
            const started = performance.now()
            const httpRequest = HttpClientRequest.make(request.method)(request.url, { headers })
            const response = yield* client.execute(httpRequest).pipe(
              Effect.mapError((error) =>
                HttpError.make({
                  operation: "execute",
                  url: request.url,
                  reason: formatUnknown(error)
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
                    reason: formatUnknown(error)
                  })
                )
              )
            const endedAt = new Date().toISOString()
            return HttpResult.make({
              request,
              status: response.status,
              json,
              startedAt,
              endedAt,
              durationMillis: Math.round(performance.now() - started)
            })
          })
      }
    })
  )
