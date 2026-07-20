// Invariant: release-evidence/v3 is the only durable evidence shape and secrets are redacted before persistence.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { readEnvironment } from "../host/platform.js"
import {
  CommandSpec,
  GitHubReleaseCreateAction,
  GitHubReleaseVerifyAction,
  Operation,
  OperationId,
  OperationPhase,
  OperationRisk
} from "../grammar/operation.js"

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

export class VerifyCheckEvidence extends Schema.Class<VerifyCheckEvidence>("VerifyCheckEvidence")({
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
  checks: Schema.optional(Schema.Array(VerifyCheckEvidence))
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

export class EvidenceBundle extends Schema.Class<EvidenceBundle>("EvidenceBundleV3")({
  schemaVersion: Schema.Literal("release-evidence/v3"),
  releaseName: ReleaseName,
  releaseVersion: ReleaseVersion,
  records: Schema.Array(EvidenceRecord)
}) {}

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
  return [...(yield* readEnvironment(redactedEnvNames(operation))).values()]
    .filter((value): value is string => value !== undefined)
})

export const sortedStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...values].sort()

export const sameStringSet = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
  const sortedLeft = sortedStrings(left)
  const sortedRight = sortedStrings(right)
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => sortedRight[index] === value)
}
