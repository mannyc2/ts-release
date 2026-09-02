import { Effect, Result } from "effect"
import { ArtifactId } from "./schema/primitives.js"
import { codePointCompare } from "./schema/trial-evidence.js"
import {
  AcceptedGateEvaluation,
  RejectedGateEvaluation,
  type GateEvaluationInput,
  type GateEvaluator
} from "./trial-adapter-executor.js"
import {
  TrialGateContractError,
  inspectGateCandidate,
  loadMachineSourceBudgetAuthority,
  trialGateInspectionFacts
} from "./trial-gate-contract.js"
import type { ArchitectureTrialSpecV2 } from "./schema/trial-spec.js"

export const LIVE_GATE_EVALUATOR_ID = ArtifactId.make(
  "gate-evaluator.runner-inspection-v2"
)

export interface LiveGateEvaluatorAuthority {
  readonly repositoryRoot: string
  readonly trialSpec: ArchitectureTrialSpecV2
}

const canonicalFailureIds = (
  values: ReadonlyArray<string>
): [typeof ArtifactId.Type, ...Array<typeof ArtifactId.Type>] => {
  const ids = [...new Set(values)].sort(codePointCompare).map((value) => ArtifactId.make(value))
  return (ids.length === 0 ? [ArtifactId.make("gate.runner-evaluation-failed")] : ids) as [
    typeof ArtifactId.Type,
    ...Array<typeof ArtifactId.Type>
  ]
}

const exactOrdered = (
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>
): boolean => left.length === right.length && left.every((value, index) => value === right[index])

const inputShapeIssues = (
  input: GateEvaluationInput
): ReadonlyArray<string> => {
  if (typeof input !== "object" || input === null ||
    typeof input.gate !== "object" || input.gate === null ||
    typeof input.observation !== "object" || input.observation === null ||
    typeof input.inspectionRoot !== "string" || !Array.isArray(input.caseReceipts) ||
    !Array.isArray(input.probeReceipts) || typeof input.commandAttempt !== "object" ||
    input.commandAttempt === null) {
    return ["gate.runner-evaluator-invalid-input"]
  }
  return []
}

const prerequisiteIssues = (
  input: GateEvaluationInput
): ReadonlyArray<string> => {
  const caseIds = input.caseReceipts.map(({ caseId }) => caseId)
  const probeIds = input.probeReceipts.map(({ probeId }) => probeId)
  return [
    ...(exactOrdered(caseIds, input.gate.caseIds)
      ? []
      : ["gate.runner-case-prerequisite-mismatch"]),
    ...(exactOrdered(probeIds, input.gate.probeIds)
      ? []
      : ["gate.runner-probe-prerequisite-mismatch"]),
    ...(input.caseReceipts.every(({ execution }) => execution._tag === "Passed")
      ? []
      : ["gate.runner-case-prerequisite-failed"]),
    ...(input.probeReceipts.every(({ execution }) => execution._tag === "Passed")
      ? []
      : ["gate.runner-probe-prerequisite-failed"])
  ]
}

/**
 * Re-decodes and inventories the runner-owned inspection snapshot. Candidate
 * gate stdout remains raw evidence: only this evaluator can issue an Accepted
 * disposition, and only after the exact prerequisite receipts and command
 * attempt have passed.
 */
export const makeLiveGateEvaluator = (
  authority: LiveGateEvaluatorAuthority
): GateEvaluator => ({
  evaluatorId: LIVE_GATE_EVALUATOR_ID,
  evaluate: Effect.fn("LiveGateEvaluator.evaluate")(function* (input) {
    const shapeIssues = inputShapeIssues(input)
    if (shapeIssues.length > 0) {
      return new RejectedGateEvaluation({ failureIds: canonicalFailureIds(shapeIssues) })
    }

    const failures = [
      ...prerequisiteIssues(input),
      ...(input.observation.gateId === input.gate.id
        ? []
        : ["gate.runner-observation-gate-mismatch"]),
      ...(input.commandAttempt._tag === "Exited" &&
        input.commandAttempt.exitCode === input.gate.expectedExit
        ? []
        : ["gate.runner-command-not-passed"])
    ]
    const sourceBudgetAuthority = input.gate.id === "GM05-machine-source-budget"
      ? yield* Effect.result(loadMachineSourceBudgetAuthority(
          authority.repositoryRoot,
          authority.trialSpec
        ))
      : null
    if (sourceBudgetAuthority !== null && Result.isFailure(sourceBudgetAuthority)) {
      failures.push(...(sourceBudgetAuthority.failure instanceof TrialGateContractError
        ? sourceBudgetAuthority.failure.failureIds
        : [ArtifactId.make("gate.runner-source-budget-denominator-unavailable")]))
    }
    const inspection = yield* Effect.result(inspectGateCandidate({
      gate: input.gate,
      candidateId: input.observation.candidateId,
      candidateTreeSha256: input.observation.candidateTreeSha256,
      inspectionRoot: input.inspectionRoot,
      sourceBudgetAuthority: sourceBudgetAuthority !== null && Result.isSuccess(sourceBudgetAuthority)
        ? sourceBudgetAuthority.success
        : null
    }))
    if (Result.isFailure(inspection)) {
      failures.push(...(inspection.failure instanceof TrialGateContractError
        ? inspection.failure.failureIds
        : [ArtifactId.make("gate.runner-inspection-failed")]))
    }

    return failures.length === 0 && Result.isSuccess(inspection)
      ? new AcceptedGateEvaluation({ facts: trialGateInspectionFacts(inspection.success) })
      : new RejectedGateEvaluation({ failureIds: canonicalFailureIds(failures) })
  })
})
