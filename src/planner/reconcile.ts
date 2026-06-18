import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  GitHubReconcileBlock,
  GitHubReconcileCreateRelease,
  GitHubReconcilePublishDraft,
  GitHubReconcileSkip,
  GitHubReleaseDraft,
  GitHubReleaseMissing,
  GitHubReleasePublished,
  GitHubReleaseRemoteState
} from "../domain/remote-state.js"
import {
  CommandSpec,
  executeGate,
  ExecutionApproval,
  HttpEnvHeader,
  HttpHeader,
  HttpRequestSpec,
  PublishCommandOperation
} from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"
import { GitHubReleaseTarget } from "../domain/target.js"
import { ReleaseHttp } from "../host/http.js"
import { emptyEvidenceBundle } from "./evidence-recorder.js"
import { runOperations } from "./executor.js"
import { ReconciliationBlockedError, RemoteStateInspectionError } from "./errors.js"

export type * from "../types/effect-internal.js"

class GitHubReleaseAssetResponse extends Schema.Class<GitHubReleaseAssetResponse>(
  "GitHubReleaseAssetResponse"
)({
  name: Schema.String
}) {}

class GitHubReleaseResponse extends Schema.Class<GitHubReleaseResponse>("GitHubReleaseResponse")({
  tag_name: Schema.String,
  name: Schema.String,
  draft: Schema.Boolean,
  prerelease: Schema.Boolean,
  assets: Schema.Array(GitHubReleaseAssetResponse)
}) {}

export class ReleaseReconcileOptions extends Schema.Class<ReleaseReconcileOptions>("ReleaseReconcileOptions")({
  execute: Schema.Boolean
}) {}

const decodeGitHubReleaseResponse = Schema.decodeUnknownEffect(GitHubReleaseResponse)
const decodeGitHubReleaseResponses = Schema.decodeUnknownEffect(Schema.Array(GitHubReleaseResponse))

const githubTargets = (plan: ReleasePlan): ReadonlyArray<GitHubReleaseTarget> =>
  plan.targets.filter((target): target is GitHubReleaseTarget => target._tag === "GitHubReleaseTarget")

const envNames = (target: GitHubReleaseTarget): ReadonlyArray<string> =>
  target.tokenEnv === undefined ? [] : [target.tokenEnv]

const ghCommand = (
  target: GitHubReleaseTarget,
  args: ReadonlyArray<string>,
  includeAuth: boolean
): CommandSpec =>
  CommandSpec.make({
    executable: "gh",
    args: [...args],
    requiredEnv: includeAuth ? envNames(target) : [],
    redactedEnv: includeAuth ? envNames(target) : []
  })

const pathBaseName = (path: string): string => {
  const parts = path.replaceAll("\\", "/").split("/")
  return parts[parts.length - 1] ?? path
}

const targetArtifacts = (target: GitHubReleaseTarget, plan: ReleasePlan) =>
  plan.artifacts.filter((artifact) => artifact.consumers.includes(target.id))

const githubReleaseTag = (plan: ReleasePlan): string =>
  plan.identity.tag ?? plan.identity.version

const githubReleaseTitle = (plan: ReleasePlan): string =>
  `${plan.identity.name} ${plan.identity.version}`

const githubTargetArtifactNames = (
  target: GitHubReleaseTarget,
  plan: ReleasePlan
): ReadonlyArray<string> =>
  targetArtifacts(target, plan).map((artifact) => pathBaseName(artifact.path)).sort()

const releaseArgs = (target: GitHubReleaseTarget, plan: ReleasePlan): ReadonlyArray<string> => {
  const args: Array<string> = [
    "release",
    "create",
    githubReleaseTag(plan),
    "--repo",
    target.repository,
    "--title",
    githubReleaseTitle(plan)
  ]
  if (target.draft === true) {
    args.push("--draft")
  }
  if (target.prerelease === true) {
    args.push("--prerelease")
  }
  if (plan.identity.notes !== undefined) {
    args.push("--notes", plan.identity.notes)
  }
  for (const artifact of targetArtifacts(target, plan)) {
    args.push(artifact.path)
  }
  return args
}

const githubReleaseApiUrl = (target: GitHubReleaseTarget, tag: string): string =>
  `https://api.github.com/repos/${target.repository}/releases/tags/${encodeURIComponent(tag)}`

const githubReleaseListApiUrl = (target: GitHubReleaseTarget): string =>
  `https://api.github.com/repos/${target.repository}/releases?per_page=100`

const githubApiHeaders = (): ReadonlyArray<HttpHeader> => [
  HttpHeader.make({ name: "Accept", value: "application/vnd.github+json" }),
  HttpHeader.make({ name: "X-GitHub-Api-Version", value: "2022-11-28" })
]

const githubApiEnvHeaders = (target: GitHubReleaseTarget): ReadonlyArray<HttpEnvHeader> =>
  target.tokenEnv === undefined
    ? []
    : [
      HttpEnvHeader.make({
        name: "Authorization",
        valueEnv: target.tokenEnv,
        prefix: "Bearer "
      })
    ]

