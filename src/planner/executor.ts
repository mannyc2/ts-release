import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import {
  CommandEvidence,
  EvidenceBundle,
  EvidenceRecord,
  HttpEvidence,
  ReleaseWorkflowFailureEvidence,
  ReleaseWorkflowEvidence
} from "../domain/evidence.js"
import {
  ExecutionApproval,
  Operation,
  ExecutionApprovalError,
  requireExecutionApproval
} from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"
import { CommandRunnerError, ReleaseCommandRunner } from "../host/host.js"
import { ReleaseHttp } from "../host/http.js"
import {
  appendEvidenceRecord,
  commandEvidenceFromResult,
  emptyEvidenceBundle,
  executionEvidence,
  httpEvidenceFromResult,
  validationNoteEvidence
} from "./evidence-recorder.js"
import { OperationFailedError, WorkspaceWriteError } from "./errors.js"

export type * from "../types/effect-internal.js"

type OperationFailureEvidence = CommandEvidence | HttpEvidence
type CommandOperation = Extract<Operation, { readonly command: unknown }>
type RenderOperation = Extract<Operation, { readonly _tag: "RenderFileOperation" }>
type ValidationOperation = Extract<Operation, { readonly _tag: "ValidateCommandOperation" | "ValidationNoteOperation" }>
type PublishOperation = Extract<Operation, { readonly _tag: "PublishCommandOperation" }>
type VerificationOperation = Extract<Operation, { readonly _tag: "VerifyRemoteOperation" | "VerifyHttpOperation" }>

const operationFailed = (evidence: EvidenceRecord): evidence is OperationFailureEvidence =>
  evidence.status === "failed" && ("exitCode" in evidence || "request" in evidence)

const workspacePath = (path: Path.Path, root: string, pathName: string): string =>
  path.isAbsolute(pathName) ? pathName : path.resolve(root, pathName)

