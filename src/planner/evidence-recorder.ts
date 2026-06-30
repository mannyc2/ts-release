import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as PlatformError from "effect/PlatformError"
import * as Schema from "effect/Schema"
import {
  EvidencePhase,
  EvidenceBundle,
  EvidenceRecord,
  GitHubReleaseEvidence,
  HttpCheckEvidence,
  OperationEvidenceRecord,
  HttpRequestEvidence,
} from "../domain/evidence.js"
import {
  CommandSpec,
  HttpJsonCheck,
  HttpRequestSpec,
  JsonPathSegment,
  Operation,
  VerifyHttpOperation
} from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"
import { ReleaseCommandRunner } from "../host/host.js"
import { ReleaseHttp } from "../host/http.js"
import {
  resolveWorkspacePath,
  validateWorkspaceWritePath,
  workspacePathBoundaryReasonMessage
} from "../internal/workspace-path.js"
import {
  GitHubApi,
  GitHubApiError,
  GitHubReleaseCreateRequest,
  GitHubReleaseInspectRequest
} from "../targets/github-api.js"
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

export const appendEvidenceBundle = (
  bundle: EvidenceBundle,
  next: EvidenceBundle
): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: bundle.schemaVersion,
    releaseName: bundle.releaseName,
    releaseVersion: bundle.releaseVersion,
    records: [...bundle.records, ...next.records]
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
      reason: workspacePathBoundaryReasonMessage(result.reason)
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
    : operation._tag === "PublishGitHubReleaseOperation" || operation._tag === "VerifyGitHubReleaseOperation"
    ? operation.tokenEnv === undefined ? [] : [operation.tokenEnv]
    : []
  for (const name of names) {
    const value = yield* readOptionalEnv(name)
    if (value !== undefined) {
      secrets.push(value)
    }
  }
  return secrets
})

export const operationEvidencePhase = (operation: Operation): EvidencePhase => {
  switch (operation._tag) {
    case "RenderFileOperation":
      return "render"
    case "ValidateCommandOperation":
    case "ValidationNoteOperation":
      return "validation"
    case "PublishCommandOperation":
    case "PublishGitHubReleaseOperation":
      return "execution"
    case "VerifyRemoteOperation":
    case "VerifyHttpOperation":
    case "VerifyGitHubReleaseOperation":
      return "verification"
  }
}

