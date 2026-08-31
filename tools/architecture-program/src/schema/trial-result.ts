import { Effect, Schema } from "effect"
import { hashCanonicalValue } from "../trial-hash.js"
import {
  type ArchitectureCandidateManifestV2,
  candidateManifestInvariantIssues
} from "./candidate-manifest.js"
import {
  ArtifactId,
  MetricId,
  PlannedRepositoryPath,
  RoleId,
  Sha256Hex,
  type Sha256Hex as Sha256HexType
} from "./primitives.js"
import {
  type TrialRunContextToolchain,
  TrialRunContextV2,
  trialRunContextInvariantIssues
} from "./run-context.js"
import { REQUIRED_TRIAL_LANES } from "./trial-contract.js"
import {
  CaseTraceStep,
  EvidenceEntryV2,
  TerminalOutcome,
  caseTraceInvariantIssues,
  codePointCompare,
  evidenceEntriesInvariantIssues,
  sortedUniqueStringIssues
} from "./trial-evidence.js"
import {
  type ArchitectureTrialSpecV2,
  REQUIRED_MACHINE_METRIC_IDS,
  REQUIRED_PROBE_MEASUREMENT_IDS,
  REQUIRED_TOPOLOGY_METRIC_IDS,
  gateDefinitionSha256,
  trialSpecInvariantIssues
} from "./trial-spec.js"
import {
  V2CaseId,
  V2GateId,
  V2ProbeId,
  V2_CASE_IDS,
  V2_MACHINE_GATE_IDS,
  V2_PROBE_IDS,
  V2_TOPOLOGY_GATE_IDS
} from "./v2-ids.js"

const wellFormedText = Schema.makeFilter(
  (value: string) => value.isWellFormed() ? undefined : "must not contain an unpaired UTF-16 surrogate"
)
const nfcText = Schema.makeFilter(
  (value: string) => value === value.normalize("NFC") ? undefined : "must be NFC-normalized"
)
const safeInteger = Schema.makeFilter(
  (value: number) => Number.isSafeInteger(value) && !Object.is(value, -0)
    ? undefined
    : "must be a safe integer other than negative zero"
)
const CanonicalNonEmptyText = Schema.NonEmptyString.check(wellFormedText, nfcText)
const Natural = Schema.Int.check(safeInteger, Schema.isGreaterThanOrEqualTo(0))
const PositiveInteger = Schema.Int.check(safeInteger, Schema.isGreaterThan(0))

const ChangeKind = Schema.Literals([
  "state",
  "command",
  "authority",
  "runtime-surface",
  "declaration-surface",
  "emitted-inventory",
  "durable-format-review",
  "migration-review",
  "ordinary-import-and-layer",
  "packed-consumer"
])
const Qualification = Schema.Literals(["Passed", "Rejected"])

export const TRIAL_RESULT_RECEIPT_HASH_DOMAIN = "ts-release/architecture-trial-receipt/v2"
export const CASE_TERMINAL_RESULT_HASH_DOMAIN = "ts-release/architecture-case-terminal-result/v2"
export const PROBE_TERMINAL_RESULT_HASH_DOMAIN = "ts-release/architecture-probe-terminal-result/v2"
export const GATE_TERMINAL_RESULT_HASH_DOMAIN = "ts-release/architecture-gate-terminal-result/v2"
export const PROBE_MEASUREMENT_EVIDENCE_HASH_DOMAIN =
  "ts-release/architecture-probe-measurement-evidence/v2"
export const OBJECTIVE_METRIC_EVIDENCE_HASH_DOMAIN =
  "ts-release/architecture-objective-metric-evidence/v2"

/** The child exited normally. An exit of zero is not, by itself, semantic success. */
export class ExitedProcessOutcome extends Schema.TaggedClass<ExitedProcessOutcome>()("Exited", {
  exitCode: Natural
}) {}

export class TimedOutProcessOutcome extends Schema.TaggedClass<TimedOutProcessOutcome>()("TimedOut", {
  timeoutMilliseconds: PositiveInteger
}) {}

export class SignaledProcessOutcome extends Schema.TaggedClass<SignaledProcessOutcome>()("Signaled", {
  signal: CanonicalNonEmptyText
}) {}

export class SpawnFailedProcessOutcome extends Schema.TaggedClass<SpawnFailedProcessOutcome>()(
  "SpawnFailed",
  { executable: CanonicalNonEmptyText }
) {}

export class ProtocolRejectedProcessOutcome extends Schema.TaggedClass<ProtocolRejectedProcessOutcome>()(
  "ProtocolRejected",
  { outputSha256: Schema.Union([Sha256Hex, Schema.Null]) }
) {}

export const ProcessOutcome = Schema.Union([
  ExitedProcessOutcome,
  TimedOutProcessOutcome,
  SignaledProcessOutcome,
  SpawnFailedProcessOutcome,
  ProtocolRejectedProcessOutcome
])
export type ProcessOutcome = typeof ProcessOutcome.Type

/** Raw runner measurement values retained as the inventory boundary API. */
export class IdentifierSetDelta extends Schema.Class<IdentifierSetDelta>("IdentifierSetDelta")({
  addedIds: Schema.Array(CanonicalNonEmptyText),
  removedIds: Schema.Array(CanonicalNonEmptyText)
}) {}

export class HashMeasurement extends Schema.TaggedClass<HashMeasurement>()("Hash", {
  id: MetricId,
  value: Sha256Hex
}) {}

export class CountMeasurement extends Schema.TaggedClass<CountMeasurement>()("Count", {
  id: MetricId,
  value: Natural
}) {}

export class IdentifierDeltaMeasurement extends Schema.TaggedClass<IdentifierDeltaMeasurement>()(
  "IdentifierDelta",
  { id: MetricId, value: IdentifierSetDelta }
) {}

export const ProbeMeasurement = Schema.Union([
  HashMeasurement,
  CountMeasurement,
  IdentifierDeltaMeasurement
])
export type ProbeMeasurement = typeof ProbeMeasurement.Type

export class HashMeasurementValue extends Schema.TaggedClass<HashMeasurementValue>()("Hash", {
  value: Sha256Hex
}) {}

export class CountMeasurementValue extends Schema.TaggedClass<CountMeasurementValue>()("Count", {
  value: Natural
}) {}

export class IdentifierDeltaMeasurementValue extends Schema.TaggedClass<IdentifierDeltaMeasurementValue>()(
  "IdentifierDelta",
  { value: IdentifierSetDelta }
) {}

export const ProbeMeasurementValue = Schema.Union([
  HashMeasurementValue,
  CountMeasurementValue,
  IdentifierDeltaMeasurementValue
])
export type ProbeMeasurementValue = typeof ProbeMeasurementValue.Type
export type ProbeMeasurementValueEncoded = typeof ProbeMeasurementValue.Encoded

