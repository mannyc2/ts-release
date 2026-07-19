import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
export type HttpMethod = "GET" | "HEAD" | "POST" | "PATCH"
export interface HttpHeader { readonly name: string; readonly value: string }
export interface HttpEnvHeader {
  readonly name: string
  readonly valueEnv: string
  readonly prefix?: string | undefined
}
export type HttpRequestBody =
  | { readonly _tag: "HttpJsonRequestBody"; readonly json: Schema.Json }
  | { readonly _tag: "HttpFileRequestBody"; readonly path: string; readonly contentType: string }
export interface HttpRequestSpec {
  readonly method: HttpMethod
  readonly url: string
  readonly headers: ReadonlyArray<HttpHeader>
  readonly envHeaders: ReadonlyArray<HttpEnvHeader>
  readonly body?: HttpRequestBody | undefined
}

export class ApiError extends Schema.TaggedErrorClass<ApiError>()("GitHubApiError", {
  operation: Schema.String,
  url: Schema.String,
  reason: Schema.String,
  status: Schema.optionalKey(Schema.Number),
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
  readonly runJson: (request: HttpRequestSpec) => Effect.Effect<HttpResult, ApiError>
}

export class ReleaseHttp extends Context.Service<ReleaseHttp, ReleaseHttpShape>()("ReleaseHttp") {}
