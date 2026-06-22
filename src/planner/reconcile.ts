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
  executeGate,
  ExecutionApproval,
  HttpHeader,
  HttpRequestSpec,
  PublishCommandOperation
} from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"
import { GitHubReleaseTarget } from "../domain/target.js"
import { ReleaseHttp } from "../host/http.js"
import {
  githubApiGetRequestSpec,
  githubReleaseCreateCommand,
  githubReleasePublishDraftCommand,
  githubReleaseRequestSpec,
  githubReleaseTag,
  githubReleaseTitle,
  githubTargetArtifactAssetNames
} from "../targets/github-release.js"
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

const githubTargetArtifactNames = (
  target: GitHubReleaseTarget,
  plan: ReleasePlan
): ReadonlyArray<string> =>
  [...githubTargetArtifactAssetNames(target, plan)].sort()

const githubReleaseListApiUrl = (target: GitHubReleaseTarget): string =>
  `https://api.github.com/repos/${target.repository}/releases?per_page=100`

const githubReleaseListApiPath = (target: GitHubReleaseTarget): string =>
  `/repos/${target.repository}/releases`

const githubReleaseListRequestSpec = (target: GitHubReleaseTarget, url: string = githubReleaseListApiUrl(target)): HttpRequestSpec =>
  githubApiGetRequestSpec(target, url)

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
    command: githubReleasePublishDraftCommand(target, plan)
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

const linkHeaderNextUrl = (value: string): string | undefined => {
  for (const entry of value.split(",")) {
    const parts = entry.split(";").map((part) => part.trim())
    const urlPart = parts[0]
    if (urlPart === undefined || !urlPart.startsWith("<") || !urlPart.endsWith(">")) {
      continue
    }
    const hasNextRelation = parts.slice(1).some((part) => part.toLowerCase() === "rel=\"next\"")
    if (hasNextRelation) {
      return urlPart.slice(1, -1)
    }
  }
  return undefined
}

const responseNextUrl = (headers: ReadonlyArray<HttpHeader>): string | undefined => {
  for (const header of headers) {
    if (header.name.toLowerCase() !== "link") {
      continue
    }
    const nextUrl = linkHeaderNextUrl(header.value)
    if (nextUrl !== undefined) {
      return nextUrl
    }
  }
  return undefined
}

const validateReleaseListNextUrl = Effect.fn("validateReleaseListNextUrl")(function*(
  target: GitHubReleaseTarget,
  url: string
) {
  const parsed = yield* Effect.try({
    try: () => new URL(url),
    catch: () => remoteStateError(target, "GitHub release list next link is not a valid URL.")
  })
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "api.github.com" ||
    parsed.pathname !== githubReleaseListApiPath(target)
  ) {
    return yield* Effect.fail(
      remoteStateError(target, "GitHub release list next link does not point to the expected releases endpoint.")
    )
  }
  return parsed.toString()
})

const releaseListNextUrl = Effect.fn("releaseListNextUrl")(function*(
  target: GitHubReleaseTarget,
  headers: ReadonlyArray<HttpHeader>
) {
  const nextUrl = responseNextUrl(headers)
  return nextUrl === undefined
    ? undefined
    : yield* validateReleaseListNextUrl(target, nextUrl)
})

const inspectGitHubReleaseListForTag = Effect.fn("inspectGitHubReleaseListForTag")(function*(
  target: GitHubReleaseTarget,
  plan: ReleasePlan
) {
  const tag = githubReleaseTag(plan)
  const http = yield* ReleaseHttp
  const visitedUrls = new Set<string>()
  let request = githubReleaseListRequestSpec(target)

  while (true) {
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

    if (release !== undefined) {
      return releaseStateFromResponse(target, release)
    }

    visitedUrls.add(request.url)
    const nextUrl = yield* releaseListNextUrl(target, result.responseHeaders)
    if (nextUrl === undefined) {
      return GitHubReleaseMissing.make({
        targetId: target.id,
        repository: target.repository,
        tag
      })
    }
    if (visitedUrls.has(nextUrl)) {
      return yield* Effect.fail(
        remoteStateError(target, "GitHub release list pagination loop detected.")
      )
    }
    request = githubReleaseListRequestSpec(target, nextUrl)
  }
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
