import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { PyPiWheelBinaryArtifact } from "./artifact.js"
import { PlatformTarget } from "./platform.js"
import { ArtifactId, Checksum } from "./artifact.js"
import bunCompileTargets from "../assets/bun-compile-targets.json" with { type: "json" }

// Invariant: every durable operation has one action representation and one approval derivation.

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

type BunCpu = "baseline" | "modern"
export type BunCompileTarget = `bun-${PlatformTarget}`
  | `bun-linux-${"x64" | "arm64"}-${BunCpu}${"" | "-musl"}`
  | `bun-darwin-${"x64" | "arm64"}-${BunCpu}` | `bun-windows-x64-${BunCpu}`
export const BunCompileTarget = Schema.Literals(bunCompileTargets as ReadonlyArray<BunCompileTarget>)

export class BunCompileIntent extends Schema.TaggedClass<BunCompileIntent>()("bun-compile", {
  entry: Schema.String,
  target: PlatformTarget,
  compileTarget: BunCompileTarget,
  outfile: Schema.String,
  minify: Schema.optional(Schema.Boolean)
}) {}

export class PyPiWheelIntent extends Schema.TaggedClass<PyPiWheelIntent>()("pypi-wheel", {
  outfile: Schema.String,
  wheelTag: Schema.String,
  packageName: Schema.String,
  moduleName: Schema.String,
  consoleScript: Schema.String,
  summary: Schema.String,
  homepage: Schema.String,
  license: Schema.String,
  requiresPython: Schema.String,
  binaries: Schema.Array(PyPiWheelBinaryArtifact)
}) {}

export const ArchiveFormat = Schema.Literals(["tar.gz", "zip"])
export type ArchiveFormat = typeof ArchiveFormat.Type

export class ArchiveArtifactEntry extends Schema.Class<ArchiveArtifactEntry>("ArchiveArtifactEntry")({
  artifactId: ArtifactId,
  sourcePath: Schema.String,
  archivePath: Schema.String
}) {}

export class ArchiveIntent extends Schema.TaggedClass<ArchiveIntent>()("archive", {
  outfile: Schema.String,
  format: ArchiveFormat,
  wrapDirectory: Schema.optional(Schema.String),
  artifacts: Schema.Array(ArchiveArtifactEntry),
  files: Schema.Array(Schema.String)
}) {}

export const StageArtifactIntent = Schema.Union([BunCompileIntent, PyPiWheelIntent, ArchiveIntent])
export type StageArtifactIntent = typeof StageArtifactIntent.Type

export class CommandAction extends Schema.TaggedClass<CommandAction>()("command", {
  command: CommandSpec
}) {}

export class CheckFileAction extends Schema.TaggedClass<CheckFileAction>()("check-file", {
  path: Schema.String,
  checksum: Schema.optional(Checksum)
}) {}

export class Sha256Hole extends Schema.Class<Sha256Hole>("Sha256Hole")({
  artifactId: ArtifactId
}) {}

export class FilePartsContent extends Schema.TaggedClass<FilePartsContent>()("file-parts", {
  parts: Schema.Array(Schema.Union([Schema.String, Sha256Hole]))
}) {}

export const DeferredFileContent = Schema.Union([FilePartsContent])
export type DeferredFileContent = typeof DeferredFileContent.Type

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

export class ExecutionApproval extends Schema.Class<ExecutionApproval>("ExecutionApproval")({
  execute: Schema.Boolean,
  approveIrreversible: Schema.Boolean
}) {
  static readonly none = ExecutionApproval.make({
    execute: false,
    approveIrreversible: false
  })
}

export class ExecutionApprovalError extends Schema.TaggedErrorClass<ExecutionApprovalError>()(
  "ExecutionApprovalError",
  {
    operationId: OperationId,
    reason: Schema.String
  }
) {}

export const operationApprovalRequirements = (operation: Operation) => {
  const requiresExecute = operation.risk !== "read-only"
  const requiresIrreversibleApproval = operation.risk === "irreversible"
  return {
    requiresExecute,
    requiresIrreversibleApproval,
    label: !requiresExecute
      ? "none"
      : requiresIrreversibleApproval
      ? "--execute + --approve-publish"
      : "--execute"
  } as const
}

export const canExecuteOperation = (operation: Operation, approval: ExecutionApproval): boolean => {
  const requirements = operationApprovalRequirements(operation)
  return (!requirements.requiresExecute || approval.execute)
    && (!requirements.requiresIrreversibleApproval || approval.approveIrreversible)
}

export const requireExecutionApproval = Effect.fn("requireExecutionApproval")(function*(
  operation: Operation,
  approval: ExecutionApproval
) {
  const requirements = operationApprovalRequirements(operation)
  if ((!requirements.requiresExecute || approval.execute)
    && (!requirements.requiresIrreversibleApproval || approval.approveIrreversible)) return

  const reason = requirements.requiresIrreversibleApproval && !approval.approveIrreversible
    ? "Operation requires irreversible approval."
    : "Operation requires execute approval."

  return yield* Effect.fail(
    ExecutionApprovalError.make({
      operationId: operation.id,
      reason
    })
  )
})
