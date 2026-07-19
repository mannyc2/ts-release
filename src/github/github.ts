// Invariant: every GitHub URL is repository-bound, every response is Schema-decoded, and pagination alone uses whileLoop.
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import {
  ReleaseHttp,
  ApiError,
  type HttpHeader,
  type HttpRequestBody,
  type HttpRequestSpec,
  type HttpResult,
  type ReleaseHttpShape
} from "../host/http.js"
import {
  type GitHubReleaseCreateAction,
  type GitHubReleaseAssetSpec
} from "../grammar/operation.js"

export class GitHubReleaseApiAssetResponse extends Schema.Class<GitHubReleaseApiAssetResponse>(
  "GitHubReleaseApiAssetResponse"
)({ id: Schema.Number, name: Schema.String, state: Schema.optionalKey(Schema.String) }) {}
export class GitHubReleaseApiResponse extends Schema.Class<GitHubReleaseApiResponse>(
  "GitHubReleaseApiResponse"
)({
  id: Schema.Number,
  tag_name: Schema.String,
  name: Schema.String,
  draft: Schema.Boolean,
  prerelease: Schema.Boolean,
  upload_url: Schema.String,
  assets: Schema.Array(GitHubReleaseApiAssetResponse)
}) {}

interface InspectRequest {
  readonly repository: string
  readonly tokenEnv?: string | undefined
  readonly tag: string
}
export interface GitHubApiShape {
  readonly createRelease: (
    request: GitHubReleaseCreateAction
  ) => Effect.Effect<GitHubReleaseApiResponse, ApiError>
  readonly inspectRelease: (
    request: InspectRequest
  ) => Effect.Effect<GitHubReleaseApiResponse, ApiError>
}
export class GitHubApi extends Context.Service<GitHubApi, GitHubApiShape>()("GitHubApi") {}

interface Coordinates { readonly owner: string; readonly repo: string }
const apiError = (
  operation: string,
  url: string,
  reason: string,
  fields: { readonly status?: number; readonly cause?: unknown } = {}
): ApiError => ApiError.make({ operation, url, reason, ...fields })

const coordinates = (repository: string): Effect.Effect<Coordinates, ApiError> => {
  const [owner, repo, extra] = repository.split("/")
  return owner !== undefined && owner.length > 0 && repo !== undefined && repo.length > 0 && extra === undefined
    ? Effect.succeed({ owner, repo })
    : Effect.fail(apiError("parseRepository", repository, "GitHub repository must use owner/repo syntax."))
}
const repositoryPath = (value: Coordinates): string =>
  encodeURIComponent(value.owner) + "/" + encodeURIComponent(value.repo)
const apiUrl = (value: Coordinates, path: string): string =>
  "https://api.github.com/repos/" + repositoryPath(value) + path
const releasesUrl = (value: Coordinates): string => apiUrl(value, "/releases")
const releaseByTagUrl = (value: Coordinates, tag: string): string =>
  apiUrl(value, "/releases/tags/" + encodeURIComponent(tag))

const apiHeaders = [
  { name: "Accept", value: "application/vnd.github+json" },
  { name: "X-GitHub-Api-Version", value: "2022-11-28" }
] satisfies ReadonlyArray<HttpHeader>
const request = (input: {
  readonly method: "GET" | "POST" | "PATCH"
  readonly url: string
  readonly tokenEnv?: string | undefined
  readonly body?: HttpRequestBody | undefined
}): HttpRequestSpec => {
  return {
    method: input.method,
    url: input.url,
    headers: apiHeaders,
    envHeaders: input.tokenEnv === undefined ? [] : [
      { name: "Authorization", valueEnv: input.tokenEnv, prefix: "Bearer " }
    ],
    ...(input.body === undefined ? {} : { body: input.body })
  }
}

const run = (
  http: ReleaseHttpShape,
  operation: string,
  specification: HttpRequestSpec
): Effect.Effect<HttpResult, ApiError> => http.runJson(specification).pipe(
  Effect.mapError((error) => apiError(operation, error.url, error.reason, { cause: error }))
)
const successful = (operation: string, result: HttpResult): Effect.Effect<HttpResult, ApiError> =>
  result.status >= 200 && result.status < 300
    ? Effect.succeed(result)
    : Effect.fail(apiError(
      operation, result.request.url, "GitHub API returned HTTP " + result.status + ".", { status: result.status }
    ))
const decode = <S extends Schema.Top>(
  schema: S,
  what: string,
  operation: string,
  result: HttpResult
): Effect.Effect<S["Type"], ApiError, S["DecodingServices"]> => Schema.decodeUnknownEffect(schema)(result.json).pipe(
  Effect.mapError((cause) => apiError(
    operation,
    result.request.url,
    "GitHub " + what + " response did not match the expected schema.",
    { status: result.status, cause }
  ))
)

const validateUrl = (
  operation: string,
  original: string,
  candidate: string,
  hostname: "api.github.com" | "uploads.github.com",
  invalidReason: string,
  endpointReason: string,
  validPath: (path: string) => boolean
): Effect.Effect<URL, ApiError> => Effect.try({
  try: () => new URL(candidate),
  catch: (cause) => apiError(operation, original, invalidReason, { cause })
}).pipe(Effect.flatMap((parsed) =>
  parsed.protocol === "https:" && parsed.hostname === hostname && validPath(parsed.pathname)
    ? Effect.succeed(parsed)
    : Effect.fail(apiError(operation, original, endpointReason))
))

