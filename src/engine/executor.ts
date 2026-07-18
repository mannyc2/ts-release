import { createHash } from "node:crypto"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Ref from "effect/Ref"
import * as Schedule from "effect/Schedule"
import {
  appendEvidenceRecord,
  CommandOutcome,
  emptyEvidenceBundle,
  EvidenceBundle,
  EvidenceRecord,
  evaluateHttpCheck,
  FileOutcome,
  GitHubReleaseOutcome,
  githubCreateRequestFromAction,
  githubInspectRequestFromAction,
  githubReleaseEvidence,
  HttpCheckEvidence,
  HttpOutcome,
  httpRequestEvidence,
  readRedactionSecrets,
  redactText,
  sameStringSet,
  sortedStrings,
  type ActionOutcome,
  type EvidenceStatus
} from "./evidence.js"
import {
  deferredContentArtifactIds,
  renderDeferredContent
} from "./content.js"
import { ActionAttemptFailed, OperationFailedError, WorkspaceWriteError } from "./errors.js"
import { ReleaseCommandRunner } from "../host/host.js"
import { ReleaseHttp } from "../host/http.js"
import { nowIso } from "../host/platform.js"
import {
  resolveWorkspacePath,
  resolveWorkspaceWritePathEffect
} from "../internal/workspace-path.js"
import {
  type CheckFileAction,
  type CommandAction,
  type DeferredFileContent,
  ExecutionApproval,
  type GitHubReleaseCreateAction,
  type GitHubReleaseVerifyAction,
  type HttpCheckAction,
  type NoteAction,
  Operation,
  requireExecutionApproval,
  type RetryPolicy,
  type StageAction,
  type WriteFileAction
} from "../pipeline/operation.js"
import { optionalField } from "../pipeline/optional-field.js"
import type { Artifact } from "../pipeline/artifact.js"
import type { PipeNotice, ReleaseIdentity } from "../pipeline/state.js"
import {
  stageArtifactOperation,
  type StageOperation
} from "./stager.js"
import {
  GitHubApi,
  GitHubApiError
} from "./github.js"


export interface OperationRunContext {
  readonly root: string
  readonly identity: ReleaseIdentity
  readonly artifacts: ReadonlyArray<Artifact>
  readonly notices?: ReadonlyArray<PipeNotice> | undefined
  readonly configPath?: string | undefined
}

export type EvidenceRef = Ref.Ref<EvidenceBundle>

interface RecordTiming {
  readonly startedAt: string
  readonly endedAt: string
  readonly durationMillis: number
}

interface RecordFields extends RecordTiming {
  readonly status: EvidenceStatus
  readonly message: string
  readonly outcome?: ActionOutcome | undefined
}

const record = (operation: Operation, fields: RecordFields): EvidenceRecord =>
  EvidenceRecord.make({
    operationId: operation.id,
    pipeId: operation.pipeId,
    phase: operation.phase,
    risk: operation.risk,
    status: fields.status,
    message: fields.message,
    startedAt: fields.startedAt,
    endedAt: fields.endedAt,
    durationMillis: fields.durationMillis,
    outcome: fields.outcome
  })

const instantRecord = Effect.fn("engine.instantRecord")(function*(
  operation: Operation,
  fields: {
    readonly status: EvidenceStatus
    readonly message: string
    readonly outcome?: ActionOutcome | undefined
  }
) {
  const timestamp = yield* nowIso()
  return record(operation, {
    ...fields,
    startedAt: timestamp,
    endedAt: timestamp,
    durationMillis: 0
  })
})

const startTiming = Effect.fn("engine.startTiming")(function*() {
  const startedAt = yield* nowIso()
  const started = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  return {
    end: Effect.fn("engine.endTiming")(function*() {
      const endedAt = yield* nowIso()
      const ended = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
      return {
        startedAt,
        endedAt,
        durationMillis: Math.max(0, ended - started)
      } satisfies RecordTiming
    })
  }
})

export const bundleForContext = (context: OperationRunContext): EvidenceBundle =>
  emptyEvidenceBundle({
    releaseName: context.identity.name,
    releaseVersion: context.identity.version,
    notices: context.notices
  })

