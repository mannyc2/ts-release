import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { CommandSpec } from "../domain/operation.js"
import {
  GitHubReleaseAvailability,
  NpmRemoteState,
  ReleaseEligibilityDecision,
  ReleaseEligibilityInput
} from "../domain/remote-state.js"
import { ReleaseIntent } from "../domain/release.js"
import { GitHubReleaseTarget, NpmRegistryTarget } from "../domain/target.js"
import { ReleaseCommandRunner } from "../host/host.js"
import { ReleaseEligibilityCheckError } from "./errors.js"

export type * from "../types/effect-internal.js"

export class ReleasePackageManifest extends Schema.Class<ReleasePackageManifest>("ReleasePackageManifest")({
  name: Schema.String,
  version: Schema.String
}) {}

export class ReleaseEligibilityRemoteCheck extends Schema.Class<ReleaseEligibilityRemoteCheck>(
  "ReleaseEligibilityRemoteCheck"
)({
  packageName: Schema.String,
  packageVersion: Schema.String,
  npmTargetId: Schema.String,
  npmRegistry: Schema.String,
  githubTargetId: Schema.String,
  githubRepository: Schema.String,
  githubTag: Schema.String,
  githubTokenEnv: Schema.optionalKey(Schema.String),
  expectedGithubDraft: Schema.Boolean
}) {}

class GitHubCliReleaseViewResponse extends Schema.Class<GitHubCliReleaseViewResponse>(
  "GitHubCliReleaseViewResponse"
)({
  isDraft: Schema.Boolean
}) {}

const decodeGitHubCliReleaseViewResponse = Schema.decodeUnknownEffect(GitHubCliReleaseViewResponse)

const releaseLabel = (input: ReleaseEligibilityInput): string =>
  `${input.packageName}@${input.packageVersion}`

const expectedGithubState = (input: ReleaseEligibilityInput): GitHubReleaseAvailability =>
  input.expectedGithubDraft ? "draft" : "published"

export const decideReleaseEligibility = (
  input: ReleaseEligibilityInput
): ReleaseEligibilityDecision => {
  if (input.npm === "missing" && input.github === "missing") {
    return ReleaseEligibilityDecision.make({
      shouldRelease: true,
      status: "ready",
      reason: `${releaseLabel(input)} is missing from npm and GitHub.`
    })
  }

  const expectedGithub = expectedGithubState(input)
  if (input.npm === "published" && input.github === expectedGithub) {
    return ReleaseEligibilityDecision.make({
      shouldRelease: false,
      status: "complete",
      reason: `${releaseLabel(input)} is already published to npm and GitHub.`
    })
  }

  if (input.npm === "published" && input.github === "draft" && !input.expectedGithubDraft) {
    return ReleaseEligibilityDecision.make({
      shouldRelease: false,
      status: "partial",
      reason: `${releaseLabel(input)} is published to npm, but GitHub release v${input.packageVersion} is still a draft.`
    })
  }

  if (input.npm === "published" && input.github === "published" && input.expectedGithubDraft) {
    return ReleaseEligibilityDecision.make({
      shouldRelease: false,
      status: "partial",
      reason: `${releaseLabel(input)} is published to npm, but GitHub release v${input.packageVersion} is public while the target expects a draft.`
    })
  }

  return ReleaseEligibilityDecision.make({
    shouldRelease: false,
    status: "partial",
    reason:
      `${releaseLabel(input)} has partial remote state: npm=${input.npm}, github=${input.github}, expected-github=${expectedGithub}.`
  })
}

const eligibilityError = (
  reason: string,
  targetId?: string
): ReleaseEligibilityCheckError =>
  ReleaseEligibilityCheckError.make({
    ...(targetId === undefined ? {} : { targetId }),
    reason
  })

const findNpmTarget = (
  intent: ReleaseIntent,
  packageName: string
): NpmRegistryTarget | undefined =>
  intent.targets.find((target): target is NpmRegistryTarget =>
    target._tag === "NpmRegistryTarget" && target.packageName === packageName
  )

const findNpmTargetById = (
  intent: ReleaseIntent,
  targetId: string
): NpmRegistryTarget | undefined =>
  intent.targets.find((target): target is NpmRegistryTarget =>
    target._tag === "NpmRegistryTarget" && target.id === targetId
  )

const findGitHubTarget = (intent: ReleaseIntent): GitHubReleaseTarget | undefined =>
  intent.targets.find((target): target is GitHubReleaseTarget => target._tag === "GitHubReleaseTarget")

