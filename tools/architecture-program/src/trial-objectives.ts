import { Effect, Schema } from "effect"
import {
  type ArchitectureCandidateManifestV2,
  ArchitectureCandidateManifestV2 as ArchitectureCandidateManifestV2Schema,
  candidateManifestInvariantIssues
} from "./schema/candidate-manifest.js"
import { ArtifactId, MetricId, Sha256Hex } from "./schema/primitives.js"
import { REQUIRED_TRIAL_LANES } from "./schema/trial-contract.js"
import {
  AcceptedRunnerEvaluationDisposition,
  type CaseReceipt,
  CaseReceipt as CaseReceiptSchema,
  type GateReceipt,
  GateReceipt as GateReceiptSchema,
  MeasuredObjectiveMetric,
  ObjectiveDerivationRecord,
  type ObjectiveMetric,
  type ObjectiveMetricEvidenceContext,
  type ProbeReceipt,
  ProbeReceipt as ProbeReceiptSchema,
  RejectedRunnerEvaluationDisposition,
  UnavailableObjectiveMetric,
  computeCaseTerminalResultSha256,
  computeGateEvaluationRecordSha256,
  computeGateTerminalResultSha256,
  computeObjectiveDerivationRecordSha256,
  computeObjectiveMetricEvidenceSha256,
  computeProbeEvaluationRecordSha256,
  computeProbeTerminalResultSha256
} from "./schema/trial-result.js"
import {
  REQUIRED_MACHINE_METRIC_IDS,
  REQUIRED_TOPOLOGY_METRIC_IDS
} from "./schema/trial-spec.js"
import {
  V2CandidateScope,
  V2_CASE_IDS,
  V2_MACHINE_GATE_IDS,
  V2_PROBE_IDS,
  V2_TOPOLOGY_GATE_IDS
} from "./schema/v2-ids.js"
import {
  EvidenceEntryV2,
  EvidenceName,
  IntegerEvidenceValueV2,
  codePointCompare,
  evidenceEntriesInvariantIssues,
  sortedUniqueStringIssues
} from "./schema/trial-evidence.js"
import {
  type CanonicalTreeEntry,
  CanonicalTreeEntry as CanonicalTreeEntrySchema,
  canonicalTreeSha256
} from "./trial-inventory.js"

export const MACHINE_RUNNER_OWNED_OBJECTIVE_METRIC_IDS = [
  "representable-invalid-state-count",
  "machine-interpreter-product-lines",
  "main-path-owner-hops",
  "difficult-path-owner-hops"
] as const

export const TOPOLOGY_RUNNER_OWNED_OBJECTIVE_METRIC_IDS = [
  "invalid-version-publication-state-count",
  "product-source-lines",
  "packed-byte-count"
] as const

export const RUNNER_OWNED_OBJECTIVE_METRIC_IDS = [
  ...MACHINE_RUNNER_OWNED_OBJECTIVE_METRIC_IDS,
  ...TOPOLOGY_RUNNER_OWNED_OBJECTIVE_METRIC_IDS
] as const

export const RunnerOwnedObjectiveMetricId = Schema.Literals(
  RUNNER_OWNED_OBJECTIVE_METRIC_IDS
)
export type RunnerOwnedObjectiveMetricId = typeof RunnerOwnedObjectiveMetricId.Type

const safeInteger = Schema.makeFilter(
  (value: number) => Number.isSafeInteger(value) && !Object.is(value, -0)
    ? undefined
    : "must be a safe integer other than negative zero"
)
const Natural = Schema.Int.check(safeInteger, Schema.isGreaterThanOrEqualTo(0))

export class RunnerMeasuredObjectiveValue extends Schema.TaggedClass<RunnerMeasuredObjectiveValue>()(
  "Measured",
  {
    id: RunnerOwnedObjectiveMetricId,
    value: Natural,
    facts: Schema.NonEmptyArray(EvidenceEntryV2)
  }
) {}

export class RunnerUnavailableObjectiveValue extends Schema.TaggedClass<RunnerUnavailableObjectiveValue>()(
  "Unavailable",
  { id: RunnerOwnedObjectiveMetricId }
) {}

export const RunnerOwnedObjectiveValue = Schema.Union([
  RunnerMeasuredObjectiveValue,
  RunnerUnavailableObjectiveValue
])
export type RunnerOwnedObjectiveValue = typeof RunnerOwnedObjectiveValue.Type

