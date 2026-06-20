import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import * as Semver from "semver"
import { CommandSpec } from "../domain/operation.js"
import {
  GitHubReleaseAvailability,
  NpmRemoteState,
  ReleaseEligibilityDecision,
  ReleaseEligibilityInput
} from "../domain/remote-state.js"
import {
  ConventionalCommitReleaseRule,
  ConventionalCommitsReleaseDecision,
  GitTagReleaseDecision,
  IntentFilesReleaseDecision,
  PackageManifestReleaseIdentitySource,
  ReleaseBump,
  ReleaseDecisionStrategy,
  ReleaseIdentity,
  ReleaseIntent,
  ReleaseIntentFile,
  ReleasePackageManifest,
  RemoteStateReleaseDecision,
  StaticReleaseIdentitySource
} from "../domain/release.js"
import { GitHubReleaseTarget, NpmRegistryTarget, TargetConfig } from "../domain/target.js"
import { ReleaseCommandRunner } from "../host/host.js"
import { ReleaseEligibilityCheckError } from "./errors.js"
import {
  readReleasePackageManifest,
  renderReleaseVersionTemplate,
  resolveIdentityCommit,
  resolveReleaseIdentitySource,
  validateNonEmptySafeRelativePath
} from "./normalize-release.js"

export type * from "../types/effect-internal.js"

export { ReleasePackageManifest } from "../domain/release.js"

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

interface ReleaseEligibilityMetadata {
  readonly strategy?: string | undefined
  readonly source?: string | undefined
}

interface TemplateParts {
  readonly prefix: string
  readonly suffix: string
}

interface MatchingTag {
  readonly tag: string
  readonly version: string
}

interface ConventionalCommit {
  readonly type: string | undefined
  readonly breaking: boolean
}

interface IntentFileSet {
  readonly packageName: string
  readonly directory: string
  readonly files: ReadonlyArray<ReleaseIntentFile>
}

const decodeGitHubCliReleaseViewResponse = Schema.decodeUnknownEffect(GitHubCliReleaseViewResponse)
const decodeReleaseIntentFile = Schema.decodeUnknownEffect(ReleaseIntentFile)

const defaultReleaseRules: ReadonlyArray<ConventionalCommitReleaseRule> = [
  ConventionalCommitReleaseRule.make({ breaking: true, release: "major" }),
  ConventionalCommitReleaseRule.make({ type: "feat", release: "minor" }),
  ConventionalCommitReleaseRule.make({ type: "fix", release: "patch" })
]

const releaseLabel = (input: ReleaseEligibilityInput): string =>
  `${input.packageName}@${input.packageVersion}`

const expectedGithubState = (input: ReleaseEligibilityInput): GitHubReleaseAvailability =>
  input.expectedGithubDraft ? "draft" : "published"

const decisionStrategy = (metadata: ReleaseEligibilityMetadata | undefined): string | undefined =>
  metadata?.strategy

const enrichDecision = (
  decision: ReleaseEligibilityDecision,
  input: ReleaseEligibilityRemoteCheck,
  metadata: ReleaseEligibilityMetadata | undefined
): ReleaseEligibilityDecision => {
  const strategy = decisionStrategy(metadata)
  return ReleaseEligibilityDecision.make({
    shouldRelease: decision.shouldRelease,
    status: decision.status,
    reason: decision.reason,
    ...(strategy === undefined ? {} : { strategy }),
    packageName: input.packageName,
    packageVersion: input.packageVersion,
    githubTag: input.githubTag,
    ...(metadata?.source === undefined ? {} : { source: metadata.source })
  })
}

const skippedDecision = (
  reason: string,
  metadata: ReleaseEligibilityMetadata
): ReleaseEligibilityDecision =>
  ReleaseEligibilityDecision.make({
    shouldRelease: false,
    status: "skipped",
    reason,
    ...(metadata.strategy === undefined ? {} : { strategy: metadata.strategy }),
    ...(metadata.source === undefined ? {} : { source: metadata.source })
  })

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
  targetId?: string,
  cause?: unknown
): ReleaseEligibilityCheckError =>
  ReleaseEligibilityCheckError.make({
    ...(targetId === undefined ? {} : { targetId }),
    reason,
    ...(cause === undefined ? {} : { cause })
  })

