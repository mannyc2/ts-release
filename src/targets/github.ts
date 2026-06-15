import * as Effect from "effect/Effect"
import {
  CommandSpec,
  executeGate,
  irreversibleGate,
  noApprovalGate,
  Operation,
  PublishCommandOperation,
  ValidateCommandOperation,
  ValidationNoteOperation,
  VerifyRemoteOperation
} from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  GitHubReleaseTarget,
  TargetCapabilities,
  targetAuthRequirement,
  TargetValidationStrategy
} from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"
import { GitHubTargetAdapter } from "./adapter.js"

export type * from "../types/effect-internal.js"

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

const githubValidationStrategy = (target: GitHubReleaseTarget): TargetValidationStrategy =>
  target.dryRunSupport === "none" ? "skipped" : "simulated-plan"

export const githubTargetCapabilities = (target: GitHubReleaseTarget): TargetCapabilities =>
  TargetCapabilities.make({
    targetId: target.id,
    targetTag: target._tag,
    authRequirement: targetAuthRequirement(target),
    dryRunSupport: target.dryRunSupport,
    mutability: target.mutability,
    recovery: target.recovery,
    validationStrategy: githubValidationStrategy(target)
  })

const targetArtifacts = (target: GitHubReleaseTarget, model: ReleaseModel) =>
  model.artifacts.filter((artifact) => artifact.consumers.includes(target.id))

const pathBaseName = (path: string): string => {
  const parts = path.replaceAll("\\", "/").split("/")
  return parts[parts.length - 1] ?? path
}

const jqString = (value: string): string =>
  JSON.stringify(value)

const jqAssert = (condition: string, message: string): string =>
  `if ${condition} then empty else error(${jqString(message)}) end`

const releaseViewJsonCommand = (
  target: GitHubReleaseTarget,
  model: ReleaseModel,
  fields: ReadonlyArray<string>,
  jq: string
): CommandSpec =>
  ghCommand(target, [
    "release",
    "view",
    model.identity.tag ?? model.identity.version,
    "--repo",
    target.repository,
    "--json",
    fields.join(","),
    "--jq",
    jq
  ], true)

const releaseArgs = (target: GitHubReleaseTarget, model: ReleaseModel): ReadonlyArray<string> => {
  const args: Array<string> = [
    "release",
    "create",
    model.identity.tag ?? model.identity.version,
    "--repo",
    target.repository,
    "--title",
    `${model.identity.name} ${model.identity.version}`
  ]
  if (target.draft === true) {
    args.push("--draft")
  }
  if (target.prerelease === true) {
    args.push("--prerelease")
  }
  if (model.identity.notes !== undefined) {
    args.push("--notes", model.identity.notes)
  }
  for (const artifact of targetArtifacts(target, model)) {
    args.push(artifact.path)
  }
  return args
}

