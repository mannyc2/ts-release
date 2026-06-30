import { HttpEnvHeader, HttpHeader, HttpRequestSpec } from "../domain/operation.js"
import { ReleaseModel, ReleasePlan } from "../domain/release.js"
import { GitHubReleaseTarget } from "../domain/target.js"

export type * from "../types/effect-internal.js"

export interface GitHubReleaseContext {
  readonly identity: ReleaseModel["identity"] | ReleasePlan["identity"]
  readonly artifacts: ReleaseModel["artifacts"] | ReleasePlan["artifacts"]
}

export const githubAuthEnvNames = (target: GitHubReleaseTarget): ReadonlyArray<string> =>
  target.tokenEnv === undefined ? [] : [target.tokenEnv]

export const githubTargetArtifacts = (
  target: GitHubReleaseTarget,
  context: GitHubReleaseContext
) =>
  context.artifacts.filter((artifact) => artifact.consumers.includes(target.id))

export const githubReleaseAssetName = (pathName: string): string => {
  const parts = pathName.replaceAll("\\", "/").split("/")
  return parts[parts.length - 1] ?? pathName
}

export const githubTargetArtifactAssetNames = (
  target: GitHubReleaseTarget,
  context: GitHubReleaseContext
): ReadonlyArray<string> =>
  githubTargetArtifacts(target, context).map((artifact) => githubReleaseAssetName(artifact.path))

export const githubReleaseTag = (context: GitHubReleaseContext): string =>
  context.identity.tag ?? context.identity.version

export const githubReleaseTitle = (context: GitHubReleaseContext): string =>
  `${context.identity.name} ${context.identity.version}`

export const githubReleaseApiUrl = (target: GitHubReleaseTarget, tag: string): string =>
  `https://api.github.com/repos/${target.repository}/releases/tags/${encodeURIComponent(tag)}`

export const githubApiHeaders = (): ReadonlyArray<HttpHeader> => [
  HttpHeader.make({ name: "Accept", value: "application/vnd.github+json" }),
  HttpHeader.make({ name: "X-GitHub-Api-Version", value: "2022-11-28" })
]

export const githubApiEnvHeaders = (target: GitHubReleaseTarget): ReadonlyArray<HttpEnvHeader> =>
  target.tokenEnv === undefined
    ? []
    : [
      HttpEnvHeader.make({
        name: "Authorization",
        valueEnv: target.tokenEnv,
        prefix: "Bearer "
      })
    ]

export const githubApiGetRequestSpec = (
  target: GitHubReleaseTarget,
  url: string
): HttpRequestSpec =>
  HttpRequestSpec.make({
    method: "GET",
    url,
    headers: githubApiHeaders(),
    envHeaders: githubApiEnvHeaders(target),
    requiredEnv: githubAuthEnvNames(target),
    redactedEnv: githubAuthEnvNames(target)
  })

export const githubReleaseRequestSpec = (
  target: GitHubReleaseTarget,
  tag: string
): HttpRequestSpec =>
  githubApiGetRequestSpec(target, githubReleaseApiUrl(target, tag))