export const makeEvidenceRef = Effect.fn("engine.makeEvidenceRef")(function*(context: OperationRunContext) {
  return yield* Ref.make(bundleForContext(context))
})

const failAttempt = (failedRecord: EvidenceRecord): Effect.Effect<never, ActionAttemptFailed> =>
  Effect.fail(ActionAttemptFailed.make({ record: failedRecord }))

const writeWorkspaceFile = Effect.fn("engine.writeWorkspaceFile")(function*(
  root: string,
  pathName: string,
  contents: string
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const targetPath = yield* resolveWorkspaceWritePathEffect(
    path,
    root,
    pathName,
    (errorPath, reason) => WorkspaceWriteError.make({ path: errorPath, reason })
  )
  yield* Effect.gen(function*() {
    yield* fs.makeDirectory(path.dirname(targetPath), { recursive: true })
    yield* fs.writeFileString(targetPath, contents)
  }).pipe(
    Effect.mapError((error) =>
      WorkspaceWriteError.make({
        path: pathName,
        reason: error.message
      })
    )
  )
})

const digestHex = (bytes: Uint8Array, algorithm: "sha256" | "sha512"): string =>
  createHash(algorithm).update(bytes).digest("hex")

const resolveDeferredContentHashes = Effect.fn("engine.resolveDeferredContentHashes")(function*(
  content: DeferredFileContent,
  context: OperationRunContext,
  outputPath: string,
  algorithm: "sha256" | "sha512"
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const hashes = new Map<string, string>()
  for (const artifactId of deferredContentArtifactIds(content)) {
    const artifact = context.artifacts.find((candidate) => candidate.id === artifactId)
    if (artifact === undefined) {
      return yield* Effect.fail(
        WorkspaceWriteError.make({
          path: outputPath,
          reason: `Deferred file content references missing artifact ${artifactId}.`
        })
      )
    }
    const bytes = yield* fs.readFile(resolveWorkspacePath(path, context.root, artifact.path)).pipe(
      Effect.mapError((error) =>
        WorkspaceWriteError.make({
          path: artifact.path,
          reason: error.message
        })
      )
    )
    hashes.set(artifactId, digestHex(bytes, algorithm))
  }
  return hashes
})

const resolveWriteFileContents = Effect.fn("engine.resolveWriteFileContents")(function*(
  contents: string | DeferredFileContent,
  context: OperationRunContext,
  outputPath: string
) {
  if (typeof contents === "string") {
    return { contents }
  }
  const outputArtifact = context.artifacts.find((artifact) =>
    artifact.path === outputPath && artifact.extra?._tag === "checksum-file"
  )
  const checksumAlgorithm = outputArtifact?.extra?._tag === "checksum-file"
    ? outputArtifact.extra.algorithm
    : undefined
  const hashes = yield* resolveDeferredContentHashes(contents, context, outputPath, checksumAlgorithm ?? "sha256")
  try {
    const resolved = renderDeferredContent(contents, hashes)
    const resolvedValues = checksumAlgorithm === undefined
      ? resolved.values
      : resolved.values.map(({ artifactId, sha256 }) => ({
        artifactId,
        algorithm: checksumAlgorithm,
        value: sha256
      }))
    return { contents: resolved.contents, resolvedValues }
  } catch (error) {
    return yield* Effect.fail(
      WorkspaceWriteError.make({
        path: outputPath,
        reason: error instanceof Error ? error.message : String(error)
      })
    )
  }
})

const fileCheckEvidence = Effect.fn("engine.fileCheckEvidence")(function*(
  operation: Operation,
  action: CheckFileAction,
  context: OperationRunContext
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const outcome = FileOutcome.make({ path: action.path })
  const resolved = resolveWorkspacePath(path, context.root, action.path)
  const exists = yield* fs.exists(resolved)
  if (!exists) {
    const failedRecord = yield* instantRecord(operation, {
      status: "failed",
      message: "File does not exist.",
      outcome
    })
    return yield* failAttempt(failedRecord)
  }
  if (action.checksum !== undefined) {
    const bytes = yield* fs.readFile(resolved)
    const actual = digestHex(bytes, action.checksum.algorithm)
    if (actual !== action.checksum.value) {
      const failedRecord = yield* instantRecord(operation, {
        status: "failed",
        message: "File checksum did not match.",
        outcome
      })
      return yield* failAttempt(failedRecord)
    }
  }
  return yield* instantRecord(operation, {
    status: "passed",
    message: "File check passed.",
    outcome
  })
})

