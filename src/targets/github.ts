import * as Effect from "effect/Effect"
import {
  CommandSpec,
  executeGate,
  HttpEnvHeader,
  HttpHeader,
  HttpJsonArrayObjectFieldEqualsCheck,
  HttpJsonEqualsCheck,
  HttpRequestSpec,
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

export type * from "../types/effect-internal.js"

interface GitHubReleaseContext {
  readonly identity: ReleaseModel["identity"]
  readonly artifacts: ReleaseModel["artifacts"]
}

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
  targetCapabilitiesFor(target, githubValidationStrategy(target))

const targetArtifacts = (target: GitHubReleaseTarget, model: GitHubReleaseContext) =>
  model.artifacts.filter((artifact) => artifact.consumers.includes(target.id))

const pathBaseName = (path: string): string => {
  const parts = path.replaceAll("\\", "/").split("/")
  return parts[parts.length - 1] ?? path
}

const githubReleaseTag = (model: GitHubReleaseContext): string =>
  model.identity.tag ?? model.identity.version

const githubReleaseTitle = (model: GitHubReleaseContext): string =>
  `${model.identity.name} ${model.identity.version}`

const releaseArgs = (target: GitHubReleaseTarget, model: GitHubReleaseContext): ReadonlyArray<string> => {
  const args: Array<string> = [
    "release",
    "create",
    githubReleaseTag(model),
    "--repo",
    target.repository,
    "--title",
    githubReleaseTitle(model)
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

const githubReleaseApiUrl = (target: GitHubReleaseTarget, tag: string): string =>
  `https://api.github.com/repos/${target.repository}/releases/tags/${encodeURIComponent(tag)}`

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

const githubReleaseCreateCommand = (
  target: GitHubReleaseTarget,
  model: GitHubReleaseContext
): CommandSpec =>
  ghCommand(target, releaseArgs(target, model), true)

const githubVerificationOperations = (
  target: GitHubReleaseTarget,
  model: ReleaseModel
): ReadonlyArray<Operation> => {
  const tag = githubReleaseTag(model)
  const title = githubReleaseTitle(model)
  const isDraft = target.draft === true
  const isPrerelease = target.prerelease === true
  const artifactChecks = targetArtifacts(target, model).map((artifact) =>
    HttpJsonArrayObjectFieldEqualsCheck.make({
      path: ["assets"],
      field: "name",
      expected: pathBaseName(artifact.path)
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