export const TrialObjectiveDerivationInput = Schema.Struct({
  scope: V2CandidateScope,
  runContextSha256: Sha256Hex,
  preflightFailures: Schema.Array(ArtifactId),
  candidateTreeEntries: Schema.Array(CanonicalTreeEntrySchema),
  candidateManifest: ArchitectureCandidateManifestV2Schema,
  caseReceipts: Schema.Array(CaseReceiptSchema),
  probeReceipts: Schema.Array(ProbeReceiptSchema),
  gateReceipts: Schema.Array(GateReceiptSchema)
})
export type TrialObjectiveDerivationInput = typeof TrialObjectiveDerivationInput.Type

export interface RunnerOwnedObjectiveEvaluationRequest {
  readonly metricId: RunnerOwnedObjectiveMetricId
  readonly scope: typeof V2CandidateScope.Type
  readonly candidateTreeEntries: ReadonlyArray<CanonicalTreeEntry>
  readonly candidateManifest: ArchitectureCandidateManifestV2
  readonly caseReceipts: ReadonlyArray<CaseReceipt>
  readonly probeReceipts: ReadonlyArray<ProbeReceipt>
  readonly gateReceipts: ReadonlyArray<GateReceipt>
}

/**
 * The runner supplies this boundary. Implementations may close over exact file bytes or other
 * runner observations, but must return only the requested frozen metric id and a natural value,
 * or explicitly report it unavailable. Candidate output is never an evaluator input.
 */
export interface RunnerOwnedObjectiveEvaluator {
  readonly derivationId: typeof ArtifactId.Type
  readonly evaluate: (
    request: RunnerOwnedObjectiveEvaluationRequest
  ) => Effect.Effect<unknown, never, never>
}

