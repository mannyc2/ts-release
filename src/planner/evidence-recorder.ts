import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as PlatformError from "effect/PlatformError"
import * as Schema from "effect/Schema"
import {
  CommandEvidence,
  EvidenceBundle,
  EvidenceRecord,
  ExecutionEvidence,
  HttpCheckEvidence,
  HttpEvidence,
  HttpRequestEvidence,
  ValidationEvidence
} from "../domain/evidence.js"
import { CommandSpec, HttpJsonCheck, JsonPathSegment, Operation, operationFingerprint, VerifyHttpOperation } from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"
import { ReleaseCommandRunner } from "../host/host.js"
import { ReleaseHttp } from "../host/http.js"
import { resolveWorkspacePath, validateWorkspaceWritePath } from "../internal/workspace-path.js"
import { EvidenceReadError, EvidenceWriteError } from "./errors.js"

export type * from "../types/effect-internal.js"

export const emptyEvidenceBundle = (plan: ReleasePlan): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: "release-evidence/v1",
    releaseName: plan.identity.name,
    releaseVersion: plan.identity.version,
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
    records: [...bundle.records, record]
  })

export const redactText = (input: string, secrets: ReadonlyArray<string>): string => {
  let output = input
  for (const secret of secrets) {
    if (secret.length > 0) {
      output = output.split(secret).join("[REDACTED]")
    }
  }
  return output
}

const nowIso = Effect.fn("evidence.nowIso")(function*() {
  const millis = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  return new Date(millis).toISOString()
})

const readOptionalEnv = (name: string): Effect.Effect<string | undefined> =>
  Config.string(name).pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined)
  )

const workspaceWritePath = (
  path: Path.Path,
  root: string,
  pathName: string
): Effect.Effect<string, EvidenceWriteError> => {
  const result = validateWorkspaceWritePath(path, root, pathName)
  if (result._tag === "Ok") {
    return Effect.succeed(result.path)
  }
  return Effect.fail(
    EvidenceWriteError.make({
      path: pathName,
      reason: result.reason === "empty-or-parent-traversal"
        ? "Path must be non-empty and must not contain parent traversal."
        : "Path must resolve inside the workspace root."
    })
  )
}

const isNotFoundError = (error: PlatformError.PlatformError): boolean =>
  error.reason._tag === "NotFound"

export const readRedactionSecrets = Effect.fn("readRedactionSecrets")(function*(operation: Operation) {
  const secrets: Array<string> = []
  const names = "command" in operation
    ? operation.command.redactedEnv
    : operation._tag === "VerifyHttpOperation"
    ? operation.request.redactedEnv
    : []
  for (const name of names) {
    const value = yield* readOptionalEnv(name)
    if (value !== undefined) {
      secrets.push(value)
    }
  }
  return secrets
})

export const commandEvidenceFromResult = Effect.fn("commandEvidenceFromResult")(function*(
  operation: Extract<Operation, { readonly command: CommandSpec }>
) {
  const commandRunner = yield* ReleaseCommandRunner
  const secrets = yield* readRedactionSecrets(operation)
  const result = yield* commandRunner.runCommand(operation.command)
  const status = result.exitCode === 0 ? "passed" : "failed"
  return CommandEvidence.make({
    id: `${operation.id}:command`,
    operationId: operation.id,
    operationFingerprint: operationFingerprint(operation),
    ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
    status,
    severity: result.exitCode === 0 ? "info" : "error",
    command: result.command,
    exitCode: result.exitCode,
    stdout: redactText(result.stdout, secrets),
    stderr: redactText(result.stderr, secrets),
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    durationMillis: result.durationMillis
  })
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

const evaluateHttpCheck = (json: Schema.Json, check: HttpJsonCheck): HttpCheckEvidence => {
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

const httpRequestEvidence = (operation: VerifyHttpOperation): HttpRequestEvidence =>
  HttpRequestEvidence.make({
    method: operation.request.method,
    url: operation.request.url,
    headers: operation.request.headers,
    envHeaders: operation.request.envHeaders
  })

export const httpEvidenceFromResult = Effect.fn("httpEvidenceFromResult")(function*(operation: VerifyHttpOperation) {
  const http = yield* ReleaseHttp

  return yield* http.runJson(operation.request).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.gen(function*() {
          const startedAt = yield* nowIso()
          const endedAt = yield* nowIso()
          return HttpEvidence.make({
            id: `${operation.id}:http`,
            operationId: operation.id,
            operationFingerprint: operationFingerprint(operation),
            targetId: operation.targetId,
            status: "failed",
            severity: "error",
            request: httpRequestEvidence(operation),
            checks: [],
            message: error.reason,
            startedAt,
            endedAt,
            durationMillis: 0
          })
        }),
      onSuccess: (result) => {
        const checks = [
          HttpCheckEvidence.make({
            description: `status is ${operation.expectedStatus}`,
            passed: result.status === operation.expectedStatus
          }),
          ...operation.checks.map((check) => evaluateHttpCheck(result.json, check))
        ]
        const failed = checks.filter((check) => !check.passed)
        return Effect.succeed(
          HttpEvidence.make({
            id: `${operation.id}:http`,
            operationId: operation.id,
            operationFingerprint: operationFingerprint(operation),
            targetId: operation.targetId,
            status: failed.length === 0 ? "passed" : "failed",
            severity: failed.length === 0 ? "info" : "error",
            request: HttpRequestEvidence.make({
              method: result.request.method,
              url: result.request.url,
              headers: result.request.headers,
              envHeaders: result.request.envHeaders
            }),
            responseStatus: result.status,
            checks,
            message: failed.length === 0
              ? "HTTP verification passed."
              : `HTTP verification failed: ${failed.map((check) => check.description).join("; ")}`,
            startedAt: result.startedAt,
            endedAt: result.endedAt,
            durationMillis: result.durationMillis
          })
        )
      }
    })
  )
})