const nextUrl = (
  value: Coordinates,
  result: HttpResult
): Effect.Effect<string | undefined, ApiError> => {
  const link = result.responseHeaders.find(({ name }) => name.toLowerCase() === "link")?.value
  const next = link?.split(",").map((part) => part.trim()).find((part) => part.includes("rel=\"next\""))
  if (next === undefined) return Effect.succeed(undefined)
  const start = next.indexOf("<")
  const end = next.indexOf(">")
  if (start < 0 || end <= start + 1) return Effect.fail(apiError(
    "nextReleaseListUrl", result.request.url, "GitHub pagination Link header has an invalid next URL."
  ))
  const candidate = next.slice(start + 1, end)
  return validateUrl(
    "validateReleaseListUrl",
    candidate,
    candidate,
    "api.github.com",
    "GitHub pagination URL is not valid.",
    "GitHub pagination URL does not point to the expected releases endpoint.",
    (path) => path === "/repos/" + repositoryPath(value) + "/releases"
  ).pipe(Effect.map(String))
}

const inspectByList = Effect.fn("githubApi.inspectByList")(function*(
  http: ReleaseHttpShape,
  value: Coordinates,
  input: InspectRequest
) {
  let next: string | undefined = releasesUrl(value) + "?per_page=100"
  let match: GitHubReleaseApiResponse | undefined
  yield* Effect.whileLoop({
    while: () => next !== undefined && match === undefined,
    body: () => Effect.gen(function*() {
      const result = yield* run(http, "inspectRelease", request({
        method: "GET", url: next!, tokenEnv: input.tokenEnv
      })).pipe(Effect.flatMap((result) => successful("inspectRelease", result)))
      const releases = yield* decode(
        Schema.Array(GitHubReleaseApiResponse), "release list", "inspectRelease", result
      )
      return {
        match: releases.find(({ tag_name }) => tag_name === input.tag),
        next: yield* nextUrl(value, result)
      }
    }),
    step: (state) => {
      match = state.match
      next = match === undefined ? state.next : undefined
    }
  })
  return match !== undefined ? match : yield* Effect.fail(apiError(
    "inspectRelease",
    releaseByTagUrl(value, input.tag),
    "GitHub release " + input.tag + " was not found.",
    { status: 404 }
  ))
})

const upload = Effect.fn("githubApi.upload")(function*(
  http: ReleaseHttpShape,
  value: Coordinates,
  tokenEnv: string | undefined,
  uploadUrl: string,
  asset: GitHubReleaseAssetSpec
) {
  const original = uploadUrl
  const parsed = yield* validateUrl(
    "validateUploadUrl",
    original,
    uploadUrl.split("{")[0] ?? uploadUrl,
    "uploads.github.com",
    "GitHub upload URL is not valid.",
    "GitHub upload URL does not point to the expected uploads endpoint.",
    (path) => path.startsWith("/repos/" + repositoryPath(value) + "/releases/") && path.endsWith("/assets")
  )
  parsed.searchParams.set("name", asset.name)
  const result = yield* run(http, "uploadAsset", request({
    method: "POST",
    url: parsed.toString(),
    tokenEnv,
    body: { _tag: "HttpFileRequestBody", path: asset.path, contentType: asset.contentType }
  })).pipe(Effect.flatMap((result) => successful("uploadAsset", result)))
  return yield* decode(GitHubReleaseApiAssetResponse, "release asset", "uploadAsset", result)
})

export const GitHubApiLiveLayer: Layer.Layer<GitHubApi, never, ReleaseHttp> = Layer.effect(GitHubApi)(
  Effect.gen(function*() {
    const http = yield* ReleaseHttp
    return {
      createRelease: Effect.fn("githubApi.createRelease")(function*(input) {
        const value = yield* coordinates(input.repository)
        const json: Record<string, Schema.Json> = {
          tag_name: input.tag,
          name: input.title,
          draft: input.draft,
          prerelease: input.prerelease,
          ...(input.notes === undefined ? {} : { body: input.notes })
        }
        const result = yield* run(http, "createRelease", request({
          method: "POST",
          url: releasesUrl(value),
          tokenEnv: input.tokenEnv,
          body: { _tag: "HttpJsonRequestBody", json }
        })).pipe(Effect.flatMap((result) => successful("createRelease", result)))
        const release = yield* decode(GitHubReleaseApiResponse, "release", "createRelease", result)
        const uploaded = yield* Effect.forEach(input.assets, (asset) =>
          upload(http, value, input.tokenEnv, release.upload_url, asset))
        return GitHubReleaseApiResponse.make({
          id: release.id,
          tag_name: release.tag_name,
          name: release.name,
          draft: release.draft,
          prerelease: release.prerelease,
          upload_url: release.upload_url,
          assets: uploaded.length === 0 ? release.assets : uploaded
        })
      }),
      inspectRelease: Effect.fn("githubApi.inspectRelease")(function*(input) {
        const value = yield* coordinates(input.repository)
        const url = releaseByTagUrl(value, input.tag)
        const result = yield* run(http, "inspectRelease", request({
          method: "GET", url, tokenEnv: input.tokenEnv
        }))
        if (result.status === 404) return yield* inspectByList(http, value, input)
        yield* successful("inspectRelease", result)
        return yield* decode(GitHubReleaseApiResponse, "release", "inspectRelease", result)
      })
    }
  })
)