export class TrialObjectivesInvariantError extends Schema.TaggedError<TrialObjectivesInvariantError>()(
  "TrialObjectivesInvariantError",
  { issues: Schema.NonEmptyArray(Schema.String), message: Schema.String }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture trial objective invariant failure: ${issues.join("; ")}`
    })
  }
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeInputStructure = Schema.decodeUnknownEffect(TrialObjectiveDerivationInput, strictOptions)
const decodeRunnerValueStructure = Schema.decodeUnknownEffect(RunnerOwnedObjectiveValue, strictOptions)
const decodeDerivationId = Schema.decodeUnknownEffect(ArtifactId, strictOptions)

const canonicalIssues = (issues: ReadonlyArray<string>): Array<string> =>
  [...new Set(issues)].sort(codePointCompare)

const exactOrderedIssues = (
  label: string,
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>
): ReadonlyArray<string> => actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  ? []
  : [`${label} must equal the exact ordered ids [${expected.join(", ")}]`]

const sameSet = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

const sameOrdered = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const terminalOutput = (
  receipt: CaseReceipt | ProbeReceipt | GateReceipt
) => receipt.execution._tag === "NotRun" ? null : receipt.execution.terminalOutput

const receiptInvariantIssues = (
  input: TrialObjectiveDerivationInput
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  issues.push(...exactOrderedIssues(
    "caseReceipts",
    input.caseReceipts.map(({ caseId }) => caseId),
    V2_CASE_IDS
  ))
  issues.push(...exactOrderedIssues(
    "probeReceipts",
    input.probeReceipts.map(({ probeId }) => probeId),
    V2_PROBE_IDS
  ))
  issues.push(...exactOrderedIssues(
    "gateReceipts",
    input.gateReceipts.map(({ gateId }) => gateId),
    input.scope === "machine" ? V2_MACHINE_GATE_IDS : V2_TOPOLOGY_GATE_IDS
  ))

  input.caseReceipts.forEach((receipt) => {
    const label = `case ${receipt.caseId}`
    const output = terminalOutput(receipt)
    if (output !== null && "trace" in output) {
      const { resultSha256: _resultSha256, ...body } = output
      if (output.resultSha256 !== computeCaseTerminalResultSha256(body)) {
        issues.push(`${label}.terminalOutput.resultSha256 must bind its canonical body`)
      }
      issues.push(...evidenceEntriesInvariantIssues(`${label}.terminalOutput.facts`, output.facts))
    }
    if (receipt.execution._tag === "Passed") {
      const output = receipt.execution.terminalOutput
      if (receipt.execution.processAttempt.exitCode !== 0) {
        issues.push(`${label} Passed requires exit code zero`)
      }
      if (output.expectedOutcome !== output.actualOutcome ||
        !sameSet(output.requiredAssertionIds, output.observedAssertionIds) ||
        !sameSet(output.requiredAssertionIds, output.executedAssertionIds)) {
        issues.push(`${label} Passed requires matching outcomes and assertion evidence`)
      }
    } else {
      issues.push(...sortedUniqueStringIssues(`${label}.failureIds`, receipt.execution.failureIds))
    }
  })

  input.probeReceipts.forEach((receipt) => {
    const label = `probe ${receipt.probeId}`
    const output = terminalOutput(receipt)
    if (output !== null && "laneDeltas" in output) {
      const { resultSha256: _resultSha256, ...body } = output
      if (output.resultSha256 !== computeProbeTerminalResultSha256(body)) {
        issues.push(`${label}.terminalOutput.resultSha256 must bind its canonical body`)
      }
      issues.push(...exactOrderedIssues(
        `${label}.terminalOutput.laneDeltas`,
        output.laneDeltas.map(({ laneId }) => laneId),
        REQUIRED_TRIAL_LANES.map(([laneId]) => laneId)
      ))
      for (const [setLabel, values] of [
        ["touchedPathIds", output.touchedPathIds],
        ["touchedModuleIds", output.touchedModuleIds],
        ["touchedPackageIds", output.touchedPackageIds],
        ["touchedConceptIds", output.touchedConceptIds],
        ["touchedCentralBranchIds", output.touchedCentralBranchIds],
        ["touchedOwnerRoleIds", output.touchedOwnerRoleIds],
        ["zeroTouchRoleIds", output.zeroTouchRoleIds],
        ["changeKinds", output.changeKinds]
      ] as const) {
        issues.push(...sortedUniqueStringIssues(`${label}.terminalOutput.${setLabel}`, values))
      }
      const evaluation = output.evaluationRecord
      if (evaluation !== null) {
        const { recordSha256: _recordSha256, ...evaluationBody } = evaluation
        if (evaluation.recordSha256 !== computeProbeEvaluationRecordSha256(evaluationBody)) {
          issues.push(`${label}.terminalOutput.evaluationRecord must bind its canonical body`)
        }
        if (evaluation.probeId !== receipt.probeId ||
          evaluation.inspectedTreeSha256 !== output.afterTreeSha256) {
          issues.push(`${label}.terminalOutput.evaluationRecord must bind its probe and after tree`)
        }
      }
    }
    if (receipt.execution._tag === "Passed") {
      if (receipt.execution.processAttempt.exitCode !== 0) {
        issues.push(`${label} Passed requires exit code zero`)
      }
      if (receipt.execution.terminalOutput.evaluationRecord?.disposition._tag !== "Accepted") {
        issues.push(`${label} Passed requires an Accepted runner evaluation record`)
      }
    } else {
      issues.push(...sortedUniqueStringIssues(`${label}.failureIds`, receipt.execution.failureIds))
    }
  })

  input.gateReceipts.forEach((receipt) => {
    const label = `gate ${receipt.gateId}`
    issues.push(...sortedUniqueStringIssues(`${label}.caseIds`, receipt.caseIds))
    issues.push(...sortedUniqueStringIssues(`${label}.probeIds`, receipt.probeIds))
    const output = terminalOutput(receipt)
    if (output !== null && !("trace" in output) && !("laneDeltas" in output)) {
      const { resultSha256: _resultSha256, ...body } = output
      if (output.resultSha256 !== computeGateTerminalResultSha256(body)) {
        issues.push(`${label}.terminalOutput.resultSha256 must bind its canonical body`)
      }
      issues.push(...evidenceEntriesInvariantIssues(`${label}.terminalOutput.facts`, output.facts))
    }
    if (receipt.execution._tag !== "NotRun") {
      const evaluation = receipt.execution.evaluationRecord
      const { recordSha256: _recordSha256, ...evaluationBody } = evaluation
      if (evaluation.recordSha256 !== computeGateEvaluationRecordSha256(evaluationBody)) {
        issues.push(`${label}.evaluationRecord must bind its canonical body`)
      }
      if (evaluation.gateId !== receipt.gateId ||
        !sameOrdered(evaluation.declaredCommand, receipt.command)) {
        issues.push(`${label}.evaluationRecord must bind its gate and command`)
      }
    }
    if (receipt.execution._tag === "Passed") {
      if (receipt.execution.processAttempt.exitCode !== receipt.expectedExit) {
        issues.push(`${label} Passed requires its exact expected exit code`)
      }
      const evaluation = receipt.execution.evaluationRecord
      if (evaluation.disposition._tag !== "Accepted" ||
        evaluation.commandAttempt._tag !== "Exited" ||
        evaluation.commandAttempt.exitCode !== receipt.expectedExit) {
        issues.push(`${label} Passed requires an Accepted exact-exit gate evaluation record`)
      }
    } else {
      issues.push(...sortedUniqueStringIssues(`${label}.failureIds`, receipt.execution.failureIds))
    }
  })
  return issues
}

const inputInvariantIssues = (
  input: TrialObjectiveDerivationInput
): ReadonlyArray<string> => {
  const issues = [
    ...candidateManifestInvariantIssues(input.candidateManifest),
    ...sortedUniqueStringIssues("preflightFailures", input.preflightFailures),
    ...receiptInvariantIssues(input)
  ]
  if (input.scope !== input.candidateManifest.scope) {
    issues.push(`scope must equal candidate manifest scope ${input.candidateManifest.scope}`)
  }
  issues.push(...exactOrderedIssues(
    "candidateTreeEntries",
    input.candidateTreeEntries.map(({ path }) => path),
    input.candidateManifest.files.map(({ path }) => path)
  ))
  return canonicalIssues(issues)
}

const toInvariantError = (label: string, error: unknown): TrialObjectivesInvariantError =>
  new TrialObjectivesInvariantError([`${label}: ${String(error)}`])

const assertNoIssues = (issues: ReadonlyArray<string>): Effect.Effect<void, TrialObjectivesInvariantError> =>
  issues.length === 0
    ? Effect.void
    : Effect.fail(new TrialObjectivesInvariantError(issues as [string, ...Array<string>]))

const productLaneIds: ReadonlySet<string> = new Set(
  REQUIRED_TRIAL_LANES
    .filter(([, countsTowardProductSource]) => countsTowardProductSource)
    .map(([laneId]) => laneId)
)

interface ProbeSummary {
  readonly available: boolean
  readonly median: number
  readonly p90: number
  readonly maximumCentralBranches: number
}

const unavailableProbeSummary: ProbeSummary = {
  available: false,
  median: 0,
  p90: 0,
  maximumCentralBranches: 0
}

const deriveProbeSummary = (receipts: ReadonlyArray<ProbeReceipt>): ProbeSummary => {
  if (receipts.length !== 9 || receipts.some(({ execution }) => execution._tag !== "Passed")) {
    return unavailableProbeSummary
  }
  const grossAdditions: Array<number> = []
  let maximumCentralBranches = 0
  for (const receipt of receipts) {
    if (receipt.execution._tag !== "Passed") return unavailableProbeSummary
    const output = receipt.execution.terminalOutput
    let additions = 0
    for (const lane of output.laneDeltas) {
      if (!productLaneIds.has(lane.laneId)) continue
      additions += lane.additions
      if (!Number.isSafeInteger(additions)) return unavailableProbeSummary
    }
    grossAdditions.push(additions)
    maximumCentralBranches = Math.max(
      maximumCentralBranches,
      output.touchedCentralBranchIds.length
    )
  }
  grossAdditions.sort((left, right) => left - right)
  return {
    available: true,
    // Nine exact observations make nearest-rank median rank 5 and p90 rank 9.
    median: grossAdditions[4]!,
    p90: grossAdditions[8]!,
    maximumCentralBranches
  }
}

const runnerOwnedMetricIds: ReadonlySet<string> = new Set(RUNNER_OWNED_OBJECTIVE_METRIC_IDS)
const probeMetricIds: ReadonlySet<string> = new Set([
  "probe-median-gross-product-additions",
  "probe-p90-gross-product-additions",
  "probe-max-central-branches-touched"
])

export const objectiveMetricUnavailableFailureId = (
  id: string
) => ArtifactId.make(`objective-unavailable.${id}`)

const BUILTIN_PROBE_SUMMARY_DERIVATION_ID = ArtifactId.make(
  "objective-derivation.probe-summary-v2"
)
const BUILTIN_DEPENDENCY_COUNT_DERIVATION_ID = ArtifactId.make(
  "objective-derivation.candidate-manifest-dependency-count-v2"
)
const BUILTIN_PUBLIC_SURFACE_COUNT_DERIVATION_ID = ArtifactId.make(
  "objective-derivation.candidate-manifest-public-surface-count-v2"
)

const objectiveValueFacts = (value: number): [EvidenceEntryV2] => [
  new EvidenceEntryV2({
    sequence: 1,
    name: EvidenceName.make("objective.value"),
    value: new IntegerEvidenceValueV2({ value })
  })
]

const makeObjectiveDerivationRecord = (input: {
  readonly derivationId: typeof ArtifactId.Type
  readonly metricId: string
  readonly value: number | null
  readonly inspectedTreeSha256: typeof Sha256Hex.Type
  readonly facts?: readonly [EvidenceEntryV2, ...Array<EvidenceEntryV2>]
  readonly failureIds?: ReadonlyArray<typeof ArtifactId.Type>
}): ObjectiveDerivationRecord => {
  const disposition = input.value === null
    ? new RejectedRunnerEvaluationDisposition({
        failureIds: failureIdsForDerivation(input.failureIds)
      })
    : new AcceptedRunnerEvaluationDisposition({
        facts: input.facts ?? objectiveValueFacts(input.value)
      })
  const body = {
    derivationId: input.derivationId,
    metricId: MetricId.make(input.metricId),
    value: input.value,
    inspectedTreeSha256: input.inspectedTreeSha256,
    disposition
  }
  return new ObjectiveDerivationRecord({
    recordSha256: computeObjectiveDerivationRecordSha256(body),
    ...body
  })
}

const failureIdsForDerivation = (
  values: ReadonlyArray<typeof ArtifactId.Type> | undefined
): [typeof ArtifactId.Type, ...Array<typeof ArtifactId.Type>] => {
  const sorted = [...new Set(values ?? [])].sort(codePointCompare)
  return (sorted.length > 0
    ? sorted
    : [ArtifactId.make("objective-derivation.unavailable")]) as [
      typeof ArtifactId.Type,
      ...Array<typeof ArtifactId.Type>
    ]
}

const makeMeasuredMetric = (
  context: ObjectiveMetricEvidenceContext,
  id: string,
  value: number,
  inspectedTreeSha256: typeof Sha256Hex.Type,
  derivationId: typeof ArtifactId.Type,
  facts: readonly [EvidenceEntryV2, ...Array<EvidenceEntryV2>] = objectiveValueFacts(value)
): ObjectiveMetric => {
  const derivationRecord = makeObjectiveDerivationRecord({
    derivationId,
    metricId: id,
    value,
    inspectedTreeSha256,
    facts
  })
  return new MeasuredObjectiveMetric({
    id: MetricId.make(id),
    value,
    evidenceSha256: computeObjectiveMetricEvidenceSha256(
      context,
      id,
      value,
      derivationRecord
    ),
    derivationRecord
  })
}

const makeUnavailableMetric = (
  id: string,
  inspectedTreeSha256: typeof Sha256Hex.Type,
  derivationId: typeof ArtifactId.Type
): ObjectiveMetric => {
  const failureId = objectiveMetricUnavailableFailureId(id)
  return new UnavailableObjectiveMetric({
    id: MetricId.make(id),
    failureId,
    derivationRecord: makeObjectiveDerivationRecord({
      derivationId,
      metricId: id,
      value: null,
      inspectedTreeSha256,
      failureIds: [failureId]
    })
  })
}

/**
 * Derives the exact frozen objective rows without reading candidate-authored metric claims.
 * Manifest sets, raw probe lane deltas, and runner-owned evaluators are the only value sources.
 */
export const deriveTrialObjectives = Effect.fn("trialObjectives.deriveTrialObjectives")(
  function* (
    rawInput: unknown,
    evaluator: RunnerOwnedObjectiveEvaluator
  ) {
    const input = yield* decodeInputStructure(rawInput).pipe(
      Effect.mapError((error) => toInvariantError("input structure", error))
    )
    yield* assertNoIssues(inputInvariantIssues(input))

    const evidenceContext: ObjectiveMetricEvidenceContext = {
      runContextSha256: input.runContextSha256,
      preflightFailures: input.preflightFailures,
      caseReceipts: input.caseReceipts,
      probeReceipts: input.probeReceipts,
      gateReceipts: input.gateReceipts
    }
    const probeSummary = deriveProbeSummary(input.probeReceipts)
    const inspectedTreeSha256 = canonicalTreeSha256(input.candidateTreeEntries)
    const runnerDerivationId = yield* decodeDerivationId(evaluator.derivationId).pipe(
      Effect.mapError((error) => toInvariantError("runner evaluator derivationId", error))
    )
    const requiredIds = input.scope === "machine"
      ? REQUIRED_MACHINE_METRIC_IDS
      : REQUIRED_TOPOLOGY_METRIC_IDS
    const output: Array<ObjectiveMetric> = []

    for (const id of requiredIds) {
      if (runnerOwnedMetricIds.has(id)) {
        const rawValue = yield* evaluator.evaluate({
          metricId: id as RunnerOwnedObjectiveMetricId,
          scope: input.scope,
          candidateTreeEntries: input.candidateTreeEntries,
          candidateManifest: input.candidateManifest,
          caseReceipts: input.caseReceipts,
          probeReceipts: input.probeReceipts,
          gateReceipts: input.gateReceipts
        })
        const value = yield* decodeRunnerValueStructure(rawValue).pipe(
          Effect.mapError((error) => toInvariantError(`runner evaluator ${id}`, error))
        )
        if (value.id !== id) {
          yield* new TrialObjectivesInvariantError([
            `runner evaluator ${id} returned mismatched id ${value.id}`
          ])
        }
        if (value._tag === "Measured") {
          yield* assertNoIssues(
            evidenceEntriesInvariantIssues(`runner evaluator ${id}.facts`, value.facts)
          )
        }
        output.push(value._tag === "Measured"
          ? makeMeasuredMetric(
              evidenceContext,
              id,
              value.value,
              inspectedTreeSha256,
              runnerDerivationId,
              value.facts
            )
          : makeUnavailableMetric(id, inspectedTreeSha256, runnerDerivationId))
        continue
      }

      if (probeMetricIds.has(id)) {
        if (!probeSummary.available) {
          output.push(makeUnavailableMetric(
            id,
            inspectedTreeSha256,
            BUILTIN_PROBE_SUMMARY_DERIVATION_ID
          ))
        } else if (id === "probe-median-gross-product-additions") {
          output.push(makeMeasuredMetric(
            evidenceContext,
            id,
            probeSummary.median,
            inspectedTreeSha256,
            BUILTIN_PROBE_SUMMARY_DERIVATION_ID
          ))
        } else if (id === "probe-p90-gross-product-additions") {
          output.push(makeMeasuredMetric(
            evidenceContext,
            id,
            probeSummary.p90,
            inspectedTreeSha256,
            BUILTIN_PROBE_SUMMARY_DERIVATION_ID
          ))
        } else {
          output.push(makeMeasuredMetric(
            evidenceContext,
            id,
            probeSummary.maximumCentralBranches,
            inspectedTreeSha256,
            BUILTIN_PROBE_SUMMARY_DERIVATION_ID
          ))
        }
        continue
      }

      if (id === "dependency-edge-count") {
        output.push(makeMeasuredMetric(
          evidenceContext,
          id,
          input.candidateManifest.dependencyEdges.length,
          inspectedTreeSha256,
          BUILTIN_DEPENDENCY_COUNT_DERIVATION_ID
        ))
        continue
      }
      if (id === "public-runtime-plus-declaration-commitment-count") {
        output.push(makeMeasuredMetric(
          evidenceContext,
          id,
          input.candidateManifest.publicSurfaceIds.length,
          inspectedTreeSha256,
          BUILTIN_PUBLIC_SURFACE_COUNT_DERIVATION_ID
        ))
        continue
      }

      yield* new TrialObjectivesInvariantError([`no frozen derivation exists for objective ${id}`])
    }
    return output
  }
)
