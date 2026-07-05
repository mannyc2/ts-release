import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { HttpHeader, HttpRequestSpec } from "../pipeline/operation.js"


export class HttpError extends Schema.TaggedErrorClass<HttpError>()("HttpError", {
  operation: Schema.String,
  url: Schema.String,
  reason: Schema.String,
  cause: Schema.optionalKey(Schema.Defect())
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
