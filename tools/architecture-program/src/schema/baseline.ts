import { Effect, Schema } from "effect"
import {
  Description,
  EvidenceId,
  ExistingRepositoryPath,
  GitRevision,
  MachineCandidateId,
  ProbeId,
  ProgramId,
  Sha256Hex,
  TopologyCandidateId
} from "./primitives.js"
import { SourceCoordinate } from "./source-coordinate.js"

const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0))

const stableId = Schema.NonEmptyString.check(
  Schema.isPattern(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u)
)

export const BaselineId = Schema.Literals([
  "pr21-research",
  "pr22-native-npm",
  "overlay-v1",
  "historical-plan184",
  "effect-build-dd39"
])
export type BaselineId = typeof BaselineId.Type

export const CandidateBaselineId = Schema.Union([
  MachineCandidateId,
  TopologyCandidateId
])
export type CandidateBaselineId = typeof CandidateBaselineId.Type

export const TreeId = Schema.NonEmptyString.check(
  Schema.isPattern(/^[0-9a-f]{40}$/u)
).pipe(Schema.brand("TreeId"))
export type TreeId = typeof TreeId.Type

const MethodId = stableId.pipe(Schema.brand("BaselineMethodId"))
const LaneId = stableId.pipe(Schema.brand("BaselineLaneId"))
const SubsystemId = stableId.pipe(Schema.brand("BaselineSubsystemId"))

const MetricUnit = Schema.Literals([
  "bytes",
  "files",
  "lines",
  "modules",
  "packages",
  "records",
  "states",
  "symbols"
])

export class MeasuredMetric extends Schema.TaggedClass<MeasuredMetric>()(
  "MeasuredMetric",
  {
    methodId: MethodId,
    sourceIds: Schema.NonEmptyArray(EvidenceId),
    unit: MetricUnit,
    value: NonNegativeInt
  }
) {}

export class AttestedMetric extends Schema.TaggedClass<AttestedMetric>()(
  "AttestedMetric",
  {
    attestation: Description,
    sourceIds: Schema.NonEmptyArray(EvidenceId),
    unit: MetricUnit,
    value: NonNegativeInt
  }
) {}

export class BlockedMetric extends Schema.TaggedClass<BlockedMetric>()(
  "BlockedMetric",
  {
    reason: Description,
    unblockCondition: Description
  }
) {}

export class PendingMetric extends Schema.TaggedClass<PendingMetric>()(
  "PendingMetric",
  {
    reason: Description,
    requiredBy: Schema.NonEmptyArray(ProgramId)
  }
) {}

export const Metric = Schema.Union([
  MeasuredMetric,
  AttestedMetric,
  BlockedMetric,
  PendingMetric
])
export type Metric = typeof Metric.Type

export class GitTreeEvidence extends Schema.TaggedClass<GitTreeEvidence>()(
  "GitTreeEvidence",
  {
    commit: GitRevision,
    description: Description,
    id: EvidenceId,
    repositoryId: ProgramId,
    tree: TreeId
  }
) {}

export class SourceFileEvidence extends Schema.TaggedClass<SourceFileEvidence>()(
  "SourceFileEvidence",
  {
    coordinate: SourceCoordinate,
    description: Description,
    id: EvidenceId
  }
) {}

export const BaselineEvidence = Schema.Union([GitTreeEvidence, SourceFileEvidence])
export type BaselineEvidence = typeof BaselineEvidence.Type

const LaneRule = Schema.Struct({
  id: LaneId,
  pathRule: Description,
  precedence: PositiveInt,
  role: Schema.Literals([
    "action-bundle",
    "action-source",
    "agents-source",
    "contract-generator",
    "fixture",
    "generated-contract",
    "generated-product-input",
    "plan",
    "product-source",
    "public-api-projection",
    "release-app-source",
    "test-oracle",
    "tooling",
    "type-test"
  ])
})

const BaselineClassifier = Schema.Struct({
  absentMetricPolicy: Schema.Literal("tagged-blocked-or-pending-never-zero"),
  fatalConditions: Schema.Array(stableId),
  generatedOutputPolicy: Schema.Literal("separate-lane-never-source"),
  laneRules: Schema.Array(LaneRule),
  overlapPolicy: Schema.Literal("fatal"),
  physicalLineDefinition: Schema.Literal("UTF-8 newline count in immutable Git blobs"),
  semanticPolicy: Schema.Literal("semantic-source/v3 only where hash-attested"),
  unclassifiedShippedSourcePolicy: Schema.Literal("fatal")
})

const RelatedCoordinate = Schema.Struct({
  commit: GitRevision,
  relation: Schema.Literals([
    "attestation-carrier",
    "direct-parent",
    "merge-parent",
    "readability-carrier"
  ]),
  tree: TreeId
})

const SourceLane = Schema.Struct({
  classifierRuleId: LaneId,
  fileCount: Metric,
  physicalLineCount: Metric
})

const SourceSummary = Schema.Struct({
  physicalProductInputLines: Metric,
  physicalProductTypeScriptLines: Metric,
  semanticOracleLines: Metric,
  semanticProductDataLines: Metric,
  semanticProductLines: Metric,
  semanticProductTypeScriptLines: Metric,
  trackedTreeBlobBytes: Metric,
  trackedTreeFileCount: Metric
})

const SubsystemMeasurement = Schema.Struct({
  fileCount: Metric,
  id: SubsystemId,
  physicalLineCount: Metric,
  scope: Schema.Literals(["host-app", "private-product", "product", "public-product"])
})