export class MeasuredProbeMeasurement extends Schema.TaggedClass<MeasuredProbeMeasurement>()("Measured", {
  id: MetricId,
  value: ProbeMeasurementValue,
  evidenceSha256: Sha256Hex
}) {}

export class UnavailableProbeMeasurement extends Schema.TaggedClass<UnavailableProbeMeasurement>()(
  "Unavailable",
  { id: MetricId, failureId: ArtifactId }
) {}

export const ProbeMeasurementResult = Schema.Union([
  MeasuredProbeMeasurement,
  UnavailableProbeMeasurement
])
export type ProbeMeasurementResult = typeof ProbeMeasurementResult.Type

export class SourceLaneDelta extends Schema.Class<SourceLaneDelta>("SourceLaneDelta")({
  laneId: MetricId,
  additions: Natural,
  deletions: Natural
}) {}

const CaseTerminalOutputBodyFields = {
  expectedOutcome: TerminalOutcome,
  actualOutcome: TerminalOutcome,
  requiredAssertionIds: Schema.NonEmptyArray(ArtifactId),
  observedAssertionIds: Schema.Array(ArtifactId),
  executedAssertionIds: Schema.Array(ArtifactId),
  trace: Schema.NonEmptyArray(CaseTraceStep),
  facts: Schema.NonEmptyArray(EvidenceEntryV2)
} as const

export const CaseTerminalOutputBody = Schema.Struct(CaseTerminalOutputBodyFields)
export type CaseTerminalOutputBody = typeof CaseTerminalOutputBody.Type
export type CaseTerminalOutputBodyEncoded = typeof CaseTerminalOutputBody.Encoded

export class CaseTerminalOutputV2 extends Schema.Class<CaseTerminalOutputV2>("CaseTerminalOutputV2")({
  resultSha256: Sha256Hex,
  ...CaseTerminalOutputBodyFields
}) {}

export class PassedCaseExecution extends Schema.TaggedClass<PassedCaseExecution>()("Passed", {
  processOutcome: ExitedProcessOutcome,
  invocationSha256: Sha256Hex,
  terminalOutput: CaseTerminalOutputV2
}) {}

export class FailedCaseExecution extends Schema.TaggedClass<FailedCaseExecution>()("Failed", {
  processOutcome: ProcessOutcome,
  invocationSha256: Schema.Union([Sha256Hex, Schema.Null]),
  terminalOutput: Schema.Union([CaseTerminalOutputV2, Schema.Null]),
  failureIds: Schema.NonEmptyArray(ArtifactId)
}) {}

export class NotRunCaseExecution extends Schema.TaggedClass<NotRunCaseExecution>()("NotRun", {
  failureIds: Schema.NonEmptyArray(ArtifactId)
}) {}

export const CaseExecutionDisposition = Schema.Union([
  PassedCaseExecution,
  FailedCaseExecution,
  NotRunCaseExecution
])
export type CaseExecutionDisposition = typeof CaseExecutionDisposition.Type

export class CaseReceipt extends Schema.Class<CaseReceipt>("CaseReceipt")({
  caseId: V2CaseId,
  definitionSha256: Sha256Hex,
  fixtureSha256: Sha256Hex,
  expectedEvidenceSha256: Sha256Hex,
  execution: CaseExecutionDisposition
}) {}

const ProbeTerminalOutputBodyFields = {
  beforeTreeSha256: Sha256Hex,
  afterTreeSha256: Sha256Hex,
  patchSha256: Sha256Hex,
  measurements: Schema.Array(ProbeMeasurementResult),
  laneDeltas: Schema.Array(SourceLaneDelta),
  touchedPathIds: Schema.Array(PlannedRepositoryPath),
  touchedModuleIds: Schema.Array(CanonicalNonEmptyText),
  touchedPackageIds: Schema.Array(CanonicalNonEmptyText),
  touchedConceptIds: Schema.Array(CanonicalNonEmptyText),
  touchedCentralBranchIds: Schema.Array(CanonicalNonEmptyText),
  touchedOwnerRoleIds: Schema.Array(RoleId),
  publicSurfaceDelta: IdentifierSetDelta,
  durableFormatDelta: IdentifierSetDelta,
  dependencyDagDelta: IdentifierSetDelta,
  zeroTouchRoleIds: Schema.Array(RoleId),
  changeKinds: Schema.Array(ChangeKind),
  observationCount: Schema.Literal(1)
} as const

export const ProbeTerminalOutputBody = Schema.Struct(ProbeTerminalOutputBodyFields)
export type ProbeTerminalOutputBody = typeof ProbeTerminalOutputBody.Type
export type ProbeTerminalOutputBodyEncoded = typeof ProbeTerminalOutputBody.Encoded
const {
  measurements: _probeMeasurementsField,
  ...ProbeMeasurementEvidenceContextFields
} = ProbeTerminalOutputBodyFields
export const ProbeMeasurementEvidenceContext = Schema.Struct(
  ProbeMeasurementEvidenceContextFields
)
export type ProbeMeasurementEvidenceContext = typeof ProbeMeasurementEvidenceContext.Type
export type ProbeMeasurementEvidenceContextEncoded =
  typeof ProbeMeasurementEvidenceContext.Encoded

export class ProbeTerminalOutputV2 extends Schema.Class<ProbeTerminalOutputV2>(
  "ProbeTerminalOutputV2"
)({
  resultSha256: Sha256Hex,
  ...ProbeTerminalOutputBodyFields
}) {}

export class PassedProbeExecution extends Schema.TaggedClass<PassedProbeExecution>()("Passed", {
  processOutcome: ExitedProcessOutcome,
  invocationSha256: Sha256Hex,
  terminalOutput: ProbeTerminalOutputV2
}) {}

export class FailedProbeExecution extends Schema.TaggedClass<FailedProbeExecution>()("Failed", {
  processOutcome: ProcessOutcome,
  invocationSha256: Schema.Union([Sha256Hex, Schema.Null]),
  terminalOutput: Schema.Union([ProbeTerminalOutputV2, Schema.Null]),
  failureIds: Schema.NonEmptyArray(ArtifactId)
}) {}

export class NotRunProbeExecution extends Schema.TaggedClass<NotRunProbeExecution>()("NotRun", {
  failureIds: Schema.NonEmptyArray(ArtifactId)
}) {}

export const ProbeExecutionDisposition = Schema.Union([
  PassedProbeExecution,
  FailedProbeExecution,
  NotRunProbeExecution
])
export type ProbeExecutionDisposition = typeof ProbeExecutionDisposition.Type

export class ProbeReceipt extends Schema.Class<ProbeReceipt>("ProbeReceipt")({
  probeId: V2ProbeId,
  definitionSha256: Sha256Hex,
  baseFixtureSha256: Sha256Hex,
  changeDefinitionSha256: Sha256Hex,
  execution: ProbeExecutionDisposition
}) {}

