import { Effect, Schema } from "effect"
import { hashCanonicalValue } from "../trial-hash.js"
import { ArtifactId, MetricId, PlannedRepositoryPath, Sha256Hex } from "./primitives.js"
import {
  type TrialSelectionOutcome,
  TrialSelectionOutcome as TrialSelectionOutcomeSchema
} from "./trial-selection.js"
import type { ArchitectureTrialSpecV2 } from "./trial-spec.js"
import {
  V2CandidateId,
  V2CandidateScope,
  V2GateId,
  V2MachineCandidateId,
  V2ProbeId,
  V2_PROBE_IDS
} from "./v2-ids.js"

export const TRIAL_RESULTS_AGGREGATE_HASH_DOMAIN =
  "ts-release/architecture-trial-results-aggregate/v2"
export const TRIAL_SELECTION_OUTCOME_HASH_DOMAIN =
  "ts-release/architecture-trial-selection-outcome/v2"

export const ProbeEvaluationAuthorityBindingV2 = Schema.Struct({
  probeId: V2ProbeId,
  evaluatorId: Schema.NullOr(ArtifactId),
  recordSha256: Schema.NullOr(Sha256Hex)
})

export const GateEvaluationAuthorityBindingV2 = Schema.Struct({
  gateId: V2GateId,
  evaluatorId: Schema.NullOr(ArtifactId),
  recordSha256: Schema.NullOr(Sha256Hex)
})

export const ObjectiveDerivationAuthorityBindingV2 = Schema.Struct({
  metricId: MetricId,
  derivationId: ArtifactId,
  recordSha256: Sha256Hex
})

export class TrialEvaluationAuthorityV2 extends Schema.Class<TrialEvaluationAuthorityV2>(
  "TrialEvaluationAuthorityV2"
)({
  probeEvaluations: Schema.Array(ProbeEvaluationAuthorityBindingV2),
  gateEvaluations: Schema.Array(GateEvaluationAuthorityBindingV2),
  objectiveDerivations: Schema.Array(ObjectiveDerivationAuthorityBindingV2)
}) {}

export class UpstreamMachineResultBindingV2 extends Schema.Class<
  UpstreamMachineResultBindingV2
>("UpstreamMachineResultBindingV2")({
  selectedMachineCandidateId: V2MachineCandidateId,
  selectedMachineReceiptId: Sha256Hex
}) {}

export class TrialResultFileBindingV2 extends Schema.Class<TrialResultFileBindingV2>(
  "TrialResultFileBindingV2"
)({
  scope: V2CandidateScope,
  candidateId: V2CandidateId,
  path: PlannedRepositoryPath,
  fileSha256: Sha256Hex,
  receiptId: Sha256Hex,
  runContextSha256: Sha256Hex,
  candidateManifestSha256: Sha256Hex,
  candidateTreeSha256: Sha256Hex,
  runnerSourceSha256: Sha256Hex,
  runnerNodeModulesSha256: Sha256Hex,
  upstreamMachineReceipt: Schema.NullOr(UpstreamMachineResultBindingV2),
  evaluationAuthority: TrialEvaluationAuthorityV2
}) {}

export class MaintainerDecisionFileBindingV2 extends Schema.Class<
  MaintainerDecisionFileBindingV2
>("MaintainerDecisionFileBindingV2")({
  scope: V2CandidateScope,
  path: PlannedRepositoryPath,
  fileSha256: Sha256Hex,
  selectionOutcomeSha256: Sha256Hex,
  selectedCandidateId: V2CandidateId,
  selectedReceiptId: Sha256Hex
}) {}

const AggregateBodyFields = {
  schemaVersion: Schema.Literal("ts-release/architecture-trial-results/v2"),
  programId: Schema.Literal("ts-release-architecture-program"),
  trialSpecSha256: Sha256Hex,
  machineResults: Schema.Array(TrialResultFileBindingV2),
  machineSelection: TrialSelectionOutcomeSchema,
  machineMaintainerDecision: Schema.NullOr(MaintainerDecisionFileBindingV2),
  topologyResults: Schema.Array(TrialResultFileBindingV2),
  topologySelection: Schema.NullOr(TrialSelectionOutcomeSchema),
  topologyMaintainerDecision: Schema.NullOr(MaintainerDecisionFileBindingV2)
} as const

