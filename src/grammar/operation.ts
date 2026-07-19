// Invariant: every durable operation has one action representation over a closed algebra.
import * as Schema from "effect/Schema"
import { ArtifactId, Checksum } from "./artifact.js"
import { DeferredFileContent } from "./content.js"
import { StageArtifactIntent } from "./intent.js"

export const OperationId = Schema.NonEmptyString
export type OperationId = typeof OperationId.Type

export const OperationRisk = Schema.Literals(["read-only", "writes-local", "externally-visible", "irreversible"])
export type OperationRisk = typeof OperationRisk.Type

export const OperationPhase = Schema.Literals(["build", "process", "catalog", "publish", "verify"])
export type OperationPhase = typeof OperationPhase.Type

export class CommandSpec extends Schema.Class<CommandSpec>("CommandSpec")({
  executable: Schema.String,
  args: Schema.Array(Schema.String),
  cwd: Schema.optional(Schema.String),
  requiredEnv: Schema.Array(Schema.String),
  redactedEnv: Schema.Array(Schema.String)
}) {}

export class GitHubReleaseAssetSpec extends Schema.Class<GitHubReleaseAssetSpec>("GitHubReleaseAssetSpec")({
  artifactId: Schema.String,
  path: Schema.String,
  name: Schema.String,
  contentType: Schema.String
}) {}

export class CommandAction extends Schema.TaggedClass<CommandAction>()("command", {
  command: CommandSpec
}) {}

export class CheckFileAction extends Schema.TaggedClass<CheckFileAction>()("check-file", {
  path: Schema.String,
  checksum: Schema.optional(Checksum)
}) {}

export class WriteFileAction extends Schema.TaggedClass<WriteFileAction>()("write-file", {
  path: Schema.String,
  contents: Schema.Union([Schema.String, DeferredFileContent])
}) {}

export class GitHubReleaseCreateAction extends Schema.TaggedClass<GitHubReleaseCreateAction>()(
  "github-release-create",
  {
    repository: Schema.String,
    tokenEnv: Schema.optional(Schema.String),
    tag: Schema.String,
    title: Schema.String,
    notes: Schema.optional(Schema.String),
    draft: Schema.Boolean,
    prerelease: Schema.Boolean,
    assets: Schema.Array(GitHubReleaseAssetSpec)
  }
) {}

export class GitHubReleaseVerifyAction extends Schema.TaggedClass<GitHubReleaseVerifyAction>()(
  "github-release-verify",
  {
    repository: Schema.String,
    tokenEnv: Schema.optional(Schema.String),
    tag: Schema.String,
    title: Schema.String,
    draft: Schema.Boolean,
    prerelease: Schema.Boolean,
    assetNames: Schema.Array(Schema.String)
  }
) {}

// NoteAction intentionally remains an operation. These notes are reachable
// operator-visible plan output; Plan 131 only deletes unreachable note branches.
export class NoteAction extends Schema.TaggedClass<NoteAction>()("note", {
  message: Schema.String,
  severity: Schema.Literals(["info", "warning"]),
  skipped: Schema.Boolean
}) {}

export class StageAction extends Schema.TaggedClass<StageAction>()("stage", {
  intent: StageArtifactIntent,
  producesArtifactIds: Schema.Array(ArtifactId)
}) {}

export const Action = Schema.Union([
  CommandAction,
  CheckFileAction,
  WriteFileAction,
  GitHubReleaseCreateAction,
  GitHubReleaseVerifyAction,
  NoteAction,
  StageAction
])
export type Action = typeof Action.Type

export class RetryPolicy extends Schema.Class<RetryPolicy>("RetryPolicy")({
  attempts: Schema.Number,
  delayMillis: Schema.Number
}) {}

export class Operation extends Schema.Class<Operation>("Operation")({
  id: OperationId,
  pipeId: Schema.String,
  phase: OperationPhase,
  risk: OperationRisk,
  description: Schema.String,
  action: Action,
  retry: Schema.optional(RetryPolicy)
}) {}