const GateTerminalOutputBodyFields = {
  facts: Schema.NonEmptyArray(EvidenceEntryV2)
} as const

export const GateTerminalOutputBody = Schema.Struct(GateTerminalOutputBodyFields)
export type GateTerminalOutputBody = typeof GateTerminalOutputBody.Type
export type GateTerminalOutputBodyEncoded = typeof GateTerminalOutputBody.Encoded

export class GateTerminalOutputV2 extends Schema.Class<GateTerminalOutputV2>("GateTerminalOutputV2")({
  resultSha256: Sha256Hex,
  ...GateTerminalOutputBodyFields
}) {}

export class PassedGateExecution extends Schema.TaggedClass<PassedGateExecution>()("Passed", {
  processOutcome: ExitedProcessOutcome,
  invocationSha256: Sha256Hex,
  terminalOutput: GateTerminalOutputV2
}) {}

export class FailedGateExecution extends Schema.TaggedClass<FailedGateExecution>()("Failed", {
  processOutcome: ProcessOutcome,
  invocationSha256: Schema.Union([Sha256Hex, Schema.Null]),
  terminalOutput: Schema.Union([GateTerminalOutputV2, Schema.Null]),
  failureIds: Schema.NonEmptyArray(ArtifactId)
}) {}

export class NotRunGateExecution extends Schema.TaggedClass<NotRunGateExecution>()("NotRun", {
  failureIds: Schema.NonEmptyArray(ArtifactId)
}) {}

export const GateExecutionDisposition = Schema.Union([
  PassedGateExecution,
  FailedGateExecution,
  NotRunGateExecution
])
export type GateExecutionDisposition = typeof GateExecutionDisposition.Type

export class GateReceipt extends Schema.Class<GateReceipt>("GateReceipt")({
  gateId: V2GateId,
  definitionSha256: Sha256Hex,
  command: Schema.NonEmptyArray(CanonicalNonEmptyText),
  caseIds: Schema.Array(V2CaseId),
  probeIds: Schema.Array(V2ProbeId),
  expectedExit: Natural,
  execution: GateExecutionDisposition
}) {}

export const ObjectiveMetricEvidenceContext = Schema.Struct({
  runContextSha256: Sha256Hex,
  preflightFailures: Schema.Array(ArtifactId),
  caseReceipts: Schema.Array(CaseReceipt),
  probeReceipts: Schema.Array(ProbeReceipt),
  gateReceipts: Schema.Array(GateReceipt)
})
export type ObjectiveMetricEvidenceContext = typeof ObjectiveMetricEvidenceContext.Type
export type ObjectiveMetricEvidenceContextEncoded = typeof ObjectiveMetricEvidenceContext.Encoded

export class MeasuredObjectiveMetric extends Schema.TaggedClass<MeasuredObjectiveMetric>()("Measured", {
  id: MetricId,
  value: Natural,
  evidenceSha256: Sha256Hex
}) {}

export class UnavailableObjectiveMetric extends Schema.TaggedClass<UnavailableObjectiveMetric>()(
  "Unavailable",
  { id: MetricId, failureId: ArtifactId }
) {}

export const ObjectiveMetric = Schema.Union([
  MeasuredObjectiveMetric,
  UnavailableObjectiveMetric
])
export type ObjectiveMetric = typeof ObjectiveMetric.Type

const SharedResultBodyFields = {
  programId: Schema.Literal("ts-release-architecture-program"),
  runContextSha256: Sha256Hex,
  runContext: TrialRunContextV2,
  preflightFailures: Schema.Array(ArtifactId),
  caseReceipts: Schema.Array(CaseReceipt),
  probeReceipts: Schema.Array(ProbeReceipt),
  gateReceipts: Schema.Array(GateReceipt),
  objectiveMetrics: Schema.Array(ObjectiveMetric),
  qualification: Qualification
} as const

const MachineTrialResultBodyFields = {
  schemaVersion: Schema.Literal("machine-trial-result-v2"),
  ...SharedResultBodyFields
} as const

const TopologyTrialResultBodyFields = {
  schemaVersion: Schema.Literal("topology-trial-result-v2"),
  ...SharedResultBodyFields
} as const

export const MachineTrialResultBody = Schema.Struct(MachineTrialResultBodyFields)
export type MachineTrialResultBody = typeof MachineTrialResultBody.Type
export type MachineTrialResultBodyEncoded = typeof MachineTrialResultBody.Encoded

export const TopologyTrialResultBody = Schema.Struct(TopologyTrialResultBodyFields)
export type TopologyTrialResultBody = typeof TopologyTrialResultBody.Type
export type TopologyTrialResultBodyEncoded = typeof TopologyTrialResultBody.Encoded

export class MachineTrialResultV2 extends Schema.Class<MachineTrialResultV2>("MachineTrialResultV2")({
  receiptId: Sha256Hex,
  ...MachineTrialResultBodyFields
}) {}

export class TopologyTrialResultV2 extends Schema.Class<TopologyTrialResultV2>(
  "TopologyTrialResultV2"
)({
  receiptId: Sha256Hex,
  ...TopologyTrialResultBodyFields
}) {}

export const ArchitectureTrialResultV2 = Schema.Union([
  MachineTrialResultV2,
  TopologyTrialResultV2
])
export type ArchitectureTrialResultV2 = typeof ArchitectureTrialResultV2.Type