export const ArchitectureTrialResultsBodyV2 = Schema.Struct(AggregateBodyFields)
export type ArchitectureTrialResultsBodyV2 = typeof ArchitectureTrialResultsBodyV2.Type
export type ArchitectureTrialResultsBodyV2Encoded = typeof ArchitectureTrialResultsBodyV2.Encoded

export class ArchitectureTrialResultsV2 extends Schema.Class<ArchitectureTrialResultsV2>(
  "ArchitectureTrialResultsV2"
)({
  aggregateId: Sha256Hex,
  ...AggregateBodyFields
}) {}

export class TrialResultsAggregateInvariantError extends Schema.TaggedError<
  TrialResultsAggregateInvariantError
>()("TrialResultsAggregateInvariantError", {
  issues: Schema.NonEmptyArray(Schema.String),
  message: Schema.String
}) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture trial results aggregate invariant failure: ${issues.join("; ")}`
    })
  }
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeBodyStructure = Schema.decodeUnknownSync(ArchitectureTrialResultsBodyV2, strictOptions)
const encodeBodyStructure = Schema.encodeUnknownSync(ArchitectureTrialResultsBodyV2, strictOptions)
const decodeAggregateStructure = Schema.decodeUnknownEffect(ArchitectureTrialResultsV2, strictOptions)
const encodeAggregateStructure = Schema.encodeUnknownSync(ArchitectureTrialResultsV2, strictOptions)
const encodeSelectionStructure = Schema.encodeUnknownSync(TrialSelectionOutcomeSchema, strictOptions)

export const computeTrialSelectionOutcomeSha256 = (selection: TrialSelectionOutcome) =>
  hashCanonicalValue(TRIAL_SELECTION_OUTCOME_HASH_DOMAIN, encodeSelectionStructure(selection))

export const computeTrialResultsAggregateId = (input: unknown) => {
  const body = decodeBodyStructure(input)
  return hashCanonicalValue(TRIAL_RESULTS_AGGREGATE_HASH_DOMAIN, encodeBodyStructure(body))
}

const exactOrdered = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const expectedResultPath = (scope: "machine" | "topology", candidateId: string): string =>
  `docs/refactor/architecture-program/results/${scope}/${candidateId}.json`

const bindingIssues = (
  label: string,
  scope: "machine" | "topology",
  bindings: ReadonlyArray<TrialResultFileBindingV2>,
  expectedCandidateIds: ReadonlyArray<string>,
  expectedGateIds: ReadonlyArray<string>,
  expectedObjectiveMetricIds: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  if (!exactOrdered(bindings.map(({ candidateId }) => candidateId), expectedCandidateIds)) {
    issues.push(`${label} must bind exact ordered candidates [${expectedCandidateIds.join(", ")}]`)
  }
  for (const binding of bindings) {
    if (binding.scope !== scope) issues.push(`${label} ${binding.candidateId} has wrong scope`)
    if (binding.path !== expectedResultPath(scope, binding.candidateId)) {
      issues.push(`${label} ${binding.candidateId} has noncanonical result path`)
    }
    if ((scope === "machine") !== (binding.upstreamMachineReceipt === null)) {
      issues.push(`${label} ${binding.candidateId} has invalid upstream machine binding`)
    }
    if (!exactOrdered(
      binding.evaluationAuthority.probeEvaluations.map(({ probeId }) => probeId),
      V2_PROBE_IDS
    ) || !exactOrdered(
      binding.evaluationAuthority.gateEvaluations.map(({ gateId }) => gateId),
      expectedGateIds
    ) || !exactOrdered(
      binding.evaluationAuthority.objectiveDerivations.map(({ metricId }) => metricId),
      expectedObjectiveMetricIds
    )) {
      issues.push(`${label} ${binding.candidateId} has incomplete or reordered evaluation authority`)
    }
    for (const evaluation of [
      ...binding.evaluationAuthority.probeEvaluations,
      ...binding.evaluationAuthority.gateEvaluations
    ]) {
      if ((evaluation.evaluatorId === null) !== (evaluation.recordSha256 === null)) {
        issues.push(`${label} ${binding.candidateId} has a partial evaluator authority pair`)
      }
    }
  }
  return issues
}

const selectionIssues = (
  label: string,
  selection: TrialSelectionOutcome,
  scope: "machine" | "topology",
  candidateIds: ReadonlyArray<string>,
  objectiveMetricIds: ReadonlyArray<string>,
  bindings: ReadonlyArray<TrialResultFileBindingV2>
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  if (selection.scope !== scope || !exactOrdered(selection.candidateIds, candidateIds) ||
    !exactOrdered(selection.objectiveMetricIds, objectiveMetricIds)) {
    issues.push(`${label} does not bind its frozen scope, candidates, and objectives`)
  }
  for (const vector of selection.objectiveVectors) {
    const binding = bindings.find(({ candidateId }) => candidateId === vector.candidateId)
    if (binding === undefined || binding.receiptId !== vector.receiptId ||
      !exactOrdered(vector.values.map(({ metricId }) => metricId), objectiveMetricIds)) {
      issues.push(`${label} objective vector ${vector.candidateId} is not receipt-bound`)
    }
  }
  if (selection._tag === "NoQualifyingCandidate") {
    if (selection.objectiveVectors.length !== 0 ||
      !exactOrdered(selection.rejectedCandidateIds, candidateIds)) {
      issues.push(`${label} NoQualifyingCandidate must reject every candidate and carry no vector`)
    }
    return issues
  }
  if (!exactOrdered(
    selection.objectiveVectors.map(({ candidateId }) => candidateId),
    selection.qualifyingCandidateIds
  )) {
    issues.push(`${label} vectors must equal the exact qualifying candidate order`)
  }
  const partition = candidateIds.filter((id) =>
    selection.qualifyingCandidateIds.includes(id as typeof V2CandidateId.Type) ||
    selection.rejectedCandidateIds.includes(id as typeof V2CandidateId.Type))
  if (!exactOrdered(partition, candidateIds) ||
    selection.qualifyingCandidateIds.some((id) => selection.rejectedCandidateIds.includes(id))) {
    issues.push(`${label} qualifying and rejected candidates must form a disjoint full partition`)
  }
  if (selection._tag === "UniqueSelection") {
    const selectedBinding = bindings.find(
      ({ candidateId }) => candidateId === selection.selectedCandidateId
    )
    if (!selection.qualifyingCandidateIds.includes(selection.selectedCandidateId) ||
      selectedBinding?.receiptId !== selection.selectedReceiptId) {
      issues.push(`${label} selected candidate and receipt are not a qualifying result binding`)
    }
  } else if (selection.nonDominatedCandidateIds.some((id) =>
    !selection.qualifyingCandidateIds.includes(id))) {
    issues.push(`${label} non-dominated candidates must be qualifying candidates`)
  }
  return issues
}

const decisionIssues = (
  label: string,
  selection: TrialSelectionOutcome,
  decision: MaintainerDecisionFileBindingV2 | null,
  bindings: ReadonlyArray<TrialResultFileBindingV2>
): ReadonlyArray<string> => {
  if (decision === null) return []
  const issues: Array<string> = []
  if (selection._tag !== "MaintainerDecisionRequired") {
    issues.push(`${label} decision is allowed only for MaintainerDecisionRequired`)
    return issues
  }
  const binding = bindings.find(({ candidateId }) => candidateId === decision.selectedCandidateId)
  if (decision.scope !== selection.scope ||
    decision.path !== "docs/refactor/architecture-program/inputs/maintainer-decision.json" ||
    decision.selectionOutcomeSha256 !== computeTrialSelectionOutcomeSha256(selection) ||
    !selection.nonDominatedCandidateIds.includes(decision.selectedCandidateId) ||
    binding?.receiptId !== decision.selectedReceiptId) {
    issues.push(`${label} decision must hash-bind one non-dominated candidate receipt`)
  }
  return issues
}

const selectedCoordinate = (
  selection: TrialSelectionOutcome,
  decision: MaintainerDecisionFileBindingV2 | null
): { readonly candidateId: string; readonly receiptId: string } | undefined =>
  selection._tag === "UniqueSelection"
    ? { candidateId: selection.selectedCandidateId, receiptId: selection.selectedReceiptId }
    : selection._tag === "MaintainerDecisionRequired" && decision !== null
    ? { candidateId: decision.selectedCandidateId, receiptId: decision.selectedReceiptId }
    : undefined

export const trialResultsAggregateInvariantIssues = (
  aggregate: ArchitectureTrialResultsV2,
  spec: ArchitectureTrialSpecV2
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const machineIds = spec.machineSelectionPolicy.candidateIds
  const topologyIds = spec.topologySelectionPolicy.candidateIds
  issues.push(...bindingIssues(
    "machineResults",
    "machine",
    aggregate.machineResults,
    machineIds,
    spec.machineSelectionPolicy.hardGateIds,
    spec.machineSelectionPolicy.objectiveMetricIds
  ))
  issues.push(...selectionIssues(
    "machineSelection",
    aggregate.machineSelection,
    "machine",
    machineIds,
    spec.machineSelectionPolicy.objectiveMetricIds,
    aggregate.machineResults
  ))
  issues.push(...decisionIssues(
    "machineMaintainerDecision",
    aggregate.machineSelection,
    aggregate.machineMaintainerDecision,
    aggregate.machineResults
  ))
  const machine = selectedCoordinate(
    aggregate.machineSelection,
    aggregate.machineMaintainerDecision
  )
  if (machine === undefined) {
    if (aggregate.topologyResults.length !== 0 || aggregate.topologySelection !== null ||
      aggregate.topologyMaintainerDecision !== null) {
      issues.push("topology evidence is forbidden until the machine selection is resolved")
    }
  } else {
    issues.push(...bindingIssues(
      "topologyResults",
      "topology",
      aggregate.topologyResults,
      topologyIds,
      spec.topologySelectionPolicy.hardGateIds,
      spec.topologySelectionPolicy.objectiveMetricIds
    ))
    for (const binding of aggregate.topologyResults) {
      if (binding.upstreamMachineReceipt?.selectedMachineCandidateId !== machine.candidateId ||
        binding.upstreamMachineReceipt.selectedMachineReceiptId !== machine.receiptId) {
        issues.push(`${binding.candidateId} does not bind the resolved machine receipt`)
      }
    }
    if (aggregate.topologySelection === null) {
      issues.push("resolved machine evidence requires a topology selection outcome")
    } else {
      issues.push(...selectionIssues(
        "topologySelection",
        aggregate.topologySelection,
        "topology",
        topologyIds,
        spec.topologySelectionPolicy.objectiveMetricIds,
        aggregate.topologyResults
      ))
      issues.push(...decisionIssues(
        "topologyMaintainerDecision",
        aggregate.topologySelection,
        aggregate.topologyMaintainerDecision,
        aggregate.topologyResults
      ))
    }
  }
  const { aggregateId: _aggregateId, ...body } = aggregate
  if (aggregate.aggregateId !== computeTrialResultsAggregateId(body)) {
    issues.push("aggregateId must bind the canonical aggregate body")
  }
  return [...new Set(issues)].sort()
}

const assertIssues = (issues: ReadonlyArray<string>): void => {
  if (issues.length > 0) {
    throw new TrialResultsAggregateInvariantError(issues as [string, ...Array<string>])
  }
}

export const makeTrialResultsAggregate = (
  input: unknown,
  spec: ArchitectureTrialSpecV2
): ArchitectureTrialResultsV2 => {
  const body = decodeBodyStructure(input)
  const aggregate = new ArchitectureTrialResultsV2({
    aggregateId: computeTrialResultsAggregateId(body),
    ...body
  })
  assertIssues(trialResultsAggregateInvariantIssues(aggregate, spec))
  return aggregate
}

export const decodeTrialResultsAggregate = Effect.fn(
  "ArchitectureTrialResultsV2.decode"
)(function* (input: unknown, spec: ArchitectureTrialSpecV2) {
  const aggregate = yield* decodeAggregateStructure(input)
  const issues = trialResultsAggregateInvariantIssues(aggregate, spec)
  if (issues.length > 0) {
    return yield* new TrialResultsAggregateInvariantError(
      issues as [string, ...Array<string>]
    )
  }
  return aggregate
})

export const encodeTrialResultsAggregate = (
  aggregate: ArchitectureTrialResultsV2,
  spec: ArchitectureTrialSpecV2
): unknown => {
  assertIssues(trialResultsAggregateInvariantIssues(aggregate, spec))
  return encodeAggregateStructure(aggregate)
}
