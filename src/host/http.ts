import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { HttpHeader, HttpRequestSpec } from "../pipeline/operation.js"


export class HttpError extends Schema.TaggedErrorClass<HttpError>()("HttpError", {
  operation: Schema.String,
  url: Schema.String,
  reason: Schema.String,
  cause: Schema.optional(Schema.Defect())
}) {}

export interface HttpResult {
  readonly request: HttpRequestSpec
  readonly status: number
  readonly json: Schema.Json
  readonly responseHeaders: ReadonlyArray<HttpHeader>
  readonly startedAt: string
  readonly endedAt: string
  readonly durationMillis: number
}

export interface ReleaseHttpShape {
  readonly runJson: (request: HttpRequestSpec) => Effect.Effect<HttpResult, HttpError>
}

export class ReleaseHttp extends Context.Service<ReleaseHttp, ReleaseHttpShape>()("ReleaseHttp") {}