const TopModule = Schema.Struct({
  path: ExistingRepositoryPath,
  physicalLines: NonNegativeInt,
  rank: PositiveInt
})

const SourceInventory = Schema.Struct({
  lanes: Schema.Array(SourceLane),
  productInputLaneIds: Schema.Array(LaneId),
  productTypeScriptLaneIds: Schema.Array(LaneId),
  subsystems: Schema.Array(SubsystemMeasurement),
  summary: SourceSummary,
  topModules: Schema.Array(TopModule)
})

const BundleMeasurement = Schema.Struct({
  bytes: NonNegativeInt,
  path: ExistingRepositoryPath,
  physicalLines: NonNegativeInt,
  sha256: Sha256Hex,
  sourceId: EvidenceId,
  status: Schema.Literal("measured")
})

const PublicSurface = Schema.Struct({
  declarationDistinctNameCount: Metric,
  declarationExportEntryCount: Metric,
  declarationOnlyCommitmentCount: Metric,
  distFileCount: Metric,
  emittedDeclarationModuleCount: Metric,
  emittedJavaScriptModuleCount: Metric,
  importableModuleCount: Metric,
  packageExportEntrypointCount: Metric,
  packedArtifactCount: Metric,
  packedBytes: Metric,
  publicPackageCount: Metric,
  runtimeDistinctNameCount: Metric,
  runtimeExportEntryCount: Metric
})

const DurableSurface = Schema.Struct({
  definitionIdCount: Metric,
  escapedExternalPayloadStatus: Schema.Literals([
    "not-investigated",
    "not-proven-locally-external-unresolved",
    "not-relevant-historical"
  ]),
  externalStandardLiteralCount: Metric,
  hashDomainCount: Metric,
  internalVersionShapedLiteralCount: Metric,
  localPrototypePayloadCount: Metric,
  transportIdCount: Metric,
  versionShapedLiteralCount: Metric
})

const OperationalSurface = Schema.Struct({
  adapterFallbackErrorTranslationCount: Metric,
  appendSiteCount: Metric,
  branchPointCount: Metric,
  canonicalRepresentationCount: Metric,
  conceptCount: Metric,
  dependencyEdgeCount: Metric,
  dispatchSiteCount: Metric,
  durableFormatCount: Metric,
  evidenceCount: Metric,
  mutationSiteCount: Metric,
  orchestrationOwnerCount: Metric,
  positiveProofGatedOperationCount: Metric,
  providerOperationCount: Metric,
  representableInvalidStateCount: Metric,
  unresolvedPositiveProofItemCount: Metric,
  workflowVariantCount: Metric
})

export class CoordinateBaseline extends Schema.Class<CoordinateBaseline>(
  "CoordinateBaseline"
)({
  bundles: Schema.Array(BundleMeasurement),
  classification: Schema.Literals([
    "cross-repository-contract",
    "historical-comparator",
    "preserved-prototype",
    "prototype",
    "research-base"
  ]),
  commit: GitRevision,
  durableSurface: DurableSurface,
  id: BaselineId,
  operationalSurface: OperationalSurface,
  publicSurface: PublicSurface,
  readiness: Schema.Literal("partial-no-selection-authority"),
  relatedCoordinates: Schema.Array(RelatedCoordinate),
  repositoryId: ProgramId,
  sourceInventory: SourceInventory,
  tree: TreeId
}) {}

const GrossChange = Schema.Struct({
  additions: NonNegativeInt,
  deletions: NonNegativeInt,
  fromBaselineId: Schema.Literal("pr21-research"),
  laneId: LaneId,
  toBaselineId: Schema.Literal("pr22-native-npm"),
  unit: Schema.Literal("physical-lines")
})

const HistoricalFamily = Schema.Struct({
  familyId: stableId,
  grossAdditions: NonNegativeInt,
  grossDeletions: NonNegativeInt,
  maximumAdditions: NonNegativeInt,
  medianAdditions: NonNegativeInt,
  netLines: Schema.Int,
  observationCount: PositiveInt,
  p90Additions: NonNegativeInt,
  role: Schema.Literal("historical-comparator-not-trial-population")
})

export class PendingCandidateBaseline extends Schema.TaggedClass<PendingCandidateBaseline>()(
  "PendingCandidateBaseline",
  {
    candidateId: CandidateBaselineId,
    reason: Description,
    requiredEvidence: Schema.NonEmptyArray(stableId)
  }
) {}

const ComparisonPolicy = Schema.Struct({
  authoritativeProbeIds: Schema.Array(ProbeId),
  historicalFamilyIds: Schema.Array(stableId),
  historicalMedianMethod: Schema.Literal("middle-value-or-average-of-middle-pair"),
  historicalP90Method: Schema.Literal("nearest-rank"),
  preservedOverlayRole: Schema.Literal("source-compression-reference-not-landed-v1"),
  sourceCompressionReferenceId: Schema.Literal("overlay-v1"),
  trialPopulationRule: Schema.Literal("one-nonzero-observation-per-nine-predeclared-probes")
})

export class ArchitectureBaselineV1 extends Schema.Class<ArchitectureBaselineV1>(
  "ArchitectureBaselineV1"
)({
  baselines: Schema.Array(CoordinateBaseline),
  candidateBaselines: Schema.Array(PendingCandidateBaseline),
  classifier: BaselineClassifier,
  comparisonPolicy: ComparisonPolicy,
  evidenceSources: Schema.Array(BaselineEvidence),
  historicalMaintenanceFamilies: Schema.Array(HistoricalFamily),
  pr21ToPr22GrossChange: Schema.Array(GrossChange),
  programId: ProgramId,
  schemaVersion: Schema.Literal("ts-release/architecture-baseline/v1"),
  terminalEffectBuildCoordinateStatus: PendingMetric
}) {}

