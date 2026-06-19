import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { TargetId } from "./target.js"

export type * from "../types/effect-internal.js"

export const OperationId = Schema.String
export type OperationId = typeof OperationId.Type

export const OperationRisk = Schema.Literals(["read-only", "writes-local", "externally-visible", "irreversible"])
export type OperationRisk = typeof OperationRisk.Type

export class ExecutionGate extends Schema.Class<ExecutionGate>("ExecutionGate")({
  requiresExecute: Schema.Boolean,
  requiresIrreversibleApproval: Schema.Boolean,
  reason: Schema.String
}) {}

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
  gate: ExecutionGate,
  path: Schema.String,
  contents: Schema.String
}) {}

export class ValidateCommandOperation extends Schema.TaggedClass<ValidateCommandOperation>()("ValidateCommandOperation", {
  id: OperationId,
  targetId: Schema.optionalKey(TargetId),
  description: Schema.String,
  risk: OperationRisk,
  gate: ExecutionGate,
  command: CommandSpec
}) {}

export class ValidationNoteOperation extends Schema.TaggedClass<ValidationNoteOperation>()("ValidationNoteOperation", {
  id: OperationId,
  targetId: Schema.optionalKey(TargetId),
  description: Schema.String,
  risk: OperationRisk,
  gate: ExecutionGate,
  message: Schema.String,
  skipped: Schema.Boolean,
  severity: Schema.Literals(["info", "warning"])
}) {}

export class PublishCommandOperation extends Schema.TaggedClass<PublishCommandOperation>()("PublishCommandOperation", {
  id: OperationId,
  targetId: TargetId,
  description: Schema.String,
  risk: OperationRisk,
  gate: ExecutionGate,
  command: CommandSpec
}) {}

export class VerifyRemoteOperation extends Schema.TaggedClass<VerifyRemoteOperation>()("VerifyRemoteOperation", {
  id: OperationId,
  targetId: TargetId,
  description: Schema.String,
  risk: OperationRisk,
  gate: ExecutionGate,
  command: CommandSpec
}) {}

export class VerifyHttpOperation extends Schema.TaggedClass<VerifyHttpOperation>()("VerifyHttpOperation", {
  id: OperationId,
  targetId: TargetId,
  description: Schema.String,
  risk: OperationRisk,
  gate: ExecutionGate,
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

type StableJson = null | boolean | number | string | ReadonlyArray<StableJson> | { readonly [key: string]: StableJson }

type JsonObject = { readonly [key: string]: Schema.Json }

const isJsonObject = (value: Schema.Json): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stableJson = (value: Schema.Json): StableJson => {
  if (Array.isArray(value)) {
    return value.map(stableJson)
  }
  if (isJsonObject(value)) {
    const output: Record<string, StableJson> = {}
    for (const key of Object.keys(value).sort()) {
      const item = value[key]
      if (item !== undefined) {
        output[key] = stableJson(item)
      }
    }
    return output
  }
  return value
}

const commandSpecPayload = (command: CommandSpec) => ({
  executable: command.executable,
  args: command.args,
  ...(command.cwd === undefined ? {} : { cwd: command.cwd }),
  requiredEnv: command.requiredEnv,
  redactedEnv: command.redactedEnv
})

const httpHeaderPayload = (header: HttpHeader) => ({
  name: header.name,
  value: header.value
})

const httpEnvHeaderPayload = (header: HttpEnvHeader) => ({
  name: header.name,
  valueEnv: header.valueEnv,
  ...(header.prefix === undefined ? {} : { prefix: header.prefix })
})

const httpRequestPayload = (request: HttpRequestSpec) => ({
  method: request.method,
  url: request.url,
  headers: request.headers.map(httpHeaderPayload),
  envHeaders: request.envHeaders.map(httpEnvHeaderPayload),
  requiredEnv: request.requiredEnv,
  redactedEnv: request.redactedEnv
})

const httpJsonCheckPayload = (check: HttpJsonCheck) => {
  switch (check._tag) {
    case "HttpJsonEqualsCheck":
      return {
        _tag: check._tag,
        path: check.path,
        expected: stableJson(check.expected)
      }
    case "HttpJsonArrayObjectFieldEqualsCheck":
      return {
        _tag: check._tag,
        path: check.path,
        field: check.field,
        expected: stableJson(check.expected)
      }
  }
}

const textEncoder = new TextEncoder()
const fnv1a64Offset = 0xcbf29ce484222325n
const fnv1a64Prime = 0x100000001b3n
const fnv1a64Mask = 0xffffffffffffffffn

const contentDigest = (contents: string): string => {
  let hash = fnv1a64Offset
  for (const byte of textEncoder.encode(contents)) {
    hash ^= BigInt(byte)
    hash = (hash * fnv1a64Prime) & fnv1a64Mask
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`
}

const approvalPayload = (operation: Operation) => ({
  requiresExecute: operation.gate.requiresExecute ||
    operation._tag === "PublishCommandOperation" ||
    operation._tag === "RenderFileOperation" ||
    operation.risk !== "read-only",
  requiresIrreversibleApproval: operation.gate.requiresIrreversibleApproval ||
    operation.risk === "irreversible"
})

const commonOperationPayload = (operation: Operation) => ({
  _tag: operation._tag,
  id: operation.id,
  ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
  approval: approvalPayload(operation)
})

export const operationFingerprint = (operation: Operation): string => {
  const common = commonOperationPayload(operation)
  switch (operation._tag) {
    case "RenderFileOperation":
      return JSON.stringify({
        ...common,
        path: operation.path,
        contentsDigest: contentDigest(operation.contents)
      })
    case "ValidateCommandOperation":
    case "PublishCommandOperation":
    case "VerifyRemoteOperation":
      return JSON.stringify({
        ...common,
        command: commandSpecPayload(operation.command)
      })
    case "ValidationNoteOperation":
      return JSON.stringify({
        ...common,
        message: operation.message,
        severity: operation.severity,
        skipped: operation.skipped
      })
    case "VerifyHttpOperation":
      return JSON.stringify({
        ...common,
        request: httpRequestPayload(operation.request),
        expectedStatus: operation.expectedStatus,
        checks: operation.checks.map(httpJsonCheckPayload)
      })
  }
}

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

export const noApprovalGate = (reason: string): ExecutionGate =>
  ExecutionGate.make({
    requiresExecute: false,
    requiresIrreversibleApproval: false,
    reason
  })

export const executeGate = (reason: string): ExecutionGate =>
  ExecutionGate.make({
    requiresExecute: true,
    requiresIrreversibleApproval: false,
    reason
  })

export const irreversibleGate = (reason: string): ExecutionGate =>
  ExecutionGate.make({
    requiresExecute: true,
    requiresIrreversibleApproval: true,
    reason
  })

export const canExecuteOperation = (operation: Operation, approval: ExecutionApproval): boolean => {
  const requiresExecute = operation.gate.requiresExecute ||
    operation._tag === "PublishCommandOperation" ||
    operation._tag === "RenderFileOperation" ||
    operation.risk !== "read-only"
  const requiresIrreversibleApproval = operation.gate.requiresIrreversibleApproval ||
    operation.risk === "irreversible"

  if (requiresExecute && !approval.execute) {
    return false
  }
  if (requiresIrreversibleApproval && !approval.approveIrreversible) {
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

  const reason = (operation.gate.requiresIrreversibleApproval || operation.risk === "irreversible") &&
      !approval.approveIrreversible
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