const findNpmTarget = (
  targets: ReadonlyArray<TargetConfig>,
  packageName: string
): NpmRegistryTarget | undefined =>
  targets.find((target): target is NpmRegistryTarget =>
    target._tag === "NpmRegistryTarget" && target.packageName === packageName
  )

const findNpmTargetById = (
  targets: ReadonlyArray<TargetConfig>,
  targetId: string
): NpmRegistryTarget | undefined =>
  targets.find((target): target is NpmRegistryTarget =>
    target._tag === "NpmRegistryTarget" && target.id === targetId
  )

const findGitHubTarget = (targets: ReadonlyArray<TargetConfig>): GitHubReleaseTarget | undefined =>
  targets.find((target): target is GitHubReleaseTarget => target._tag === "GitHubReleaseTarget")

export const releaseEligibilityRemoteCheckFromIdentity = Effect.fn(
  "releaseEligibilityRemoteCheckFromIdentity"
)(function*(identity: ReleaseIdentity, targets: ReadonlyArray<TargetConfig>) {
  const npmTarget = findNpmTarget(targets, identity.name)
  if (npmTarget === undefined) {
    const npmTargetById = findNpmTargetById(targets, "npm")
    if (npmTargetById !== undefined) {
      return yield* Effect.fail(
        eligibilityError(
          `npm target ${npmTargetById.id} packageName ${npmTargetById.packageName} does not match release identity ${identity.name}.`,
          npmTargetById.id
        )
      )
    }
    return yield* Effect.fail(
      eligibilityError(`release config must include an npm target for ${identity.name}`)
    )
  }

  const githubTarget = findGitHubTarget(targets)
  if (githubTarget === undefined) {
    return yield* Effect.fail(
      eligibilityError("release config must include a GitHub release target")
    )
  }

  return ReleaseEligibilityRemoteCheck.make({
    packageName: identity.name,
    packageVersion: identity.version,
    npmTargetId: npmTarget.id,
    npmRegistry: npmTarget.registry,
    githubTargetId: githubTarget.id,
    githubRepository: githubTarget.repository,
    githubTag: identity.tag ?? identity.version,
    ...(githubTarget.tokenEnv === undefined ? {} : { githubTokenEnv: githubTarget.tokenEnv }),
    expectedGithubDraft: githubTarget.draft ?? false
  })
})

