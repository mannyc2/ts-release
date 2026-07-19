// Invariant: operations execute sequentially in pass order, each producing exactly one final evidence record.
import { createHash } from "node:crypto"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Ref from "effect/Ref"
import * as Schedule from "effect/Schedule"
import {
  CommandOutcome,
  EvidenceBundle,
  EvidenceRecord,
  FileOutcome,
  GitHubReleaseEvidence,
  GitHubReleaseOutcome,
  HttpCheckEvidence,
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
import { endTiming, nowIso, startTiming } from "../host/platform.js"
import {
  resolveWorkspacePath,
  writeWorkspaceFile
} from "../host/workspace-path.js"
import {
  type CheckFileAction,
  type CommandAction,
  type DeferredFileContent,
  ExecutionApproval,
  type GitHubReleaseCreateAction,
  type GitHubReleaseVerifyAction,
  type NoteAction,
  Operation,
  requireExecutionApproval,
  type RetryPolicy,
  type StageAction,
  type WriteFileAction
} from "../grammar/operation.js"
import { optionalField } from "../grammar/optional-field.js"
import type { Artifact } from "../grammar/artifact.js"
import type { PipeNotice, ReleaseIdentity } from "../grammar/state.js"
import {
  ArtifactStager,
  type StageOperation
} from "../pack/stager.js"
import {
  GitHubApi,
} from "../github/github.js"
import type { ApiError } from "../host/http.js"


export interface OperationRunContext {
  readonly root: string
  readonly identity: ReleaseIdentity
  readonly artifacts: ReadonlyArray<Artifact>
  readonly notices?: ReadonlyArray<PipeNotice> | undefined
  readonly configPath?: string | undefined
}

export type EvidenceRef = Ref.Ref<EvidenceBundle>

interface RecordFields extends Effect.Success<ReturnType<typeof endTiming>> {
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

export const bundleForContext = (context: OperationRunContext): EvidenceBundle =>
  EvidenceBundle.make({
    schemaVersion: "release-evidence/v2",
    releaseName: context.identity.name,
    releaseVersion: context.identity.version,
    notices: [...(context.notices ?? [])],
    records: []
  })

export const makeEvidenceRef = Effect.fn("engine.makeEvidenceRef")(function*(context: OperationRunContext) {
  return yield* Ref.make(bundleForContext(context))
})

const failAttempt = (failedRecord: EvidenceRecord): Effect.Effect<never, ActionAttemptFailed> =>
  Effect.fail(ActionAttemptFailed.make({ record: failedRecord }))

const digestHex = (bytes: Uint8Array, algorithm: "sha256" | "sha512"): string =>
  createHash(algorithm).update(bytes).digest("hex")

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
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const hashes = new Map<string, string>()
  for (const artifactId of deferredContentArtifactIds(contents)) {
    const artifact = context.artifacts.find((candidate) => candidate.id === artifactId)
    if (artifact === undefined) return yield* Effect.fail(WorkspaceWriteError.make({
      path: outputPath, reason: `Deferred file content references missing artifact ${artifactId}.`
    }))
    const data = yield* fs.readFile(resolveWorkspacePath(path, context.root, artifact.path)).pipe(
      Effect.mapError((error) => WorkspaceWriteError.make({ path: artifact.path, reason: error.message }))
    )
    hashes.set(artifactId, digestHex(data, checksumAlgorithm ?? "sha256"))
  }
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
  yield* writeWorkspaceFile(context.root, action.path, resolved.contents,
    (path, reason) => WorkspaceWriteError.make({ path, reason }))
  return yield* instantRecord(operation, {
    status: "passed",
    message: `Rendered ${action.path}`,
    outcome: FileOutcome.make({
      path: action.path,
      ...optionalField(resolved.resolvedValues, (resolvedValues) => ({ resolvedValues: [...resolvedValues] }))
    })
  })
})

