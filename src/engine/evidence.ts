import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { readOptionalEnv } from "../host/platform.js"
import {
  CommandSpec,
  GitHubReleaseCreateAction,
  GitHubReleaseVerifyAction,
  HttpEnvHeader,
  HttpHeader,
  HttpJsonCheck,
  HttpRequestSpec,
  JsonPathSegment,
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

export class HttpRequestEvidence extends Schema.Class<HttpRequestEvidence>("HttpRequestEvidence")({
  method: Schema.Literals(["GET", "HEAD", "POST", "PATCH"]),
  url: Schema.String,
  headers: Schema.Array(HttpHeader),
  envHeaders: Schema.Array(HttpEnvHeader),
  body: Schema.optional(Schema.Literals(["json", "file"])),
  bodyPath: Schema.optional(Schema.String),
  contentType: Schema.optional(Schema.String)
}) {}

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

export class HttpOutcome extends Schema.TaggedClass<HttpOutcome>()("http", {
  request: HttpRequestEvidence,
  responseStatus: Schema.optional(Schema.Number),
  checks: Schema.Array(HttpCheckEvidence)
}) {}

export class GitHubReleaseOutcome extends Schema.TaggedClass<GitHubReleaseOutcome>()("github-release", {
  release: GitHubReleaseEvidence,
  responseStatus: Schema.optional(Schema.Number),
  checks: Schema.optional(Schema.Array(HttpCheckEvidence))
}) {}

export const ActionOutcome = Schema.Union([CommandOutcome, FileOutcome, HttpOutcome, GitHubReleaseOutcome])
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
    case "http-check":
      return operation.action.request.redactedEnv
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

type JsonObject = { readonly [key: string]: Schema.Json }

const isJsonObject = (value: Schema.Json): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const jsonAt = (value: Schema.Json, path: ReadonlyArray<JsonPathSegment>): Schema.Json | undefined => {
  let current: Schema.Json | undefined = value
  for (const segment of path) {
    if (current === undefined) {
      return undefined
    }
    if (typeof segment === "number") {
      if (!Number.isInteger(segment) || !Array.isArray(current)) {
        return undefined
      }
      current = current[segment]
    } else {
      if (!isJsonObject(current)) {
        return undefined
      }
      current = current[segment]
    }
  }
  return current
}

const objectKeys = (value: JsonObject): ReadonlyArray<string> =>
  Object.keys(value).sort()

const jsonEquals = (left: Schema.Json, right: Schema.Json): boolean => {
  if (left === right) {
    return true
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => {
      const rightValue = right[index]
      return rightValue !== undefined && jsonEquals(value, rightValue)
    })
  }
  if (isJsonObject(left) && isJsonObject(right)) {
    const leftKeys = objectKeys(left)
    const rightKeys = objectKeys(right)
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => {
        const rightKey = rightKeys[index]
        const leftValue = left[key]
        const rightValue = right[key]
        return rightKey === key && leftValue !== undefined && rightValue !== undefined && jsonEquals(leftValue, rightValue)
      })
  }
  return false
}

const jsonLabel = (value: Schema.Json): string =>
  JSON.stringify(value)

const pathSegmentLabel = (segment: JsonPathSegment): string =>
  typeof segment === "number" ? `[${segment}]` : `.${segment}`

const pathLabel = (path: ReadonlyArray<JsonPathSegment>): string =>
  path.length === 0 ? "$" : `$${path.map(pathSegmentLabel).join("")}`

const describeHttpCheck = (check: HttpJsonCheck): string => {
  switch (check._tag) {
    case "HttpJsonEqualsCheck":
      return `${pathLabel(check.path)} equals ${jsonLabel(check.expected)}`
    case "HttpJsonArrayObjectFieldEqualsCheck":
      return `${pathLabel(check.path)} contains object with ${check.field} equal to ${jsonLabel(check.expected)}`
  }
}

export const evaluateHttpCheck = (json: Schema.Json, check: HttpJsonCheck): HttpCheckEvidence => {
  switch (check._tag) {
    case "HttpJsonEqualsCheck": {
      const actual = jsonAt(json, check.path)
      return HttpCheckEvidence.make({
        description: describeHttpCheck(check),
        passed: actual !== undefined && jsonEquals(actual, check.expected)
      })
    }
    case "HttpJsonArrayObjectFieldEqualsCheck": {
      const actual = jsonAt(json, check.path)
      const passed = Array.isArray(actual) && actual.some((item) => {
        if (!isJsonObject(item)) {
          return false
        }
        const value = item[check.field]
        return value !== undefined && jsonEquals(value, check.expected)
      })
      return HttpCheckEvidence.make({
        description: describeHttpCheck(check),
        passed
      })
    }
  }
}

export const httpRequestEvidence = (request: HttpRequestSpec): HttpRequestEvidence =>
  HttpRequestEvidence.make({
    method: request.method,
    url: request.url,
    headers: request.headers,
    envHeaders: request.envHeaders,
    body: request.body === undefined
      ? undefined
      : request.body._tag === "HttpJsonRequestBody" ? "json" : "file",
    bodyPath: request.body?._tag === "HttpFileRequestBody" ? request.body.path : undefined,
    contentType: request.body?._tag === "HttpFileRequestBody" ? request.body.contentType : undefined
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