const commandEvidence = Effect.fn("engine.commandEvidence")(function*(
  operation: Operation,
  action: CommandAction
) {
  const commandRunner = yield* ReleaseCommandRunner
  const secrets = yield* readRedactionSecrets(operation)
  const result = yield* commandRunner.runCommand(action.command)
  const attemptRecord = record(operation, {
    status: result.exitCode === 0 ? "passed" : "failed",
    message: result.exitCode === 0
      ? "Command completed successfully."
      : "Command exited with a nonzero status.",
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    durationMillis: result.durationMillis,
    outcome: CommandOutcome.make({
      command: result.command,
      exitCode: result.exitCode,
      stdout: redactText(result.stdout, secrets),
      stderr: redactText(result.stderr, secrets)
    })
  })
  return result.exitCode === 0 ? attemptRecord : yield* failAttempt(attemptRecord)
})

const writeFileEvidence = Effect.fn("engine.writeFileEvidence")(function*(
  operation: Operation,
  action: WriteFileAction,
  context: OperationRunContext
) {
  const resolved = yield* resolveWriteFileContents(action.contents, context, action.path)
  yield* writeWorkspaceFile(context.root, action.path, resolved.contents)
  return yield* instantRecord(operation, {
    status: "passed",
    message: `Rendered ${action.path}`,
    outcome: FileOutcome.make({
      path: action.path,
      ...optionalField(resolved.resolvedValues, (resolvedValues) => ({ resolvedValues: [...resolvedValues] }))
    })
  })
})

const httpEvidence = Effect.fn("engine.httpEvidence")(function*(
  operation: Operation,
  action: HttpCheckAction
) {
  const http = yield* ReleaseHttp

  return yield* http.runJson(action.request).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        instantRecord(operation, {
          status: "failed",
          message: error.reason,
          outcome: HttpOutcome.make({
            request: httpRequestEvidence(action.request),
            checks: []
          })
        }).pipe(Effect.flatMap(failAttempt)),
      onSuccess: (result) => {
        const checks = [
          HttpCheckEvidence.make({
            description: `status is ${action.expectedStatus}`,
            passed: result.status === action.expectedStatus
          }),
          ...action.checks.map((check) => evaluateHttpCheck(result.json, check))
        ]
        const failed = checks.filter((check) => !check.passed)
        const attemptRecord = record(operation, {
          status: failed.length === 0 ? "passed" : "failed",
          message: failed.length === 0
            ? "HTTP verification passed."
            : `HTTP verification failed: ${failed.map((check) => check.description).join("; ")}`,
          startedAt: result.startedAt,
          endedAt: result.endedAt,
          durationMillis: result.durationMillis,
          outcome: HttpOutcome.make({
            request: httpRequestEvidence(result.request),
            responseStatus: result.status,
            checks
          })
        })
        return failed.length === 0 ? Effect.succeed(attemptRecord) : failAttempt(attemptRecord)
      }
    })
  )
})

const githubApiFailureEvidence = Effect.fn("engine.githubApiFailureEvidence")(function*(
  operation: Operation,
  action: GitHubReleaseCreateAction | GitHubReleaseVerifyAction,
  error: GitHubApiError
) {
  const failedRecord = yield* instantRecord(operation, {
    status: "failed",
    message: error.reason,
    outcome: GitHubReleaseOutcome.make({
      release: githubReleaseEvidence({
        repository: action.repository,
        tag: action.tag,
        assets: action._tag === "github-release-create"
          ? action.assets.map((asset) => asset.name)
          : action.assetNames
      }),
      responseStatus: error.status
    })
  })
  return yield* failAttempt(failedRecord)
})