export class TrialResultInvariantError extends Schema.TaggedError<TrialResultInvariantError>()(
  "TrialResultInvariantError",
  { issues: Schema.NonEmptyArray(Schema.String), message: Schema.String }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture trial result invariant failure: ${issues.join("; ")}`
    })
  }
}

export interface TrialResultValidationAuthority {
  readonly trialSpec: ArchitectureTrialSpecV2
  /** SHA-256 of the exact canonical trial-spec document bytes accepted by the runner. */
  readonly rawTrialSpecSha256: Sha256HexType
  readonly candidateManifest: ArchitectureCandidateManifestV2
  /** SHA-256 of the exact canonical candidate-manifest document bytes accepted by the runner. */
  readonly rawCandidateManifestSha256: Sha256HexType
  /** Hash of the runner-observed, manifest-complete candidate tree. */
  readonly candidateTreeSha256: Sha256HexType
  /** Hash of the exact runner source closure used for the trial. */
  readonly runnerSourceSha256: Sha256HexType
  /** Exact externally observed toolchain; receipt claims are not self-authoritative. */
  readonly toolchain: TrialRunContextToolchain
}

type ResultScope = "machine" | "topology"
type SharedResult = MachineTrialResultV2 | TopologyTrialResultV2
type SharedBody = MachineTrialResultBody | TopologyTrialResultBody

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeMachineBodyStructureSync = Schema.decodeUnknownSync(MachineTrialResultBody, strictOptions)
const decodeTopologyBodyStructureSync = Schema.decodeUnknownSync(TopologyTrialResultBody, strictOptions)
const encodeMachineBodyStructure = Schema.encodeUnknownSync(MachineTrialResultBody, strictOptions)
const encodeTopologyBodyStructure = Schema.encodeUnknownSync(TopologyTrialResultBody, strictOptions)
const decodeMachineResultStructure = Schema.decodeUnknownEffect(MachineTrialResultV2, strictOptions)
const decodeTopologyResultStructure = Schema.decodeUnknownEffect(TopologyTrialResultV2, strictOptions)
const encodeMachineResultStructure = Schema.encodeUnknownSync(MachineTrialResultV2, strictOptions)
const encodeTopologyResultStructure = Schema.encodeUnknownSync(TopologyTrialResultV2, strictOptions)
const decodeCaseTerminalBodyStructure = Schema.decodeUnknownSync(CaseTerminalOutputBody, strictOptions)
const encodeCaseTerminalBodyStructure = Schema.encodeUnknownSync(CaseTerminalOutputBody, strictOptions)
const decodeProbeTerminalBodyStructure = Schema.decodeUnknownSync(ProbeTerminalOutputBody, strictOptions)
const encodeProbeTerminalBodyStructure = Schema.encodeUnknownSync(ProbeTerminalOutputBody, strictOptions)
const decodeGateTerminalBodyStructure = Schema.decodeUnknownSync(GateTerminalOutputBody, strictOptions)
const encodeGateTerminalBodyStructure = Schema.encodeUnknownSync(GateTerminalOutputBody, strictOptions)
const decodeProbeMeasurementValueStructure = Schema.decodeUnknownSync(ProbeMeasurementValue, strictOptions)
const encodeProbeMeasurementValueStructure = Schema.encodeUnknownSync(ProbeMeasurementValue, strictOptions)
const decodeProbeMeasurementEvidenceContextStructure = Schema.decodeUnknownSync(
  ProbeMeasurementEvidenceContext,
  strictOptions
)
const encodeProbeMeasurementEvidenceContextStructure = Schema.encodeUnknownSync(
  ProbeMeasurementEvidenceContext,
  strictOptions
)
const decodeObjectiveMetricEvidenceContextStructure = Schema.decodeUnknownSync(
  ObjectiveMetricEvidenceContext,
  strictOptions
)
const encodeObjectiveMetricEvidenceContextStructure = Schema.encodeUnknownSync(
  ObjectiveMetricEvidenceContext,
  strictOptions
)

export const computeCaseTerminalResultSha256 = (
  input: CaseTerminalOutputBody | CaseTerminalOutputBodyEncoded
) => {
  const body = decodeCaseTerminalBodyStructure(input)
  return hashCanonicalValue(CASE_TERMINAL_RESULT_HASH_DOMAIN, encodeCaseTerminalBodyStructure(body))
}

export const computeProbeTerminalResultSha256 = (
  input: ProbeTerminalOutputBody | ProbeTerminalOutputBodyEncoded
) => {
  const body = decodeProbeTerminalBodyStructure(input)
  return hashCanonicalValue(PROBE_TERMINAL_RESULT_HASH_DOMAIN, encodeProbeTerminalBodyStructure(body))
}

export const computeGateTerminalResultSha256 = (
  input: GateTerminalOutputBody | GateTerminalOutputBodyEncoded
) => {
  const body = decodeGateTerminalBodyStructure(input)
  return hashCanonicalValue(GATE_TERMINAL_RESULT_HASH_DOMAIN, encodeGateTerminalBodyStructure(body))
}

export const computeProbeMeasurementEvidenceSha256 = (
  probeId: typeof V2ProbeId.Type,
  id: string,
  value: ProbeMeasurementValue | ProbeMeasurementValueEncoded,
  context: ProbeMeasurementEvidenceContext | ProbeMeasurementEvidenceContextEncoded
) => {
  const decodedValue = decodeProbeMeasurementValueStructure(value)
  const decodedContext = decodeProbeMeasurementEvidenceContextStructure(context)
  return hashCanonicalValue(PROBE_MEASUREMENT_EVIDENCE_HASH_DOMAIN, {
    probeId,
    id,
    value: encodeProbeMeasurementValueStructure(decodedValue),
    context: encodeProbeMeasurementEvidenceContextStructure(decodedContext)
  })
}

export const computeObjectiveMetricEvidenceSha256 = (
  context: ObjectiveMetricEvidenceContext | ObjectiveMetricEvidenceContextEncoded,
  id: string,
  value: number
) => {
  const decoded = decodeObjectiveMetricEvidenceContextStructure(context)
  const encoded = encodeObjectiveMetricEvidenceContextStructure(decoded)
  return hashCanonicalValue(OBJECTIVE_METRIC_EVIDENCE_HASH_DOMAIN, {
    runContextSha256: encoded.runContextSha256,
    id,
    value,
    preflightFailures: encoded.preflightFailures,
    caseReceipts: encoded.caseReceipts,
    probeReceipts: encoded.probeReceipts,
    gateReceipts: encoded.gateReceipts
  })
}

const canonicalIssues = (issues: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(issues)].sort(codePointCompare)

const exactOrderedIds = (
  label: string,
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>
): ReadonlyArray<string> => actual.length === expected.length &&
    actual.every((id, index) => id === expected[index])
  ? []
  : [`${label} must equal the exact ordered v2 ids [${expected.join(", ")}]`]

const sameOrdered = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const sameSet = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length &&
  [...left].sort(codePointCompare).every((value, index) =>
    value === [...right].sort(codePointCompare)[index])

const uniqueStringIssues = (label: string, values: ReadonlyArray<string>): ReadonlyArray<string> =>
  new Set(values).size === values.length ? [] : [`${label} must contain unique values`]

const sameValue = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right)

const checkFailureIds = (label: string, ids: ReadonlyArray<string>): ReadonlyArray<string> =>
  sortedUniqueStringIssues(`${label}.failureIds`, ids)

const deltaInvariantIssues = (label: string, delta: IdentifierSetDelta): ReadonlyArray<string> => {
  const issues = [
    ...sortedUniqueStringIssues(`${label}.addedIds`, delta.addedIds),
    ...sortedUniqueStringIssues(`${label}.removedIds`, delta.removedIds)
  ]
  const removed = new Set(delta.removedIds)
  if (delta.addedIds.some((id) => removed.has(id))) {
    issues.push(`${label} cannot add and remove the same id`)
  }
  return issues
}

const caseOutputInvariantIssues = (
  label: string,
  output: CaseTerminalOutputV2
): ReadonlyArray<string> => {
  const { resultSha256: _resultSha256, ...body } = output
  return [
    ...(output.resultSha256 === computeCaseTerminalResultSha256(body)
      ? []
      : [`${label}.resultSha256 must bind the canonical terminal result body`]),
    ...uniqueStringIssues(`${label}.requiredAssertionIds`, output.requiredAssertionIds),
    ...sortedUniqueStringIssues(`${label}.observedAssertionIds`, output.observedAssertionIds),
    ...sortedUniqueStringIssues(`${label}.executedAssertionIds`, output.executedAssertionIds),
    ...caseTraceInvariantIssues(`${label}.trace`, output.trace),
    ...evidenceEntriesInvariantIssues(`${label}.facts`, output.facts)
  ]
}

const measurementId = (measurement: ProbeMeasurementResult): string => measurement.id

const measuredById = (
  output: ProbeTerminalOutputV2,
  id: string
): MeasuredProbeMeasurement | undefined => {
  const measurement = output.measurements.find((candidate) => candidate.id === id)
  return measurement?._tag === "Measured" ? measurement : undefined
}

const measuredCount = (output: ProbeTerminalOutputV2, id: string): number | undefined => {
  const measurement = measuredById(output, id)
  return measurement?.value._tag === "Count" ? measurement.value.value : undefined
}

const sameDelta = (left: IdentifierSetDelta, right: IdentifierSetDelta): boolean =>
  sameOrdered(left.addedIds, right.addedIds) && sameOrdered(left.removedIds, right.removedIds)

const probeMeasurementEvidenceContext = (
  output: ProbeTerminalOutputV2
): ProbeMeasurementEvidenceContext => ({
  beforeTreeSha256: output.beforeTreeSha256,
  afterTreeSha256: output.afterTreeSha256,
  patchSha256: output.patchSha256,
  laneDeltas: output.laneDeltas,
  touchedPathIds: output.touchedPathIds,
  touchedModuleIds: output.touchedModuleIds,
  touchedPackageIds: output.touchedPackageIds,
  touchedConceptIds: output.touchedConceptIds,
  touchedCentralBranchIds: output.touchedCentralBranchIds,
  touchedOwnerRoleIds: output.touchedOwnerRoleIds,
  publicSurfaceDelta: output.publicSurfaceDelta,
  durableFormatDelta: output.durableFormatDelta,
  dependencyDagDelta: output.dependencyDagDelta,
  zeroTouchRoleIds: output.zeroTouchRoleIds,
  changeKinds: output.changeKinds,
  observationCount: output.observationCount
})

const probeOutputInvariantIssues = (
  label: string,
  probeId: typeof V2ProbeId.Type,
  output: ProbeTerminalOutputV2
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const { resultSha256: _resultSha256, ...body } = output
  if (output.resultSha256 !== computeProbeTerminalResultSha256(body)) {
    issues.push(`${label}.resultSha256 must bind the canonical terminal result body`)
  }
  issues.push(...exactOrderedIds(
    `${label}.measurements`,
    output.measurements.map(measurementId),
    REQUIRED_PROBE_MEASUREMENT_IDS
  ))
  const expectedTags = [
    "Hash", "Hash", "Hash",
    "Count", "Count", "Count", "Count", "Count", "Count", "Count",
    "IdentifierDelta", "IdentifierDelta", "IdentifierDelta"
  ] as const
  output.measurements.forEach((measurement, index) => {
    if (measurement._tag === "Measured" && measurement.value._tag !== expectedTags[index]) {
      issues.push(`${label}.measurements[${index}] has the wrong value tag for ${measurement.id}`)
    }
    if (measurement._tag === "Measured" && measurement.evidenceSha256 !==
      computeProbeMeasurementEvidenceSha256(
        probeId,
        measurement.id,
        measurement.value,
        probeMeasurementEvidenceContext(output)
      )) {
      issues.push(`${label}.measurements[${index}].evidenceSha256 does not bind runner evidence`)
    }
  })

  for (const [id, expected] of [
    ["before-tree-sha256", output.beforeTreeSha256],
    ["after-tree-sha256", output.afterTreeSha256],
    ["patch-sha256", output.patchSha256]
  ] as const) {
    const measured = measuredById(output, id)
    if (measured !== undefined && (measured.value._tag !== "Hash" || measured.value.value !== expected)) {
      issues.push(`${label}.${id} does not match its bound hash`)
    }
  }

  issues.push(...exactOrderedIds(
    `${label}.laneDeltas`,
    output.laneDeltas.map(({ laneId }) => laneId),
    REQUIRED_TRIAL_LANES.map(([laneId]) => laneId)
  ))
  const productLaneIds: ReadonlySet<string> = new Set(
    REQUIRED_TRIAL_LANES.filter(([, counts]) => counts).map(([laneId]) => laneId)
  )
  const productLanes = output.laneDeltas.filter(({ laneId }) => productLaneIds.has(laneId))
  const expectedCounts = new Map<string, number>([
    ["gross-product-additions", productLanes.reduce((total, lane) => total + lane.additions, 0)],
    ["gross-product-deletions", productLanes.reduce((total, lane) => total + lane.deletions, 0)],
    ["files-touched", output.touchedPathIds.length],
    ["modules-touched", output.touchedModuleIds.length],
    ["packages-touched", output.touchedPackageIds.length],
    ["concepts-touched", output.touchedConceptIds.length],
    ["central-branches-touched", output.touchedCentralBranchIds.length]
  ])
  for (const [id, expected] of expectedCounts) {
    const actual = measuredCount(output, id)
    if (actual !== undefined && actual !== expected) {
      issues.push(`${label}.${id} does not match its runner-observed source arithmetic`)
    }
  }

  for (const [id, delta] of [
    ["public-surface-delta", output.publicSurfaceDelta],
    ["durable-format-delta", output.durableFormatDelta],
    ["dependency-dag-delta", output.dependencyDagDelta]
  ] as const) {
    issues.push(...deltaInvariantIssues(`${label}.${id}`, delta))
    const measured = measuredById(output, id)
    if (measured !== undefined &&
      (measured.value._tag !== "IdentifierDelta" || !sameDelta(measured.value.value, delta))) {
      issues.push(`${label}.${id} does not match its bound identifier delta`)
    }
  }

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
    issues.push(...sortedUniqueStringIssues(`${label}.${setLabel}`, values))
  }
  const zeroTouch = new Set(output.zeroTouchRoleIds)
  if (output.touchedOwnerRoleIds.some((roleId) => zeroTouch.has(roleId))) {
    issues.push(`${label}.touchedOwnerRoleIds must be disjoint from zeroTouchRoleIds`)
  }
  return issues
}

const gateOutputInvariantIssues = (
  label: string,
  output: GateTerminalOutputV2
): ReadonlyArray<string> => {
  const { resultSha256: _resultSha256, ...body } = output
  return [
    ...(output.resultSha256 === computeGateTerminalResultSha256(body)
      ? []
      : [`${label}.resultSha256 must bind the canonical terminal result body`]),
    ...evidenceEntriesInvariantIssues(`${label}.facts`, output.facts)
  ]
}

const bodyScope = (body: SharedBody | SharedResult): ResultScope =>
  body.schemaVersion === "machine-trial-result-v2" ? "machine" : "topology"

export const trialResultBodyInvariantIssues = (body: SharedBody): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const scope = bodyScope(body)
  const expectedGateIds = scope === "machine" ? V2_MACHINE_GATE_IDS : V2_TOPOLOGY_GATE_IDS
  const expectedObjectiveIds = scope === "machine"
    ? REQUIRED_MACHINE_METRIC_IDS
    : REQUIRED_TOPOLOGY_METRIC_IDS

  issues.push(...trialRunContextInvariantIssues(body.runContext).map((issue) => `runContext: ${issue}`))
  if (body.runContextSha256 !== body.runContext.runContextSha256) {
    issues.push("runContextSha256 must equal the embedded self-hashed run context id")
  }
  if (body.runContext.candidateScope !== scope) {
    issues.push(`embedded run context scope must be ${scope}`)
  }
  issues.push(...sortedUniqueStringIssues("preflightFailures", body.preflightFailures))
  issues.push(...exactOrderedIds(
    "caseReceipts",
    body.caseReceipts.map(({ caseId }) => caseId),
    V2_CASE_IDS
  ))
  issues.push(...exactOrderedIds(
    "probeReceipts",
    body.probeReceipts.map(({ probeId }) => probeId),
    V2_PROBE_IDS
  ))
  issues.push(...exactOrderedIds(
    "gateReceipts",
    body.gateReceipts.map(({ gateId }) => gateId),
    expectedGateIds
  ))
  issues.push(...exactOrderedIds(
    "objectiveMetrics",
    body.objectiveMetrics.map(({ id }) => id),
    expectedObjectiveIds
  ))

  body.caseReceipts.forEach((receipt, index) => {
    const label = `case ${receipt.caseId}`
    const binding = body.runContext.caseDefinitionBindings[index]
    if (binding === undefined || receipt.caseId !== binding.caseId ||
      receipt.definitionSha256 !== binding.definitionSha256 ||
      receipt.fixtureSha256 !== binding.fixtureSha256 ||
      receipt.expectedEvidenceSha256 !== binding.expectedEvidenceSha256) {
      issues.push(`${label} must bind its exact run-context definition, fixture, and expected evidence`)
    }
    const execution = receipt.execution
    if (execution._tag === "Passed") {
      if (execution.processOutcome.exitCode !== 0) {
        issues.push(`${label} Passed requires an Exited process outcome with exit code 0`)
      }
      issues.push(...caseOutputInvariantIssues(`${label}.terminalOutput`, execution.terminalOutput))
      const output = execution.terminalOutput
      if (output.expectedOutcome !== output.actualOutcome ||
        !sameSet(output.requiredAssertionIds, output.observedAssertionIds) ||
        !sameSet(output.requiredAssertionIds, output.executedAssertionIds)) {
        issues.push(`${label} Passed requires expected=actual and required=observed=executed evidence`)
      }
    } else {
      issues.push(...checkFailureIds(label, execution.failureIds))
      if (execution._tag === "Failed" && execution.terminalOutput !== null) {
        issues.push(...caseOutputInvariantIssues(`${label}.terminalOutput`, execution.terminalOutput))
      }
    }
  })

  body.probeReceipts.forEach((receipt, index) => {
    const label = `probe ${receipt.probeId}`
    const binding = body.runContext.probeDefinitionBindings[index]
    if (binding === undefined || receipt.probeId !== binding.probeId ||
      receipt.definitionSha256 !== binding.definitionSha256 ||
      receipt.baseFixtureSha256 !== binding.baseFixtureSha256 ||
      receipt.changeDefinitionSha256 !== binding.changeDefinitionSha256) {
      issues.push(`${label} must bind its exact run-context definition, fixture, and change definition`)
    }
    const execution = receipt.execution
    if (execution._tag === "Passed") {
      if (execution.processOutcome.exitCode !== 0) {
        issues.push(`${label} Passed requires an Exited process outcome with exit code 0`)
      }
      const output = execution.terminalOutput
      issues.push(...probeOutputInvariantIssues(`${label}.terminalOutput`, receipt.probeId, output))
      if (output.measurements.some((measurement) => measurement._tag !== "Measured")) {
        issues.push(`${label} Passed requires every probe measurement to be Measured`)
      }
      if (output.beforeTreeSha256 !== body.runContext.candidateTreeSha256 ||
        output.beforeTreeSha256 === output.afterTreeSha256 ||
        measuredCount(output, "files-touched") === 0 ||
        (measuredCount(output, "gross-product-additions") ?? 0) +
          (measuredCount(output, "gross-product-deletions") ?? 0) === 0) {
        issues.push(`${label} Passed requires a nonzero runner-observed change from the context tree`)
      }
    } else {
      issues.push(...checkFailureIds(label, execution.failureIds))
      if (execution._tag === "Failed" && execution.terminalOutput !== null) {
        issues.push(...probeOutputInvariantIssues(
          `${label}.terminalOutput`,
          receipt.probeId,
          execution.terminalOutput
        ))
      }
    }
  })

  body.gateReceipts.forEach((receipt, index) => {
    const label = `gate ${receipt.gateId}`
    const binding = body.runContext.gateDefinitionBindings[index]
    if (binding === undefined || receipt.gateId !== binding.gateId ||
      receipt.definitionSha256 !== binding.definitionSha256) {
      issues.push(`${label} must bind its exact run-context definition`)
    }
    issues.push(...sortedUniqueStringIssues(`${label}.caseIds`, receipt.caseIds))
    issues.push(...sortedUniqueStringIssues(`${label}.probeIds`, receipt.probeIds))
    const execution = receipt.execution
    if (execution._tag === "Passed") {
      if (execution.processOutcome.exitCode !== receipt.expectedExit) {
        issues.push(`${label} Passed requires its actual exit to equal expectedExit`)
      }
      issues.push(...gateOutputInvariantIssues(`${label}.terminalOutput`, execution.terminalOutput))
    } else {
      issues.push(...checkFailureIds(label, execution.failureIds))
      if (execution._tag === "Failed" && execution.terminalOutput !== null) {
        issues.push(...gateOutputInvariantIssues(`${label}.terminalOutput`, execution.terminalOutput))
      }
    }
  })

  const objectiveEvidenceContext: ObjectiveMetricEvidenceContext = {
    runContextSha256: body.runContextSha256,
    preflightFailures: body.preflightFailures,
    caseReceipts: body.caseReceipts,
    probeReceipts: body.probeReceipts,
    gateReceipts: body.gateReceipts
  }
  body.objectiveMetrics.forEach((metric, index) => {
    if (metric._tag === "Measured" && metric.evidenceSha256 !==
      computeObjectiveMetricEvidenceSha256(objectiveEvidenceContext, metric.id, metric.value)) {
      issues.push(`objectiveMetrics[${index}].evidenceSha256 does not bind exact receipt evidence`)
    }
  })

  const unavailableProbeMeasurements = body.probeReceipts.flatMap(({ execution }) =>
    execution._tag !== "NotRun" && execution.terminalOutput !== null
      ? execution.terminalOutput.measurements.filter(({ _tag }) => _tag === "Unavailable")
      : [])
  const unavailableObjectives = body.objectiveMetrics.filter(({ _tag }) => _tag === "Unavailable")
  const everyExecutionPassed = [
    ...body.caseReceipts,
    ...body.probeReceipts,
    ...body.gateReceipts
  ].every(({ execution }) => execution._tag === "Passed")
  const qualifies = body.preflightFailures.length === 0 &&
    everyExecutionPassed &&
    unavailableProbeMeasurements.length === 0 &&
    unavailableObjectives.length === 0
  if ((body.qualification === "Passed") !== qualifies) {
    issues.push(
      "qualification must be Passed exactly when preflight is clean, every execution Passed, and every value is available"
    )
  }
  return canonicalIssues(issues)
}

const assertIssues = (issues: ReadonlyArray<string>): void => {
  if (issues.length > 0) throw new TrialResultInvariantError(issues as [string, ...Array<string>])
}

export const computeMachineTrialResultReceiptId = (
  input: MachineTrialResultBody | MachineTrialResultBodyEncoded
) => {
  const body = decodeMachineBodyStructureSync(input)
  assertIssues(trialResultBodyInvariantIssues(body))
  return hashCanonicalValue(TRIAL_RESULT_RECEIPT_HASH_DOMAIN, encodeMachineBodyStructure(body))
}

export const computeTopologyTrialResultReceiptId = (
  input: TopologyTrialResultBody | TopologyTrialResultBodyEncoded
) => {
  const body = decodeTopologyBodyStructureSync(input)
  assertIssues(trialResultBodyInvariantIssues(body))
  return hashCanonicalValue(TRIAL_RESULT_RECEIPT_HASH_DOMAIN, encodeTopologyBodyStructure(body))
}

const withoutReceiptId = <A extends { readonly receiptId: unknown }>(
  result: A
): Omit<A, "receiptId"> => {
  const { receiptId: _receiptId, ...body } = result
  return body
}

export const trialResultStructureInvariantIssues = (result: SharedResult): ReadonlyArray<string> => {
  const body = withoutReceiptId(result) as SharedBody
  const issues = [...trialResultBodyInvariantIssues(body)]
  const expected = result.schemaVersion === "machine-trial-result-v2"
    ? hashCanonicalValue(
        TRIAL_RESULT_RECEIPT_HASH_DOMAIN,
        encodeMachineBodyStructure(body as MachineTrialResultBody)
      )
    : hashCanonicalValue(
        TRIAL_RESULT_RECEIPT_HASH_DOMAIN,
        encodeTopologyBodyStructure(body as TopologyTrialResultBody)
      )
  if (result.receiptId !== expected) {
    issues.push("receiptId must bind the canonical encoded result body excluding receiptId")
  }
  return canonicalIssues(issues)
}

const contextualCaseIssues = (
  result: SharedResult,
  spec: ArchitectureTrialSpecV2
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  result.caseReceipts.forEach((receipt, index) => {
    const definition = spec.machineCases[index]
    const binding = result.runContext.caseDefinitionBindings[index]
    if (definition === undefined || binding === undefined ||
      definition.id !== receipt.caseId ||
      binding.definitionSha256 !== definition.execution.definitionSha256 ||
      binding.fixtureSha256 !== definition.execution.fixtureSha256 ||
      binding.expectedEvidenceSha256 !== definition.execution.expectedEvidenceSha256) {
      issues.push(`case ${receipt.caseId} run-context binding does not match the decoded trial spec`)
      return
    }
    const execution = receipt.execution
    const output = execution._tag === "NotRun" ? null : execution.terminalOutput
    if (output !== null) {
      if (output.expectedOutcome !== definition.requiredTerminalOutcome ||
        !sameOrdered(output.requiredAssertionIds, definition.requiredObservationIds)) {
        issues.push(`case ${receipt.caseId} terminal expectations do not match the decoded trial spec`)
      }
      if (execution._tag === "Passed" &&
        (!sameValue(output.trace, definition.expectedEvidence.trace) ||
          !sameValue(output.facts, definition.expectedEvidence.facts) ||
          output.actualOutcome !== definition.expectedEvidence.terminalOutcome)) {
        issues.push(`case ${receipt.caseId} Passed evidence does not match runner-owned expected evidence`)
      }
    }
  })
  return issues
}

const contextualProbeIssues = (
  result: SharedResult,
  spec: ArchitectureTrialSpecV2
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  result.probeReceipts.forEach((receipt, index) => {
    const definition = spec.marginalProbes[index]
    const binding = result.runContext.probeDefinitionBindings[index]
    if (definition === undefined || binding === undefined ||
      definition.id !== receipt.probeId ||
      binding.definitionSha256 !== definition.execution.definitionSha256 ||
      binding.baseFixtureSha256 !== definition.execution.baseFixtureSha256 ||
      binding.changeDefinitionSha256 !== definition.execution.changeDefinitionSha256) {
      issues.push(`probe ${receipt.probeId} run-context binding does not match the decoded trial spec`)
      return
    }
    const execution = receipt.execution
    const output = execution._tag === "NotRun" ? null : execution.terminalOutput
    if (output !== null && (
      !sameOrdered(output.zeroTouchRoleIds, definition.requiredZeroTouchRoleIds) ||
      !sameOrdered(output.changeKinds, definition.requiredChangeKinds) ||
      !sameOrdered(output.measurements.map(measurementId), definition.requiredMeasurementIds)
    )) {
      issues.push(`probe ${receipt.probeId} output does not match its decoded trial-spec contract`)
    }
  })
  return issues
}

const contextualGateIssues = (
  result: SharedResult,
  spec: ArchitectureTrialSpecV2
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const scope = bodyScope(result)
  const definitions = spec.gateRequirements.filter(({ scope: gateScope }) => gateScope === scope)
  result.gateReceipts.forEach((receipt, index) => {
    const definition = definitions[index]
    const binding = result.runContext.gateDefinitionBindings[index]
    if (definition === undefined || binding === undefined || definition.id !== receipt.gateId ||
      binding.definitionSha256 !== gateDefinitionSha256(definition)) {
      issues.push(`gate ${receipt.gateId} run-context binding does not match the decoded trial spec`)
      return
    }
    if (!sameOrdered(receipt.command, definition.command) ||
      !sameOrdered(receipt.caseIds, definition.caseIds) ||
      !sameOrdered(receipt.probeIds, definition.probeIds) ||
      receipt.expectedExit !== definition.expectedExit) {
      issues.push(`gate ${receipt.gateId} execution definition does not match the decoded trial spec`)
    }
  })
  return issues
}

export const trialResultContextInvariantIssues = (
  result: SharedResult,
  authority: TrialResultValidationAuthority
): ReadonlyArray<string> => {
  const issues: Array<string> = [
    ...trialResultStructureInvariantIssues(result),
    ...trialSpecInvariantIssues(authority.trialSpec).map((issue) => `trialSpec: ${issue}`),
    ...candidateManifestInvariantIssues(authority.candidateManifest).map((issue) =>
      `candidateManifest: ${issue}`)
  ]
  const context = result.runContext
  const manifest = authority.candidateManifest
  const scope = bodyScope(result)

  if (context.trialSpecSha256 !== authority.rawTrialSpecSha256) {
    issues.push("run context trialSpecSha256 does not match the exact raw trial-spec document hash")
  }
  if (context.candidateManifestSha256 !== authority.rawCandidateManifestSha256) {
    issues.push("run context candidateManifestSha256 does not match the exact raw manifest document hash")
  }
  if (context.candidateTreeSha256 !== authority.candidateTreeSha256) {
    issues.push("run context candidateTreeSha256 does not match the runner-observed tree hash")
  }
  if (context.runnerSourceSha256 !== authority.runnerSourceSha256) {
    issues.push("run context runnerSourceSha256 does not match the exact runner source hash")
  }
  if (!sameValue(context.toolchain, authority.toolchain)) {
    issues.push("run context toolchain does not match the exact externally observed toolchain")
  }
  if (context.executionContractSha256 !== authority.trialSpec.executionContract.contractSha256 ||
    context.measurementContractSha256 !== authority.trialSpec.measurementContract.contractSha256 ||
    context.topologyFixtureSha256 !== authority.trialSpec.topologyFixture.fixtureSha256) {
    issues.push("run context does not match the trial spec execution, measurement, and topology fixture hashes")
  }
  if (manifest.candidateId !== context.candidateId || manifest.scope !== context.candidateScope ||
    manifest.model !== context.candidateModel || manifest.implementationRoot !== context.implementationRoot) {
    issues.push("candidate manifest identity does not match the exact run-context candidate mapping")
  }
  const candidates = scope === "machine"
    ? authority.trialSpec.machineCandidates
    : authority.trialSpec.topologyCandidates
  const candidate = candidates.find(({ id }) => id === context.candidateId)
  if (candidate === undefined || candidate.model !== context.candidateModel ||
    candidate.implementationRoot !== context.implementationRoot) {
    issues.push("run-context candidate does not match its decoded trial-spec candidate definition")
  }
  issues.push(...contextualCaseIssues(result, authority.trialSpec))
  issues.push(...contextualProbeIssues(result, authority.trialSpec))
  issues.push(...contextualGateIssues(result, authority.trialSpec))
  return canonicalIssues(issues)
}

/** Strict structure and self-hash decoding only; this intentionally performs no external provenance checks. */
export const decodeMachineTrialResultStructure = Effect.fn("MachineTrialResultV2.decodeStructure")(
  function* (input: unknown) {
    const result = yield* decodeMachineResultStructure(input)
    const issues = trialResultStructureInvariantIssues(result)
    if (issues.length > 0) yield* new TrialResultInvariantError(issues as [string, ...Array<string>])
    return result
  }
)

/** Strict structure and self-hash decoding only; this intentionally performs no external provenance checks. */
export const decodeTopologyTrialResultStructure = Effect.fn("TopologyTrialResultV2.decodeStructure")(
  function* (input: unknown) {
    const result = yield* decodeTopologyResultStructure(input)
    const issues = trialResultStructureInvariantIssues(result)
    if (issues.length > 0) yield* new TrialResultInvariantError(issues as [string, ...Array<string>])
    return result
  }
)

export const decodeMachineTrialResult = Effect.fn("MachineTrialResultV2.decodeContextual")(
  function* (input: unknown, authority: TrialResultValidationAuthority) {
    const result = yield* decodeMachineTrialResultStructure(input)
    const issues = trialResultContextInvariantIssues(result, authority)
    if (issues.length > 0) yield* new TrialResultInvariantError(issues as [string, ...Array<string>])
    return result
  }
)

export const decodeTopologyTrialResult = Effect.fn("TopologyTrialResultV2.decodeContextual")(
  function* (input: unknown, authority: TrialResultValidationAuthority) {
    const result = yield* decodeTopologyTrialResultStructure(input)
    const issues = trialResultContextInvariantIssues(result, authority)
    if (issues.length > 0) yield* new TrialResultInvariantError(issues as [string, ...Array<string>])
    return result
  }
)

export const encodeMachineTrialResultStructure = (result: MachineTrialResultV2): unknown => {
  assertIssues(trialResultStructureInvariantIssues(result))
  return encodeMachineResultStructure(result)
}

export const encodeTopologyTrialResultStructure = (result: TopologyTrialResultV2): unknown => {
  assertIssues(trialResultStructureInvariantIssues(result))
  return encodeTopologyResultStructure(result)
}

export const encodeMachineTrialResult = (
  result: MachineTrialResultV2,
  authority: TrialResultValidationAuthority
): unknown => {
  assertIssues(trialResultContextInvariantIssues(result, authority))
  return encodeMachineResultStructure(result)
}

export const encodeTopologyTrialResult = (
  result: TopologyTrialResultV2,
  authority: TrialResultValidationAuthority
): unknown => {
  assertIssues(trialResultContextInvariantIssues(result, authority))
  return encodeTopologyResultStructure(result)
}

export const makeMachineTrialResultStructure = (
  input: MachineTrialResultBodyEncoded
): MachineTrialResultV2 => {
  const body = decodeMachineBodyStructureSync(input)
  assertIssues(trialResultBodyInvariantIssues(body))
  return new MachineTrialResultV2({
    receiptId: computeMachineTrialResultReceiptId(body),
    ...body
  })
}

export const makeTopologyTrialResultStructure = (
  input: TopologyTrialResultBodyEncoded
): TopologyTrialResultV2 => {
  const body = decodeTopologyBodyStructureSync(input)
  assertIssues(trialResultBodyInvariantIssues(body))
  return new TopologyTrialResultV2({
    receiptId: computeTopologyTrialResultReceiptId(body),
    ...body
  })
}

export const makeMachineTrialResult = (
  input: MachineTrialResultBodyEncoded,
  authority: TrialResultValidationAuthority
): MachineTrialResultV2 => {
  const result = makeMachineTrialResultStructure(input)
  assertIssues(trialResultContextInvariantIssues(result, authority))
  return result
}

export const makeTopologyTrialResult = (
  input: TopologyTrialResultBodyEncoded,
  authority: TrialResultValidationAuthority
): TopologyTrialResultV2 => {
  const result = makeTopologyTrialResultStructure(input)
  assertIssues(trialResultContextInvariantIssues(result, authority))
  return result
}