export const releaseEligibilityRemoteCheckFromIntent = Effect.fn(
  "releaseEligibilityRemoteCheckFromIntent"
)(function*(manifest: ReleasePackageManifest, intent: ReleaseIntent) {
  const npmTarget = findNpmTarget(intent, manifest.name)
  if (npmTarget === undefined) {
    const npmTargetById = findNpmTargetById(intent, "npm")
    if (npmTargetById !== undefined) {
      return yield* Effect.fail(
        eligibilityError(
          `npm target ${npmTargetById.id} packageName ${npmTargetById.packageName} does not match package manifest ${manifest.name}.`,
          npmTargetById.id
        )
      )
    }
    return yield* Effect.fail(
      eligibilityError(`release config must include an npm target for ${manifest.name}`)
    )
  }

  const githubTarget = findGitHubTarget(intent)
  if (githubTarget === undefined) {
    return yield* Effect.fail(
      eligibilityError("release config must include a GitHub release target")
    )
  }

  return ReleaseEligibilityRemoteCheck.make({
    packageName: manifest.name,
    packageVersion: manifest.version,
    npmTargetId: npmTarget.id,
    npmRegistry: npmTarget.registry,
    githubTargetId: githubTarget.id,
    githubRepository: githubTarget.repository,
    githubTag: intent.identity.tag ?? intent.identity.version,
    ...(githubTarget.tokenEnv === undefined ? {} : { githubTokenEnv: githubTarget.tokenEnv }),
    expectedGithubDraft: githubTarget.draft ?? false
  })
})

const looksMissing = (stdout: string, stderr: string): boolean => {
  const text = `${stdout}\n${stderr}`.toLowerCase()
  return text.includes("not found") || text.includes("404") || text.includes("e404")
}

const firstDiagnosticLine = (result: { readonly exitCode: number; readonly stdout: string; readonly stderr: string }): string => {
  const lines = `${result.stderr}\n${result.stdout}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  return lines[0] ?? `exit code ${result.exitCode}`
}

const npmViewCommand = (input: ReleaseEligibilityRemoteCheck): CommandSpec =>
  CommandSpec.make({
    executable: "npm",
    args: [
      "view",
      `${input.packageName}@${input.packageVersion}`,
      "version",
      "--registry",
      input.npmRegistry
    ],
    requiredEnv: [],
    redactedEnv: []
  })

const githubReleaseViewCommand = (input: ReleaseEligibilityRemoteCheck): CommandSpec =>
  CommandSpec.make({
    executable: "gh",
    args: [
      "release",
      "view",
      input.githubTag,
      "--repo",
      input.githubRepository,
      "--json",
      "isDraft,tagName,publishedAt"
    ],
    requiredEnv: input.githubTokenEnv === undefined ? [] : [input.githubTokenEnv],
    redactedEnv: input.githubTokenEnv === undefined ? [] : [input.githubTokenEnv]
  })

const parseGitHubCliReleaseView = Effect.fn("parseGitHubCliReleaseView")(function*(
  input: ReleaseEligibilityRemoteCheck,
  stdout: string
) {
  const parsed: unknown = yield* Effect.try({
    try: () => JSON.parse(stdout),
    catch: (cause) =>
      eligibilityError(
        cause instanceof Error ? cause.message : String(cause),
        input.githubTargetId
      )
  })

  const response = yield* decodeGitHubCliReleaseViewResponse(parsed).pipe(
    Effect.mapError((error) =>
      eligibilityError(`gh release view returned malformed JSON: ${error.message}`, input.githubTargetId)
    )
  )
  return response.isDraft ? "draft" : "published"
})

export const classifyNpmRemoteState = Effect.fn("classifyNpmRemoteState")(function*(
  input: ReleaseEligibilityRemoteCheck
) {
  const commandRunner = yield* ReleaseCommandRunner
  const result = yield* commandRunner.runCommand(npmViewCommand(input))
  if (result.exitCode === 0) {
    return "published" satisfies NpmRemoteState
  }
  if (looksMissing(result.stdout, result.stderr)) {
    return "missing" satisfies NpmRemoteState
  }
  return yield* Effect.fail(
    eligibilityError(
      `npm view failed while checking package state: ${firstDiagnosticLine(result)}`,
      input.npmTargetId
    )
  )
})

export const classifyGitHubReleaseAvailability = Effect.fn("classifyGitHubReleaseAvailability")(function*(
  input: ReleaseEligibilityRemoteCheck
) {
  const commandRunner = yield* ReleaseCommandRunner
  const result = yield* commandRunner.runCommand(githubReleaseViewCommand(input))
  if (result.exitCode === 0) {
    return yield* parseGitHubCliReleaseView(input, result.stdout)
  }
  if (looksMissing(result.stdout, result.stderr)) {
    return "missing" satisfies GitHubReleaseAvailability
  }
  return yield* Effect.fail(
    eligibilityError(
      `gh release view failed while checking release state: ${firstDiagnosticLine(result)}`,
      input.githubTargetId
    )
  )
})

export const checkReleaseEligibility = Effect.fn("checkReleaseEligibility")(function*(
  input: ReleaseEligibilityRemoteCheck
) {
  const npm = yield* classifyNpmRemoteState(input)
  const github = yield* classifyGitHubReleaseAvailability(input)
  return decideReleaseEligibility(
    ReleaseEligibilityInput.make({
      packageName: input.packageName,
      packageVersion: input.packageVersion,
      expectedGithubDraft: input.expectedGithubDraft,
      npm,
      github
    })
  )
})

export const renderReleaseEligibilityText = (decision: ReleaseEligibilityDecision): string =>
  `release eligibility status=${decision.status} should-release=${decision.shouldRelease} reason=${JSON.stringify(decision.reason)}\n`

export const renderReleaseEligibilityJson = (decision: ReleaseEligibilityDecision): string =>
  `${JSON.stringify(decision, null, 2)}\n`
