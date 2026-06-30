import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import {
  GitHubReleaseAssetSpec,
  HttpEnvHeader,
  HttpFileRequestBody,
  HttpHeader,
  HttpJsonRequestBody,
  HttpRequestBody,
  HttpRequestSpec
} from "../domain/operation.js"
import { HttpResult, ReleaseHttp, type ReleaseHttpShape } from "../host/http.js"
import { githubApiHeaders } from "./github-release.js"

export type * from "../types/effect-internal.js"

export class GitHubApiError extends Schema.TaggedErrorClass<GitHubApiError>()("GitHubApiError", {
  operation: Schema.String,
  url: Schema.String,
  reason: Schema.String,
  status: Schema.optionalKey(Schema.Number),
  cause: Schema.optionalKey(Schema.Defect())
}) {}

export class GitHubRepositoryCoordinates extends Schema.Class<GitHubRepositoryCoordinates>(
  "GitHubRepositoryCoordinates"
)({
  owner: Schema.String,
  repo: Schema.String
}) {}

export class GitHubReleaseApiAssetResponse extends Schema.Class<GitHubReleaseApiAssetResponse>(
  "GitHubReleaseApiAssetResponse"
)({
  id: Schema.Number,
  name: Schema.String,
  state: Schema.optionalKey(Schema.String)
}) {}

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

export class GitHubReleaseCreateRequest extends Schema.Class<GitHubReleaseCreateRequest>(
  "GitHubReleaseCreateRequest"
)({
  repository: Schema.String,
  tokenEnv: Schema.optionalKey(Schema.String),
  tag: Schema.String,
  title: Schema.String,
  notes: Schema.optionalKey(Schema.String),
  draft: Schema.Boolean,
  prerelease: Schema.Boolean,
  assets: Schema.Array(GitHubReleaseAssetSpec)
}) {}

export class GitHubReleaseInspectRequest extends Schema.Class<GitHubReleaseInspectRequest>(
  "GitHubReleaseInspectRequest"
)({
  repository: Schema.String,
  tokenEnv: Schema.optionalKey(Schema.String),
  tag: Schema.String
}) {}

export interface GitHubApiShape {
  readonly createRelease: (
    request: GitHubReleaseCreateRequest
  ) => Effect.Effect<GitHubReleaseApiResponse, GitHubApiError>
  readonly inspectRelease: (
    request: GitHubReleaseInspectRequest
  ) => Effect.Effect<GitHubReleaseApiResponse, GitHubApiError>
}

export class GitHubApi extends Context.Service<GitHubApi, GitHubApiShape>()("GitHubApi") {}

const decodeGitHubRelease = Schema.decodeUnknownEffect(GitHubReleaseApiResponse)
const decodeGitHubReleaseList = Schema.decodeUnknownEffect(Schema.Array(GitHubReleaseApiResponse))
const decodeGitHubAsset = Schema.decodeUnknownEffect(GitHubReleaseApiAssetResponse)

const parseRepository = Effect.fn("githubApi.parseRepository")(function*(repository: string) {
  const parts = repository.split("/")
  const owner = parts[0]
  const repo = parts[1]
  if (
    parts.length === 2 &&
    owner !== undefined &&
    repo !== undefined &&
    owner.length > 0 &&
    repo.length > 0
  ) {
    return GitHubRepositoryCoordinates.make({ owner, repo })
  }
  return yield* Effect.fail(
    GitHubApiError.make({
      operation: "parseRepository",
      url: repository,
      reason: "GitHub repository must use owner/repo syntax."
    })
  )
})

const encodedRepositoryPath = (coordinates: GitHubRepositoryCoordinates): string =>
  `${encodeURIComponent(coordinates.owner)}/${encodeURIComponent(coordinates.repo)}`

const githubApiUrl = (coordinates: GitHubRepositoryCoordinates, path: string): string =>
  `https://api.github.com/repos/${encodedRepositoryPath(coordinates)}${path}`

const githubReleasesUrl = (coordinates: GitHubRepositoryCoordinates): string =>
  githubApiUrl(coordinates, "/releases")

const githubReleaseByTagUrl = (coordinates: GitHubRepositoryCoordinates, tag: string): string =>
  githubApiUrl(coordinates, `/releases/tags/${encodeURIComponent(tag)}`)

const githubEnvHeaders = (tokenEnv: string | undefined): ReadonlyArray<HttpEnvHeader> =>
  tokenEnv === undefined
    ? []
    : [
      HttpEnvHeader.make({
        name: "Authorization",
        valueEnv: tokenEnv,
        prefix: "Bearer "
      })
    ]

const githubAuthEnvNames = (tokenEnv: string | undefined): ReadonlyArray<string> =>
  tokenEnv === undefined ? [] : [tokenEnv]