const githubCreateEvidence = Effect.fn("engine.githubCreateEvidence")(function*(
  operation: Operation,
  action: GitHubReleaseCreateAction
) {
  const api = yield* GitHubApi
  const timing = yield* startTiming()
  return yield* api.createRelease(githubCreateRequestFromAction(action)).pipe(
    Effect.matchEffect({
      onFailure: (error) => githubApiFailureEvidence(operation, action, error),
      onSuccess: (release) =>
        Effect.gen(function*() {
          return record(operation, {
            status: "passed",
            message: "GitHub release created through the GitHub API.",
            ...(yield* timing.end()),
            outcome: GitHubReleaseOutcome.make({
              release: githubReleaseEvidence({
                repository: action.repository,
                tag: release.tag_name,
                releaseId: release.id,
                title: release.name,
                draft: release.draft,
                prerelease: release.prerelease,
                assets: release.assets.map((asset) => asset.name)
              })
            })
          })
        })
    })
  )
})

const githubVerifyEvidence = Effect.fn("engine.githubVerifyEvidence")(function*(
  operation: Operation,
  action: GitHubReleaseVerifyAction
) {
  const api = yield* GitHubApi
  const timing = yield* startTiming()
  return yield* api.inspectRelease(githubInspectRequestFromAction(action)).pipe(
    Effect.matchEffect({
      onFailure: (error) => githubApiFailureEvidence(operation, action, error),
      onSuccess: (release) =>
        Effect.gen(function*() {
          const assetNames = release.assets.map((asset) => asset.name)
          const checks = [
            HttpCheckEvidence.make({ description: `tag is ${action.tag}`, passed: release.tag_name === action.tag }),
            HttpCheckEvidence.make({ description: `title is ${action.title}`, passed: release.name === action.title }),
            HttpCheckEvidence.make({ description: `draft is ${action.draft}`, passed: release.draft === action.draft }),
            HttpCheckEvidence.make({
              description: `prerelease is ${action.prerelease}`,
              passed: release.prerelease === action.prerelease
            }),
            HttpCheckEvidence.make({
              description: `assets are ${sortedStrings(action.assetNames).join(", ")}`,
              passed: sameStringSet(assetNames, action.assetNames)
            })
          ]
          const failed = checks.filter((check) => !check.passed)
          const attemptRecord = record(operation, {
            status: failed.length === 0 ? "passed" : "failed",
            message: failed.length === 0
              ? "GitHub release verification passed."
              : `GitHub release verification failed: ${failed.map((check) => check.description).join("; ")}`,
            ...(yield* timing.end()),
            outcome: GitHubReleaseOutcome.make({
              release: githubReleaseEvidence({
                repository: action.repository,
                tag: release.tag_name,
                releaseId: release.id,
                title: release.name,
                draft: release.draft,
                prerelease: release.prerelease,
                assets: assetNames
              }),
              checks
            })
          })
          return failed.length === 0 ? attemptRecord : yield* failAttempt(attemptRecord)
        })
    })
  )
})

const noteEvidence = Effect.fn("engine.noteEvidence")(function*(operation: Operation, action: NoteAction) {
  return yield* instantRecord(operation, {
    status: action.skipped ? "skipped" : action.severity === "warning" ? "warning" : "passed",
    message: action.message
  })
})

const stageEvidence = Effect.fn("engine.stageEvidence")(function*(
  operation: Operation,
  action: StageAction,
  context: OperationRunContext
) {
  const stageOperation: StageOperation = { ...operation, action }
  const result = yield* stageArtifactOperation(stageOperation, {
    root: context.root,
    identity: context.identity,
    configPath: context.configPath
  })
  return yield* instantRecord(operation, {
    status: "passed",
    message: "Artifact staging completed.",
    outcome: FileOutcome.make({ path: result.artifacts[0]?.path ?? "" })
  })
})

const runOperationActionEvidence = Effect.fn("engine.runOperationActionEvidence")(function*(
  operation: Operation,
  context: OperationRunContext
) {
  const action = operation.action
  switch (action._tag) {
    case "command":
      return yield* commandEvidence(operation, action)
    case "check-file":
      return yield* fileCheckEvidence(operation, action, context)
    case "write-file":
      return yield* writeFileEvidence(operation, action, context)
    case "http-check":
      return yield* httpEvidence(operation, action)
    case "github-release-create":
      return yield* githubCreateEvidence(operation, action)
    case "github-release-verify":
      return yield* githubVerifyEvidence(operation, action)
    case "note":
      return yield* noteEvidence(operation, action)
    case "stage":
      return yield* stageEvidence(operation, action, context)
  }
})

