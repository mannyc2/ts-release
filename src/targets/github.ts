import * as Effect from "effect/Effect"
import {
  GitHubReleaseAssetSpec,
  Operation,
  PublishGitHubReleaseOperation,
  VerifyGitHubReleaseOperation
} from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  GitHubReleaseTarget,
  TargetCapabilities,
  TargetDryRunSupport,
  TargetValidationStrategy
} from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"
import { GitHubTargetAdapter } from "./adapter.js"
import {
  rejectNoDryRunInStrictMode,
  targetCapabilitiesFor,
  validationNoteOperation
} from "./adapter-helpers.js"
import {
  GitHubReleaseContext,
  githubReleaseAssetName,
  githubReleaseTag,
  githubReleaseTitle,
  githubTargetArtifacts
} from "./github-release.js"

export type * from "../types/effect-internal.js"

const githubValidationStrategy = (target: GitHubReleaseTarget): TargetValidationStrategy =>
  target.dryRunSupport === "none" ? "skipped" : "simulated-plan"

export const githubTargetCapabilities = (target: GitHubReleaseTarget): TargetCapabilities =>
  targetCapabilitiesFor(target, githubValidationStrategy(target))

const rejectDirectoryAssets = Effect.fn("github.rejectDirectoryAssets")(function*(
  target: GitHubReleaseTarget,
  model: GitHubReleaseContext
) {
  const directoryAsset = githubTargetArtifacts(target, model).find((artifact) => artifact.format === "directory")
  if (directoryAsset === undefined) {
    return
  }
  return yield* Effect.fail(
    PlanConstructionError.make({
      targetId: target.id,
      reason: "GitHub release assets must be file-like, not directories."
    })
  )
})

const githubVerificationOperations = (
  target: GitHubReleaseTarget,
  model: ReleaseModel
): ReadonlyArray<Operation> => {
  const tag = githubReleaseTag(model)
  const title = githubReleaseTitle(model)
  const isPrerelease = target.prerelease === true

  return [
    VerifyGitHubReleaseOperation.make({
      id: `${target.id}:github-release-verify-api`,
      targetId: target.id,
      description: "Verify the GitHub release through the GitHub API.",
      risk: "read-only",
      repository: target.repository,
      ...(target.tokenEnv === undefined ? {} : { tokenEnv: target.tokenEnv }),
      tag,
      title,
      draft: target.draft === true,
      prerelease: isPrerelease,
      assetNames: githubTargetArtifacts(target, model).map((artifact) => githubReleaseAssetName(artifact.path))
    })
  ]
}

const githubDryRunOperation = (
  target: GitHubReleaseTarget,
  dryRunSupport: Exclude<TargetDryRunSupport, "native">
): Operation =>
  validationNoteOperation({
    id: `${target.id}:github-release-dry-run`,
    targetId: target.id,
    dryRunSupport,
    simulatedDescription: "Record simulated GitHub release dry-run validation.",
    skippedDescription: "Record skipped GitHub release dry-run validation.",
    simulatedMessage:
      "GitHub release dry-run validation is simulated by the deterministic release plan; GitHub Releases API creation is not called during validation.",
    skippedMessage: "GitHub release dry-run validation was skipped because this target declares no dry-run support."
  })

const githubReleaseAssets = (
  target: GitHubReleaseTarget,
  model: ReleaseModel
): ReadonlyArray<GitHubReleaseAssetSpec> =>
  githubTargetArtifacts(target, model).map((artifact) =>
    GitHubReleaseAssetSpec.make({
      artifactId: artifact.id,
      path: artifact.path,
      name: githubReleaseAssetName(artifact.path),
      contentType: "application/octet-stream"
    })
  )

export const planGitHubOperations = Effect.fn("planGitHubOperations")(function*(
  target: GitHubReleaseTarget,
  model: ReleaseModel
) {
  const dryRunSupport = target.dryRunSupport
  if (dryRunSupport === "native") {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason: "GitHub release targets do not support native dry-run; use simulated dry-run support."
      })
    )
  }
  yield* rejectNoDryRunInStrictMode(
    target,
    model,
    "GitHub release target declares no dry-run support in strict mode."
  )
  yield* rejectDirectoryAssets(target, model)
  const publishRisk = target.mutability === "immutable" ? "irreversible" : "externally-visible"

  return [
    githubDryRunOperation(target, dryRunSupport),
    PublishGitHubReleaseOperation.make({
      id: `${target.id}:github-release-create`,
      targetId: target.id,
      description: `Create GitHub release for ${model.identity.name}@${model.identity.version}.`,
      risk: publishRisk,
      repository: target.repository,
      ...(target.tokenEnv === undefined ? {} : { tokenEnv: target.tokenEnv }),
      tag: githubReleaseTag(model),
      title: githubReleaseTitle(model),
      ...(model.identity.notes === undefined ? {} : { notes: model.identity.notes }),
      draft: target.draft === true,
      prerelease: target.prerelease === true,
      assets: githubReleaseAssets(target, model)
    }),
    ...githubVerificationOperations(target, model)
  ] satisfies ReadonlyArray<Operation>
})

export const GitHubAdapter: GitHubTargetAdapter = {
  targetTag: "GitHubReleaseTarget",
  capabilities: githubTargetCapabilities,
  planOperations: planGitHubOperations
}
