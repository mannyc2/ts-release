import { createHash } from "node:crypto"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import {
  appendEvidenceBundle,
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
  sortedStrings
} from "./evidence.js"
import {
  deferredContentDigestAlgorithm,
  deferredContentArtifactIds,
  renderDeferredContent
} from "./content.js"
import { OperationFailedError, WorkspaceWriteError } from "./errors.js"
import { ReleaseCommandRunner } from "../host/host.js"
import { ReleaseHttp } from "../host/http.js"
import { nowIso } from "../host/platform.js"
import {
  resolveWorkspacePath,
  resolveWorkspaceWritePathEffect
} from "../internal/workspace-path.js"
import {
  CommandAction,
  type DeferredFileContent,
  ExecutionApproval,
  GitHubReleaseCreateAction,
  GitHubReleaseVerifyAction,
  Operation,
  requireExecutionApproval
} from "../pipeline/operation.js"
import { optionalField } from "../pipeline/optional-field.js"
import type { ArtifactCatalog } from "../pipeline/catalog.js"
import type { PipeNotice, ReleaseIdentity } from "../pipeline/state.js"
import {
  ArtifactStager,
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
  readonly artifacts?: ArtifactCatalog | undefined
  readonly notices?: ReadonlyArray<PipeNotice> | undefined
  readonly configPath?: string | undefined
}

const bundleForContext = (context: OperationRunContext): EvidenceBundle =>
  emptyEvidenceBundle({
    releaseName: context.identity.name,
    releaseVersion: context.identity.version,
    notices: context.notices
  })

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
  outputPath: string
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const catalog = context.artifacts
  if (catalog === undefined) {
    return yield* Effect.fail(
      WorkspaceWriteError.make({
        path: outputPath,
        reason: "Deferred file content requires the release artifact catalog."
      })
    )
  }
  const algorithm = deferredContentDigestAlgorithm(content)
  const hashes = new Map<string, string>()
  for (const artifactId of deferredContentArtifactIds(content)) {
    const artifact = catalog.artifacts.find((candidate) => candidate.id === artifactId)
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
  const hashes = yield* resolveDeferredContentHashes(contents, context, outputPath)
  try {
    const resolved = renderDeferredContent(contents, hashes)
    return { contents: resolved.contents, resolvedValues: resolved.values }
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
  context: OperationRunContext
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  if (operation.action._tag !== "check-file") {
    throw new Error("fileCheckEvidence requires a check-file action")
  }
  const resolved = resolveWorkspacePath(path, context.root, operation.action.path)
  const exists = yield* fs.exists(resolved)
  if (!exists) {
    const timestamp = yield* nowIso()
    return EvidenceRecord.make({
      operationId: operation.id,
      pipeId: operation.pipeId,
      phase: operation.phase,
      risk: operation.risk,
      status: "failed",
      message: "File does not exist.",
      startedAt: timestamp,
      endedAt: timestamp,
      durationMillis: 0,
      outcome: FileOutcome.make({ path: operation.action.path })
    })
  }
  if (operation.action.checksum !== undefined) {
    const bytes = yield* fs.readFile(resolved)
    const actual = digestHex(bytes, operation.action.checksum.algorithm)
    if (actual !== operation.action.checksum.value) {
      const timestamp = yield* nowIso()
      return EvidenceRecord.make({
        operationId: operation.id,
        pipeId: operation.pipeId,
        phase: operation.phase,
        risk: operation.risk,
        status: "failed",
        message: "File checksum did not match.",
        startedAt: timestamp,
        endedAt: timestamp,
        durationMillis: 0,
        outcome: FileOutcome.make({ path: operation.action.path })
      })
    }
  }
  const timestamp = yield* nowIso()
  return EvidenceRecord.make({
    operationId: operation.id,
    pipeId: operation.pipeId,
    phase: operation.phase,
    risk: operation.risk,
    status: "passed",
    message: "File check passed.",
    startedAt: timestamp,
    endedAt: timestamp,
    durationMillis: 0,
    outcome: FileOutcome.make({ path: operation.action.path })
  })
})

