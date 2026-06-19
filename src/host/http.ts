import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { HttpHeader, HttpRequestSpec } from "../domain/operation.js"

export type * from "../types/effect-internal.js"

export class HttpError extends Schema.TaggedErrorClass<HttpError>()("HttpError", {
  operation: Schema.String,
  url: Schema.String,
  reason: Schema.String
}) {}

export class HttpResult extends Schema.Class<HttpResult>("HttpResult")({
  request: HttpRequestSpec,
  status: Schema.Number,
  json: Schema.Json,
  responseHeaders: Schema.Array(HttpHeader),
  startedAt: Schema.String,
  endedAt: Schema.String,
  durationMillis: Schema.Number
}) {}

export interface ReleaseHttpShape {
  readonly runJson: (request: HttpRequestSpec) => Effect.Effect<HttpResult, HttpError>
}

export class ReleaseHttp extends Context.Service<ReleaseHttp, ReleaseHttpShape>()("ReleaseHttp") {}

export interface TestHttpResponse {
  readonly status: number
  readonly json: Schema.Json
  readonly responseHeaders?: ReadonlyArray<HttpHeader> | undefined
}

export interface TestReleaseHttpOptions {
  readonly responses?: ReadonlyMap<string, TestHttpResponse> | undefined
  readonly timestamps?: ReadonlyArray<string> | undefined
}

export const httpRequestKey = (request: HttpRequestSpec): string =>
  `${request.method}\u0000${request.url}`

export const makeTestReleaseHttpLayer = (
  options: TestReleaseHttpOptions = {}
): Layer.Layer<ReleaseHttp> => {
  const responses = new Map(options.responses ?? [])
  const timestamps = [...(options.timestamps ?? ["2026-06-16T00:00:00.000Z"])]
  let timestampIndex = 0

  const nextTimestamp = (): string => {
    const value = timestamps[timestampIndex] ?? timestamps[timestamps.length - 1] ?? "2026-06-16T00:00:00.000Z"
    timestampIndex += 1
    return value
  }

  return Layer.succeed(ReleaseHttp)({
    runJson: (request) =>
      Effect.gen(function*() {
        const startedAt = nextTimestamp()
        const response = responses.get(httpRequestKey(request))
        if (response === undefined) {
          return yield* Effect.fail(
            HttpError.make({
              operation: "runJson",
              url: request.url,
              reason: "No test HTTP response configured"
            })
          )
        }
        const endedAt = nextTimestamp()
        return HttpResult.make({
          request,
          status: response.status,
          json: response.json,
          responseHeaders: response.responseHeaders === undefined ? [] : [...response.responseHeaders],
          startedAt,
          endedAt,
          durationMillis: 0
        })
      })
  })
}