export const REQUIRED_BASELINE_IDS = [
  "pr21-research",
  "pr22-native-npm",
  "overlay-v1",
  "historical-plan184",
  "effect-build-dd39"
] as const

export const REQUIRED_CANDIDATE_BASELINE_IDS = [
  "M1-extracted-fold",
  "M2-total-transition",
  "T1-root",
  "T2-kernel-provider-bundle",
  "T3-provider-verticals"
] as const

export const REQUIRED_BASELINE_PROBE_IDS = [
  "P01-second-provider-instance",
  "P02-packed-external-provider",
  "P03-new-first-party-provider",
  "P04-new-commitment-mechanism",
  "P05-existing-provider-operation",
  "P06-journal-store-backend",
  "P07-file-tree-producer-adapter",
  "P08-deliberate-public-export",
  "P09-difficult-recovery-transition"
] as const

export const REQUIRED_HISTORICAL_FAMILY_IDS = [
  "announce",
  "changelog",
  "distributed",
  "packages",
  "providers",
  "shared",
  "supply-chain"
] as const

const REQUIRED_FATAL_CONDITIONS = [
  "bundle-counted-as-source",
  "candidate-measurement-presented-as-baseline",
  "fixture-counted-as-product-or-oracle",
  "generated-output-counted-as-source",
  "historical-family-substituted-for-trial-probe",
  "missing-measurement-encoded-as-zero",
  "multiply-classified-path",
  "physical-count-labeled-semantic",
  "semantic-count-labeled-physical",
  "test-or-tooling-counted-as-product",
  "unclassified-shipped-source"
] as const

const REQUIRED_LANE_RULE_IDS = [
  "action-bundles",
  "fixtures",
  "tests-oracles",
  "action-source",
  "release-app-source",
  "agents-source",
  "product-root-source",
  "generated-product-inputs",
  "tooling-typescript",
  "plans-text",
  "effect-tests",
  "effect-type-tests",
  "effect-production-source",
  "effect-contract-generator",
  "effect-generated-contract",
  "effect-public-api-projection",
  "effect-bundles",
  "effect-plans"
] as const

const REQUIRED_IDENTITIES: Readonly<Record<BaselineId, {
  readonly classification: CoordinateBaseline["classification"]
  readonly commit: string
  readonly repositoryId: string
  readonly tree: string
}>> = {
  "pr21-research": {
    classification: "research-base",
    commit: "887a9fe2b35590f3088ffeee84f32722796e03ab",
    repositoryId: "ts-release",
    tree: "68b86fa8811dc58c620b2017a2c4a1c794e7acf2"
  },
  "pr22-native-npm": {
    classification: "prototype",
    commit: "c2ac4ee4e7f02d74a7a1ff435bdfeaca6890b720",
    repositoryId: "ts-release",
    tree: "9f830f893f1dea7ae00675ef3d801848579f7d55"
  },
  "overlay-v1": {
    classification: "preserved-prototype",
    commit: "2ef7a9a61fe40608d053569cbcd71e40fca5c181",
    repositoryId: "ts-release",
    tree: "4e71a43c14f2dc980fadae024020d294270e6565"
  },
  "historical-plan184": {
    classification: "historical-comparator",
    commit: "86d30feba02c904e196288c3e3bd1316ee9050af",
    repositoryId: "ts-release",
    tree: "4946aa59f73b55935d62ab2a33f80290e0b45ba8"
  },
  "effect-build-dd39": {
    classification: "cross-repository-contract",
    commit: "dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc",
    repositoryId: "effect-build",
    tree: "29cdac9bf9621aa3df12757e2720c093b17d742e"
  }
}

const REQUIRED_LANE_MEASUREMENTS: Readonly<Record<BaselineId, ReadonlyArray<readonly [string, number, number]>>> = {
  "pr21-research": [
    ["product-root-source", 78, 15_961],
    ["release-app-source", 4, 607],
    ["agents-source", 3, 348],
    ["action-source", 8, 1_136],
    ["generated-product-inputs", 11, 568],
    ["tests-oracles", 82, 16_714],
    ["fixtures", 19, 1_172],
    ["tooling-typescript", 46, 6_831],
    ["plans-text", 68, 7_709],
    ["action-bundles", 3, 588]
  ],
  "pr22-native-npm": [
    ["product-root-source", 86, 19_161],
    ["release-app-source", 4, 607],
    ["agents-source", 3, 348],
    ["action-source", 8, 1_136],
    ["generated-product-inputs", 11, 568],
    ["tests-oracles", 85, 18_258],
    ["fixtures", 22, 1_190],
    ["tooling-typescript", 46, 6_862],
    ["plans-text", 68, 7_709],
    ["action-bundles", 3, 588]
  ],
  "overlay-v1": [
    ["product-root-source", 58, 22_560],
    ["release-app-source", 0, 0],
    ["agents-source", 0, 0],
    ["action-source", 2, 356],
    ["generated-product-inputs", 1, 55],
    ["tests-oracles", 40, 12_274],
    ["fixtures", 10, 1_477],
    ["tooling-typescript", 13, 1_800],
    ["plans-text", 68, 7_727],
    ["action-bundles", 1, 61]
  ],
  "historical-plan184": [
    ["product-root-source", 73, 5_490],
    ["release-app-source", 3, 236],
    ["agents-source", 0, 0],
    ["action-source", 2, 184],
    ["generated-product-inputs", 12, 138],
    ["tests-oracles", 77, 4_914],
    ["fixtures", 18, 611],
    ["tooling-typescript", 38, 6_390],
    ["plans-text", 61, 24_617],
    ["action-bundles", 1, 29_061]
  ],
  "effect-build-dd39": [
    ["effect-production-source", 119, 15_777],
    ["effect-tests", 68, 10_694],
    ["effect-type-tests", 16, 942],
    ["effect-contract-generator", 5, 1_722],
    ["effect-generated-contract", 1, 4_977],
    ["effect-public-api-projection", 1, 1_055],
    ["effect-bundles", 0, 0],
    ["effect-plans", -1, -1]
  ]
}