const githubVerificationOperations = (
  target: GitHubReleaseTarget,
  model: ReleaseModel
): ReadonlyArray<Operation> => {
  const tag = model.identity.tag ?? model.identity.version
  const title = `${model.identity.name} ${model.identity.version}`
  const isDraft = target.draft === true
  const isPrerelease = target.prerelease === true

  return [
    VerifyRemoteOperation.make({
      id: `${target.id}:gh-release-view`,
      targetId: target.id,
      description: "Verify the GitHub release tag exists.",
      risk: "read-only",
      gate: noApprovalGate("Release verification is read-only."),
      command: releaseViewJsonCommand(
        target,
        model,
        ["tagName"],
        jqAssert(`.tagName == ${jqString(tag)}`, `Expected release tag ${tag}.`)
      )
    }),
    VerifyRemoteOperation.make({
      id: `${target.id}:gh-release-verify-title`,
      targetId: target.id,
      description: "Verify the GitHub release title.",
      risk: "read-only",
      gate: noApprovalGate("Release title verification is read-only."),
      command: releaseViewJsonCommand(
        target,
        model,
        ["name"],
        jqAssert(`.name == ${jqString(title)}`, `Expected release title ${title}.`)
      )
    }),
    VerifyRemoteOperation.make({
      id: `${target.id}:gh-release-verify-draft`,
      targetId: target.id,
      description: "Verify the GitHub release draft flag.",
      risk: "read-only",
      gate: noApprovalGate("Release draft verification is read-only."),
      command: releaseViewJsonCommand(
        target,
        model,
        ["isDraft"],
        jqAssert(`.isDraft == ${isDraft ? "true" : "false"}`, `Expected release draft flag ${isDraft}.`)
      )
    }),
    VerifyRemoteOperation.make({
      id: `${target.id}:gh-release-verify-prerelease`,
      targetId: target.id,
      description: "Verify the GitHub release prerelease flag.",
      risk: "read-only",
      gate: noApprovalGate("Release prerelease verification is read-only."),
      command: releaseViewJsonCommand(
        target,
        model,
        ["isPrerelease"],
        jqAssert(
          `.isPrerelease == ${isPrerelease ? "true" : "false"}`,
          `Expected release prerelease flag ${isPrerelease}.`
        )
      )
    }),
    ...targetArtifacts(target, model).map((artifact) => {
      const assetName = pathBaseName(artifact.path)
      return VerifyRemoteOperation.make({
        id: `${target.id}:gh-release-verify-asset-${artifact.id}`,
        targetId: target.id,
        description: `Verify GitHub release asset ${assetName}.`,
        risk: "read-only",
        gate: noApprovalGate("Release asset verification is read-only."),
        command: releaseViewJsonCommand(
          target,
          model,
          ["assets"],
          jqAssert(
            `.assets | map(.name) | index(${jqString(assetName)}) != null`,
            `Expected release asset ${assetName}`
          )
        )
      })
    })
  ]
}

const githubDryRunOperation = (target: GitHubReleaseTarget): Operation =>
  ValidationNoteOperation.make({
    id: `${target.id}:gh-release-dry-run`,
    targetId: target.id,
    description: target.dryRunSupport === "none"
      ? "Record skipped GitHub release dry-run validation."
      : "Record simulated GitHub release dry-run validation.",
    risk: "read-only",
    gate: noApprovalGate("Validation notes do not modify local or remote state."),
    message: target.dryRunSupport === "none"
      ? "GitHub release dry-run validation was skipped because this target declares no dry-run support."
      : "GitHub release dry-run validation is simulated by the deterministic release plan; gh release create has no native dry-run command.",
    skipped: target.dryRunSupport === "none",
    severity: target.dryRunSupport === "none" ? "warning" : "info"
  })

export const planGitHubOperations = Effect.fn("planGitHubOperations")(function*(
  target: GitHubReleaseTarget,
  model: ReleaseModel
) {
  if (model.strict && target.dryRunSupport === "none") {
    return yield* Effect.fail(
      PlanConstructionError.make({
        targetId: target.id,
        reason: "GitHub release target declares no dry-run support in strict mode."
      })
    )
  }
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
      command: ghCommand(target, ["--version"], false)
    }),
    ValidateCommandOperation.make({
      id: `${target.id}:gh-auth-status`,
      targetId: target.id,
      description: "Validate GitHub CLI authentication.",
      risk: "read-only",
      gate: noApprovalGate("gh auth status checks authentication without publishing."),
      command: ghCommand(target, ["auth", "status"], true)
    }),
    githubDryRunOperation(target),
    PublishCommandOperation.make({
      id: `${target.id}:gh-release-create`,
      targetId: target.id,
      description: `Create GitHub release for ${model.identity.name}@${model.identity.version}.`,
      risk: publishRisk,
      gate: publishGate,
      command: ghCommand(target, releaseArgs(target, model), true)
    }),
    ...githubVerificationOperations(target, model)
  ] satisfies ReadonlyArray<Operation>
})

export const GitHubAdapter: GitHubTargetAdapter = {
  targetTag: "GitHubReleaseTarget",
  capabilities: githubTargetCapabilities,
  planOperations: planGitHubOperations
}
