import { Effect, Schema } from "effect"
import { MetricId, Sha256Hex } from "./primitives.js"
import type { ArchitectureTrialResultV2 } from "./trial-result.js"
import type { ArchitectureTrialSpecV2 } from "./trial-spec.js"
import { V2CandidateId, V2CandidateScope } from "./v2-ids.js"

const Natural = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

export class TrialObjectiveValue extends Schema.Class<TrialObjectiveValue>(
  "TrialObjectiveValue"
)({
  metricId: MetricId,
  value: Natural
}) {}

export class TrialCandidateObjectiveVector extends Schema.Class<TrialCandidateObjectiveVector>(
  "TrialCandidateObjectiveVector"
)({
  candidateId: V2CandidateId,
  receiptId: Sha256Hex,
  values: Schema.NonEmptyArray(TrialObjectiveValue)
}) {}

const SharedSelectionFields = {
  scope: V2CandidateScope,
  candidateIds: Schema.NonEmptyArray(V2CandidateId),
  objectiveMetricIds: Schema.NonEmptyArray(MetricId),
  objectiveVectors: Schema.Array(TrialCandidateObjectiveVector)
} as const

export class NoQualifyingCandidate extends Schema.TaggedClass<NoQualifyingCandidate>()(
  "NoQualifyingCandidate",
  {
    ...SharedSelectionFields,
    rejectedCandidateIds: Schema.NonEmptyArray(V2CandidateId)
  }
) {}

export class UniqueSelection extends Schema.TaggedClass<UniqueSelection>()(
  "UniqueSelection",
  {
    ...SharedSelectionFields,
    selectedCandidateId: V2CandidateId,
    selectedReceiptId: Sha256Hex,
    qualifyingCandidateIds: Schema.NonEmptyArray(V2CandidateId),
    dominatedCandidateIds: Schema.Array(V2CandidateId),
    rejectedCandidateIds: Schema.Array(V2CandidateId)
  }
) {}

export class MaintainerDecisionRequired extends Schema.TaggedClass<
  MaintainerDecisionRequired
>()("MaintainerDecisionRequired", {
  ...SharedSelectionFields,
  qualifyingCandidateIds: Schema.NonEmptyArray(V2CandidateId),
  nonDominatedCandidateIds: Schema.NonEmptyArray(V2CandidateId),
  rejectedCandidateIds: Schema.Array(V2CandidateId)
}) {}

export const TrialSelectionOutcome = Schema.Union([
  NoQualifyingCandidate,
  UniqueSelection,
  MaintainerDecisionRequired
])
export type TrialSelectionOutcome = typeof TrialSelectionOutcome.Type

export class TrialSelectionInvariantError extends Schema.TaggedError<
  TrialSelectionInvariantError