const githubRequest = (input: {
  readonly method: "GET" | "POST" | "PATCH"
  readonly url: string
  readonly tokenEnv?: string | undefined
  readonly body?: HttpRequestBody | undefined
  readonly headers?: ReadonlyArray<HttpHeader> | undefined
}): HttpRequestSpec =>
  HttpRequestSpec.make({
    method: input.method,
    url: input.url,
    headers: [...(input.headers ?? githubApiHeaders())],
    envHeaders: githubEnvHeaders(input.tokenEnv),
    requiredEnv: githubAuthEnvNames(input.tokenEnv),
    redactedEnv: githubAuthEnvNames(input.tokenEnv),
    ...(input.body === undefined ? {} : { body: input.body })
  })

const statusOk = (status: number): boolean =>
  status >= 200 && status < 300

const ensureSuccessStatus = (
  operation: string,
  result: HttpResult
): Effect.Effect<void, GitHubApiError> =>
  statusOk(result.status)
    ? Effect.void
    : Effect.fail(
      GitHubApiError.make({
        operation,
        url: result.request.url,
        status: result.status,
        reason: `GitHub API returned HTTP ${result.status}.`
      })
    )

const decodeReleaseResult = (
  operation: string,
  result: HttpResult
): Effect.Effect<GitHubReleaseApiResponse, GitHubApiError> =>
  decodeGitHubRelease(result.json).pipe(
    Effect.mapError((error) =>
      GitHubApiError.make({
        operation,
        url: result.request.url,
        status: result.status,
        reason: "GitHub release response did not match the expected schema.",
        cause: error
      })
    )
  )

const decodeReleaseListResult = (
  operation: string,
  result: HttpResult
): Effect.Effect<ReadonlyArray<GitHubReleaseApiResponse>, GitHubApiError> =>
  decodeGitHubReleaseList(result.json).pipe(
    Effect.mapError((error) =>
      GitHubApiError.make({
        operation,
        url: result.request.url,
        status: result.status,
        reason: "GitHub release list response did not match the expected schema.",
        cause: error
      })
    )
  )

const decodeAssetResult = (
  operation: string,
  result: HttpResult
): Effect.Effect<GitHubReleaseApiAssetResponse, GitHubApiError> =>
  decodeGitHubAsset(result.json).pipe(
    Effect.mapError((error) =>
      GitHubApiError.make({
        operation,
        url: result.request.url,
        status: result.status,
        reason: "GitHub release asset response did not match the expected schema.",
        cause: error
      })
    )
  )

const releaseBody = (request: GitHubReleaseCreateRequest): HttpJsonRequestBody => {
  const json: Record<string, Schema.Json> = {
    tag_name: request.tag,
    name: request.title,
    draft: request.draft,
    prerelease: request.prerelease
  }
  if (request.notes !== undefined) {
    json.body = request.notes
  }
  return HttpJsonRequestBody.make({ json })
}

const responseLinkHeader = (result: HttpResult): string | undefined =>
  result.responseHeaders.find((header) => header.name.toLowerCase() === "link")?.value

const validateReleaseListUrl = (
  coordinates: GitHubRepositoryCoordinates,
  url: string
): Effect.Effect<string, GitHubApiError> =>
  Effect.try({
    try: () => new URL(url),
    catch: (cause) =>
      GitHubApiError.make({
        operation: "validateReleaseListUrl",
        url,
        reason: "GitHub pagination URL is not valid.",
        cause
      })
  }).pipe(
    Effect.flatMap((parsed) => {
      const expectedPath = `/repos/${encodedRepositoryPath(coordinates)}/releases`
      if (parsed.protocol === "https:" && parsed.hostname === "api.github.com" && parsed.pathname === expectedPath) {
        return Effect.succeed(parsed.toString())
      }
      return Effect.fail(
        GitHubApiError.make({
          operation: "validateReleaseListUrl",
          url,
          reason: "GitHub pagination URL does not point to the expected releases endpoint."
        })
      )
    })
  )

const nextReleaseListUrl = (
  coordinates: GitHubRepositoryCoordinates,
  result: HttpResult
): Effect.Effect<string | undefined, GitHubApiError> => {
  const link = responseLinkHeader(result)
  if (link === undefined) {
    return Effect.succeed(undefined)
  }
  const next = link
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.includes("rel=\"next\""))
  if (next === undefined) {
    return Effect.succeed(undefined)
  }
  const start = next.indexOf("<")
  const end = next.indexOf(">")
  if (start < 0 || end <= start + 1) {
    return Effect.fail(
      GitHubApiError.make({
        operation: "nextReleaseListUrl",
        url: result.request.url,
        reason: "GitHub pagination Link header has an invalid next URL."
      })
    )
  }
  return validateReleaseListUrl(coordinates, next.slice(start + 1, end))
}

const validateUploadUrl = (
  coordinates: GitHubRepositoryCoordinates,
  uploadUrl: string,
  assetName: string
): Effect.Effect<string, GitHubApiError> =>
  Effect.try({
    try: () => new URL(uploadUrl.split("{")[0] ?? uploadUrl),
    catch: (cause) =>
      GitHubApiError.make({
        operation: "validateUploadUrl",
        url: uploadUrl,
        reason: "GitHub upload URL is not valid.",
        cause
      })
  }).pipe(
    Effect.flatMap((parsed) => {
      const expectedPrefix = `/repos/${encodedRepositoryPath(coordinates)}/releases/`
      if (
        parsed.protocol === "https:" &&
        parsed.hostname === "uploads.github.com" &&
        parsed.pathname.startsWith(expectedPrefix) &&
        parsed.pathname.endsWith("/assets")
      ) {
        parsed.searchParams.set("name", assetName)
        return Effect.succeed(parsed.toString())
      }
      return Effect.fail(
        GitHubApiError.make({
          operation: "validateUploadUrl",
          url: uploadUrl,
          reason: "GitHub upload URL does not point to the expected uploads endpoint."
        })
      )
    })
  )

