import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { PyPiWheelBinaryArtifact } from "./artifact.js"
import { PlatformTarget } from "./platform.js"
import { ArtifactId, Checksum } from "./artifact.js"

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

export const HttpMethod = Schema.Literals(["GET", "HEAD", "POST", "PATCH"])
export type HttpMethod = typeof HttpMethod.Type

export class HttpHeader extends Schema.Class<HttpHeader>("HttpHeader")({
  name: Schema.String,
  value: Schema.String
}) {}

export class HttpEnvHeader extends Schema.Class<HttpEnvHeader>("HttpEnvHeader")({
  name: Schema.String,
  valueEnv: Schema.String,
  prefix: Schema.optional(Schema.String)
}) {}

export class HttpJsonRequestBody extends Schema.TaggedClass<HttpJsonRequestBody>()("HttpJsonRequestBody", {
  json: Schema.Json
}) {}

export class HttpFileRequestBody extends Schema.TaggedClass<HttpFileRequestBody>()("HttpFileRequestBody", {
  path: Schema.String,
  contentType: Schema.String
}) {}

export const HttpRequestBody = Schema.Union([HttpJsonRequestBody, HttpFileRequestBody])
export type HttpRequestBody = typeof HttpRequestBody.Type

export class HttpRequestSpec extends Schema.Class<HttpRequestSpec>("HttpRequestSpec")({
  method: HttpMethod,
  url: Schema.String,
  headers: Schema.Array(HttpHeader),
  envHeaders: Schema.Array(HttpEnvHeader),
  requiredEnv: Schema.Array(Schema.String),
  redactedEnv: Schema.Array(Schema.String),
  body: Schema.optional(HttpRequestBody)
}) {}

export const JsonPathSegment = Schema.Union([Schema.String, Schema.Number])
export type JsonPathSegment = typeof JsonPathSegment.Type

export class HttpJsonEqualsCheck extends Schema.TaggedClass<HttpJsonEqualsCheck>()("HttpJsonEqualsCheck", {
  path: Schema.Array(JsonPathSegment),
  expected: Schema.Json
}) {}

export class HttpJsonArrayObjectFieldEqualsCheck extends Schema.TaggedClass<HttpJsonArrayObjectFieldEqualsCheck>()(
  "HttpJsonArrayObjectFieldEqualsCheck",
  {
    path: Schema.Array(JsonPathSegment),
    field: Schema.String,
    expected: Schema.Json
  }
) {}

export const HttpJsonCheck = Schema.Union([HttpJsonEqualsCheck, HttpJsonArrayObjectFieldEqualsCheck])
export type HttpJsonCheck = typeof HttpJsonCheck.Type

export class GitHubReleaseAssetSpec extends Schema.Class<GitHubReleaseAssetSpec>("GitHubReleaseAssetSpec")({
  artifactId: Schema.String,
  path: Schema.String,
  name: Schema.String,
  contentType: Schema.String
}) {}

export const BunCompileTarget = Schema.Literals([
  "bun-linux-x64",
  "bun-linux-x64-baseline",
  "bun-linux-x64-modern",
  "bun-linux-x64-musl",
  "bun-linux-x64-baseline-musl",
  "bun-linux-x64-modern-musl",
  "bun-linux-arm64",
  "bun-linux-arm64-baseline",
  "bun-linux-arm64-modern",
  "bun-linux-arm64-musl",
  "bun-linux-arm64-baseline-musl",
  "bun-linux-arm64-modern-musl",
  "bun-darwin-x64",
  "bun-darwin-x64-baseline",
  "bun-darwin-x64-modern",
  "bun-darwin-arm64",
  "bun-darwin-arm64-baseline",
  "bun-darwin-arm64-modern",
  "bun-windows-x64",
  "bun-windows-x64-baseline",
  "bun-windows-x64-modern",
  "bun-windows-arm64"
])
export type BunCompileTarget = typeof BunCompileTarget.Type

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

export class HttpCheckAction extends Schema.TaggedClass<HttpCheckAction>()("http-check", {
  request: HttpRequestSpec,
  expectedStatus: Schema.Number,
  checks: Schema.Array(HttpJsonCheck)
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
  HttpCheckAction,
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

export const operationApprovalRequirements = (operation: Operation) => ({
  requiresExecute: operation.risk !== "read-only",
  requiresIrreversibleApproval: operation.risk === "irreversible"
})

export const operationApprovalLabel = (operation: Operation): string => {
  const requirements = operationApprovalRequirements(operation)
  if (!requirements.requiresExecute) {
    return "none"
  }
  return requirements.requiresIrreversibleApproval
    ? "--execute + --approve-publish"
    : "--execute"
}

export const canExecuteOperation = (operation: Operation, approval: ExecutionApproval): boolean => {
  const requirements = operationApprovalRequirements(operation)

  if (requirements.requiresExecute && !approval.execute) {
    return false
  }
  if (requirements.requiresIrreversibleApproval && !approval.approveIrreversible) {
    return false
  }
  return true
}

export const requireExecutionApproval = Effect.fn("requireExecutionApproval")(function*(
  operation: Operation,
  approval: ExecutionApproval
) {
  if (canExecuteOperation(operation, approval)) {
    return
  }

  const requirements = operationApprovalRequirements(operation)
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

export type PipelineOperation = Operation