const REQUIRED_GROSS_CHANGES = [
  ["action-bundles", 1, 1],
  ["fixtures", 18, 0],
  ["product-root-source", 3_205, 5],
  ["tests-oracles", 1_544, 0],
  ["tooling-typescript", 34, 3]
] as const

const REQUIRED_HISTORICAL_STATS = [
  ["announce", 3, 96, 0, 96, 28, 59, 59],
  ["changelog", 3, 87, 0, 87, 22, 47, 47],
  ["distributed", 8, 430, 80, 350, 52, 106, 106],
  ["packages", 10, 402, 0, 402, 27, 59, 114],
  ["providers", 5, 189, 1, 188, 30, 60, 60],
  ["shared", 6, 124, 8, 116, 21, 35, 35],
  ["supply-chain", 8, 313, 1, 312, 30, 59, 59]
] as const

const REQUIRED_EVIDENCE_SOURCE_IDS = [
  "evidence.effect-build-contract",
  "evidence.effect-build-dd39-tree",
  "evidence.effect-build-public-api",
  "evidence.overlay-manifest",
  "evidence.overlay-tree",
  "evidence.plan184-implementation-tree",
  "evidence.plan184-report",
  "evidence.plan184-source-budget",
  "evidence.pr21-tree",
  "evidence.pr22-tree"
] as const

const REQUIRED_EVIDENCE_COORDINATES: Readonly<Record<string, ReadonlyArray<string>>> = {
  "evidence.effect-build-contract": ["file", "effect-build", "dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc", "tooling/effect-build-contract.json", "6c9422466d7e449d8d4ce7cd0fdf38cb869456993bd00bbe7eb9b685cdc11d53"],
  "evidence.effect-build-dd39-tree": ["tree", "effect-build", "dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc", "29cdac9bf9621aa3df12757e2720c093b17d742e"],
  "evidence.effect-build-public-api": ["file", "effect-build", "dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc", "tooling/public-api.json", "6bbbdcb00e75cd1f104aa658f4ddfe781719016a7568c7a59006ff435f52fac3"],
  "evidence.overlay-manifest": ["file", "ts-release", "WORKTREE", "advisor-plans/evidence/v1-reference-manifest.json", "87e7271f668c4ba821b7935b0082d9b9b7987f6ee29a9a5639557983aa4941ea"],
  "evidence.overlay-tree": ["tree", "ts-release", "2ef7a9a61fe40608d053569cbcd71e40fca5c181", "4e71a43c14f2dc980fadae024020d294270e6565"],
  "evidence.plan184-implementation-tree": ["tree", "ts-release", "86d30feba02c904e196288c3e3bd1316ee9050af", "4946aa59f73b55935d62ab2a33f80290e0b45ba8"],
  "evidence.plan184-report": ["file", "ts-release", "5ee1be5e26ae2145c8e0f28a5ca73ddb7c6b8d6b", "contracts/rewrite/reports/plan-184.json", "06a5520cb3572a990ca2f7caa36206cf3eecec0abcb6eb1628bdc39ce2487ea0"],
  "evidence.plan184-source-budget": ["file", "ts-release", "5ee1be5e26ae2145c8e0f28a5ca73ddb7c6b8d6b", "contracts/rewrite/source-budget.json", "05e9fe4d4d41d999ca2d99ff5a9e8f31de0ff4173887876c2a5ab6b35b435bd2"],
  "evidence.pr21-tree": ["tree", "ts-release", "887a9fe2b35590f3088ffeee84f32722796e03ab", "68b86fa8811dc58c620b2017a2c4a1c794e7acf2"],
  "evidence.pr22-tree": ["tree", "ts-release", "c2ac4ee4e7f02d74a7a1ff435bdfeaca6890b720", "9f830f893f1dea7ae00675ef3d801848579f7d55"]
}

const REQUIRED_RELATED_COORDINATES: Readonly<Record<BaselineId, ReadonlyArray<ReadonlyArray<string>>>> = {
  "pr21-research": [],
  "pr22-native-npm": [["direct-parent", "887a9fe2b35590f3088ffeee84f32722796e03ab", "68b86fa8811dc58c620b2017a2c4a1c794e7acf2"]],
  "overlay-v1": [["direct-parent", "1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3", "cc0c3a2c02aaf554b4f22340487c939d6a13f84e"]],
  "historical-plan184": [
    ["attestation-carrier", "5ee1be5e26ae2145c8e0f28a5ca73ddb7c6b8d6b", "85abed2ab41a6c2a822b1185aa2bc9851cf10221"],
    ["readability-carrier", "7690da13fc8c41f6fa6bb25442b60221e5a50f91", "bfe9182e8a18ed1811946ff8d23ea0a18f2d97f3"]
  ],
  "effect-build-dd39": [
    ["merge-parent", "4ad34423d84d17c959ace0d55af8623f336a68be", "b2a0d33e1e046aaf8f2e24f0d0a802877693a82f"],
    ["merge-parent", "e4511f12f2afdab0090de73fd6bf4d1f226b4d88", "29cdac9bf9621aa3df12757e2720c093b17d742e"]
  ]
}