const githubReleaseRequestSpec = (
  target: GitHubReleaseTarget,
  tag: string
): HttpRequestSpec =>
  HttpRequestSpec.make({
    method: "GET",
    url: githubReleaseApiUrl(target, tag),
    headers: githubApiHeaders(),
    envHeaders: githubApiEnvHeaders(target),
    requiredEnv: envNames(target),
    redactedEnv: envNames(target)
  })

const githubReleaseListRequestSpec = (target: GitHubReleaseTarget): HttpRequestSpec =>
  HttpRequestSpec.make({
    method: "GET",
    url: githubReleaseListApiUrl(target),
    headers: githubApiHeaders(),
    envHeaders: githubApiEnvHeaders(target),
    requiredEnv: envNames(target),
    redactedEnv: envNames(target)
  })

const githubReleaseCreateCommand = (
  target: GitHubReleaseTarget,
  plan: ReleasePlan
): CommandSpec =>
  ghCommand(target, releaseArgs(target, plan), true)

const githubReleaseReconcileCreateOperation = (
  target: GitHubReleaseTarget,
  plan: ReleasePlan
): PublishCommandOperation =>
  PublishCommandOperation.make({
    id: `${target.id}:gh-release-reconcile-create`,
    targetId: target.id,
    description: `Create missing GitHub release for ${plan.identity.name}@${plan.identity.version}.`,
    risk: "externally-visible",
    gate: executeGate("Creating this GitHub release is externally visible."),
    command: githubReleaseCreateCommand(target, plan)
  })

const githubReleasePublishDraftOperation = (
  target: GitHubReleaseTarget,
  plan: ReleasePlan
): PublishCommandOperation =>
  PublishCommandOperation.make({
    id: `${target.id}:gh-release-publish-draft`,
    targetId: target.id,
    description: `Publish existing GitHub draft release for ${plan.identity.name}@${plan.identity.version}.`,
    risk: "externally-visible",
    gate: executeGate("Publishing this GitHub draft release is externally visible."),
    command: ghCommand(
      target,
      [
        "release",
        "edit",
        githubReleaseTag(plan),
        "--repo",
        target.repository,
        "--draft=false"
      ],
      true
    )
  })

const sortedAssetNames = (response: GitHubReleaseResponse): ReadonlyArray<string> =>
  response.assets.map((asset) => asset.name).sort()

const remoteStateError = (
  target: GitHubReleaseTarget,
  reason: string
): RemoteStateInspectionError =>
  RemoteStateInspectionError.make({
    targetId: target.id,
    reason
  })

const releaseStateFromResponse = (
  target: GitHubReleaseTarget,
  response: GitHubReleaseResponse
): GitHubReleaseDraft | GitHubReleasePublished => {
  const fields = {
    targetId: target.id,
    repository: target.repository,
    tag: response.tag_name,
    title: response.name,
    prerelease: response.prerelease,
    assetNames: sortedAssetNames(response)
  }

  return response.draft
    ? GitHubReleaseDraft.make({
      ...fields,
      draft: true
    })
    : GitHubReleasePublished.make({
      ...fields,
      draft: false
    })
}

const inspectGitHubReleaseListForTag = Effect.fn("inspectGitHubReleaseListForTag")(function*(
  target: GitHubReleaseTarget,
  plan: ReleasePlan
) {
  const tag = githubReleaseTag(plan)
  const request = githubReleaseListRequestSpec(target)
  const http = yield* ReleaseHttp
  const result = yield* http.runJson(request).pipe(
    Effect.mapError((error) => remoteStateError(target, error.reason))
  )

  if (result.status !== 200) {
    return yield* Effect.fail(
      remoteStateError(target, `GitHub release list lookup returned HTTP ${result.status}.`)
    )
  }

  const releases = yield* decodeGitHubReleaseResponses(result.json).pipe(
    Effect.mapError((error) =>
      remoteStateError(target, `GitHub release list response did not match the expected schema: ${error.message}`)
    )
  )
  const release = releases.find((item) => item.tag_name === tag)

  return release === undefined
    ? GitHubReleaseMissing.make({
      targetId: target.id,
      repository: target.repository,
      tag
    })
    : releaseStateFromResponse(target, release)
})

export const inspectGitHubReleaseState = Effect.fn("inspectGitHubReleaseState")(function*(
  target: GitHubReleaseTarget,
  plan: ReleasePlan
) {
  const tag = githubReleaseTag(plan)
  const request = githubReleaseRequestSpec(target, tag)
  const http = yield* ReleaseHttp
  const result = yield* http.runJson(request).pipe(
    Effect.mapError((error) => remoteStateError(target, error.reason))
  )

  if (result.status === 404) {
    return yield* inspectGitHubReleaseListForTag(target, plan)
  }

  if (result.status !== 200) {
    return yield* Effect.fail(
      remoteStateError(target, `GitHub release lookup returned HTTP ${result.status}.`)
    )
  }

  const release = yield* decodeGitHubReleaseResponse(result.json).pipe(
    Effect.mapError((error) =>
      remoteStateError(target, `GitHub release response did not match the expected schema: ${error.message}`)
    )
  )
  return releaseStateFromResponse(target, release)
})