export const releaseEligibilityRemoteCheckFromIntent = Effect.fn(
  "releaseEligibilityRemoteCheckFromIntent"
)(function*(manifest: ReleasePackageManifest, intent: ReleaseIntent) {
  const staticTag = intent.identity instanceof StaticReleaseIdentitySource ? intent.identity.tag : undefined
  return yield* releaseEligibilityRemoteCheckFromIdentity(
    ReleaseIdentity.make({
      name: manifest.name,
      version: manifest.version,
      commit: "HEAD",
      ...(staticTag === undefined ? {} : { tag: staticTag })
    }),
    intent.targets
  )
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

const gitTagsAtHeadCommand = (root: string): CommandSpec =>
  CommandSpec.make({
    executable: "git",
    args: ["tag", "--points-at", "HEAD"],
    cwd: root,
    requiredEnv: [],
    redactedEnv: []
  })

const gitListTagsCommand = (root: string): CommandSpec =>
  CommandSpec.make({
    executable: "git",
    args: ["tag", "--list", "--merged", "HEAD"],
    cwd: root,
    requiredEnv: [],
    redactedEnv: []
  })

const gitLogCommand = (root: string, sinceTag: string | undefined): CommandSpec =>
  CommandSpec.make({
    executable: "git",
    args: sinceTag === undefined
      ? ["log", "--format=%B%x1e"]
      : ["log", `${sinceTag}..HEAD`, "--format=%B%x1e"],
    cwd: root,
    requiredEnv: [],
    redactedEnv: []
  })

const parseGitHubCliReleaseView = Effect.fn("parseGitHubCliReleaseView")(function*(
  input: ReleaseEligibilityRemoteCheck,
  stdout: string
) {
  const parsed: unknown = yield* Effect.try({
    try: () => JSON.parse(stdout),
    catch: (cause) =>
      eligibilityError(
        "gh release view returned invalid JSON.",
        input.githubTargetId,
        cause
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
  input: ReleaseEligibilityRemoteCheck,
  metadata: ReleaseEligibilityMetadata | undefined = undefined
) {
  const npm = yield* classifyNpmRemoteState(input)
  const github = yield* classifyGitHubReleaseAvailability(input)
  return enrichDecision(
    decideReleaseEligibility(
      ReleaseEligibilityInput.make({
        packageName: input.packageName,
        packageVersion: input.packageVersion,
        expectedGithubDraft: input.expectedGithubDraft,
        npm,
        github
      })
    ),
    input,
    metadata
  )
})

const strategyFromIntent = (intent: ReleaseIntent): ReleaseDecisionStrategy =>
  intent.releaseDecision ?? RemoteStateReleaseDecision.make({})

const identitySourceName = (intent: ReleaseIntent): string =>
  intent.identity instanceof PackageManifestReleaseIdentitySource
    ? "PackageManifestReleaseIdentitySource"
    : "StaticReleaseIdentitySource"

const checkRemoteStateForIdentity = Effect.fn("checkRemoteStateForIdentity")(function*(
  identity: ReleaseIdentity,
  targets: ReadonlyArray<TargetConfig>,
  metadata: ReleaseEligibilityMetadata
) {
  const remoteCheck = yield* releaseEligibilityRemoteCheckFromIdentity(identity, targets)
  return yield* checkReleaseEligibility(remoteCheck, metadata)
})

type ReleaseDecisionResolution =
  | {
    readonly _tag: "Skipped"
    readonly decision: ReleaseEligibilityDecision
  }
  | {
    readonly _tag: "Resolved"
    readonly identity: ReleaseIdentity
    readonly targets: ReadonlyArray<TargetConfig>
    readonly metadata: ReleaseEligibilityMetadata
  }

const skippedReleaseResolution = (decision: ReleaseEligibilityDecision): ReleaseDecisionResolution => ({
  _tag: "Skipped",
  decision
})

const resolvedReleaseResolution = (
  identity: ReleaseIdentity,
  targets: ReadonlyArray<TargetConfig>,
  metadata: ReleaseEligibilityMetadata
): ReleaseDecisionResolution => ({
  _tag: "Resolved",
  identity,
  targets,
  metadata
})

const resolveRemoteStateDecision = Effect.fn("resolveRemoteStateDecision")(function*(
  strategy: RemoteStateReleaseDecision,
  intent: ReleaseIntent,
  root: string
) {
  const identity = yield* resolveReleaseIdentitySource(intent.identity, root)
  return resolvedReleaseResolution(identity, intent.targets, {
    strategy: strategy._tag,
    source: identitySourceName(intent)
  })
})

const templateParts = (template: string, field: string): Effect.Effect<TemplateParts, ReleaseEligibilityCheckError> => {
  const placeholder = "{version}"
  const firstIndex = template.indexOf(placeholder)
  const lastIndex = template.lastIndexOf(placeholder)
  if (firstIndex >= 0 && firstIndex === lastIndex) {
    return Effect.succeed({
      prefix: template.slice(0, firstIndex),
      suffix: template.slice(firstIndex + placeholder.length)
    })
  }
  return Effect.fail(
    eligibilityError(`${field} must contain exactly one {version} placeholder.`)
  )
}

const versionFromTag = (
  tag: string,
  parts: TemplateParts
): string | undefined => {
  if (!tag.startsWith(parts.prefix) || !tag.endsWith(parts.suffix)) {
    return undefined
  }
  const suffixStart = tag.length - parts.suffix.length
  const version = tag.slice(parts.prefix.length, suffixStart)
  return version.length === 0 ? undefined : version
}

const stdoutLines = (stdout: string): ReadonlyArray<string> =>
  stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0)

const readMatchingCurrentTags = Effect.fn("readMatchingCurrentTags")(function*(
  root: string,
  template: string,
  providedTag: string | undefined,
  requireCurrentRef: boolean
) {
  const parts = yield* templateParts(template, "releaseDecision.tagTemplate")
  const tags = providedTag !== undefined && !requireCurrentRef
    ? [providedTag]
    : yield* Effect.gen(function*() {
      const commandRunner = yield* ReleaseCommandRunner
      const result = yield* commandRunner.runCommand(gitTagsAtHeadCommand(root))
      if (result.exitCode !== 0) {
        return yield* Effect.fail(
          eligibilityError(`git tag --points-at HEAD failed: ${firstDiagnosticLine(result)}`)
        )
      }
      const currentTags = stdoutLines(result.stdout)
      return providedTag === undefined
        ? currentTags
        : currentTags.filter((tag) => tag === providedTag)
    })
  return tags.flatMap((tag) => {
    const version = versionFromTag(tag, parts)
    return version === undefined ? [] : [{ tag, version }]
  })
})

const resolveTagIdentity = Effect.fn("resolveTagIdentity")(function*(
  root: string,
  manifest: ReleasePackageManifest,
  tag: MatchingTag
) {
  return yield* resolveIdentityCommit(
    ReleaseIdentity.make({
      name: manifest.name,
      version: tag.version,
      commit: "HEAD",
      tag: tag.tag
    }),
    root
  )
})

const resolveGitTagDecision = Effect.fn("resolveGitTagDecision")(function*(
  strategy: GitTagReleaseDecision,
  intent: ReleaseIntent,
  root: string
) {
  const metadata = {
    strategy: strategy._tag,
    source: strategy.tag === undefined ? "git tag --points-at HEAD" : `tag ${strategy.tag}`
  }
  const manifest = yield* readReleasePackageManifest(
    root,
    strategy.packagePath ?? "package.json",
    "releaseDecision.packagePath"
  )
  const tagTemplate = strategy.tagTemplate ?? "v{version}"
  const requireCurrentRef = strategy.requireCurrentRef ?? true
  const matchingTags = yield* readMatchingCurrentTags(root, tagTemplate, strategy.tag, requireCurrentRef)
  if (matchingTags.length === 0) {
    if (strategy.tag !== undefined && requireCurrentRef) {
      return skippedReleaseResolution(
        skippedDecision(`Release tag ${strategy.tag} does not point at HEAD.`, metadata)
      )
    }
    return skippedReleaseResolution(
      skippedDecision("No release tag matching releaseDecision.tagTemplate points at HEAD.", metadata)
    )
  }
  if (matchingTags.length > 1) {
    return yield* Effect.fail(
      eligibilityError(`Multiple release tags match ${tagTemplate}: ${matchingTags.map((tag) => tag.tag).join(", ")}.`)
    )
  }
  const tag = matchingTags[0]
  if (tag === undefined) {
    return skippedReleaseResolution(
      skippedDecision("No release tag matching releaseDecision.tagTemplate points at HEAD.", metadata)
    )
  }
  const identity = yield* resolveTagIdentity(root, manifest, tag)
  return resolvedReleaseResolution(identity, intent.targets, metadata)
})

const matchingTagsFromList = Effect.fn("matchingTagsFromList")(function*(
  stdout: string,
  template: string
) {
  const parts = yield* templateParts(template, "releaseDecision.tagTemplate")
  const candidates: Array<MatchingTag> = []
  for (const tag of stdoutLines(stdout)) {
    const version = versionFromTag(tag, parts)
    if (version === undefined) {
      continue
    }
    const validVersion = Semver.valid(version)
    if (validVersion !== null) {
      candidates.push({ tag, version: validVersion })
    }
  }
  return candidates.sort((left, right) => Semver.rcompare(left.version, right.version))
})

const latestMatchingTag = Effect.fn("latestMatchingTag")(function*(
  root: string,
  template: string
) {
  const commandRunner = yield* ReleaseCommandRunner
  const result = yield* commandRunner.runCommand(gitListTagsCommand(root))
  if (result.exitCode !== 0) {
    return yield* Effect.fail(
      eligibilityError(`git tag --list failed: ${firstDiagnosticLine(result)}`)
    )
  }
  const matching = yield* matchingTagsFromList(result.stdout, template)
  return matching[0]
})

const parseCommit = (message: string): ConventionalCommit => {
  const firstLine = message.split(/\r?\n/)[0]?.trim() ?? ""
  const match = /^([A-Za-z][A-Za-z0-9-]*)(?:\([^)]+\))?(!)?:/.exec(firstLine)
  const type = match?.[1]
  const breakingSubject = match?.[2] === "!"
  const breakingBody = /^BREAKING[ -]CHANGE:/m.test(message)
  return {
    type,
    breaking: breakingSubject || breakingBody
  }
}

const bumpRank = (bump: ReleaseBump): number => {
  switch (bump) {
    case "major":
      return 3
    case "minor":
      return 2
    case "patch":
      return 1
    case "none":
      return 0
  }
}

const higherBump = (left: ReleaseBump, right: ReleaseBump): ReleaseBump =>
  bumpRank(right) > bumpRank(left) ? right : left

const ruleMatches = (rule: ConventionalCommitReleaseRule, commit: ConventionalCommit): boolean => {
  if (rule.breaking !== undefined && rule.breaking !== commit.breaking) {
    return false
  }
  if (rule.type !== undefined && rule.type !== commit.type) {
    return false
  }
  return rule.breaking !== undefined || rule.type !== undefined
}

const classifyConventionalCommitBump = (
  message: string,
  rules: ReadonlyArray<ConventionalCommitReleaseRule>
): ReleaseBump => {
  const commit = parseCommit(message)
  let bump: ReleaseBump = "none"
  for (const rule of rules) {
    if (ruleMatches(rule, commit)) {
      bump = higherBump(bump, rule.release)
    }
  }
  return bump
}

const readCommitMessages = Effect.fn("readCommitMessages")(function*(
  root: string,
  sinceTag: string | undefined
) {
  const commandRunner = yield* ReleaseCommandRunner
  const result = yield* commandRunner.runCommand(gitLogCommand(root, sinceTag))
  if (result.exitCode !== 0) {
    return yield* Effect.fail(
      eligibilityError(`git log failed: ${firstDiagnosticLine(result)}`)
    )
  }
  return result.stdout
    .split("\x1e")
    .map((message) => message.trim())
    .filter((message) => message.length > 0)
})

const nextSemverVersion = (
  version: string,
  bump: "major" | "minor" | "patch",
  field: string
): Effect.Effect<string, ReleaseEligibilityCheckError> => {
  const validVersion = Semver.valid(version)
  if (validVersion === null) {
    return Effect.fail(eligibilityError(`${field} must be a valid SemVer version.`))
  }
  const nextVersion = Semver.inc(validVersion, bump)
  if (nextVersion !== null) {
    return Effect.succeed(nextVersion)
  }
  return Effect.fail(eligibilityError(`Unable to increment ${validVersion} as ${bump}.`))
}

const highestConventionalBump = (
  messages: ReadonlyArray<string>,
  rules: ReadonlyArray<ConventionalCommitReleaseRule>
): ReleaseBump => {
  let bump: ReleaseBump = "none"
  for (const message of messages) {
    bump = higherBump(bump, classifyConventionalCommitBump(message, rules))
  }
  return bump
}

const resolveConventionalCommitsDecision = Effect.fn("resolveConventionalCommitsDecision")(function*(
  strategy: ConventionalCommitsReleaseDecision,
  intent: ReleaseIntent,
  root: string
) {
  const metadata = {
    strategy: strategy._tag,
    source: "git commits"
  }
  const tagTemplate = strategy.tagTemplate ?? "v{version}"
  const manifest = yield* readReleasePackageManifest(
    root,
    strategy.packagePath ?? "package.json",
    "releaseDecision.packagePath"
  )
  const latest = yield* latestMatchingTag(root, tagTemplate)
  const messages = yield* readCommitMessages(root, latest?.tag)
  if (messages.length === 0) {
    return skippedReleaseResolution(skippedDecision("No commits were found for conventional commit analysis.", metadata))
  }
  const bump = highestConventionalBump(messages, strategy.releaseRules ?? defaultReleaseRules)
  if (bump === "none") {
    return skippedReleaseResolution(skippedDecision("No releasable conventional commits were found.", metadata))
  }
  const baseVersion = latest?.version ?? manifest.version
  const nextVersion = yield* nextSemverVersion(baseVersion, bump, latest === undefined ? "package.json version" : "release tag version")
  const identity = yield* resolveIdentityCommit(
    ReleaseIdentity.make({
      name: manifest.name,
      version: nextVersion,
      commit: "HEAD",
      tag: renderReleaseVersionTemplate(tagTemplate, nextVersion)
    }),
    root
  )
  return resolvedReleaseResolution(identity, intent.targets, metadata)
})

const readIntentFiles = Effect.fn("readIntentFiles")(function*(
  root: string,
  strategy: IntentFilesReleaseDecision
) {
  const directory = strategy.directory ?? ".release/intents"
  yield* validateNonEmptySafeRelativePath("releaseDecision.directory", directory)
  const manifest = yield* readReleasePackageManifest(
    root,
    strategy.packagePath ?? "package.json",
    "releaseDecision.packagePath"
  )
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const absoluteDirectory = path.resolve(root, directory)
  const entries = yield* fs.readDirectory(absoluteDirectory).pipe(
    Effect.catch(() => Effect.succeed<Array<string>>([]))
  )
  const files: Array<ReleaseIntentFile> = []
  for (const entry of entries.filter((item) => item.endsWith(".json")).sort()) {
    yield* validateNonEmptySafeRelativePath("releaseDecision.intentFile", entry)
    const intentPath = path.join(absoluteDirectory, entry)
    const contents = yield* fs.readFileString(intentPath).pipe(
      Effect.mapError((error) =>
        eligibilityError(`Unable to read release intent file ${entry}: ${error.message}`, undefined, error)
      )
    )
    const parsed: unknown = yield* Effect.try({
      try: () => JSON.parse(contents),
      catch: (cause) =>
        eligibilityError(
          `Release intent file ${entry} is not valid JSON.`,
          undefined,
          cause
        )
    })
    const decoded = yield* decodeReleaseIntentFile(parsed).pipe(
      Effect.mapError((error) =>
        eligibilityError(`Release intent file ${entry} is invalid: ${error.message}`)
      )
    )
    if (decoded.package === manifest.name) {
      files.push(decoded)
    }
  }
  return {
    manifest,
    packageName: manifest.name,
    directory,
    files
  }
})

const highestIntentBump = (files: ReadonlyArray<ReleaseIntentFile>): ReleaseBump => {
  let bump: ReleaseBump = "none"
  for (const file of files) {
    const release = file.empty === true ? "none" : file.release
    bump = higherBump(bump, release)
  }
  return bump
}

const resolveIntentFilesDecision = Effect.fn("resolveIntentFilesDecision")(function*(
  strategy: IntentFilesReleaseDecision,
  intent: ReleaseIntent,
  root: string
) {
  const metadata = {
    strategy: strategy._tag,
    source: strategy.directory ?? ".release/intents"
  }
  const intentFiles = yield* readIntentFiles(root, strategy)
  const manifest = intentFiles.manifest
  if (intentFiles.files.length === 0) {
    return skippedReleaseResolution(skippedDecision(`No release intent files were found for ${manifest.name}.`, metadata))
  }
  const bump = highestIntentBump(intentFiles.files)
  if (bump === "none") {
    return skippedReleaseResolution(skippedDecision(`Release intent files for ${manifest.name} request no release.`, metadata))
  }
  const nextVersion = yield* nextSemverVersion(manifest.version, bump, "package.json version")
  const tagTemplate = strategy.tagTemplate ?? "v{version}"
  yield* templateParts(tagTemplate, "releaseDecision.tagTemplate")
  const identity = yield* resolveIdentityCommit(
    ReleaseIdentity.make({
      name: manifest.name,
      version: nextVersion,
      commit: "HEAD",
      tag: renderReleaseVersionTemplate(tagTemplate, nextVersion)
    }),
    root
  )
  return resolvedReleaseResolution(identity, intent.targets, metadata)
})

const resolveReleaseDecision = Effect.fn("resolveReleaseDecision")(function*(
  intent: ReleaseIntent,
  root: string = "."
) {
  const strategy = strategyFromIntent(intent)
  switch (strategy._tag) {
    case "RemoteStateReleaseDecision":
      return yield* resolveRemoteStateDecision(strategy, intent, root)
    case "GitTagReleaseDecision":
      return yield* resolveGitTagDecision(strategy, intent, root)
    case "ConventionalCommitsReleaseDecision":
      return yield* resolveConventionalCommitsDecision(strategy, intent, root)
    case "IntentFilesReleaseDecision":
      return yield* resolveIntentFilesDecision(strategy, intent, root)
  }
})

export const checkReleaseDecision = Effect.fn("checkReleaseDecision")(function*(
  intent: ReleaseIntent,
  root: string = "."
) {
  const resolution = yield* resolveReleaseDecision(intent, root)
  switch (resolution._tag) {
    case "Skipped":
      return resolution.decision
    case "Resolved":
      return yield* checkRemoteStateForIdentity(resolution.identity, resolution.targets, resolution.metadata)
  }
})

export const checkReleaseIntentRequirement = Effect.fn("checkReleaseIntentRequirement")(function*(
  intent: ReleaseIntent,
  root: string = "."
) {
  const strategy = strategyFromIntent(intent)
  if (!(strategy instanceof IntentFilesReleaseDecision)) {
    return skippedDecision("Release config is not using IntentFilesReleaseDecision.", {
      strategy: strategy._tag,
      source: "releaseDecision"
    })
  }
  const intentFiles = yield* readIntentFiles(root, strategy)
  if (intentFiles.files.length === 0 && (strategy.requireIntent ?? true)) {
    return yield* Effect.fail(
      eligibilityError(`release intent files are required for ${intentFiles.packageName} in ${intentFiles.directory}.`)
    )
  }
  const bump = highestIntentBump(intentFiles.files)
  return ReleaseEligibilityDecision.make({
    shouldRelease: bump !== "none",
    status: bump === "none" ? "skipped" : "ready",
    reason: bump === "none"
      ? `Release intent files for ${intentFiles.packageName} request no release.`
      : `Release intent files for ${intentFiles.packageName} request a ${bump} release.`,
    strategy: strategy._tag,
    packageName: intentFiles.packageName,
    source: intentFiles.directory
  })
})

export const renderReleaseEligibilityText = (decision: ReleaseEligibilityDecision): string => {
  const strategy = decision.strategy === undefined ? "" : ` strategy=${decision.strategy}`
  const source = decision.source === undefined ? "" : ` source=${JSON.stringify(decision.source)}`
  const release = decision.packageName === undefined || decision.packageVersion === undefined
    ? ""
    : ` release=${decision.packageName}@${decision.packageVersion}`
  const tag = decision.githubTag === undefined ? "" : ` github-tag=${decision.githubTag}`
  return `release eligibility status=${decision.status} should-release=${decision.shouldRelease}${strategy}${source}${release}${tag} reason=${JSON.stringify(decision.reason)}\n`
}

export const renderReleaseEligibilityJson = (decision: ReleaseEligibilityDecision): string =>
  `${JSON.stringify(decision, null, 2)}\n`