const REQUIRED_BUNDLES: Readonly<Record<BaselineId, ReadonlyArray<ReadonlyArray<string | number>>>> = {
  "pr21-research": [
    ["apps/ts-release-action/dist/artifact-bridge.cjs", 199, 2_101_737, "216e5663206123a963ea893366a6b4c34137f3c1961521a2c1324794fb5e76e3"],
    ["apps/ts-release-action/dist/index.js", 388, 2_581_662, "e35c275246c892c93e5483785b99b1344f0d7127bd4d48c7af76527fedd04165"],
    ["apps/ts-release-action/dist/launcher.cjs", 1, 1_504, "64509e9311a6329d0b96b2387e56d5615cb193f463b1b23f60bac93bbf92c7b3"]
  ],
  "pr22-native-npm": [
    ["apps/ts-release-action/dist/artifact-bridge.cjs", 199, 2_101_737, "216e5663206123a963ea893366a6b4c34137f3c1961521a2c1324794fb5e76e3"],
    ["apps/ts-release-action/dist/index.js", 388, 2_581_690, "91a2edcafc6ddfa4325611db696ac669aaee2cede31841ac8896aa4298556f58"],
    ["apps/ts-release-action/dist/launcher.cjs", 1, 1_504, "64509e9311a6329d0b96b2387e56d5615cb193f463b1b23f60bac93bbf92c7b3"]
  ],
  "overlay-v1": [["apps/ts-release-action/dist/index.cjs", 61, 199_255, "13dc18d78b5833f2ca2198bff6847d766300809bbca4f617572d1762a7f17113"]],
  "historical-plan184": [["apps/ts-release-action/dist/index.js", 29_061, 1_116_532, "d261db582cb9bd998426257806ce57a880987a522628e1420309be51578d6f56"]],
  "effect-build-dd39": []
}

const exactOrdered = (
  label: string,
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
  issues: Array<string>
): void => {
  const duplicates = actual.filter((value, index) => actual.indexOf(value) !== index)
  if (duplicates.length > 0) {
    issues.push(`${label} contains duplicates: ${[...new Set(duplicates)].join(", ")}`)
  }
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    issues.push(`${label} must equal [${expected.join(", ")}]`)
  }
}

const numericMetricValue = (metric: Metric): number | undefined =>
  metric._tag === "MeasuredMetric" || metric._tag === "AttestedMetric" ? metric.value : undefined

const validateMetric = (
  label: string,
  metric: Metric,
  evidenceIds: ReadonlySet<string>,
  issues: Array<string>
): void => {
  if (metric._tag !== "MeasuredMetric" && metric._tag !== "AttestedMetric") return
  const duplicateSources = metric.sourceIds.filter((id, index) => metric.sourceIds.indexOf(id) !== index)
  if (duplicateSources.length > 0) issues.push(`${label} contains duplicate evidence references`)
  for (const sourceId of metric.sourceIds) {
    if (!evidenceIds.has(sourceId)) issues.push(`${label} references missing evidence ${sourceId}`)
  }
}

const requireNumericMetric = (
  label: string,
  metric: Metric,
  expectedTag: "AttestedMetric" | "MeasuredMetric",
  expectedValue: number,
  expectedUnit: MeasuredMetric["unit"],
  expectedSourceIds: ReadonlyArray<string>,
  issues: Array<string>
): void => {
  if (metric._tag !== expectedTag || metric.value !== expectedValue || metric.unit !== expectedUnit ||
    JSON.stringify(metric.sourceIds) !== JSON.stringify(expectedSourceIds)) {
    issues.push(`${label} must remain the exact ${expectedTag} ${expectedValue} ${expectedUnit} measurement`)
  }
}

const evidenceCoordinateTuple = (evidence: BaselineEvidence): ReadonlyArray<string> => {
  if (evidence._tag === "GitTreeEvidence") {
    return ["tree", evidence.repositoryId, evidence.commit, evidence.tree]
  }
  const coordinate = evidence.coordinate
  return [
    "file",
    coordinate.repositoryId,
    "gitRevision" in coordinate ? coordinate.gitRevision : "WORKTREE",
    coordinate.path,
    coordinate.sha256
  ]
}

const allMetrics = (baseline: CoordinateBaseline): ReadonlyArray<readonly [string, Metric]> => [
  ...baseline.sourceInventory.lanes.flatMap((lane) => [
    [`lane ${lane.classifierRuleId} files`, lane.fileCount] as const,
    [`lane ${lane.classifierRuleId} lines`, lane.physicalLineCount] as const
  ]),
  ...baseline.sourceInventory.subsystems.flatMap((subsystem) => [
    [`subsystem ${subsystem.id} files`, subsystem.fileCount] as const,
    [`subsystem ${subsystem.id} lines`, subsystem.physicalLineCount] as const
  ]),
  ...Object.entries(baseline.sourceInventory.summary).map(([id, metric]) => [`summary ${id}`, metric] as const),
  ...Object.entries(baseline.publicSurface).map(([id, metric]) => [`public ${id}`, metric] as const),
  ...Object.entries(baseline.durableSurface)
    .filter((entry): entry is [string, Metric] => entry[0] !== "escapedExternalPayloadStatus")
    .map(([id, metric]) => [`durable ${id}`, metric] as const),
  ...Object.entries(baseline.operationalSurface).map(([id, metric]) => [`operational ${id}`, metric] as const)
]