const operationFailureFields = (
  record: EvidenceRecord
): {
  readonly exitCode?: number | undefined
  readonly responseStatus?: number | undefined
} => {
  const outcome = record.outcome
  if (outcome?._tag === "command") {
    return { exitCode: outcome.exitCode }
  }
  if (outcome?._tag === "http" || outcome?._tag === "github-release") {
    return { responseStatus: outcome.responseStatus }
  }
  return {}
}

const failOperationEvidence = (
  record: EvidenceRecord,
  bundle: EvidenceBundle | undefined
): Effect.Effect<never, OperationFailedError> => {
  const fields = operationFailureFields(record)
  return Effect.fail(
    OperationFailedError.make({
      operationId: record.operationId,
      exitCode: fields.exitCode,
      responseStatus: fields.responseStatus,
      reason: record.message,
      evidence: bundle
    })
  )
}

const runOperationEvidenceWithRetry = Effect.fn("engine.runOperationEvidenceWithRetry")(function*(
  operation: Operation,
  context: OperationRunContext
) {
  return yield* runOperationActionEvidence(operation, context).pipe(
    Effect.retry({
      schedule: scheduleFromRetryPolicy(operation.retry),
      while: isActionAttemptFailed
    }),
    Effect.catchTag("ActionAttemptFailed", (error) => Effect.succeed(error.record))
  )
})

const shouldRefuseForSnapshot = (operation: Operation, context: OperationRunContext): boolean =>
  context.identity.snapshot &&
  (operation.risk === "externally-visible" || operation.risk === "irreversible")

const isActionAttemptFailed = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "ActionAttemptFailed"

export const scheduleFromRetryPolicy = (policy: RetryPolicy | undefined) => {
  const attempts = Math.max(1, policy?.attempts ?? 1)
  const delay = Duration.millis(Math.max(0, policy?.delayMillis ?? 0))
  return Schedule.spaced(delay).pipe(
    Schedule.both(Schedule.recurs(attempts - 1))
  )
}

export const runOperationEvidence = Effect.fn("engine.runOperationEvidence")(function*(
  operation: Operation,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  if (shouldRefuseForSnapshot(operation, context)) {
    return yield* instantRecord(operation, {
      status: "refused",
      message: "Refused by snapshot policy."
    })
  }
  yield* requireExecutionApproval(operation, approval)
  return yield* runOperationEvidenceWithRetry(operation, context)
})

export const runOperation = Effect.fn("engine.runOperation")(function*(
  operation: Operation,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  const evidence = yield* runOperationEvidence(operation, approval, context)
  if (evidence.status === "failed") {
    return yield* failOperationEvidence(
      evidence,
      appendEvidenceRecord(bundleForContext(context), evidence)
    )
  }
  return evidence
})

const appendEvidenceRecordInto = (ref: EvidenceRef, evidence: EvidenceRecord): Effect.Effect<void> =>
  Ref.update(ref, (bundle) => appendEvidenceRecord(bundle, evidence))

export const runOperationsInto = Effect.fn("engine.runOperationsInto")(function*(
  ref: EvidenceRef,
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  for (const operation of operations) {
    const evidence = yield* runOperationEvidence(operation, approval, context)
    yield* appendEvidenceRecordInto(ref, evidence)
    if (evidence.status === "failed") {
      return yield* failOperationEvidence(evidence, yield* Ref.get(ref))
    }
  }
})

export const publishOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> =>
  operations.filter((operation) => operation.phase === "publish" && operation.risk !== "read-only")

export const buildOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> =>
  operations.filter((operation) => operation.phase === "build" || operation.phase === "process")

const renderFileOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> =>
  operations.filter((operation) => operation.phase === "catalog" && operation.action._tag === "write-file")

const validationOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> =>
  operations.filter((operation) => operation.phase === "publish" && operation.risk === "read-only")

const verificationOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> =>
  operations.filter((operation) => operation.phase === "verify")

const releasePassOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> => [
  ...renderFileOperations(operations),
  ...validationOperations(operations),
  ...publishOperations(operations),
  ...verificationOperations(operations)
]