export const commandEvidenceFromResult = Effect.fn("commandEvidenceFromResult")(function*(
  operation: Extract<Operation, { readonly command: CommandSpec }>,
  phase: EvidencePhase = operationEvidencePhase(operation)
) {
  const commandRunner = yield* ReleaseCommandRunner
  const secrets = yield* readRedactionSecrets(operation)
  const result = yield* commandRunner.runCommand(operation.command)
  const status = result.exitCode === 0 ? "passed" : "failed"
  return OperationEvidenceRecord.make({
    id: `${operation.id}:command`,
    operationId: operation.id,
    phase,
    ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
    risk: operation.risk,
    status,
    severity: result.exitCode === 0 ? "info" : "error",
    message: result.exitCode === 0
      ? "Command completed successfully."
      : "Command exited with a nonzero status.",
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

const httpRequestEvidence = (request: HttpRequestSpec): HttpRequestEvidence =>
  HttpRequestEvidence.make({
    method: request.method,
    url: request.url,
    headers: request.headers,
    envHeaders: request.envHeaders,
    ...(request.body === undefined
      ? {}
      : {
        body: request.body._tag === "HttpJsonRequestBody" ? "json" : "file",
        ...(request.body._tag === "HttpFileRequestBody"
          ? {
            bodyPath: request.body.path,
            contentType: request.body.contentType
          }
          : {})
      })
  })

export const httpEvidenceFromResult = Effect.fn("httpEvidenceFromResult")(function*(
  operation: VerifyHttpOperation,
  phase: EvidencePhase = operationEvidencePhase(operation)
) {
  const http = yield* ReleaseHttp

  return yield* http.runJson(operation.request).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.gen(function*() {
          const startedAt = yield* nowIso()
          const endedAt = yield* nowIso()
          return OperationEvidenceRecord.make({
            id: `${operation.id}:http`,
            operationId: operation.id,
            phase,
            targetId: operation.targetId,
            risk: operation.risk,
            status: "failed",
            severity: "error",
            message: error.reason,
            request: httpRequestEvidence(operation.request),
            checks: [],
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
          OperationEvidenceRecord.make({
            id: `${operation.id}:http`,
            operationId: operation.id,
            phase,
            targetId: operation.targetId,
            risk: operation.risk,
            status: failed.length === 0 ? "passed" : "failed",
            severity: failed.length === 0 ? "info" : "error",
            request: httpRequestEvidence(result.request),
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

const githubReleaseEvidence = (input: {
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
    ...(input.releaseId === undefined ? {} : { releaseId: input.releaseId }),
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.draft === undefined ? {} : { draft: input.draft }),
    ...(input.prerelease === undefined ? {} : { prerelease: input.prerelease }),
    assets: [...input.assets]
  })

const githubApiFailureEvidence = Effect.fn("githubApiFailureEvidence")(function*(
  operation: Extract<Operation, { readonly _tag: "PublishGitHubReleaseOperation" | "VerifyGitHubReleaseOperation" }>,
  error: GitHubApiError,
  phase: EvidencePhase
) {
  const timestamp = yield* nowIso()
  return OperationEvidenceRecord.make({
    id: `${operation.id}:github-api`,
    operationId: operation.id,
    phase,
    targetId: operation.targetId,
    risk: operation.risk,
    status: "failed",
    severity: "error",
    message: error.reason,
    ...(error.status === undefined ? {} : { responseStatus: error.status }),
    githubRelease: githubReleaseEvidence({
      repository: operation.repository,
      tag: operation.tag,
      assets: operation._tag === "PublishGitHubReleaseOperation"
        ? operation.assets.map((asset) => asset.name)
        : operation.assetNames
    }),
    startedAt: timestamp,
    endedAt: timestamp,
    durationMillis: 0
  })
})

export const githubCreateEvidenceFromResult = Effect.fn("githubCreateEvidenceFromResult")(function*(
  operation: Extract<Operation, { readonly _tag: "PublishGitHubReleaseOperation" }>,
  phase: EvidencePhase = operationEvidencePhase(operation)
) {
  const api = yield* GitHubApi
  const startedAt = yield* nowIso()
  const started = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  return yield* api.createRelease(
    GitHubReleaseCreateRequest.make({
      repository: operation.repository,
      ...(operation.tokenEnv === undefined ? {} : { tokenEnv: operation.tokenEnv }),
      tag: operation.tag,
      title: operation.title,
      ...(operation.notes === undefined ? {} : { notes: operation.notes }),
      draft: operation.draft,
      prerelease: operation.prerelease,
      assets: [...operation.assets]
    })
  ).pipe(
    Effect.matchEffect({
      onFailure: (error) => githubApiFailureEvidence(operation, error, phase),
      onSuccess: (release) =>
        Effect.gen(function*() {
          const endedAt = yield* nowIso()
          const ended = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
          return OperationEvidenceRecord.make({
            id: `${operation.id}:github-api`,
            operationId: operation.id,
            phase,
            targetId: operation.targetId,
            risk: operation.risk,
            status: "passed",
            severity: "info",
            message: "GitHub release created through the GitHub API.",
            githubRelease: githubReleaseEvidence({
              repository: operation.repository,
              tag: release.tag_name,
              releaseId: release.id,
              title: release.name,
              draft: release.draft,
              prerelease: release.prerelease,
              assets: release.assets.map((asset) => asset.name)
            }),
            startedAt,
            endedAt,
            durationMillis: Math.max(0, ended - started)
          })
        })
    })
  )
})

const sortedStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...values].sort()

const sameStringSet = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
  const sortedLeft = sortedStrings(left)
  const sortedRight = sortedStrings(right)
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => sortedRight[index] === value)
}

export const githubVerifyEvidenceFromResult = Effect.fn("githubVerifyEvidenceFromResult")(function*(
  operation: Extract<Operation, { readonly _tag: "VerifyGitHubReleaseOperation" }>,
  phase: EvidencePhase = operationEvidencePhase(operation)
) {
  const api = yield* GitHubApi
  const startedAt = yield* nowIso()
  const started = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  return yield* api.inspectRelease(
    GitHubReleaseInspectRequest.make({
      repository: operation.repository,
      ...(operation.tokenEnv === undefined ? {} : { tokenEnv: operation.tokenEnv }),
      tag: operation.tag
    })
  ).pipe(
    Effect.matchEffect({
      onFailure: (error) => githubApiFailureEvidence(operation, error, phase),
      onSuccess: (release) =>
        Effect.gen(function*() {
          const assetNames = release.assets.map((asset) => asset.name)
          const checks = [
            HttpCheckEvidence.make({ description: `tag is ${operation.tag}`, passed: release.tag_name === operation.tag }),
            HttpCheckEvidence.make({ description: `title is ${operation.title}`, passed: release.name === operation.title }),
            HttpCheckEvidence.make({ description: `draft is ${operation.draft}`, passed: release.draft === operation.draft }),
            HttpCheckEvidence.make({
              description: `prerelease is ${operation.prerelease}`,
              passed: release.prerelease === operation.prerelease
            }),
            HttpCheckEvidence.make({
              description: `assets are ${sortedStrings(operation.assetNames).join(", ")}`,
              passed: sameStringSet(assetNames, operation.assetNames)
            })
          ]
          const failed = checks.filter((check) => !check.passed)
          const endedAt = yield* nowIso()
          const ended = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
          return OperationEvidenceRecord.make({
            id: `${operation.id}:github-api`,
            operationId: operation.id,
            phase,
            targetId: operation.targetId,
            risk: operation.risk,
            status: failed.length === 0 ? "passed" : "failed",
            severity: failed.length === 0 ? "info" : "error",
            message: failed.length === 0
              ? "GitHub release verification passed."
              : `GitHub release verification failed: ${failed.map((check) => check.description).join("; ")}`,
            githubRelease: githubReleaseEvidence({
              repository: operation.repository,
              tag: release.tag_name,
              releaseId: release.id,
              title: release.name,
              draft: release.draft,
              prerelease: release.prerelease,
              assets: assetNames
            }),
            checks,
            startedAt,
            endedAt,
            durationMillis: Math.max(0, ended - started)
          })
        })
    })
  )
})

export const executionEvidence = Effect.fn("executionEvidence")(function*(operation: Operation, message: string) {
  const timestamp = yield* nowIso()
  return OperationEvidenceRecord.make({
    id: `${operation.id}:execution`,
    operationId: operation.id,
    phase: operationEvidencePhase(operation),
    ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
    risk: operation.risk,
    status: "passed",
    severity: "info",
    message,
    startedAt: timestamp,
    endedAt: timestamp,
    durationMillis: 0
  })
})

export const validationNoteEvidence = Effect.fn("validationNoteEvidence")(function*(
  operation: Extract<Operation, { readonly _tag: "ValidationNoteOperation" }>,
  phase: EvidencePhase = operationEvidencePhase(operation)
) {
  const timestamp = yield* nowIso()
  const status = operation.skipped ? "skipped" : operation.severity === "warning" ? "warning" : "passed"
  return OperationEvidenceRecord.make({
    id: `${operation.id}:validation`,
    operationId: operation.id,
    phase,
    ...(operation.targetId === undefined ? {} : { targetId: operation.targetId }),
    risk: operation.risk,
    status,
    severity: operation.severity,
    message: operation.message,
    startedAt: timestamp,
    endedAt: timestamp,
    durationMillis: 0,
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

const readEvidenceContents = Effect.fn("readEvidenceContents")(function*(pathName: string, root: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const targetPath = resolveWorkspacePath(path, root, pathName)
  return yield* fs.readFileString(targetPath)
})

const parseEvidenceJson = (contents: string, pathName: string): Effect.Effect<unknown, EvidenceReadError> =>
  Effect.try({
    try: () => JSON.parse(contents),
    catch: (cause) =>
      EvidenceReadError.make({
        path: pathName,
        reason: "Evidence bundle is not valid JSON.",
        cause
      })
  })

const decodeEvidenceJson = (
  parsed: unknown,
  pathName: string,
  includeCause: boolean
): Effect.Effect<EvidenceBundle, EvidenceReadError> =>
  decodeEvidenceBundle(parsed).pipe(
    Effect.mapError((error) =>
      EvidenceReadError.make({
        path: pathName,
        reason: error.message,
        ...(includeCause ? { cause: error } : {})
      })
    )
  )

export const readEvidenceBundle = Effect.fn("readEvidenceBundle")(function*(
  pathName: string,
  root: string = "."
) {
  const contents = yield* readEvidenceContents(pathName, root).pipe(
    Effect.mapError((error) =>
      EvidenceReadError.make({
        path: pathName,
        reason: error.message,
        cause: error
      })
    )
  )
  const parsed = yield* parseEvidenceJson(contents, pathName)
  return yield* decodeEvidenceJson(parsed, pathName, true)
})

export const tryReadEvidenceBundle = Effect.fn("tryReadEvidenceBundle")(function*(
  pathName: string,
  root: string = "."
) {
  const contents = yield* readEvidenceContents(pathName, root).pipe(
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
  const parsed = yield* parseEvidenceJson(contents, pathName)
  return yield* decodeEvidenceJson(parsed, pathName, false)
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