export const architectureBaselineInvariantIssues = (
  document: ArchitectureBaselineV1
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  if (document.programId !== "ts-release-architecture-program") {
    issues.push("programId must remain ts-release-architecture-program")
  }

  exactOrdered(
    "baseline ids",
    document.baselines.map(({ id }) => id),
    REQUIRED_BASELINE_IDS,
    issues
  )
  exactOrdered(
    "candidate baseline ids",
    document.candidateBaselines.map(({ candidateId }) => candidateId),
    REQUIRED_CANDIDATE_BASELINE_IDS,
    issues
  )
  exactOrdered(
    "authoritative probe ids",
    document.comparisonPolicy.authoritativeProbeIds,
    REQUIRED_BASELINE_PROBE_IDS,
    issues
  )
  exactOrdered(
    "historical family ids",
    document.comparisonPolicy.historicalFamilyIds,
    REQUIRED_HISTORICAL_FAMILY_IDS,
    issues
  )
  exactOrdered(
    "historical maintenance families",
    document.historicalMaintenanceFamilies.map(({ familyId }) => familyId),
    REQUIRED_HISTORICAL_FAMILY_IDS,
    issues
  )
  exactOrdered("fatal conditions", document.classifier.fatalConditions, REQUIRED_FATAL_CONDITIONS, issues)
  exactOrdered(
    "classifier lane rules",
    document.classifier.laneRules.map(({ id }) => id),
    REQUIRED_LANE_RULE_IDS,
    issues
  )
  document.classifier.laneRules.forEach((rule, index) => {
    if (rule.precedence !== index + 1) issues.push(`lane rule ${rule.id} has non-canonical precedence`)
  })

  const evidenceIds = document.evidenceSources.map(({ id }) => id)
  exactOrdered("evidence source ids", evidenceIds, REQUIRED_EVIDENCE_SOURCE_IDS, issues)
  const evidenceSet = new Set<string>(evidenceIds)
  for (const evidence of document.evidenceSources) {
    const expected = REQUIRED_EVIDENCE_COORDINATES[evidence.id]
    if (expected === undefined ||
      JSON.stringify(evidenceCoordinateTuple(evidence)) !== JSON.stringify(expected)) {
      issues.push(`evidence ${evidence.id} changed its immutable repository coordinate`)
    }
  }

  for (const baseline of document.baselines) {
    const expectedIdentity = REQUIRED_IDENTITIES[baseline.id]
    if (baseline.commit !== expectedIdentity.commit ||
      baseline.tree !== expectedIdentity.tree ||
      baseline.repositoryId !== expectedIdentity.repositoryId ||
      baseline.classification !== expectedIdentity.classification) {
      issues.push(`baseline ${baseline.id} changed its immutable coordinate or role`)
    }
    const related = baseline.relatedCoordinates.map(({ relation, commit, tree }) => [relation, commit, tree])
    if (JSON.stringify(related) !== JSON.stringify(REQUIRED_RELATED_COORDINATES[baseline.id])) {
      issues.push(`baseline ${baseline.id} changed its parent or carrier coordinates`)
    }

    const expectedLanes = REQUIRED_LANE_MEASUREMENTS[baseline.id]
    exactOrdered(
      `baseline ${baseline.id} lane ids`,
      baseline.sourceInventory.lanes.map(({ classifierRuleId }) => classifierRuleId),
      expectedLanes.map(([id]) => id),
      issues
    )
    baseline.sourceInventory.lanes.forEach((lane, index) => {
      const expected = expectedLanes[index]
      if (expected === undefined) return
      const [, expectedFiles, expectedLines] = expected
      const files = numericMetricValue(lane.fileCount)
      const lines = numericMetricValue(lane.physicalLineCount)
      if (expectedFiles === -1) {
        if (files !== undefined || lines !== undefined) {
          issues.push(`baseline ${baseline.id} lane ${lane.classifierRuleId} must remain explicitly pending`)
        }
      } else if (files !== expectedFiles || lines !== expectedLines ||
        lane.fileCount._tag !== "MeasuredMetric" || lane.physicalLineCount._tag !== "MeasuredMetric") {
        issues.push(`baseline ${baseline.id} lane ${lane.classifierRuleId} changed its measured files/lines`)
      }
    })

    const laneFileCount = (laneId: string): number => {
      const lane = baseline.sourceInventory.lanes.find((candidate) => candidate.classifierRuleId === laneId)
      if (lane === undefined) {
        issues.push(`baseline ${baseline.id} is missing lane ${laneId}`)
        return 0
      }
      return numericMetricValue(lane.fileCount) ?? 0
    }
    const laneLineCount = (laneId: string): number => {
      const lane = baseline.sourceInventory.lanes.find((candidate) => candidate.classifierRuleId === laneId)
      if (lane === undefined) {
        issues.push(`baseline ${baseline.id} is missing lane ${laneId}`)
        return 0
      }
      return numericMetricValue(lane.physicalLineCount) ?? 0
    }

    const subsystemIds = baseline.sourceInventory.subsystems.map(({ id }) => id)
    if (new Set(subsystemIds).size !== subsystemIds.length) {
      issues.push(`baseline ${baseline.id} contains duplicate subsystem ids`)
    }
    const subsystemFiles = baseline.sourceInventory.subsystems
      .map(({ fileCount }) => numericMetricValue(fileCount))
    const subsystemLines = baseline.sourceInventory.subsystems
      .map(({ physicalLineCount }) => numericMetricValue(physicalLineCount))
    if (subsystemFiles.some((value) => value === undefined) || subsystemLines.some((value) => value === undefined)) {
      issues.push(`baseline ${baseline.id} subsystem inventory must be measured or attested`)
    } else {
      const expectedProductFiles = baseline.sourceInventory.productTypeScriptLaneIds.reduce(
        (total, laneId) => total + laneFileCount(laneId),
        0
      )
      const expectedProductLines = baseline.sourceInventory.productTypeScriptLaneIds.reduce(
        (total, laneId) => total + laneLineCount(laneId),
        0
      )
      if (subsystemFiles.reduce<number>((total, value) => total + (value ?? 0), 0) !== expectedProductFiles ||
        subsystemLines.reduce<number>((total, value) => total + (value ?? 0), 0) !== expectedProductLines) {
        issues.push(`baseline ${baseline.id} subsystem inventory does not sum to product TypeScript lanes`)
      }
    }

    exactOrdered(
      `baseline ${baseline.id} product input lanes`,
      baseline.sourceInventory.productInputLaneIds,
      baseline.id === "effect-build-dd39"
        ? ["effect-production-source"]
        : ["product-root-source", "release-app-source", "agents-source", "action-source", "generated-product-inputs"],
      issues
    )
    exactOrdered(
      `baseline ${baseline.id} product TypeScript lanes`,
      baseline.sourceInventory.productTypeScriptLaneIds,
      baseline.id === "effect-build-dd39"
        ? ["effect-production-source"]
        : ["product-root-source", "release-app-source", "agents-source", "action-source"],
      issues
    )

    const productTypeScriptLines = baseline.sourceInventory.productTypeScriptLaneIds.reduce(
      (total, laneId) => total + laneLineCount(laneId),
      0
    )
    const productInputLines = baseline.sourceInventory.productInputLaneIds.reduce(
      (total, laneId) => total + laneLineCount(laneId),
      0
    )
    if (numericMetricValue(baseline.sourceInventory.summary.physicalProductTypeScriptLines) !== productTypeScriptLines ||
      numericMetricValue(baseline.sourceInventory.summary.physicalProductInputLines) !== productInputLines) {
      issues.push(`baseline ${baseline.id} product source summary does not equal its classified lanes`)
    }

    if (baseline.sourceInventory.topModules.length !== 25) {
      issues.push(`baseline ${baseline.id} must contain exactly 25 largest product modules`)
    }
    const topPaths = baseline.sourceInventory.topModules.map(({ path }) => path)
    if (new Set(topPaths).size !== topPaths.length) issues.push(`baseline ${baseline.id} top modules contain duplicates`)
    baseline.sourceInventory.topModules.forEach((module, index, modules) => {
      if (module.rank !== index + 1) issues.push(`baseline ${baseline.id} top-module ranks are not contiguous`)
      const previous = modules[index - 1]
      if (previous !== undefined && (
        module.physicalLines > previous.physicalLines ||
        (module.physicalLines === previous.physicalLines && module.path < previous.path)
      )) issues.push(`baseline ${baseline.id} top modules are not deterministically ordered`)
    })

    const bundlePaths = baseline.bundles.map(({ path }) => path)
    if (new Set(bundlePaths).size !== bundlePaths.length) issues.push(`baseline ${baseline.id} bundle paths repeat`)
    for (const bundle of baseline.bundles) {
      if (!evidenceSet.has(bundle.sourceId)) issues.push(`baseline ${baseline.id} bundle references missing evidence`)
    }
    const bundleMeasurements = baseline.bundles.map(({ path, physicalLines, bytes, sha256 }) => [
      path,
      physicalLines,
      bytes,
      sha256
    ])
    if (JSON.stringify(bundleMeasurements) !== JSON.stringify(REQUIRED_BUNDLES[baseline.id])) {
      issues.push(`baseline ${baseline.id} changed its exact generated-bundle inventory`)
    }
    const bundleLane = baseline.sourceInventory.lanes.find((lane) =>
      lane.classifierRuleId === (baseline.id === "effect-build-dd39" ? "effect-bundles" : "action-bundles"))
    if (bundleLane !== undefined && (
      numericMetricValue(bundleLane.fileCount) !== baseline.bundles.length ||
      numericMetricValue(bundleLane.physicalLineCount) !== baseline.bundles.reduce(
        (total, bundle) => total + bundle.physicalLines,
        0
      )
    )) issues.push(`baseline ${baseline.id} bundle lane does not equal bundle inventory`)

    for (const [label, metric] of allMetrics(baseline)) {
      validateMetric(`baseline ${baseline.id} ${label}`, metric, evidenceSet, issues)
    }

    if (baseline.id === "historical-plan184") {
      const summary = baseline.sourceInventory.summary
      requireNumericMetric("Plan 184 semantic product", summary.semanticProductLines, "AttestedMetric", 5_871, "lines", ["evidence.plan184-report"], issues)
      requireNumericMetric("Plan 184 semantic oracle", summary.semanticOracleLines, "AttestedMetric", 6_040, "lines", ["evidence.plan184-report"], issues)
      requireNumericMetric("Plan 184 semantic TypeScript", summary.semanticProductTypeScriptLines, "AttestedMetric", 5_733, "lines", ["evidence.plan184-report"], issues)
      requireNumericMetric("Plan 184 semantic data", summary.semanticProductDataLines, "AttestedMetric", 138, "lines", ["evidence.plan184-report"], issues)
    }
    if (baseline.id === "overlay-v1") {
      requireNumericMetric("overlay runtime export entries", baseline.publicSurface.runtimeExportEntryCount, "AttestedMetric", 59, "symbols", ["evidence.overlay-manifest"], issues)
      requireNumericMetric("overlay declaration export entries", baseline.publicSurface.declarationExportEntryCount, "AttestedMetric", 108, "symbols", ["evidence.overlay-manifest"], issues)
      requireNumericMetric("overlay declaration-only commitments", baseline.publicSurface.declarationOnlyCommitmentCount, "AttestedMetric", 49, "symbols", ["evidence.overlay-manifest"], issues)
      requireNumericMetric("overlay version-shaped literals", baseline.durableSurface.versionShapedLiteralCount, "AttestedMetric", 101, "records", ["evidence.overlay-manifest"], issues)
    }
    if (baseline.id === "effect-build-dd39") {
      requireNumericMetric("effect-build tracked files", baseline.sourceInventory.summary.trackedTreeFileCount, "MeasuredMetric", 899, "files", ["evidence.effect-build-dd39-tree"], issues)
      requireNumericMetric("effect-build tracked bytes", baseline.sourceInventory.summary.trackedTreeBlobBytes, "MeasuredMetric", 7_513_781, "bytes", ["evidence.effect-build-dd39-tree"], issues)
      requireNumericMetric("effect-build public packages", baseline.publicSurface.publicPackageCount, "AttestedMetric", 11, "packages", ["evidence.effect-build-public-api"], issues)
      requireNumericMetric("effect-build importable modules", baseline.publicSurface.importableModuleCount, "AttestedMetric", 42, "modules", ["evidence.effect-build-public-api"], issues)
      requireNumericMetric("effect-build provider operations", baseline.operationalSurface.providerOperationCount, "AttestedMetric", 67, "records", ["evidence.effect-build-contract"], issues)
      requireNumericMetric("effect-build positive-proof operations", baseline.operationalSurface.positiveProofGatedOperationCount, "AttestedMetric", 22, "records", ["evidence.effect-build-contract"], issues)
      requireNumericMetric("effect-build unresolved proof items", baseline.operationalSurface.unresolvedPositiveProofItemCount, "AttestedMetric", 37, "records", ["evidence.effect-build-contract"], issues)
    }
  }

  exactOrdered(
    "PR21 to PR22 gross-change lanes",
    document.pr21ToPr22GrossChange.map(({ laneId }) => laneId),
    REQUIRED_GROSS_CHANGES.map(([id]) => id),
    issues
  )
  document.pr21ToPr22GrossChange.forEach((change, index) => {
    const expected = REQUIRED_GROSS_CHANGES[index]
    if (expected === undefined || change.additions !== expected[1] || change.deletions !== expected[2]) {
      issues.push(`PR21 to PR22 gross-change row ${change.laneId} changed its measured arithmetic`)
    }
  })

  document.historicalMaintenanceFamilies.forEach((family, index) => {
    const expected = REQUIRED_HISTORICAL_STATS[index]
    const actual = [
      family.familyId,
      family.observationCount,
      family.grossAdditions,
      family.grossDeletions,
      family.netLines,
      family.medianAdditions,
      family.p90Additions,
      family.maximumAdditions
    ]
    if (expected === undefined || JSON.stringify(actual) !== JSON.stringify(expected)) {
      issues.push(`historical family ${family.familyId} changed its attested statistics`)
    }
    if (family.grossAdditions - family.grossDeletions !== family.netLines) {
      issues.push(`historical family ${family.familyId} has invalid gross/net arithmetic`)
    }
    if (family.maximumAdditions < family.p90Additions || family.p90Additions < family.medianAdditions) {
      issues.push(`historical family ${family.familyId} has invalid ordered statistics`)
    }
  })

  for (const candidate of document.candidateBaselines) {
    if (candidate.requiredEvidence.length === 0) issues.push(`candidate ${candidate.candidateId} lacks requirements`)
  }
  if (document.terminalEffectBuildCoordinateStatus._tag !== "PendingMetric") {
    issues.push("terminal effect-build coordinate must remain pending until Plan 004 completes")
  }

  return issues
}

export class BaselineInvariantError extends Schema.TaggedError<BaselineInvariantError>()(
  "BaselineInvariantError",
  {
    issues: Schema.NonEmptyArray(Schema.String),
    message: Schema.String
  }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture baseline invariant failure: ${issues.join("; ")}`
    })
  }
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeBaselineStructure = Schema.decodeUnknownEffect(ArchitectureBaselineV1, strictOptions)

export const decodeArchitectureBaseline = Effect.fn("ArchitectureBaselineV1.decode")(
  function* (input: unknown) {
    const baseline = yield* decodeBaselineStructure(input)
    const issues = architectureBaselineInvariantIssues(baseline)
    if (issues.length > 0) yield* new BaselineInvariantError(issues as [string, ...Array<string>])
    return baseline
  }
)

const encodeBaselineStructure = Schema.encodeUnknownSync(ArchitectureBaselineV1, strictOptions)

export const encodeArchitectureBaseline = (baseline: ArchitectureBaselineV1): unknown => {
  const issues = architectureBaselineInvariantIssues(baseline)
  if (issues.length > 0) throw new BaselineInvariantError(issues as [string, ...Array<string>])
  return encodeBaselineStructure(baseline)
}
