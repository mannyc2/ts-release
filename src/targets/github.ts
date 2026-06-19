import * as Effect from "effect/Effect"
import {
  executeGate,
  HttpJsonArrayObjectFieldEqualsCheck,
  HttpJsonEqualsCheck,
  irreversibleGate,
  noApprovalGate,
  Operation,
  PublishCommandOperation,
  ValidateCommandOperation,
  VerifyHttpOperation
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
import { rejectNoDryRunInStrictMode, targetCapabilitiesFor, validationNoteOperation } from "./adapter-helpers.js"
import {
  GitHubReleaseContext,
  githubGhCommand,
  githubReleaseAssetName,
  githubReleaseCreateCommand,
  githubReleaseRequestSpec,
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
  const isDraft = target.draft === true
  const isPrerelease = target.prerelease === true
  const artifactChecks = githubTargetArtifacts(target, model).map((artifact) =>
    HttpJsonArrayObjectFieldEqualsCheck.make({
      path: ["assets"],
      field: "name",
      expected: githubReleaseAssetName(artifact.path)
    })
  )

  return [
    VerifyHttpOperation.make({
      id: `${target.id}:github-release-verify-http`,
      targetId: target.id,
      description: "Verify the GitHub release through the GitHub API.",
      risk: "read-only",
      gate: noApprovalGate("GitHub API release verification is read-only."),
      request: githubReleaseRequestSpec(target, tag),
      expectedStatus: 200,
      checks: [
        HttpJsonEqualsCheck.make({
          path: ["tag_name"],
          expected: tag
        }),
        HttpJsonEqualsCheck.make({
          path: ["name"],
          expected: title
        }),
        HttpJsonEqualsCheck.make({
          path: ["draft"],
          expected: isDraft
        }),
        HttpJsonEqualsCheck.make({
          path: ["prerelease"],
          expected: isPrerelease
        }),
        ...artifactChecks
      ]
    })
  ]
}

const githubDryRunOperation = (
  target: GitHubReleaseTarget,
  dryRunSupport: Exclude<TargetDryRunSupport, "native">
): Operation =>
  validationNoteOperation({
    id: `${target.id}:gh-release-dry-run`,
    targetId: target.id,
    dryRunSupport,
    simulatedDescription: "Record simulated GitHub release dry-run validation.",
    skippedDescription: "Record skipped GitHub release dry-run validation.",
    simulatedMessage:
      "GitHub release dry-run validation is simulated by the deterministic release plan; gh release create has no native dry-run command.",
    skippedMessage: "GitHub release dry-run validation was skipped because this target declares no dry-run support."
  })

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
  const publishGate = publishRisk === "irreversible"
    ? irreversibleGate("Creating this GitHub release is externally visible and configured as immutable.")
    : executeGate("Creating or updating a GitHub release is externally visible.")

  return [
    ValidateCommandOperation.make({
      id: `${target.id}:gh-version`,
      targetId: target.id,
      description: "Check GitHub CLI availability.",
      risk: "read-only",
      gate: noApprovalGate("CLI availability validation is read-only."),
      command: githubGhCommand(target, ["--version"], false)
    }),
    ValidateCommandOperation.make({
      id: `${target.id}:gh-auth-status`,
      targetId: target.id,
      description: "Validate GitHub CLI authentication.",
      risk: "read-only",
      gate: noApprovalGate("gh auth status checks authentication without publishing."),
      command: githubGhCommand(target, ["auth", "status"], true)
    }),
    githubDryRunOperation(target, dryRunSupport),
    PublishCommandOperation.make({
      id: `${target.id}:gh-release-create`,
      targetId: target.id,
      description: `Create GitHub release for ${model.identity.name}@${model.identity.version}.`,
      risk: publishRisk,
      gate: publishGate,
      command: githubReleaseCreateCommand(target, model)
    }),
    ...githubVerificationOperations(target, model)
  ] satisfies ReadonlyArray<Operation>
})

export const GitHubAdapter: GitHubTargetAdapter = {
  targetTag: "GitHubReleaseTarget",
  capabilities: githubTargetCapabilities,
  planOperations: planGitHubOperations
}