export const releaseWorkflowOperations = (
  operations: ReadonlyArray<Operation>,
  context: OperationRunContext
): ReadonlyArray<Operation> =>
  releasePassOperations(operations).filter((operation) => !shouldRefuseForSnapshot(operation, context))

const preflightOperations = Effect.fn("engine.preflightOperations")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval
) {
  for (const operation of operations) {
    yield* requireExecutionApproval(operation, approval)
  }
})

export const preflightReleaseApproval = Effect.fn("engine.preflightReleaseApproval")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  yield* preflightOperations(releaseWorkflowOperations(operations, context), approval)
})

export const preflightRenderApproval = Effect.fn("engine.preflightRenderApproval")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  yield* preflightOperations(
    renderFileOperations(operations).filter((operation) => !shouldRefuseForSnapshot(operation, context)),
    approval
  )
})

export const runOperations = Effect.fn("engine.runOperations")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  yield* preflightOperations(
    operations.filter((operation) => !shouldRefuseForSnapshot(operation, context)),
    approval
  )
  const ref = yield* makeEvidenceRef(context)
  yield* runOperationsInto(ref, operations, approval, context)
  return yield* Ref.get(ref)
})

export const validateOperationsInto = Effect.fn("engine.validateOperationsInto")(function*(
  ref: EvidenceRef,
  operations: ReadonlyArray<Operation>,
  context: OperationRunContext
) {
  yield* runOperationsInto(ref, validationOperations(operations), ExecutionApproval.none, context)
})

export const validateOperations = Effect.fn("engine.validateOperations")(function*(
  operations: ReadonlyArray<Operation>,
  context: OperationRunContext
) {
  return yield* runOperations(validationOperations(operations), ExecutionApproval.none, context)
})

export const executeOperationsInto = Effect.fn("engine.executeOperationsInto")(function*(
  ref: EvidenceRef,
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  const selected = publishOperations(operations)
  yield* preflightOperations(
    selected.filter((operation) => !shouldRefuseForSnapshot(operation, context)),
    approval
  )
  yield* runOperationsInto(ref, selected, approval, context)
})

export const executeOperations = Effect.fn("engine.executeOperations")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  return yield* runOperations(publishOperations(operations), approval, context)
})

export const writeRenderFilesInto = Effect.fn("engine.writeRenderFilesInto")(function*(
  ref: EvidenceRef,
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  const selected = renderFileOperations(operations)
  yield* preflightRenderApproval(operations, approval, context)
  yield* runOperationsInto(ref, selected, approval, context)
})

export const writeRenderFiles = Effect.fn("engine.writeRenderFiles")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  const selected = renderFileOperations(operations)
  yield* preflightRenderApproval(operations, approval, context)
  const ref = yield* makeEvidenceRef(context)
  yield* runOperationsInto(ref, selected, approval, context)
  return yield* Ref.get(ref)
})

export const verifyOperationsInto = Effect.fn("engine.verifyOperationsInto")(function*(
  ref: EvidenceRef,
  operations: ReadonlyArray<Operation>,
  context: OperationRunContext
) {
  yield* runOperationsInto(ref, verificationOperations(operations), ExecutionApproval.none, context)
})

export const verifyOperations = Effect.fn("engine.verifyOperations")(function*(
  operations: ReadonlyArray<Operation>,
  context: OperationRunContext
) {
  return yield* runOperations(verificationOperations(operations), ExecutionApproval.none, context)
})

export const runApprovedReleaseWorkflowInto = Effect.fn("engine.runApprovedReleaseWorkflowInto")(function*(
  ref: EvidenceRef,
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  yield* preflightReleaseApproval(operations, approval, context)
  yield* runOperationsInto(ref, renderFileOperations(operations), approval, context)
  yield* runOperationsInto(ref, validationOperations(operations), ExecutionApproval.none, context)
  yield* runOperationsInto(ref, publishOperations(operations), approval, context)
  yield* runOperationsInto(ref, verificationOperations(operations), ExecutionApproval.none, context)
})

export const runApprovedReleaseWorkflow = Effect.fn("engine.runApprovedReleaseWorkflow")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  yield* preflightReleaseApproval(operations, approval, context)
  const ref = yield* makeEvidenceRef(context)
  yield* runApprovedReleaseWorkflowInto(ref, operations, approval, context)
  return yield* Ref.get(ref)
})