export const executionEvidence = Effect.fn("executionEvidence")(function*(operation: Operation, message: string) {
  const timestamp = yield* nowIso()
  return ExecutionEvidence.make({
    id: `${operation.id}:execution`,
    operationId: operation.id,
    operationFingerprint: operationFingerprint(operation),
    ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
    status: "passed",
    severity: "info",
    message,
    timestamp
  })
})

export const validationNoteEvidence = Effect.fn("validationNoteEvidence")(function*(
  operation: Extract<Operation, { readonly _tag: "ValidationNoteOperation" }>
) {
  const timestamp = yield* nowIso()
  const status = operation.skipped ? "skipped" : operation.severity === "warning" ? "warning" : "passed"
  return ValidationEvidence.make({
    id: `${operation.id}:validation`,
    operationFingerprint: operationFingerprint(operation),
    ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
    status,
    severity: operation.severity,
    message: operation.message,
    timestamp,
    skipped: operation.skipped
  })
})

export const renderEvidenceJson = (bundle: EvidenceBundle): string =>
  `${JSON.stringify(bundle, null, 2)}\n`

export const writeEvidenceBundle = Effect.fn("writeEvidenceBundle")(function*(
  pathName: string,
  bundle: EvidenceBundle,
  root: string = "."
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const targetPath = yield* workspaceWritePath(path, root, pathName)
  yield* Effect.gen(function*() {
    yield* fs.makeDirectory(path.dirname(targetPath), { recursive: true })
    yield* fs.writeFileString(targetPath, renderEvidenceJson(bundle))
  }).pipe(
    Effect.mapError((error) =>
      EvidenceWriteError.make({
        path: pathName,
        reason: error.message,
        cause: error
      })
    )
  )
})

export const decodeEvidenceBundle = Schema.decodeUnknownEffect(EvidenceBundle)

const readEvidenceJson = Effect.fn("readEvidenceJson")(function*(pathName: string, root: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const targetPath = resolveWorkspacePath(path, root, pathName)
  const contents = yield* fs.readFileString(targetPath).pipe(
    Effect.mapError((error) =>
      EvidenceReadError.make({
        path: pathName,
        reason: error.message,
        cause: error
      })
    )
  )
  const parsed: unknown = yield* Effect.try({
    try: () => JSON.parse(contents),
    catch: (cause) =>
      EvidenceReadError.make({
        path: pathName,
        reason: "Evidence bundle is not valid JSON.",
        cause
      })
  })
  return parsed
})

export const readEvidenceBundle = Effect.fn("readEvidenceBundle")(function*(
  pathName: string,
  root: string = "."
) {
  const parsed = yield* readEvidenceJson(pathName, root)
  return yield* decodeEvidenceBundle(parsed).pipe(
    Effect.mapError((error) =>
      EvidenceReadError.make({
        path: pathName,
        reason: error.message,
        cause: error
      })
    )
  )
})

export const tryReadEvidenceBundle = Effect.fn("tryReadEvidenceBundle")(function*(
  pathName: string,
  root: string = "."
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const targetPath = resolveWorkspacePath(path, root, pathName)
  const contents = yield* fs.readFileString(targetPath).pipe(
    Effect.catchIf(isNotFoundError, () => Effect.succeed(undefined)),
    Effect.mapError((error) =>
      EvidenceReadError.make({
        path: pathName,
        reason: error.message
      })
    )
  )
  if (contents === undefined) {
    return undefined
  }
  const parsed: unknown = yield* Effect.try({
    try: () => JSON.parse(contents),
    catch: (cause) =>
      EvidenceReadError.make({
        path: pathName,
        reason: "Evidence bundle is not valid JSON.",
        cause
      })
  })
  return yield* decodeEvidenceBundle(parsed).pipe(
    Effect.mapError((error) =>
      EvidenceReadError.make({
        path: pathName,
        reason: error.message
      })
    )
  )
})

const ensureBundleMatchesPlan = (
  plan: ReleasePlan,
  bundle: EvidenceBundle,
  pathName: string
): Effect.Effect<void, EvidenceReadError> => {
  if (bundle.releaseName === plan.identity.name && bundle.releaseVersion === plan.identity.version) {
    return Effect.void
  }
  return Effect.fail(
    EvidenceReadError.make({
      path: pathName,
      reason:
        `Evidence bundle is for ${bundle.releaseName}@${bundle.releaseVersion}, expected ${plan.identity.name}@${plan.identity.version}.`
    })
  )
}

export const mergeEvidenceBundles = Effect.fn("mergeEvidenceBundles")(function*(
  plan: ReleasePlan,
  existing: EvidenceBundle | undefined,
  fresh: EvidenceBundle
) {
  const base = existing ?? emptyEvidenceBundle(plan)
  yield* ensureBundleMatchesPlan(plan, base, plan.evidenceDirectory)
  yield* ensureBundleMatchesPlan(plan, fresh, plan.evidenceDirectory)
  return EvidenceBundle.make({
    schemaVersion: "release-evidence/v1",
    releaseName: plan.identity.name,
    releaseVersion: plan.identity.version,
    records: [...base.records, ...fresh.records]
  })
})