const githubApiFailureEvidence = Effect.fn("engine.githubApiFailureEvidence")(function*(
  operation: Operation,
  action: GitHubReleaseCreateAction | GitHubReleaseVerifyAction,
  error: ApiError
) {
  const failedRecord = yield* instantRecord(operation, {
    status: "failed",
    message: error.reason,
    outcome: GitHubReleaseOutcome.make({
      release: GitHubReleaseEvidence.make({
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
  return yield* api.createRelease(action).pipe(
    Effect.matchEffect({
      onFailure: (error) => githubApiFailureEvidence(operation, action, error),
      onSuccess: (release) =>
        Effect.gen(function*() {
          return record(operation, {
            status: "passed",
            message: "GitHub release created through the GitHub API.",
            ...(yield* endTiming(timing)),
            outcome: GitHubReleaseOutcome.make({
              release: GitHubReleaseEvidence.make({
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
  return yield* api.inspectRelease(action).pipe(
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
            ...(yield* endTiming(timing)),
            outcome: GitHubReleaseOutcome.make({
              release: GitHubReleaseEvidence.make({
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
  const result = yield* (yield* ArtifactStager).stage(stageOperation, {
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

const failOperationEvidence = (
  record: EvidenceRecord,
  bundle: EvidenceBundle | undefined
): Effect.Effect<never, OperationFailedError> => {
  const outcome = record.outcome
  return Effect.fail(
    OperationFailedError.make({
      operationId: record.operationId,
      exitCode: outcome?._tag === "command" ? outcome.exitCode : undefined,
      responseStatus: outcome?._tag === "github-release" ? outcome.responseStatus : undefined,
      reason: record.message,
      evidence: bundle
    })
  )
}

const shouldRefuseForSnapshot = (operation: Operation, context: OperationRunContext): boolean =>
  context.identity.snapshot &&
  (operation.risk === "externally-visible" || operation.risk === "irreversible")

const retrySchedule = (policy: RetryPolicy | undefined) => {
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
  return yield* runOperationActionEvidence(operation, context).pipe(
    Effect.retry({ schedule: retrySchedule(operation.retry), while: (error) => error instanceof ActionAttemptFailed }),
    Effect.catchTag("ActionAttemptFailed", (error) => Effect.succeed(error.record))
  )
})

export const runOperationsInto = Effect.fn("engine.runOperationsInto")(function*(
  ref: EvidenceRef,
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  for (const operation of operations) {
    const evidence = yield* runOperationEvidence(operation, approval, context)
    yield* Ref.update(ref, (bundle) => EvidenceBundle.make({
      ...bundle,
      notices: [...bundle.notices],
      records: [...bundle.records, evidence]
    }))
    if (evidence.status === "failed") {
      return yield* failOperationEvidence(evidence, yield* Ref.get(ref))
    }
  }
})

export type OperationPass = "build" | "render" | "validation" | "publish" | "verification"
export type EvidenceWorkflow = Exclude<OperationPass, "build"> | "release"

const operationMatchesPass: Record<OperationPass, (operation: Operation) => boolean> = {
  build: (operation) => operation.phase === "build" || operation.phase === "process",
  render: (operation) => operation.phase === "catalog" && operation.action._tag === "write-file",
  validation: (operation) => operation.phase === "publish" && operation.risk === "read-only",
  publish: (operation) => operation.phase === "publish" && operation.risk !== "read-only",
  verification: (operation) => operation.phase === "verify"
}

export const operationsForPass = (
  operations: ReadonlyArray<Operation>,
  pass: OperationPass
): ReadonlyArray<Operation> =>
  operations.filter(operationMatchesPass[pass])

const operationsForWorkflow = (operations: ReadonlyArray<Operation>, workflow: EvidenceWorkflow) =>
  (workflow === "release" ? ["render", "validation", "publish", "verification"] as const : [workflow])
    .flatMap((pass) => operationsForPass(operations, pass))

export const preflightEvidenceWorkflow = Effect.fn("engine.preflightEvidenceWorkflow")(function*(
  operations: ReadonlyArray<Operation>,
  workflow: EvidenceWorkflow,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  yield* Effect.forEach(
    operationsForWorkflow(operations, workflow).filter((operation) => !shouldRefuseForSnapshot(operation, context)),
    (operation) => requireExecutionApproval(operation, approval),
    { discard: true }
  )
})

export const runOperations = Effect.fn("engine.runOperations")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  yield* Effect.forEach(
    operations.filter((operation) => !shouldRefuseForSnapshot(operation, context)),
    (operation) => requireExecutionApproval(operation, approval),
    { discard: true }
  )
  const ref = yield* makeEvidenceRef(context)
  yield* runOperationsInto(ref, operations, approval, context)
  return yield* Ref.get(ref)
})

export const runEvidenceWorkflowInto = Effect.fn("engine.runEvidenceWorkflowInto")(function*(
  ref: EvidenceRef,
  operations: ReadonlyArray<Operation>,
  workflow: EvidenceWorkflow,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  yield* runOperationsInto(ref, operationsForWorkflow(operations, workflow), approval, context)
})
