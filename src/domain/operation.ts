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

export const HttpMethod = Schema.Literals(["GET", "HEAD"])
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

export class HttpRequestSpec extends Schema.Class<HttpRequestSpec>("HttpRequestSpec")({
  method: HttpMethod,
  url: Schema.String,
  headers: Schema.Array(HttpHeader),
  envHeaders: Schema.Array(HttpEnvHeader),
  requiredEnv: Schema.Array(Schema.String),
  redactedEnv: Schema.Array(Schema.String)
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

export const Operation = Schema.Union([
  RenderFileOperation,
  ValidateCommandOperation,
  ValidationNoteOperation,
  PublishCommandOperation,
  VerifyRemoteOperation,
  VerifyHttpOperation
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
    ? "--execute + --approve-irreversible"
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
      return 2
    case "VerifyRemoteOperation":
    case "VerifyHttpOperation":
      return 3
  }
}

const publishOperationPriority = (operation: PublishCommandOperation): number => {
  if (operation.id.endsWith(":npm-publish") || operation.id.endsWith(":twine-upload")) {
    return 0
  }
  if (operation.id.endsWith(":gh-release-create")) {
    return 1
  }
  if (operation.id.endsWith(":homebrew-push") || operation.id.endsWith(":scoop-push")) {
    return 2
  }
  return 3
}

export const operationOrder = (left: Operation, right: Operation): number =>
  operationPhasePriority(left) - operationPhasePriority(right) ||
  (left._tag === "PublishCommandOperation" && right._tag === "PublishCommandOperation"
    ? publishOperationPriority(left) - publishOperationPriority(right)
    : 0) ||
  left.id.localeCompare(right.id)