const writeWorkspaceFile = Effect.fn("writeWorkspaceFile")(function*(
  root: string,
  pathName: string,
  contents: string
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const targetPath = workspacePath(path, root, pathName)
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

const failOperationEvidence = (
  evidence: OperationFailureEvidence,
  bundle: EvidenceBundle | undefined
): Effect.Effect<never, OperationFailedError> =>
  Effect.fail(
    OperationFailedError.make({
      operationId: evidence.operationId,
      ...("exitCode" in evidence ? { exitCode: evidence.exitCode } : {}),
      ...("responseStatus" in evidence && evidence.responseStatus !== undefined
        ? { responseStatus: evidence.responseStatus }
        : {}),
      reason: "exitCode" in evidence
        ? "Command exited with a nonzero status."
        : "HTTP verification failed.",
      ...(bundle === undefined ? {} : { evidence: bundle })
    })
  )

const failWorkflowOperation = (
  error: OperationFailedError,
  workflowEvidence: ReleaseWorkflowFailureEvidence
): Effect.Effect<never, OperationFailedError> =>
  Effect.fail(
    OperationFailedError.make({
      operationId: error.operationId,
      ...(error.exitCode === undefined ? {} : { exitCode: error.exitCode }),
      ...(error.responseStatus === undefined ? {} : { responseStatus: error.responseStatus }),
      reason: error.reason,
      ...(error.evidence === undefined ? {} : { evidence: error.evidence }),
      workflowEvidence
    })
  )

export function runOperationEvidence(
  operation: Extract<Operation, { readonly _tag: "VerifyHttpOperation" }>,
  approval: ExecutionApproval,
  root?: string
): Effect.Effect<EvidenceRecord, ExecutionApprovalError, ReleaseHttp>
export function runOperationEvidence(
  operation: RenderOperation,
  approval: ExecutionApproval,
  root?: string
): Effect.Effect<EvidenceRecord, ExecutionApprovalError | WorkspaceWriteError, FileSystem.FileSystem | Path.Path>
export function runOperationEvidence(
  operation: CommandOperation,
  approval: ExecutionApproval,
  root?: string
): Effect.Effect<EvidenceRecord, ExecutionApprovalError | CommandRunnerError, ReleaseCommandRunner>
export function runOperationEvidence(
  operation: Extract<Operation, { readonly _tag: "ValidationNoteOperation" }>,
  approval: ExecutionApproval,
  root?: string
): Effect.Effect<EvidenceRecord, ExecutionApprovalError>
export function runOperationEvidence(
  operation: Operation,
  approval: ExecutionApproval,
  root?: string
): Effect.Effect<
  EvidenceRecord,
  ExecutionApprovalError | CommandRunnerError | WorkspaceWriteError,
  ReleaseCommandRunner | ReleaseHttp | FileSystem.FileSystem | Path.Path
>
export function runOperationEvidence(
  operation: Operation,
  approval: ExecutionApproval,
  root: string = "."
) {
  return Effect.gen(function*() {
    yield* requireExecutionApproval(operation, approval)

    if (operation._tag === "RenderFileOperation") {
      yield* writeWorkspaceFile(root, operation.path, operation.contents)
      return yield* executionEvidence(operation, `Rendered ${operation.path}`)
    }

    if (operation._tag === "ValidationNoteOperation") {
      return yield* validationNoteEvidence(operation)
    }

    if (operation._tag === "VerifyHttpOperation") {
      return yield* httpEvidenceFromResult(operation)
    }

    return yield* commandEvidenceFromResult(operation)
  })
}

export function runOperation(
  operation: Extract<Operation, { readonly _tag: "VerifyHttpOperation" }>,
  approval: ExecutionApproval
): Effect.Effect<EvidenceRecord, ExecutionApprovalError | OperationFailedError, ReleaseHttp>
export function runOperation(
  operation: RenderOperation,
  approval: ExecutionApproval
): Effect.Effect<
  EvidenceRecord,
  ExecutionApprovalError | WorkspaceWriteError | OperationFailedError,
  FileSystem.FileSystem | Path.Path
>
export function runOperation(
  operation: CommandOperation,
  approval: ExecutionApproval
): Effect.Effect<
  EvidenceRecord,
  ExecutionApprovalError | CommandRunnerError | OperationFailedError,
  ReleaseCommandRunner
>
export function runOperation(
  operation: Extract<Operation, { readonly _tag: "ValidationNoteOperation" }>,
  approval: ExecutionApproval
): Effect.Effect<EvidenceRecord, ExecutionApprovalError | OperationFailedError>
export function runOperation(
  operation: Operation,
  approval: ExecutionApproval
): Effect.Effect<
  EvidenceRecord,
  ExecutionApprovalError | CommandRunnerError | WorkspaceWriteError | OperationFailedError,
  ReleaseCommandRunner | ReleaseHttp | FileSystem.FileSystem | Path.Path
>
export function runOperation(
  operation: Operation,
  approval: ExecutionApproval
): Effect.Effect<
  EvidenceRecord,
  ExecutionApprovalError | CommandRunnerError | WorkspaceWriteError | OperationFailedError,
  unknown
> {
  if (operation._tag === "VerifyHttpOperation") {
    return Effect.gen(function*() {
      const evidence = yield* runOperationEvidence(operation, approval)
      if (operationFailed(evidence)) {
        return yield* failOperationEvidence(evidence, undefined)
      }
      return evidence
    })
  }

  return Effect.gen(function*() {
    const evidence = yield* runOperationEvidence(operation, approval)
    if (operationFailed(evidence)) {
      return yield* failOperationEvidence(evidence, undefined)
    }
    return evidence
  })
}

export function runOperations(
  plan: ReleasePlan,
  operations: ReadonlyArray<VerificationOperation>,
  approval: ExecutionApproval
): Effect.Effect<
  EvidenceBundle,
  ExecutionApprovalError | CommandRunnerError | OperationFailedError,
  ReleaseCommandRunner | ReleaseHttp
>
export function runOperations(
  plan: ReleasePlan,
  operations: ReadonlyArray<RenderOperation>,
  approval: ExecutionApproval
): Effect.Effect<
  EvidenceBundle,
  ExecutionApprovalError | WorkspaceWriteError | OperationFailedError,
  FileSystem.FileSystem | Path.Path
>
export function runOperations(
  plan: ReleasePlan,
  operations: ReadonlyArray<ValidationOperation>,
  approval: ExecutionApproval
): Effect.Effect<EvidenceBundle, ExecutionApprovalError | CommandRunnerError | OperationFailedError, ReleaseCommandRunner>
export function runOperations(
  plan: ReleasePlan,
  operations: ReadonlyArray<PublishOperation>,
  approval: ExecutionApproval
): Effect.Effect<EvidenceBundle, ExecutionApprovalError | CommandRunnerError | OperationFailedError, ReleaseCommandRunner>
export function runOperations(
  plan: ReleasePlan,
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval
): Effect.Effect<
  EvidenceBundle,
  ExecutionApprovalError | CommandRunnerError | WorkspaceWriteError | OperationFailedError,
  ReleaseCommandRunner | ReleaseHttp | FileSystem.FileSystem | Path.Path
>
export function runOperations(
  plan: ReleasePlan,
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval
) {
  return Effect.gen(function*() {
    let bundle: EvidenceBundle = emptyEvidenceBundle(plan)
    for (const operation of operations) {
      const evidence = yield* runOperationEvidence(operation, approval, plan.source.root)
      bundle = appendEvidenceRecord(bundle, evidence)
      if (operationFailed(evidence)) {
        return yield* failOperationEvidence(evidence, bundle)
      }
    }
    return bundle
  })
}

const isValidationOperation = (operation: Operation): operation is ValidationOperation =>
  operation._tag === "ValidateCommandOperation" || operation._tag === "ValidationNoteOperation"

const isPublishOperation = (operation: Operation): operation is PublishOperation =>
  operation._tag === "PublishCommandOperation"

const isRenderOperation = (operation: Operation): operation is RenderOperation =>
  operation._tag === "RenderFileOperation"

const isVerificationOperation = (operation: Operation): operation is VerificationOperation =>
  operation._tag === "VerifyRemoteOperation" || operation._tag === "VerifyHttpOperation"

export const validationOperations = (plan: ReleasePlan): ReadonlyArray<ValidationOperation> =>
  plan.operations.filter(isValidationOperation)

export const publishOperations = (plan: ReleasePlan): ReadonlyArray<PublishOperation> =>
  plan.operations.filter(isPublishOperation)

export const renderOperations = (plan: ReleasePlan): ReadonlyArray<RenderOperation> =>
  plan.operations.filter(isRenderOperation)

export const verificationOperations = (plan: ReleasePlan): ReadonlyArray<VerificationOperation> =>
  plan.operations.filter(isVerificationOperation)

export const validatePlan = Effect.fn("validatePlan")(function*(plan: ReleasePlan) {
  return yield* runOperations(plan, validationOperations(plan), ExecutionApproval.none)
})

export const executePlan = Effect.fn("executePlan")(function*(plan: ReleasePlan, approval: ExecutionApproval) {
  return yield* runOperations(plan, publishOperations(plan), approval)
})

export const renderPlan = Effect.fn("renderPlan")(function*(plan: ReleasePlan, approval: ExecutionApproval) {
  return yield* runOperations(plan, renderOperations(plan), approval)
})

export const verifyPlan = Effect.fn("verifyPlan")(function*(plan: ReleasePlan) {
  return yield* runOperations(plan, verificationOperations(plan), ExecutionApproval.none)
})

export const runApprovedReleaseWorkflow = Effect.fn("runApprovedReleaseWorkflow")(function*(
  plan: ReleasePlan,
  approval: ExecutionApproval
) {
  const renderApproval = ExecutionApproval.make({
    execute: approval.execute,
    approveIrreversible: false
  })
  const render = yield* renderPlan(plan, renderApproval).pipe(
    Effect.catchTag("OperationFailedError", (error) =>
      failWorkflowOperation(
        error,
        ReleaseWorkflowFailureEvidence.make({
          ...(error.evidence === undefined ? {} : { render: error.evidence })
        })
      ))
  )
  const validation = yield* validatePlan(plan).pipe(
    Effect.catchTag("OperationFailedError", (error) =>
      failWorkflowOperation(
        error,
        ReleaseWorkflowFailureEvidence.make({
          render,
          ...(error.evidence === undefined ? {} : { validation: error.evidence })
        })
      ))
  )
  const execution = yield* executePlan(plan, approval).pipe(
    Effect.catchTag("OperationFailedError", (error) =>
      failWorkflowOperation(
        error,
        ReleaseWorkflowFailureEvidence.make({
          render,
          validation,
          ...(error.evidence === undefined ? {} : { execution: error.evidence })
        })
      ))
  )
  const verification = yield* verifyPlan(plan).pipe(
    Effect.catchTag("OperationFailedError", (error) =>
      failWorkflowOperation(
        error,
        ReleaseWorkflowFailureEvidence.make({
          render,
          validation,
          execution,
          ...(error.evidence === undefined ? {} : { verification: error.evidence })
        })
      ))
  )

  return ReleaseWorkflowEvidence.make({
    render,
    validation,
    execution,
    verification
  })
})