>()("TrialSelectionInvariantError", {
  issues: Schema.NonEmptyArray(Schema.String),
  message: Schema.String
}) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture trial selection invariant failure: ${issues.join("; ")}`
    })
  }
}

const scopePolicy = (
  spec: ArchitectureTrialSpecV2,
  scope: "machine" | "topology"
) => scope === "machine" ? spec.machineSelectionPolicy : spec.topologySelectionPolicy

const resultCandidateId = (result: ArchitectureTrialResultV2) =>
  result.runContext.candidateId

const exactOrdered = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const measuredVector = (
  result: ArchitectureTrialResultV2,
  objectiveMetricIds: ReadonlyArray<string>
): TrialCandidateObjectiveVector | undefined => {
  if (result.qualification !== "Passed" ||
    result.gateReceipts.some(({ execution }) => execution._tag !== "Passed") ||
    result.objectiveMetrics.some(
    ({ _tag }) => _tag !== "Measured"
  )) return undefined
  const values: Array<TrialObjectiveValue> = []
  for (const metricId of objectiveMetricIds) {
    const metric = result.objectiveMetrics.find(({ id }) => id === metricId)
    if (metric?._tag !== "Measured") return undefined
    values.push(new TrialObjectiveValue({ metricId: MetricId.make(metricId), value: metric.value }))
  }
  if (values.length === 0) return undefined
  return new TrialCandidateObjectiveVector({
    candidateId: resultCandidateId(result),
    receiptId: result.receiptId,
    values: values as [TrialObjectiveValue, ...Array<TrialObjectiveValue>]
  })
}

const dominates = (
  left: TrialCandidateObjectiveVector,
  right: TrialCandidateObjectiveVector
): boolean => {
  if (left.values.length !== right.values.length) return false
  let strictlyBetter = false
  for (let index = 0; index < left.values.length; index += 1) {
    const leftValue = left.values[index]
    const rightValue = right.values[index]
    if (leftValue === undefined || rightValue === undefined ||
      leftValue.metricId !== rightValue.metricId || leftValue.value > rightValue.value) {
      return false
    }
    if (leftValue.value < rightValue.value) strictlyBetter = true
  }
  return strictlyBetter
}

const topologyBudgetIssues = (
  spec: ArchitectureTrialSpecV2,
  vector: TrialCandidateObjectiveVector
): ReadonlyArray<string> => {
  const budget = spec.topologySelectionPolicy.marginalBudget
  const median = vector.values.find(
    ({ metricId }) => metricId === "probe-median-gross-product-additions"
  )?.value
  const p90 = vector.values.find(
    ({ metricId }) => metricId === "probe-p90-gross-product-additions"
  )?.value
  return [
    ...(median !== undefined && median <= budget.medianGrossProductAdditionLinesAtMost
      ? []
      : [`${vector.candidateId} exceeds or omits the topology median marginal budget`]),
    ...(p90 !== undefined && p90 <= budget.p90GrossProductAdditionLinesAtMost &&
      p90 <= budget.maximumGrossProductAdditionLinesAtMost
      ? []
      : [`${vector.candidateId} exceeds or omits the topology p90/maximum marginal budget`])
  ]
}

/**
 * Applies only the frozen two-phase rule: reject hard-gate/metric failures,
 * then componentwise strict Pareto minimization. There is intentionally no
 * score, weight, ordering tie-break, or implicit default.
 */
export const selectTrialCandidates = Effect.fn("TrialSelection.selectTrialCandidates")(
  function* (input: {
    readonly scope: "machine" | "topology"
    readonly spec: ArchitectureTrialSpecV2
    readonly results: ReadonlyArray<ArchitectureTrialResultV2>
  }) {
    const policy = scopePolicy(input.spec, input.scope)
    const expectedCandidateIds = [...policy.candidateIds]
    const expectedMetricIds = [...policy.objectiveMetricIds]
    const issues: Array<string> = []
    const actualCandidateIds = input.results.map(resultCandidateId)
    if (!exactOrdered(actualCandidateIds, expectedCandidateIds)) {
      issues.push(
        `results must equal exact ordered ${input.scope} candidates [${expectedCandidateIds.join(", ")}]`
      )
    }
    input.results.forEach((result) => {
      if (result.runContext.candidateScope !== input.scope ||
        (input.scope === "machine") !== (result.schemaVersion === "machine-trial-result-v2")) {
        issues.push(`${resultCandidateId(result)} is not a ${input.scope} result`)
      }
      if (!exactOrdered(result.gateReceipts.map(({ gateId }) => gateId), policy.hardGateIds)) {
        issues.push(`${resultCandidateId(result)} does not bind the exact hard-gate set`)
      }
      if (!exactOrdered(result.objectiveMetrics.map(({ id }) => id), expectedMetricIds)) {
        issues.push(`${resultCandidateId(result)} does not bind the exact objective vector`)
      }
    })
    if (issues.length > 0) {
      return yield* new TrialSelectionInvariantError(issues as [string, ...Array<string>])
    }

    const vectors = input.results.flatMap((result) => {
      const vector = measuredVector(result, expectedMetricIds)
      if (vector === undefined) return []
      if (input.scope === "topology" && topologyBudgetIssues(input.spec, vector).length > 0) {
        return []
      }
      return [vector]
    })
    const qualifyingIds = vectors.map(({ candidateId }) => candidateId)
    const rejectedIds = expectedCandidateIds.filter((id) => !qualifyingIds.includes(id))
    const shared = {
      scope: input.scope,
      candidateIds: expectedCandidateIds,
      objectiveMetricIds: expectedMetricIds.map((id) => MetricId.make(id)),
      objectiveVectors: vectors
    }

    if (vectors.length === 0) {
      return new NoQualifyingCandidate({
        ...shared,
        candidateIds: shared.candidateIds as [typeof V2CandidateId.Type, ...Array<typeof V2CandidateId.Type>],
        objectiveMetricIds: shared.objectiveMetricIds as [typeof MetricId.Type, ...Array<typeof MetricId.Type>],
        rejectedCandidateIds: rejectedIds as [typeof V2CandidateId.Type, ...Array<typeof V2CandidateId.Type>]
      })
    }

    const winner = vectors.find((candidate) => vectors.every((other) =>
      other.candidateId === candidate.candidateId || dominates(candidate, other)))
    if (winner !== undefined) {
      return new UniqueSelection({
        ...shared,
        candidateIds: shared.candidateIds as [typeof V2CandidateId.Type, ...Array<typeof V2CandidateId.Type>],
        objectiveMetricIds: shared.objectiveMetricIds as [typeof MetricId.Type, ...Array<typeof MetricId.Type>],
        selectedCandidateId: winner.candidateId,
        selectedReceiptId: winner.receiptId,
        qualifyingCandidateIds: qualifyingIds as [typeof V2CandidateId.Type, ...Array<typeof V2CandidateId.Type>],
        dominatedCandidateIds: qualifyingIds.filter((id) => id !== winner.candidateId),
        rejectedCandidateIds: rejectedIds
      })
    }

    const nonDominatedIds = vectors
      .filter((candidate) => !vectors.some((other) =>
        other.candidateId !== candidate.candidateId && dominates(other, candidate)))
      .map(({ candidateId }) => candidateId)
    return new MaintainerDecisionRequired({
      ...shared,
      candidateIds: shared.candidateIds as [typeof V2CandidateId.Type, ...Array<typeof V2CandidateId.Type>],
      objectiveMetricIds: shared.objectiveMetricIds as [typeof MetricId.Type, ...Array<typeof MetricId.Type>],
      qualifyingCandidateIds: qualifyingIds as [typeof V2CandidateId.Type, ...Array<typeof V2CandidateId.Type>],
      nonDominatedCandidateIds: nonDominatedIds as [typeof V2CandidateId.Type, ...Array<typeof V2CandidateId.Type>],
      rejectedCandidateIds: rejectedIds
    })
  }
)