type ExistingGitHubReleaseState = GitHubReleaseDraft | GitHubReleasePublished

const listLabel = (values: ReadonlyArray<string>): string =>
  values.length === 0 ? "(none)" : values.join(", ")

const sameStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const existingMismatchReasons = (
  target: GitHubReleaseTarget,
  plan: ReleasePlan,
  state: ExistingGitHubReleaseState
): ReadonlyArray<string> => {
  const reasons: Array<string> = []
  const expectedTag = githubReleaseTag(plan)
  const expectedTitle = githubReleaseTitle(plan)
  const expectedPrerelease = target.prerelease === true
  const expectedAssets = githubTargetArtifactNames(target, plan)

  if (state.tag !== expectedTag) {
    reasons.push(`GitHub release tag ${state.tag} does not match expected ${expectedTag}.`)
  }
  if (state.title !== expectedTitle) {
    reasons.push(`GitHub release title ${state.title} does not match expected ${expectedTitle}.`)
  }
  if (state.prerelease !== expectedPrerelease) {
    reasons.push(
      `GitHub release prerelease=${state.prerelease} does not match expected prerelease=${expectedPrerelease}.`
    )
  }
  if (!sameStrings(state.assetNames, expectedAssets)) {
    reasons.push(
      `GitHub release assets ${listLabel(state.assetNames)} do not match expected assets ${listLabel(expectedAssets)}.`
    )
  }

  return reasons
}

const blockDecision = (
  target: GitHubReleaseTarget,
  reasons: ReadonlyArray<string>
): GitHubReconcileBlock =>
  GitHubReconcileBlock.make({
    targetId: target.id,
    reasons: [...reasons]
  })

export const decideGitHubReleaseReconciliation = (
  target: GitHubReleaseTarget,
  plan: ReleasePlan,
  state: GitHubReleaseRemoteState
) => {
  switch (state._tag) {
    case "GitHubReleaseMissing":
      return GitHubReconcileCreateRelease.make({
        targetId: target.id,
        reason: `GitHub release ${githubReleaseTag(plan)} is missing.`
      })
    case "GitHubReleaseMismatch":
      return blockDecision(target, state.reasons)
    case "GitHubReleaseDraft": {
      const reasons = existingMismatchReasons(target, plan, state)
      if (reasons.length > 0) {
        return blockDecision(target, reasons)
      }
      if (target.draft === true) {
        return GitHubReconcileSkip.make({
          targetId: target.id,
          reason: `GitHub release ${githubReleaseTag(plan)} already matches the draft target.`
        })
      }
      return GitHubReconcilePublishDraft.make({
        targetId: target.id,
        reason: `GitHub release ${githubReleaseTag(plan)} is a matching draft and can be published.`
      })
    }
    case "GitHubReleasePublished": {
      const reasons = [...existingMismatchReasons(target, plan, state)]
      if (target.draft === true) {
        reasons.push("GitHub release is public, but the target expects a draft.")
      }
      if (reasons.length > 0) {
        return blockDecision(target, reasons)
      }
      return GitHubReconcileSkip.make({
        targetId: target.id,
        reason: `GitHub release ${githubReleaseTag(plan)} already matches the target.`
      })
    }
  }
}

const operationForDecision = (
  target: GitHubReleaseTarget,
  plan: ReleasePlan,
  decision: ReturnType<typeof decideGitHubReleaseReconciliation>
): PublishCommandOperation | undefined => {
  switch (decision._tag) {
    case "GitHubReconcileCreateRelease":
      return githubReleaseReconcileCreateOperation(target, plan)
    case "GitHubReconcilePublishDraft":
      return githubReleasePublishDraftOperation(target, plan)
    case "GitHubReconcileSkip":
    case "GitHubReconcileBlock":
      return undefined
  }
}

const failBlockedDecision = (
  decision: GitHubReconcileBlock
): Effect.Effect<never, ReconciliationBlockedError> =>
  Effect.fail(
    ReconciliationBlockedError.make({
      targetId: decision.targetId,
      reasons: decision.reasons
    })
  )

export const reconcileReleasePlan = Effect.fn("reconcileReleasePlan")(function*(
  plan: ReleasePlan,
  options: ReleaseReconcileOptions
) {
  const operations: Array<PublishCommandOperation> = []

  for (const target of githubTargets(plan)) {
    const state = yield* inspectGitHubReleaseState(target, plan)
    const decision = decideGitHubReleaseReconciliation(target, plan, state)
    if (decision._tag === "GitHubReconcileBlock") {
      return yield* failBlockedDecision(decision)
    }
    const operation = operationForDecision(target, plan, decision)
    if (operation !== undefined) {
      operations.push(operation)
    }
  }

  if (operations.length === 0) {
    return emptyEvidenceBundle(plan)
  }

  return yield* runOperations(
    plan,
    operations,
    ExecutionApproval.make({
      execute: options.execute,
      approveIrreversible: false
    })
  )
})
