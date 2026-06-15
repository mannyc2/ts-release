import * as Effect from "effect/Effect"
import { CommandEvidence, EvidenceBundle, EvidenceRecord } from "../domain/evidence.js"
import {
  ExecutionApproval,
  Operation,
  requireExecutionApproval
} from "../domain/operation.js"
import { ReleasePlan } from "../domain/release.js"
import { ReleaseHost } from "../host/host.js"
import {
  appendEvidenceRecord,
  commandEvidenceFromResult,
  emptyEvidenceBundle,
  executionEvidence,
  validationNoteEvidence
} from "./evidence-recorder.js"
import { OperationFailedError } from "./errors.js"

export type * from "../types/effect-internal.js"

const commandFailed = (evidence: EvidenceRecord): evidence is CommandEvidence =>
  "exitCode" in evidence && evidence.status === "failed"

const failCommandEvidence = (
  evidence: CommandEvidence,
  bundle: EvidenceBundle | undefined
): Effect.Effect<never, OperationFailedError> =>
  Effect.fail(
    OperationFailedError.make({
      operationId: evidence.operationId,
      exitCode: evidence.exitCode,
      reason: "Command exited with a nonzero status.",
      ...(bundle === undefined ? {} : { evidence: bundle })
    })
  )

export const runOperationEvidence = Effect.fn("runOperationEvidence")(function*(
  operation: Operation,
  approval: ExecutionApproval
) {
  yield* requireExecutionApproval(operation, approval)

  if (operation._tag === "RenderFileOperation") {
    const host = yield* ReleaseHost
    yield* host.writeFileString(operation.path, operation.contents)
    return yield* executionEvidence(operation, `Rendered ${operation.path}`)
  }

  if (operation._tag === "ValidationNoteOperation") {
    return yield* validationNoteEvidence(operation)
  }

  return yield* commandEvidenceFromResult(operation)
})

export const runOperation = Effect.fn("runOperation")(function*(
  operation: Operation,
  approval: ExecutionApproval
) {
  const evidence = yield* runOperationEvidence(operation, approval)
  if (commandFailed(evidence)) {
    return yield* failCommandEvidence(evidence, undefined)
  }
  return evidence
})

export const runOperations = Effect.fn("runOperations")(function*(
  plan: ReleasePlan,
  operations: ReadonlyArray<Operation>,
  approval: ExecutionApproval
) {
  let bundle: EvidenceBundle = emptyEvidenceBundle(plan)
  for (const operation of operations) {
    const evidence = yield* runOperationEvidence(operation, approval)
    bundle = appendEvidenceRecord(bundle, evidence)
    if (commandFailed(evidence)) {
      return yield* failCommandEvidence(evidence, bundle)
    }
  }
  return bundle
})

export const validationOperations = (plan: ReleasePlan): ReadonlyArray<Operation> =>
  plan.operations.filter((operation) =>
    operation._tag === "ValidateCommandOperation" || operation._tag === "ValidationNoteOperation"
  )

export const publishOperations = (plan: ReleasePlan): ReadonlyArray<Operation> =>
  plan.operations.filter((operation) => operation._tag === "PublishCommandOperation")

export const renderOperations = (plan: ReleasePlan): ReadonlyArray<Operation> =>
  plan.operations.filter((operation) => operation._tag === "RenderFileOperation")

export const verificationOperations = (plan: ReleasePlan): ReadonlyArray<Operation> =>
  plan.operations.filter((operation) => operation._tag === "VerifyRemoteOperation")

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
