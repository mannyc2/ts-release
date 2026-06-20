import {
  CommandSpec,
  HttpEnvHeader,
  HttpHeader,
  HttpRequestSpec
} from "../domain/operation.js"
import { ReleaseModel, ReleasePlan } from "../domain/release.js"
import { GitHubReleaseTarget } from "../domain/target.js"

export type * from "../types/effect-internal.js"

export interface GitHubReleaseContext {
  readonly identity: ReleaseModel["identity"] | ReleasePlan["identity"]
  readonly artifacts: ReleaseModel["artifacts"] | ReleasePlan["artifacts"]
}

export const githubAuthEnvNames = (target: GitHubReleaseTarget): ReadonlyArray<string> =>
  target.tokenEnv === undefined ? [] : [target.tokenEnv]

export const githubGhCommand = (
  target: GitHubReleaseTarget,
  args: ReadonlyArray<string>,
  includeAuth: boolean
): CommandSpec =>
  CommandSpec.make({
    executable: "gh",
    args: [...args],
    requiredEnv: includeAuth ? githubAuthEnvNames(target) : [],
    redactedEnv: includeAuth ? githubAuthEnvNames(target) : []
  })

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

export const githubReleaseCreateArgs = (
  target: GitHubReleaseTarget,
  context: GitHubReleaseContext
): ReadonlyArray<string> => {
  const args: Array<string> = [
    "release",
    "create",
    githubReleaseTag(context),
    "--repo",
    target.repository,
    "--title",
    githubReleaseTitle(context)
  ]
  if (target.draft === true) {
    args.push("--draft")
  }
  if (target.prerelease === true) {
    args.push("--prerelease")
  }
  if (context.identity.notes !== undefined) {
    args.push("--notes", context.identity.notes)
  }
  for (const artifact of githubTargetArtifacts(target, context)) {
    args.push(artifact.path)
  }
  return args
}

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

export const githubReleaseCreateCommand = (
  target: GitHubReleaseTarget,
  context: GitHubReleaseContext
): CommandSpec =>
  githubGhCommand(target, githubReleaseCreateArgs(target, context), true)

export const githubReleasePublishDraftCommand = (
  target: GitHubReleaseTarget,
  context: GitHubReleaseContext
): CommandSpec =>
  githubGhCommand(
    target,
    [
      "release",
      "edit",
      githubReleaseTag(context),
      "--repo",
      target.repository,
      "--draft=false"
    ],
    true
  )