const commandEvidence = Effect.fn("engine.commandEvidence")(function*(
  operation: Operation & { readonly action: CommandAction }
) {
  const commandRunner = yield* ReleaseCommandRunner
  const secrets = yield* readRedactionSecrets(operation)
  const result = yield* commandRunner.runCommand(operation.action.command)
  const status = result.exitCode === 0 ? "passed" : "failed"
  return EvidenceRecord.make({
    operationId: operation.id,
    pipeId: operation.pipeId,
    phase: operation.phase,
    risk: operation.risk,
    status,
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
})

const writeFileEvidence = Effect.fn("engine.writeFileEvidence")(function*(
  operation: Operation,
  context: OperationRunContext
) {
  if (operation.action._tag !== "write-file") {
    throw new Error("writeFileEvidence requires a write-file action")
  }
  const resolved = yield* resolveWriteFileContents(operation.action.contents, context, operation.action.path)
  yield* writeWorkspaceFile(context.root, operation.action.path, resolved.contents)
  const timestamp = yield* nowIso()
  return EvidenceRecord.make({
    operationId: operation.id,
    pipeId: operation.pipeId,
    phase: operation.phase,
    risk: operation.risk,
    status: "passed",
    message: `Rendered ${operation.action.path}`,
    startedAt: timestamp,
    endedAt: timestamp,
    durationMillis: 0,
    outcome: FileOutcome.make({
      path: operation.action.path,
      ...optionalField(resolved.resolvedValues, (resolvedValues) => ({ resolvedValues: [...resolvedValues] }))
    })
  })
})

const httpEvidence = Effect.fn("engine.httpEvidence")(function*(operation: Operation) {
  const http = yield* ReleaseHttp
  if (operation.action._tag !== "http-check") {
    throw new Error("httpEvidence requires an http-check action")
  }
  const action = operation.action

  return yield* http.runJson(action.request).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.gen(function*() {
          const startedAt = yield* nowIso()
          const endedAt = yield* nowIso()
          return EvidenceRecord.make({
            operationId: operation.id,
            pipeId: operation.pipeId,
            phase: operation.phase,
            risk: operation.risk,
            status: "failed",
            message: error.reason,
            startedAt,
            endedAt,
            durationMillis: 0,
            outcome: HttpOutcome.make({
              request: httpRequestEvidence(action.request),
              checks: []
            })
          })
        }),
      onSuccess: (result) => {
        const checks = [
          HttpCheckEvidence.make({
            description: `status is ${action.expectedStatus}`,
            passed: result.status === action.expectedStatus
          }),
          ...action.checks.map((check) => evaluateHttpCheck(result.json, check))
        ]
        const failed = checks.filter((check) => !check.passed)
        return Effect.succeed(
          EvidenceRecord.make({
            operationId: operation.id,
            pipeId: operation.pipeId,
            phase: operation.phase,
            risk: operation.risk,
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
        )
      }
    })
  )
})

const githubApiFailureEvidence = Effect.fn("engine.githubApiFailureEvidence")(function*(
  operation: Operation,
  action: GitHubReleaseCreateAction | GitHubReleaseVerifyAction,
  error: GitHubApiError
) {
  const timestamp = yield* nowIso()
  return EvidenceRecord.make({
    operationId: operation.id,
    pipeId: operation.pipeId,
    phase: operation.phase,
    risk: operation.risk,
    status: "failed",
    message: error.reason,
    startedAt: timestamp,
    endedAt: timestamp,
    durationMillis: 0,
    outcome: GitHubReleaseOutcome.make({
      release: githubReleaseEvidence({
        repository: action.repository,
        tag: action.tag,
        assets: action._tag === "github-release-create"
          ? action.assets.map((asset) => asset.name)
          : action.assetNames
      }),
      ...optionalField(error.status, (responseStatus) => ({ responseStatus }))
    })
  })
})

const githubCreateEvidence = Effect.fn("engine.githubCreateEvidence")(function*(operation: Operation) {
  const api = yield* GitHubApi
  if (operation.action._tag !== "github-release-create") {
    throw new Error("githubCreateEvidence requires a github-release-create action")
  }
  const startedAt = yield* nowIso()
  const started = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  const action = operation.action
  return yield* api.createRelease(githubCreateRequestFromAction(action)).pipe(
    Effect.matchEffect({
      onFailure: (error) => githubApiFailureEvidence(operation, action, error),
      onSuccess: (release) =>
        Effect.gen(function*() {
          const endedAt = yield* nowIso()
          const ended = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
          return EvidenceRecord.make({
            operationId: operation.id,
            pipeId: operation.pipeId,
            phase: operation.phase,
            risk: operation.risk,
            status: "passed",
            message: "GitHub release created through the GitHub API.",
            startedAt,
            endedAt,
            durationMillis: Math.max(0, ended - started),
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

const githubVerifyEvidence = Effect.fn("engine.githubVerifyEvidence")(function*(operation: Operation) {
  const api = yield* GitHubApi
  if (operation.action._tag !== "github-release-verify") {
    throw new Error("githubVerifyEvidence requires a github-release-verify action")
  }
  const startedAt = yield* nowIso()
  const started = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  const action = operation.action
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
          const endedAt = yield* nowIso()
          const ended = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
          return EvidenceRecord.make({
            operationId: operation.id,
            pipeId: operation.pipeId,
            phase: operation.phase,
            risk: operation.risk,
            status: failed.length === 0 ? "passed" : "failed",
            message: failed.length === 0
              ? "GitHub release verification passed."
              : `GitHub release verification failed: ${failed.map((check) => check.description).join("; ")}`,
            startedAt,
            endedAt,
            durationMillis: Math.max(0, ended - started),
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
        })
    })
  )
})

const noteEvidence = Effect.fn("engine.noteEvidence")(function*(operation: Operation) {
  if (operation.action._tag !== "note") {
    throw new Error("noteEvidence requires a note action")
  }
  const timestamp = yield* nowIso()
  const status = operation.action.skipped ? "skipped" : operation.action.severity === "warning" ? "warning" : "passed"
  return EvidenceRecord.make({
    operationId: operation.id,
    pipeId: operation.pipeId,
    phase: operation.phase,
    risk: operation.risk,
    status,
    message: operation.action.message,
    startedAt: timestamp,
    endedAt: timestamp,
    durationMillis: 0
  })
})

const isStageOperation = (operation: Operation): operation is StageOperation =>
  operation.action._tag === "stage"

const stageEvidence = Effect.fn("engine.stageEvidence")(function*(
  operation: Operation,
  context: OperationRunContext
) {
  if (!isStageOperation(operation)) {
    throw new Error("stageEvidence requires a stage action")
  }
  const result = yield* stageArtifactOperation(operation, {
    root: context.root,
    identity: context.identity,
    ...optionalField(context.configPath, (configPath) => ({ configPath }))
  })
  const timestamp = yield* nowIso()
  const firstArtifact = result.artifacts[0]
  return EvidenceRecord.make({
    operationId: operation.id,
    pipeId: operation.pipeId,
    phase: operation.phase,
    risk: operation.risk,
    status: "passed",
    message: "Artifact staging completed.",
    startedAt: timestamp,
    endedAt: timestamp,
    durationMillis: 0,
    outcome: FileOutcome.make({ path: firstArtifact?.path ?? "" })
  })
})

const runOperationActionEvidence = Effect.fn("engine.runOperationActionEvidence")(function*(
  operation: Operation,
  context: OperationRunContext
) {
  switch (operation.action._tag) {
    case "command":
      return yield* commandEvidence(operation as Operation & { readonly action: CommandAction })
    case "check-file":
      return yield* fileCheckEvidence(operation, context)
    case "write-file":
      return yield* writeFileEvidence(operation, context)
    case "http-check":
      return yield* httpEvidence(operation)
    case "github-release-create":
      return yield* githubCreateEvidence(operation)
    case "github-release-verify":
      return yield* githubVerifyEvidence(operation)
    case "note":
      return yield* noteEvidence(operation)
    case "stage":
      return yield* stageEvidence(operation, context)
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
  if (outcome?._tag === "http") {
    return optionalField(outcome.responseStatus, (responseStatus) => ({ responseStatus }))
  }
  if (outcome?._tag === "github-release") {
    return optionalField(outcome.responseStatus, (responseStatus) => ({ responseStatus }))
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
      ...optionalField(fields.exitCode, (exitCode) => ({ exitCode })),
      ...optionalField(fields.responseStatus, (responseStatus) => ({ responseStatus })),
      reason: record.message,
      ...optionalField(bundle, (evidence) => ({ evidence }))
    })
  )
}

const runOperationEvidenceAttempt = (
  operation: Operation,
  context: OperationRunContext
) =>
  runOperationActionEvidence(operation, context)

const runOperationEvidenceWithRetry = Effect.fn("engine.runOperationEvidenceWithRetry")(function*(
  operation: Operation,
  context: OperationRunContext
) {
  const attempts = Math.max(1, operation.retry?.attempts ?? 1)
  const delayMillis = Math.max(0, operation.retry?.delayMillis ?? 0)
  let attempt = 1
  let record = yield* runOperationEvidenceAttempt(operation, context)
  while (record.status === "failed" && attempt < attempts) {
    attempt += 1
    if (delayMillis > 0) {
      yield* Effect.sleep(Duration.millis(delayMillis))
    }
    record = yield* runOperationEvidenceAttempt(operation, context)
  }
  return record
})

const shouldRefuseForSnapshot = (operation: Operation, context: OperationRunContext): boolean =>
  context.identity.snapshot &&
  (operation.risk === "externally-visible" || operation.risk === "irreversible")

const snapshotRefusalEvidence = Effect.fn("engine.snapshotRefusalEvidence")(function*(operation: Operation) {
  const timestamp = yield* nowIso()
  return EvidenceRecord.make({
    operationId: operation.id,
    pipeId: operation.pipeId,
    phase: operation.phase,
    risk: operation.risk,
    status: "refused",
    message: "Refused by snapshot policy.",
    startedAt: timestamp,
    endedAt: timestamp,
    durationMillis: 0
  })
})

export const runOperationEvidence = Effect.fn("engine.runOperationEvidence")(function*(
  operation: Operation,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  if (shouldRefuseForSnapshot(operation, context)) {
    return yield* snapshotRefusalEvidence(operation)
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
    return yield* failOperationEvidence(evidence, undefined)
  }
  return evidence
})

export const runOperations = Effect.fn("engine.runOperations")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  let bundle = bundleForContext(context)
  for (const operation of operations) {
    const evidence = yield* runOperationEvidence(operation, approval, context)
    bundle = appendEvidenceRecord(bundle, evidence)
    if (evidence.status === "failed") {
      return yield* failOperationEvidence(evidence, bundle)
    }
  }
  return bundle
})

export const executeOperationBatch = runOperations

export const renderOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> =>
  operations.filter((operation) => operation.phase === "catalog" && operation.action._tag === "write-file")

export const validationOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> =>
  operations.filter((operation) => operation.phase === "publish" && operation.risk === "read-only")

export const publishOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> =>
  operations.filter((operation) => operation.phase === "publish" && operation.risk !== "read-only")

export const verificationOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> =>
  operations.filter((operation) => operation.phase === "verify")

export const buildOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<Operation> =>
  operations.filter((operation) => operation.phase === "build" || operation.phase === "process")

export const validateOperations = Effect.fn("engine.validateOperations")(function*(
  operations: ReadonlyArray<Operation>,
  context: OperationRunContext
) {
  return yield* runOperations(validationOperations(operations), ExecutionApproval.none, context)
})

export const executeOperations = Effect.fn("engine.executeOperations")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  return yield* runOperations(publishOperations(operations), approval, context)
})

export const writeRenderFiles = Effect.fn("engine.writeRenderFiles")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  return yield* runOperations(renderOperations(operations), approval, context)
})

export const verifyOperations = Effect.fn("engine.verifyOperations")(function*(
  operations: ReadonlyArray<Operation>,
  context: OperationRunContext
) {
  return yield* runOperations(verificationOperations(operations), ExecutionApproval.none, context)
})

const appendFailureEvidence = (
  accumulated: EvidenceBundle,
  error: OperationFailedError
): OperationFailedError => {
  const evidence = error.evidence === undefined
    ? accumulated
    : appendEvidenceBundle(accumulated, error.evidence)
  return OperationFailedError.make({
    operationId: error.operationId,
    ...optionalField(error.exitCode, (exitCode) => ({ exitCode })),
    ...optionalField(error.responseStatus, (responseStatus) => ({ responseStatus })),
    reason: error.reason,
    evidence
  })
}

export const runApprovedReleaseWorkflow = Effect.fn("engine.runApprovedReleaseWorkflow")(function*(
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval,
  context: OperationRunContext
) {
  let evidence = bundleForContext(context)
  const passContext = {
    ...context,
    notices: []
  }
  const renderApproval = ExecutionApproval.make({
    execute: approval.execute,
    approveIrreversible: false
  })
  const render = yield* writeRenderFiles(operations, renderApproval, passContext).pipe(
    Effect.catchTag("OperationFailedError", (error) =>
      Effect.fail(appendFailureEvidence(evidence, error)))
  )
  evidence = appendEvidenceBundle(evidence, render)
  const validation = yield* validateOperations(operations, passContext).pipe(
    Effect.catchTag("OperationFailedError", (error) =>
      Effect.fail(appendFailureEvidence(evidence, error)))
  )
  evidence = appendEvidenceBundle(evidence, validation)
  const execution = yield* executeOperations(operations, approval, passContext).pipe(
    Effect.catchTag("OperationFailedError", (error) =>
      Effect.fail(appendFailureEvidence(evidence, error)))
  )
  evidence = appendEvidenceBundle(evidence, execution)
  const verification = yield* verifyOperations(operations, passContext).pipe(
    Effect.catchTag("OperationFailedError", (error) =>
      Effect.fail(appendFailureEvidence(evidence, error)))
  )
  evidence = appendEvidenceBundle(evidence, verification)

  return evidence
})
