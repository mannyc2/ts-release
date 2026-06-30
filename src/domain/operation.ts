import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { TargetId } from "./target.js"

export type * from "../types/effect-internal.js"

export const OperationId = Schema.NonEmptyString
export type OperationId = typeof OperationId.Type

export const OperationRisk = Schema.Literals(["read-only", "writes-local", "externally-visible", "irreversible"])
export type OperationRisk = typeof OperationRisk.Type

export class CommandSpec extends Schema.Class<CommandSpec>("CommandSpec")({
  executable: Schema.String,
  args: Schema.Array(Schema.String),
  cwd: Schema.optionalKey(Schema.String),
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
  prefix: Schema.optionalKey(Schema.String)
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
  body: Schema.optionalKey(HttpRequestBody)
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

export class RenderFileOperation extends Schema.TaggedClass<RenderFileOperation>()("RenderFileOperation", {
  id: OperationId,
  targetId: Schema.optionalKey(TargetId),
  description: Schema.String,
  risk: OperationRisk,
  path: Schema.String,
  contents: Schema.String
}) {}

export class ValidateCommandOperation extends Schema.TaggedClass<ValidateCommandOperation>()("ValidateCommandOperation", {
  id: OperationId,
  targetId: Schema.optionalKey(TargetId),
  description: Schema.String,
  risk: OperationRisk,
  command: CommandSpec
}) {}

export class ValidationNoteOperation extends Schema.TaggedClass<ValidationNoteOperation>()("ValidationNoteOperation", {
  id: OperationId,
  targetId: Schema.optionalKey(TargetId),
  description: Schema.String,
  risk: OperationRisk,
  message: Schema.String,
  skipped: Schema.Boolean,
  severity: Schema.Literals(["info", "warning"])
}) {}

export class PublishCommandOperation extends Schema.TaggedClass<PublishCommandOperation>()("PublishCommandOperation", {
  id: OperationId,
  targetId: TargetId,
  description: Schema.String,
  risk: OperationRisk,
  command: CommandSpec
}) {}

export class GitHubReleaseAssetSpec extends Schema.Class<GitHubReleaseAssetSpec>("GitHubReleaseAssetSpec")({
  artifactId: Schema.String,
  path: Schema.String,
  name: Schema.String,
  contentType: Schema.String
}) {}

export class PublishGitHubReleaseOperation extends Schema.TaggedClass<PublishGitHubReleaseOperation>()(
  "PublishGitHubReleaseOperation",
  {
    id: OperationId,
    targetId: TargetId,
    description: Schema.String,
    risk: OperationRisk,
    repository: Schema.String,
    tokenEnv: Schema.optionalKey(Schema.String),
    tag: Schema.String,
    title: Schema.String,
    notes: Schema.optionalKey(Schema.String),
    draft: Schema.Boolean,
    prerelease: Schema.Boolean,
    assets: Schema.Array(GitHubReleaseAssetSpec)
  }
) {}

export class VerifyRemoteOperation extends Schema.TaggedClass<VerifyRemoteOperation>()("VerifyRemoteOperation", {
  id: OperationId,
  targetId: TargetId,
  description: Schema.String,
  risk: OperationRisk,
  command: CommandSpec
}) {}

export class VerifyHttpOperation extends Schema.TaggedClass<VerifyHttpOperation>()("VerifyHttpOperation", {
  id: OperationId,
  targetId: TargetId,
  description: Schema.String,
  risk: OperationRisk,
  request: HttpRequestSpec,
  expectedStatus: Schema.Number,
  checks: Schema.Array(HttpJsonCheck)
}) {}

export class VerifyGitHubReleaseOperation extends Schema.TaggedClass<VerifyGitHubReleaseOperation>()(
  "VerifyGitHubReleaseOperation",
  {
    id: OperationId,
    targetId: TargetId,
    description: Schema.String,
    risk: OperationRisk,
    repository: Schema.String,
    tokenEnv: Schema.optionalKey(Schema.String),
    tag: Schema.String,
    title: Schema.String,
    draft: Schema.Boolean,
    prerelease: Schema.Boolean,
    assetNames: Schema.Array(Schema.String)
  }
) {}

export const Operation = Schema.Union([
  RenderFileOperation,
  ValidateCommandOperation,
  ValidationNoteOperation,
  PublishCommandOperation,
  PublishGitHubReleaseOperation,
  VerifyRemoteOperation,
  VerifyHttpOperation,
  VerifyGitHubReleaseOperation
])
export type Operation = typeof Operation.Type

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

export const operationRequiresExecute = (operation: Operation): boolean =>
  operationApprovalRequirements(operation).requiresExecute

export const operationRequiresIrreversibleApproval = (operation: Operation): boolean =>
  operationApprovalRequirements(operation).requiresIrreversibleApproval

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

const operationPhasePriority = (operation: Operation): number => {
  switch (operation._tag) {
    case "RenderFileOperation":
      return 0
    case "ValidateCommandOperation":
    case "ValidationNoteOperation":
      return 1
    case "PublishCommandOperation":
    case "PublishGitHubReleaseOperation":
      return 2
    case "VerifyRemoteOperation":
    case "VerifyHttpOperation":
    case "VerifyGitHubReleaseOperation":
      return 3
  }
}

type PublishOperation = Extract<Operation, { readonly _tag: "PublishCommandOperation" | "PublishGitHubReleaseOperation" }>

const publishOperationPriority = (operation: PublishOperation): number => {
  if (operation.id.endsWith(":npm-publish") || operation.id.endsWith(":twine-upload")) {
    return 0
  }
  if (operation.id.endsWith(":github-release-create")) {
    return 1
  }
  if (operation.id.endsWith(":add")) {
    return 2
  }
  if (operation.id.endsWith(":commit")) {
    return 3
  }
  if (operation.id.endsWith(":homebrew-push") || operation.id.endsWith(":scoop-push")) {
    return 4
  }
  return 5
}

export const operationOrder = (left: Operation, right: Operation): number =>
  operationPhasePriority(left) - operationPhasePriority(right) ||
  (isPublishOperation(left) && isPublishOperation(right)
    ? publishOperationPriority(left) - publishOperationPriority(right)
    : 0) ||
  left.id.localeCompare(right.id)

const isPublishOperation = (operation: Operation): operation is PublishOperation =>
  operation._tag === "PublishCommandOperation" || operation._tag === "PublishGitHubReleaseOperation"
