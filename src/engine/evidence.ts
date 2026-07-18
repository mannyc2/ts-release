import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { readOptionalEnv } from "../host/platform.js"
import {
  CommandSpec,
  GitHubReleaseCreateAction,
  GitHubReleaseVerifyAction,
  Operation,
  OperationId,
  OperationPhase,
  OperationRisk
} from "../pipeline/operation.js"
import { PipeNotice } from "../pipeline/state.js"

const ReleaseName = Schema.NonEmptyString
const ReleaseVersion = Schema.NonEmptyString


export const EvidenceStatus = Schema.Literals(["passed", "failed", "skipped", "warning", "refused"])
export type EvidenceStatus = typeof EvidenceStatus.Type

export class GitHubReleaseEvidence extends Schema.Class<GitHubReleaseEvidence>("GitHubReleaseEvidence")({
  repository: Schema.String,
  tag: Schema.String,
  releaseId: Schema.optional(Schema.Number),
  title: Schema.optional(Schema.String),
  draft: Schema.optional(Schema.Boolean),
  prerelease: Schema.optional(Schema.Boolean),
  assets: Schema.Array(Schema.String)
}) {}

export class HttpCheckEvidence extends Schema.Class<HttpCheckEvidence>("HttpCheckEvidence")({
  description: Schema.String,
  passed: Schema.Boolean
}) {}

export class CommandOutcome extends Schema.TaggedClass<CommandOutcome>()("command", {
  command: CommandSpec,
  exitCode: Schema.Number,
  stdout: Schema.String,
  stderr: Schema.String
}) {}

export class ResolvedFileValue extends Schema.Class<ResolvedFileValue>("ResolvedFileValue")({
  artifactId: Schema.String,
  sha256: Schema.optional(Schema.String),
  algorithm: Schema.optional(Schema.Literals(["sha256", "sha512"])),
  value: Schema.optional(Schema.String)
}) {}

export class FileOutcome extends Schema.TaggedClass<FileOutcome>()("file", {
  path: Schema.String,
  resolvedValues: Schema.optionalKey(Schema.Array(ResolvedFileValue))
}) {}

export class GitHubReleaseOutcome extends Schema.TaggedClass<GitHubReleaseOutcome>()("github-release", {
  release: GitHubReleaseEvidence,
  responseStatus: Schema.optional(Schema.Number),
  checks: Schema.optional(Schema.Array(HttpCheckEvidence))
}) {}

export const ActionOutcome = Schema.Union([CommandOutcome, FileOutcome, GitHubReleaseOutcome])
export type ActionOutcome = typeof ActionOutcome.Type

export class EvidenceRecord extends Schema.Class<EvidenceRecord>("EvidenceRecordV2")({
  operationId: OperationId,
  pipeId: Schema.String,
  phase: OperationPhase,
  risk: OperationRisk,
  status: EvidenceStatus,
  message: Schema.String,
  startedAt: Schema.String,
  endedAt: Schema.String,
  durationMillis: Schema.Number,
  outcome: Schema.optional(ActionOutcome)
}) {}

export class EvidenceBundle extends Schema.Class<EvidenceBundle>("EvidenceBundleV2")({
  schemaVersion: Schema.Literal("release-evidence/v2"),
  releaseName: ReleaseName,
  releaseVersion: ReleaseVersion,
  notices: Schema.Array(PipeNotice),
  records: Schema.Array(EvidenceRecord)
}) {}

export const emptyEvidenceBundle = (input: {
  readonly releaseName: string
  readonly releaseVersion: string
  readonly notices?: ReadonlyArray<PipeNotice> | undefined
}): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: "release-evidence/v2",
    releaseName: input.releaseName,
    releaseVersion: input.releaseVersion,
    notices: [...(input.notices ?? [])],
    records: []
  })

export const appendEvidenceRecord = (
  bundle: EvidenceBundle,
  record: EvidenceRecord
): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: bundle.schemaVersion,
    releaseName: bundle.releaseName,
    releaseVersion: bundle.releaseVersion,
    notices: [...bundle.notices],
    records: [...bundle.records, record]
  })

export const renderEvidenceJson = (bundle: EvidenceBundle): string =>
  `${JSON.stringify(bundle, null, 2)}\n`

export const redactText = (input: string, secrets: ReadonlyArray<string>): string => {
  let output = input
  for (const secret of secrets) {
    if (secret.length > 0) {
      output = output.split(secret).join("[REDACTED]")
    }
  }
  return output
}

const redactedEnvNames = (operation: Operation): ReadonlyArray<string> => {
  switch (operation.action._tag) {
    case "command":
      return operation.action.command.redactedEnv
    case "github-release-create":
    case "github-release-verify":
      return operation.action.tokenEnv === undefined ? [] : [operation.action.tokenEnv]
    case "check-file":
    case "write-file":
    case "note":
    case "stage":
      return []
  }
}

export const readRedactionSecrets = Effect.fn("engine.evidence.readRedactionSecrets")(function*(operation: Operation) {
  const secrets: Array<string> = []
  for (const name of redactedEnvNames(operation)) {
    const value = yield* readOptionalEnv(name)
    if (value !== undefined) {
      secrets.push(value)
    }
  }
  return secrets
})

export const githubReleaseEvidence = (input: {
  readonly repository: string
  readonly tag: string
  readonly releaseId?: number | undefined
  readonly title?: string | undefined
  readonly draft?: boolean | undefined
  readonly prerelease?: boolean | undefined
  readonly assets: ReadonlyArray<string>
}): GitHubReleaseEvidence =>
  GitHubReleaseEvidence.make({
    repository: input.repository,
    tag: input.tag,
    releaseId: input.releaseId,
    title: input.title,
    draft: input.draft,
    prerelease: input.prerelease,
    assets: [...input.assets]
  })

export const sortedStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...values].sort()

export const sameStringSet = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
  const sortedLeft = sortedStrings(left)
  const sortedRight = sortedStrings(right)
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => sortedRight[index] === value)
}

export const githubCreateRequestFromAction = (action: GitHubReleaseCreateAction) => ({
  repository: action.repository,
  tokenEnv: action.tokenEnv,
  tag: action.tag,
  title: action.title,
  notes: action.notes,
  draft: action.draft,
  prerelease: action.prerelease,
  assets: [...action.assets]
})

export const githubInspectRequestFromAction = (action: GitHubReleaseVerifyAction) => ({
  repository: action.repository,
  tokenEnv: action.tokenEnv,
  tag: action.tag
})