const uploadAsset = Effect.fn("githubApi.uploadAsset")(function*(
  http: ReleaseHttpShape,
  coordinates: GitHubRepositoryCoordinates,
  tokenEnv: string | undefined,
  uploadUrl: string,
  asset: GitHubReleaseAssetSpec
) {
  const url = yield* validateUploadUrl(coordinates, uploadUrl, asset.name)
  const result = yield* http.runJson(
    githubRequest({
      method: "POST",
      url,
      tokenEnv,
      body: HttpFileRequestBody.make({
        path: asset.path,
        contentType: asset.contentType
      })
    })
  ).pipe(
    Effect.mapError((error) =>
      GitHubApiError.make({
        operation: "uploadAsset",
        url: error.url,
        reason: error.reason,
        cause: error
      })
    )
  )
  yield* ensureSuccessStatus("uploadAsset", result)
  return yield* decodeAssetResult("uploadAsset", result)
})

const inspectReleaseByList = Effect.fn("githubApi.inspectReleaseByList")(function*(
  http: ReleaseHttpShape,
  coordinates: GitHubRepositoryCoordinates,
  request: GitHubReleaseInspectRequest
) {
  let url: string | undefined = `${githubReleasesUrl(coordinates)}?per_page=100`
  while (url !== undefined) {
    const result: HttpResult = yield* http.runJson(
      githubRequest({
        method: "GET",
        url,
        tokenEnv: request.tokenEnv
      })
    ).pipe(
      Effect.mapError((error) =>
        GitHubApiError.make({
          operation: "inspectRelease",
          url: error.url,
          reason: error.reason,
          cause: error
        })
      )
    )
    yield* ensureSuccessStatus("inspectRelease", result)
    const releases = yield* decodeReleaseListResult("inspectRelease", result)
    const match = releases.find((release) => release.tag_name === request.tag)
    if (match !== undefined) {
      return match
    }
    url = yield* nextReleaseListUrl(coordinates, result)
  }
  return yield* Effect.fail(
    GitHubApiError.make({
      operation: "inspectRelease",
      url: githubReleaseByTagUrl(coordinates, request.tag),
      status: 404,
      reason: `GitHub release ${request.tag} was not found.`
    })
  )
})

export const GitHubApiLiveLayer: Layer.Layer<GitHubApi, never, ReleaseHttp> =
  Layer.effect(GitHubApi)(
    Effect.gen(function*() {
      const http = yield* ReleaseHttp
      return {
        createRelease: Effect.fn("githubApi.createRelease")(function*(request: GitHubReleaseCreateRequest) {
          const coordinates = yield* parseRepository(request.repository)
          const result = yield* http.runJson(
            githubRequest({
              method: "POST",
              url: githubReleasesUrl(coordinates),
              tokenEnv: request.tokenEnv,
              body: releaseBody(request)
            })
          ).pipe(
            Effect.mapError((error) =>
              GitHubApiError.make({
                operation: "createRelease",
                url: error.url,
                reason: error.reason,
                cause: error
              })
            )
          )
          yield* ensureSuccessStatus("createRelease", result)
          const release = yield* decodeReleaseResult("createRelease", result)
          const uploadedAssets: Array<GitHubReleaseApiAssetResponse> = []
          for (const asset of request.assets) {
            uploadedAssets.push(yield* uploadAsset(http, coordinates, request.tokenEnv, release.upload_url, asset))
          }
          return GitHubReleaseApiResponse.make({
            id: release.id,
            tag_name: release.tag_name,
            name: release.name,
            draft: release.draft,
            prerelease: release.prerelease,
            upload_url: release.upload_url,
            assets: uploadedAssets.length === 0 ? release.assets : uploadedAssets
          })
        }),
        inspectRelease: Effect.fn("githubApi.inspectRelease")(function*(request: GitHubReleaseInspectRequest) {
          const coordinates = yield* parseRepository(request.repository)
          const url = githubReleaseByTagUrl(coordinates, request.tag)
          const result = yield* http.runJson(
            githubRequest({
              method: "GET",
              url,
              tokenEnv: request.tokenEnv
            })
          ).pipe(
            Effect.mapError((error) =>
              GitHubApiError.make({
                operation: "inspectRelease",
                url: error.url,
                reason: error.reason,
                cause: error
              })
            )
          )
          if (result.status === 404) {
            return yield* inspectReleaseByList(http, coordinates, request)
          }
          yield* ensureSuccessStatus("inspectRelease", result)
          return yield* decodeReleaseResult("inspectRelease", result)
        })
      }
    })
  )
