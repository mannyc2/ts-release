import { Effect, Schema } from "effect"
import { hashCanonicalValue } from "../trial-hash.js"
import {
  ArtifactId,
  CaseId,
  Description,
  ExistingRepositoryPath,
  GitRevision,
  LawId,
  OwnerId,
  PlannedRepositoryPath,
  Sha256Hex,
  TraceabilityId
} from "./primitives.js"
import { SourceCoordinate } from "./source-coordinate.js"
import {
  V2MachineCandidateId,
  V2TopologyCandidateId,
  V2_CASE_IDS
} from "./v2-ids.js"

const Natural = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0))
const Percentage = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(100)
)
const nfcText = Schema.makeFilter(
  (value: string) => value === value.normalize("NFC") ? undefined : "must be NFC-normalized"
)
const noControlText = Schema.makeFilter(
  (value: string) => /[\u0000-\u001f\u007f]/u.test(value)
    ? "must not contain control characters"
    : undefined
)
const boundedText = (maximumLength: number) => Schema.NonEmptyString.check(
  nfcText,
  Schema.isTrimmed(),
  noControlText,
  Schema.makeFilter((value: string) => value.length <= maximumLength
    ? undefined
    : `must contain at most ${maximumLength} characters`)
)
const stableId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u)
)

export const FreezeEntityId = stableId.pipe(Schema.brand("FreezeEntityId"))
export type FreezeEntityId = typeof FreezeEntityId.Type

export const FreezeUnitId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^[a-z][A-Za-z0-9]*(?:[._/-][A-Za-z0-9]+)*$/u)
).pipe(Schema.brand("FreezeUnitId"))
export type FreezeUnitId = typeof FreezeUnitId.Type

export const NpmPackageName = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/u)
).pipe(Schema.brand("NpmPackageName"))
export type NpmPackageName = typeof NpmPackageName.Type

const PublicName = boundedText(512)
const VersionText = boundedText(256)
const WorkspaceGlob = Schema.NonEmptyString.check(
  nfcText,
  Schema.makeFilter((value: string) => value.length <= 512
    ? undefined
    : "must contain at most 512 characters"),
  Schema.makeFilter((value: string) => value.startsWith("/") || value.includes("\\") ||
      value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    ? "must be a repository-relative POSIX glob without dot segments"
    : undefined),
  Schema.isPattern(/^[A-Za-z0-9._@/+*?{}~-]+$/u)
)

const FreezeInputBinding = Schema.Struct({
  id: ArtifactId,
  path: ExistingRepositoryPath,
  sha256: Sha256Hex,
  role: Schema.Literals([
    "evidence-input",
    "selection-result",
    "maintainer-decision",
    "candidate-manifest",
    "candidate-result",
    "terminal-reconciliation"
  ])
})
export type FreezeInputBinding = typeof FreezeInputBinding.Type

const ClosureEvidenceBinding = Schema.Struct({
  path: ExistingRepositoryPath,
  sha256: Sha256Hex,
  authority: Schema.Literals([
    "canonical-input",
    "tool-produced-result",
    "immutable-source-coordinate",
    "independent-receipt"
  ])
})

const ClosedFreezePrerequisite = Schema.Struct({
  id: ArtifactId,
  evidence: Schema.NonEmptyArray(ClosureEvidenceBinding)
})

export const REQUIRED_FREEZE_PREREQUISITE_IDS = [
  "OB01-action-default-qualification",
  "OB02-plan004-terminal-reconciliation",
  "OB03-operational-s3-worm-cas-deployment",
  "OB04-external-payload-inventory",
  "OB05-product-journal-byte-limit",
  "OB06-terminal-apple-codec-correlation",
  "prerequisite.candidate-baseline-m1",
  "prerequisite.candidate-baseline-m2",
  "prerequisite.candidate-baseline-t1",
  "prerequisite.candidate-baseline-t2",
  "prerequisite.candidate-baseline-t3",
  "prerequisite.plan004-terminal-coordinate"
] as const

export const REQUIRED_FREEZE_INPUT_IDS = [
  "input.baseline",
  "input.ownership-decisions",
  "input.research-traceability",
  "input.trial-spec",
  "result.trial-results",
  "evidence.plan004-terminal"
] as const

const EngineConstraint = Schema.Struct({
  runtime: Schema.Literals(["node", "bun"]),
  range: VersionText
})

const PackageBin = Schema.Struct({
  name: PublicName,
  path: PlannedRepositoryPath
})

const PackageDependency = Schema.Struct({
  id: FreezeEntityId,
  kind: Schema.Literals(["dependency", "peer", "optional"]),
  npmName: NpmPackageName,
  targetPackageId: Schema.NullOr(FreezeEntityId),
  version: VersionText
})

const ExportCondition = Schema.Struct({
  condition: PublicName,
  target: PlannedRepositoryPath
})

const PackageExport = Schema.Struct({
  subpath: PublicName,
  conditions: Schema.NonEmptyArray(ExportCondition)
})

const EmittedModule = Schema.Struct({
  id: FreezeEntityId,
  kind: Schema.Literals(["javascript", "declaration", "source-map", "other"]),
  path: PlannedRepositoryPath,
  sha256: Sha256Hex
})

const PackedFile = Schema.Struct({
  path: PlannedRepositoryPath,
  byteLength: Natural,
  sha256: Sha256Hex
})

const HostRuntimeSupport = Schema.Struct({
  id: FreezeEntityId,
  host: Schema.Literals(["library", "cli", "github-action", "node-host", "bun-host"]),
  runtime: Schema.Literals(["node", "bun"]),
  entrypoint: PlannedRepositoryPath,
  caseIds: Schema.NonEmptyArray(CaseId)
})

const ProviderOperationOwnership = Schema.Struct({
  providerId: FreezeEntityId,
  operationIds: Schema.NonEmptyArray(FreezeEntityId),
  ownerId: OwnerId
})

const PackageSurface = Schema.Struct({
  packageId: FreezeEntityId,
  npmName: NpmPackageName,
  visibility: Schema.Literals(["public", "private"]),
  role: Description,
  workspacePath: PlannedRepositoryPath,
  versionTrain: VersionText,
  engines: Schema.Array(EngineConstraint),
  bins: Schema.Array(PackageBin),
  dependencies: Schema.Array(PackageDependency),
  exports: Schema.Array(PackageExport),
  sourceEntrypoint: PlannedRepositoryPath,
  moduleIds: Schema.NonEmptyArray(FreezeEntityId),
  runtimeExports: Schema.Array(PublicName),
  declarationExports: Schema.Array(PublicName),
  namespaceMembers: Schema.Array(PublicName),
  declarationFingerprintSha256: Sha256Hex,
  emittedModules: Schema.Array(EmittedModule),
  packedInventory: Schema.Array(PackedFile),
  hostRuntimeSupport: Schema.Array(HostRuntimeSupport),
  providerOperationOwnership: Schema.Array(ProviderOperationOwnership),
  packedConsumerCaseIds: Schema.Array(CaseId),
  publicationOrder: PositiveInteger
})

const DependencyNode = Schema.Struct({
  id: FreezeEntityId,
  kind: Schema.Literals(["package", "module", "host"]),
  ownerId: OwnerId
})

const DependencyEdge = Schema.Struct({
  id: FreezeEntityId,
  fromId: FreezeEntityId,
  toId: FreezeEntityId,
  kind: Schema.Literals([
    "static",
    "type-only",
    "literal-dynamic",
    "manifest-dependency",
    "manifest-peer",
    "manifest-optional"
  ])
})

const ForbiddenDependencyEdge = Schema.Struct({
  id: FreezeEntityId,
  fromId: FreezeEntityId,
  toId: FreezeEntityId,
  kind: DependencyEdge.fields.kind,
  reason: Description
})

const SurfaceFactFields = {
  workspaceGlobs: Schema.NonEmptyArray(WorkspaceGlob),
  packages: Schema.NonEmptyArray(PackageSurface),
  dependencyNodes: Schema.NonEmptyArray(DependencyNode),
  allowedImportEdges: Schema.Array(DependencyEdge),
  forbiddenImportEdges: Schema.Array(ForbiddenDependencyEdge),
  dependencyDag: Schema.Array(DependencyEdge),
  publicationOrder: Schema.NonEmptyArray(FreezeEntityId)
} as const

export const SurfaceFreezeFactsV1 = Schema.Struct(SurfaceFactFields)
export type SurfaceFreezeFactsV1 = typeof SurfaceFreezeFactsV1.Type

const MigrationTarget = Schema.Union([
  Schema.TaggedStruct("Targeted", {
    packageId: FreezeEntityId,
    moduleId: FreezeEntityId,
    ownerId: OwnerId
  }),
  Schema.TaggedStruct("Removed", {
    finalState: Schema.Literals(["deleted", "historical-only"])
  })
])

const RemovalLedger = Schema.Struct({
  concepts: Natural,
  representations: Natural,
  branches: Natural,
  workflows: Natural,
  exports: Natural,
  dependencyEdges: Natural
})

const MigrationSharedFields = {
  id: FreezeEntityId,
  sourceUnitId: FreezeUnitId,
  sourceCoordinates: Schema.NonEmptyArray(SourceCoordinate),
  baselinePaths: Schema.Array(ExistingRepositoryPath),
  baselineSymbols: Schema.Array(PublicName),
  baselineExports: Schema.Array(PublicName),
  baselineDurableCodecs: Schema.Array(PublicName),
  action: Schema.Literals(["retain", "move", "merge", "replace", "delete", "historical-only"]),
  target: MigrationTarget,
  lawIds: Schema.Array(LawId),
  traceIds: Schema.Array(TraceabilityId),
  publicMigrationStatus: Schema.Literals(["not-public", "retained", "hard-cut", "one-shot-migration"]),
  durableMigrationStatus: Schema.Literals(["not-durable", "retained", "hard-cut", "one-shot-migration"]),
  successorWaveId: FreezeEntityId,
  deletionGateId: FreezeEntityId
} as const

export class MigrationPathRowV1 extends Schema.TaggedClass<MigrationPathRowV1>()(
  "PathRow",
  {
    ...MigrationSharedFields,
    physicalCandidateProductLines: Natural,
    unavoidableReplacementProductLines: Natural,
    relocatedSchemaLines: Natural,
    relocatedTableLines: Natural,
    relocatedGeneratorLines: Natural,
    relocatedToolingLines: Natural,
    relocatedOracleLines: Natural,
    credibleNetProductDeletion: Schema.Int,
    removed: RemovalLedger
  }
) {}

export class MigrationLinkedRowV1 extends Schema.TaggedClass<MigrationLinkedRowV1>()(
  "LinkedRow",
  {
    ...MigrationSharedFields,
    unitKind: Schema.Literals(["symbol", "export", "durable-codec"]),
    lineOwningPathRowId: FreezeEntityId
  }
) {}

export const MigrationRowV1 = Schema.Union([MigrationPathRowV1, MigrationLinkedRowV1])
export type MigrationRowV1 = typeof MigrationRowV1.Type

const MigrationFactFields = {
  inventoryAuthoritySha256: Sha256Hex,
  requiredSourceUnitIds: Schema.NonEmptyArray(FreezeUnitId),
  rows: Schema.NonEmptyArray(MigrationRowV1)
} as const

export const MigrationFreezeFactsV1 = Schema.Struct(MigrationFactFields)
export type MigrationFreezeFactsV1 = typeof MigrationFreezeFactsV1.Type

export const FreezePlanId = Schema.Literals(["006", "007", "008", "008B", "009"])
export type FreezePlanId = typeof FreezePlanId.Type

const WaveBudget = Schema.Struct({
  productSourceLinesAtMost: Natural,
  grossProductAdditionLinesAtMost: Natural,
  credibleNetProductDeletionAtLeast: Schema.Int
})

const WaveRecord = Schema.Struct({
  id: FreezeEntityId,
  planId: FreezePlanId,
  order: PositiveInteger,
  inputPaths: Schema.NonEmptyArray(PlannedRepositoryPath),
  outputPaths: Schema.NonEmptyArray(PlannedRepositoryPath),
  packageIds: Schema.NonEmptyArray(FreezeEntityId),
  moduleIds: Schema.NonEmptyArray(FreezeEntityId),
  predecessorIds: Schema.Array(FreezeEntityId),
  deletionMigrationRowIds: Schema.Array(FreezeEntityId),
  productRowIds: Schema.Array(TraceabilityId),
  propositionIds: Schema.Array(TraceabilityId),
  migrationUnitIds: Schema.Array(FreezeUnitId),
  budget: WaveBudget,
  gateIds: Schema.NonEmptyArray(FreezeEntityId),
  claimIds: Schema.NonEmptyArray(ArtifactId),
  stopConditions: Schema.NonEmptyArray(Description),
  resultArtifact: PlannedRepositoryPath
})

const WavesFactFields = {
  requiredProductRowIds: Schema.NonEmptyArray(TraceabilityId),
  requiredPropositionIds: Schema.NonEmptyArray(TraceabilityId),
  requiredMigrationUnitIds: Schema.NonEmptyArray(FreezeUnitId),
  waves: Schema.NonEmptyArray(WaveRecord)
} as const

export const WavesFreezeFactsV1 = Schema.Struct(WavesFactFields)
export type WavesFreezeFactsV1 = typeof WavesFreezeFactsV1.Type

const GateInputBinding = Schema.Struct({
  id: ArtifactId,
  path: PlannedRepositoryPath,
  sha256: Sha256Hex
})

const GateRecord = Schema.Struct({
  id: FreezeEntityId,
  waveId: FreezeEntityId,
  command: PublicName,
  argv: Schema.Array(PublicName),
  host: Schema.Literals(["bun", "node", "github-action", "shell"]),
  immutableInputs: Schema.NonEmptyArray(GateInputBinding),
  expectedExit: Natural,
  resultSchemaId: ArtifactId,
  claimIds: Schema.NonEmptyArray(ArtifactId),
  caseIds: Schema.Array(CaseId),
  authority: Schema.Literal("local-inert"),
  requiresNetwork: Schema.Literal(false),
  requiresCredentials: Schema.Literal(false),
  mutatesExternalState: Schema.Literal(false),
  resultArtifact: PlannedRepositoryPath
})

const GatesFactFields = {
  requiredClaimIds: Schema.NonEmptyArray(ArtifactId),
  requiredCaseIds: Schema.NonEmptyArray(CaseId),
  gates: Schema.NonEmptyArray(GateRecord)
} as const

export const GatesFreezeFactsV1 = Schema.Struct(GatesFactFields)
export type GatesFreezeFactsV1 = typeof GatesFreezeFactsV1.Type

const CanonicalEntity = Schema.Struct({
  id: FreezeEntityId,
  description: Description,
  ownerId: OwnerId
})

const ForbiddenState = Schema.Struct({
  id: FreezeEntityId,
  description: Description,
  excludedBy: Schema.NonEmptyArray(FreezeEntityId)
})

const DurableFormat = Schema.Struct({
  id: FreezeEntityId,
  version: VersionText,
  ownerId: OwnerId,
  migrationDisposition: Schema.Literals(["new", "retained", "hard-cut", "one-shot-migration"])
})

const OwnershipAssignment = Schema.Struct({
  kind: Schema.Literals(["construction", "transition", "persistence", "effect", "projection"]),
  subjectId: FreezeEntityId,
  ownerId: OwnerId,
  moduleId: FreezeEntityId
})

const JournalDeployment = Schema.Struct({
  id: FreezeEntityId,
  host: Schema.Literals(["cli", "github-action", "release-readiness"]),
  storeKind: FreezeEntityId,
  ownerId: OwnerId,
  logicalJournalCardinality: Schema.Literal(1),
  productByteLimit: PositiveInteger
})

const EffectBuildBoundary = Schema.Struct({
  acceptedGitRevision: GitRevision,
  contractSha256: Sha256Hex,
  publicApiSha256: Sha256Hex,
  producerOwnerId: OwnerId,
  adoptionOwnerId: OwnerId,
  appleOperationOwnerId: OwnerId,
  appleJournalOwnerId: OwnerId,
  artifactProtocolId: FreezeEntityId,
  appleCommitBeforeIdOutcome: Schema.Literal("inconclusive-no-blind-resubmit")
})

const TargetFile = Schema.Struct({
  path: PlannedRepositoryPath,
  packageId: FreezeEntityId,
  moduleId: FreezeEntityId,
  ownerId: OwnerId,
  role: Schema.Literals([
    "product-source",
    "generated-product-input",
    "host-source",
    "public-entrypoint"
  ])
})

const SingletonAssertion = Schema.Struct({
  ownerId: OwnerId,
  moduleId: FreezeEntityId,
  path: PlannedRepositoryPath,
  cardinality: Schema.Literal(1)
})

const SingletonAssertions = Schema.Struct({
  transitionOwner: SingletonAssertion,
  interpreter: SingletonAssertion,
  dispatchAuthorityConstructor: SingletonAssertion,
  journalAppendPath: SingletonAssertion,
  reportProjection: SingletonAssertion
})

const TotalBudget = Schema.Struct({
  preservedPrototypeProductLines: PositiveInteger,
  targetForecastProductLines: Natural,
  targetPercentageAtMost: Schema.Literal(50),
  actualPercentage: Percentage,
  selectedMachineReferenceLines: PositiveInteger,
  selectedMachineLines: Natural,
  selectedMachinePercentageAtMost: Schema.Literal(60),
  selectedMachineActualPercentage: Percentage
})

const MarginalBudget = Schema.Struct({
  quantileMethod: Schema.Literal("nearest-rank"),
  observationCount: Schema.Literal(9),
  medianGrossProductAdditionLines: Natural,
  medianGrossProductAdditionLinesAtMost: Schema.Literal(40),
  p90GrossProductAdditionLines: Natural,
  p90GrossProductAdditionLinesAtMost: Schema.Literal(100),
  maximumGrossProductAdditionLines: Natural,
  maximumGrossProductAdditionLinesAtMost: Schema.Literal(200)
})

const AncestryContract = Schema.Struct({
  requiredAncestorRevisions: Schema.NonEmptyArray(GitRevision),
  forbiddenAncestorRevisions: Schema.NonEmptyArray(GitRevision),
  prototypeAncestryForbidden: Schema.Literal(true)
})

const SystemCoverage = Schema.Struct({
  productRowIds: Schema.NonEmptyArray(TraceabilityId),
  propositionIds: Schema.NonEmptyArray(TraceabilityId),
  migrationUnitIds: Schema.NonEmptyArray(FreezeUnitId),
  publicUnitIds: Schema.NonEmptyArray(FreezeUnitId),
  durableFormatIds: Schema.NonEmptyArray(FreezeEntityId)
})

const SystemFactFields = {
  countingPolicySha256: Sha256Hex,
  concepts: Schema.NonEmptyArray(CanonicalEntity),
  states: Schema.NonEmptyArray(CanonicalEntity),
  events: Schema.NonEmptyArray(CanonicalEntity),
  commands: Schema.NonEmptyArray(CanonicalEntity),
  forbiddenStates: Schema.NonEmptyArray(ForbiddenState),
  durableFormats: Schema.NonEmptyArray(DurableFormat),
  ownershipAssignments: Schema.NonEmptyArray(OwnershipAssignment),
  journalDeployments: Schema.NonEmptyArray(JournalDeployment),
  effectBuildBoundary: EffectBuildBoundary,
  targetFiles: Schema.NonEmptyArray(TargetFile),
  dependencyNodes: Schema.NonEmptyArray(DependencyNode),
  dependencyDag: Schema.Array(DependencyEdge),
  singletonAssertions: SingletonAssertions,
  totalBudget: TotalBudget,
  marginalBudget: MarginalBudget,
  ancestry: AncestryContract,
  coverage: SystemCoverage
} as const

export const SystemFreezeFactsV1 = Schema.Struct(SystemFactFields)
export type SystemFreezeFactsV1 = typeof SystemFreezeFactsV1.Type

export class SelectedMachineFreezeCoordinateV1 extends Schema.Class<
  SelectedMachineFreezeCoordinateV1
>("SelectedMachineFreezeCoordinateV1")({
  candidateId: V2MachineCandidateId,
  receiptId: Sha256Hex,
  selectionMode: Schema.Literals(["unique", "maintainer-approved"]),
  decisionDocumentId: Schema.NullOr(Sha256Hex),
  decisionFileSha256: Schema.NullOr(Sha256Hex)
}) {}

export class SelectedTopologyFreezeCoordinateV1 extends Schema.Class<
  SelectedTopologyFreezeCoordinateV1
>("SelectedTopologyFreezeCoordinateV1")({
  candidateId: V2TopologyCandidateId,
  receiptId: Sha256Hex,
  selectionMode: Schema.Literals(["unique", "maintainer-approved"]),
  decisionDocumentId: Schema.NullOr(Sha256Hex),
  decisionFileSha256: Schema.NullOr(Sha256Hex)
}) {}

export class FreezeSelectionAuthorityV1 extends Schema.Class<FreezeSelectionAuthorityV1>(
  "FreezeSelectionAuthorityV1"
)({
  trialSpecSha256: Sha256Hex,
  trialResultsAggregateId: Sha256Hex,
  trialResultsFileSha256: Sha256Hex,
  machine: SelectedMachineFreezeCoordinateV1,
  topology: SelectedTopologyFreezeCoordinateV1
}) {}

const FreezeFactSetBodyFields = {
  schemaVersion: Schema.Literal("ts-release/architecture-freeze-facts/v1"),
  programId: Schema.Literal("ts-release-architecture-program"),
  inputBindings: Schema.NonEmptyArray(FreezeInputBinding),
  closedPrerequisites: Schema.NonEmptyArray(ClosedFreezePrerequisite),
  sourceCoordinates: Schema.NonEmptyArray(SourceCoordinate),
  surface: SurfaceFreezeFactsV1,
  migration: MigrationFreezeFactsV1,
  waves: WavesFreezeFactsV1,
  gates: GatesFreezeFactsV1,
  system: SystemFreezeFactsV1
} as const

export const FreezeFactSetBodyV1 = Schema.Struct(FreezeFactSetBodyFields)
export type FreezeFactSetBodyV1 = typeof FreezeFactSetBodyV1.Type

export class FreezeFactSetV1 extends Schema.Class<FreezeFactSetV1>("FreezeFactSetV1")({
  factSetId: Sha256Hex,
  ...FreezeFactSetBodyFields
}) {}

const SurfaceDocumentBodyFields = {
  schemaVersion: Schema.Literal("ts-release/architecture-surface-freeze/v1"),
  programId: Schema.Literal("ts-release-architecture-program"),
  contractId: Sha256Hex,
  ...SurfaceFactFields
} as const

const MigrationDocumentBodyFields = {
  schemaVersion: Schema.Literal("ts-release/architecture-migration-freeze/v1"),
  programId: Schema.Literal("ts-release-architecture-program"),
  contractId: Sha256Hex,
  ...MigrationFactFields
} as const

const WavesDocumentBodyFields = {
  schemaVersion: Schema.Literal("ts-release/architecture-waves-freeze/v1"),
  programId: Schema.Literal("ts-release-architecture-program"),
  contractId: Sha256Hex,
  ...WavesFactFields
} as const

const GatesDocumentBodyFields = {
  schemaVersion: Schema.Literal("ts-release/architecture-gates-freeze/v1"),
  programId: Schema.Literal("ts-release-architecture-program"),
  contractId: Sha256Hex,
  ...GatesFactFields
} as const

export class SurfaceFreezeV1 extends Schema.Class<SurfaceFreezeV1>("SurfaceFreezeV1")({
  documentId: Sha256Hex,
  ...SurfaceDocumentBodyFields
}) {}

export class MigrationFreezeV1 extends Schema.Class<MigrationFreezeV1>("MigrationFreezeV1")({
  documentId: Sha256Hex,
  ...MigrationDocumentBodyFields
}) {}

export class WavesFreezeV1 extends Schema.Class<WavesFreezeV1>("WavesFreezeV1")({
  documentId: Sha256Hex,
  ...WavesDocumentBodyFields
}) {}

export class GatesFreezeV1 extends Schema.Class<GatesFreezeV1>("GatesFreezeV1")({
  documentId: Sha256Hex,
  ...GatesDocumentBodyFields
}) {}

const ProjectionBinding = Schema.Struct({
  artifact: Schema.Literals(["SURFACE", "MIGRATION", "WAVES", "GATES"]),
  jsonPath: PlannedRepositoryPath,
  jsonSha256: Sha256Hex,
  documentId: Sha256Hex,
  markdownPath: PlannedRepositoryPath,
  markdownSha256: Sha256Hex
})
export type ProjectionBinding = typeof ProjectionBinding.Type

const SystemDocumentBodyFields = {
  schemaVersion: Schema.Literal("ts-release/architecture-system-freeze/v1"),
  programId: Schema.Literal("ts-release-architecture-program"),
  contractId: Sha256Hex,
  factSetId: Sha256Hex,
  inputBindings: Schema.NonEmptyArray(FreezeInputBinding),
  selection: FreezeSelectionAuthorityV1,
  sourceCoordinates: Schema.NonEmptyArray(SourceCoordinate),
  projectionBindings: Schema.NonEmptyArray(ProjectionBinding),
  ...SystemFactFields
} as const

export class SystemFreezeV1 extends Schema.Class<SystemFreezeV1>("SystemFreezeV1")({
  systemId: Sha256Hex,
  ...SystemDocumentBodyFields
}) {}

export class FreezeContractInvariantError extends Schema.TaggedError<
  FreezeContractInvariantError
>()("FreezeContractInvariantError", {
  artifact: Schema.String,
  issues: Schema.NonEmptyArray(Schema.String),
  message: Schema.String
}) {
  constructor(artifact: string, issues: readonly [string, ...Array<string>]) {
    super({
      artifact,
      issues,
      message: `${artifact} freeze invariant failure: ${issues.join("; ")}`
    })
  }
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const encodeFactSetBody = Schema.encodeUnknownSync(FreezeFactSetBodyV1, strictOptions)
const decodeFactSetStructure = Schema.decodeUnknownEffect(FreezeFactSetV1, strictOptions)
const encodeFactSetStructure = Schema.encodeUnknownSync(FreezeFactSetV1, strictOptions)

const SurfaceDocumentBody = Schema.Struct(SurfaceDocumentBodyFields)
const MigrationDocumentBody = Schema.Struct(MigrationDocumentBodyFields)
const WavesDocumentBody = Schema.Struct(WavesDocumentBodyFields)
const GatesDocumentBody = Schema.Struct(GatesDocumentBodyFields)
const SystemDocumentBody = Schema.Struct(SystemDocumentBodyFields)

const encodeSurfaceBody = Schema.encodeUnknownSync(SurfaceDocumentBody, strictOptions)
const encodeMigrationBody = Schema.encodeUnknownSync(MigrationDocumentBody, strictOptions)
const encodeWavesBody = Schema.encodeUnknownSync(WavesDocumentBody, strictOptions)
const encodeGatesBody = Schema.encodeUnknownSync(GatesDocumentBody, strictOptions)
const encodeSystemBody = Schema.encodeUnknownSync(SystemDocumentBody, strictOptions)
const decodeSurfaceStructure = Schema.decodeUnknownEffect(SurfaceFreezeV1, strictOptions)
const decodeMigrationStructure = Schema.decodeUnknownEffect(MigrationFreezeV1, strictOptions)
const decodeWavesStructure = Schema.decodeUnknownEffect(WavesFreezeV1, strictOptions)
const decodeGatesStructure = Schema.decodeUnknownEffect(GatesFreezeV1, strictOptions)
const decodeSystemStructure = Schema.decodeUnknownEffect(SystemFreezeV1, strictOptions)
const encodeSurfaceStructure = Schema.encodeUnknownSync(SurfaceFreezeV1, strictOptions)
const encodeMigrationStructure = Schema.encodeUnknownSync(MigrationFreezeV1, strictOptions)
const encodeWavesStructure = Schema.encodeUnknownSync(WavesFreezeV1, strictOptions)
const encodeGatesStructure = Schema.encodeUnknownSync(GatesFreezeV1, strictOptions)
const encodeSystemStructure = Schema.encodeUnknownSync(SystemFreezeV1, strictOptions)

const codePointCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0
const duplicates = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
    .sort(codePointCompare)
const isSorted = (values: ReadonlyArray<string>): boolean =>
  values.every((value, index) => index === 0 || codePointCompare(values[index - 1]!, value) < 0)
const exactOrdered = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])
const canonicalIssues = (issues: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(issues)].sort(codePointCompare)
const sortedUniqueIssues = (label: string, values: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...(duplicates(values).length === 0 ? [] : [`${label} contains duplicate ids [${duplicates(values).join(", ")}]`]),
  ...(isSorted(values) ? [] : [`${label} must be strictly code-point sorted`])
]

const graphIssues = (
  label: string,
  nodeIds: ReadonlyArray<string>,
  edges: ReadonlyArray<{ readonly id: string; readonly fromId: string; readonly toId: string }>
): ReadonlyArray<string> => {
  const issues = [...sortedUniqueIssues(`${label}.edgeIds`, edges.map(({ id }) => id))]
  const nodes = new Set(nodeIds)
  for (const edge of edges) {
    if (!nodes.has(edge.fromId) || !nodes.has(edge.toId)) {
      issues.push(`${label} edge ${edge.id} has a dangling endpoint`)
    }
    if (edge.fromId === edge.toId) issues.push(`${label} edge ${edge.id} is a self edge`)
  }
  const outgoing = new Map<string, Array<string>>()
  for (const edge of edges) {
    const targets = outgoing.get(edge.fromId) ?? []
    targets.push(edge.toId)
    outgoing.set(edge.fromId, targets)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true
    if (visited.has(node)) return false
    visiting.add(node)
    for (const target of outgoing.get(node) ?? []) {
      if (visit(target)) return true
    }
    visiting.delete(node)
    visited.add(node)
    return false
  }
  if (nodeIds.some(visit)) issues.push(`${label} must be acyclic`)
  return issues
}

export const surfaceFreezeInvariantIssues = (
  surface: SurfaceFreezeFactsV1
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const packageIds = surface.packages.map(({ packageId }) => packageId)
  const nodeIds = surface.dependencyNodes.map(({ id }) => id)
  issues.push(...sortedUniqueIssues("workspaceGlobs", surface.workspaceGlobs))
  issues.push(...sortedUniqueIssues("packages", packageIds))
  issues.push(...sortedUniqueIssues("dependencyNodes", nodeIds))
  const expectedPublication = [...surface.packages]
    .sort((left, right) => left.publicationOrder - right.publicationOrder)
    .map(({ packageId }) => packageId)
  if (!exactOrdered(surface.publicationOrder, expectedPublication) ||
    new Set(surface.packages.map(({ publicationOrder }) => publicationOrder)).size !== surface.packages.length ||
    surface.packages.some(({ publicationOrder }) => publicationOrder > surface.packages.length)) {
    issues.push("publicationOrder must be the exact contiguous package publication permutation")
  }
  const allModuleIds = surface.packages.flatMap(({ moduleIds }) => moduleIds)
  if (duplicates(allModuleIds).length > 0) issues.push("moduleIds must have one package owner")
  for (const pkg of surface.packages) {
    issues.push(...sortedUniqueIssues(`${pkg.packageId}.moduleIds`, pkg.moduleIds))
    issues.push(...sortedUniqueIssues(`${pkg.packageId}.runtimeExports`, pkg.runtimeExports))
    issues.push(...sortedUniqueIssues(`${pkg.packageId}.declarationExports`, pkg.declarationExports))
    issues.push(...sortedUniqueIssues(`${pkg.packageId}.namespaceMembers`, pkg.namespaceMembers))
    issues.push(...sortedUniqueIssues(`${pkg.packageId}.dependencies`, pkg.dependencies.map(({ id }) => id)))
    issues.push(...sortedUniqueIssues(`${pkg.packageId}.emittedModules`, pkg.emittedModules.map(({ id }) => id)))
    for (const dependency of pkg.dependencies) {
      if (dependency.targetPackageId !== null && !packageIds.includes(dependency.targetPackageId)) {
        issues.push(`${pkg.packageId} dependency ${dependency.id} targets an unknown package`)
      }
    }
  }
  if (!surface.dependencyNodes.some(({ kind }) => kind === "package") ||
    packageIds.some((id) => !surface.dependencyNodes.some((node) => node.id === id && node.kind === "package")) ||
    allModuleIds.some((id) => !surface.dependencyNodes.some((node) => node.id === id && node.kind === "module"))) {
    issues.push("dependencyNodes must contain every package and module with its exact kind")
  }
  issues.push(...graphIssues("dependencyDag", nodeIds, surface.dependencyDag))
  const allowedEncoded = surface.allowedImportEdges.map((edge) => JSON.stringify(edge))
  const dagEncoded = surface.dependencyDag.map((edge) => JSON.stringify(edge))
  if (!exactOrdered(allowedEncoded, dagEncoded)) {
    issues.push("allowedImportEdges must equal the exact dependencyDag, not a permissive superset")
  }
  issues.push(...sortedUniqueIssues(
    "forbiddenImportEdges",
    surface.forbiddenImportEdges.map(({ id }) => id)
  ))
  if (surface.forbiddenImportEdges.some(({ id }) =>
    surface.allowedImportEdges.some((edge) => edge.id === id))) {
    issues.push("allowed and forbidden import edge ids must be disjoint")
  }
  return canonicalIssues(issues)
}

export const migrationFreezeInvariantIssues = (
  migration: MigrationFreezeFactsV1
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const rowIds = migration.rows.map(({ id }) => id)
  const unitIds = migration.rows.map(({ sourceUnitId }) => sourceUnitId)
  issues.push(...sortedUniqueIssues("requiredSourceUnitIds", migration.requiredSourceUnitIds))
  issues.push(...sortedUniqueIssues("migration.rows", rowIds))
  if (!exactOrdered([...unitIds].sort(codePointCompare), migration.requiredSourceUnitIds)) {
    issues.push("migration rows must disposition every required source unit exactly once")
  }
  const pathRows = migration.rows.filter((row): row is MigrationPathRowV1 => row._tag === "PathRow")
  const pathRowIds = pathRows.map(({ id }) => id)
  for (const row of migration.rows) {
    const targetedAction = ["retain", "move", "merge", "replace"].includes(row.action)
    if ((row.target._tag === "Targeted") !== targetedAction) {
      issues.push(`${row.id} target variant does not match action ${row.action}`)
    }
    if (row._tag === "LinkedRow" && !pathRowIds.includes(row.lineOwningPathRowId)) {
      issues.push(`${row.id} has a dangling line-owning path row`)
    }
    if (row._tag === "PathRow") {
      const expected = row.physicalCandidateProductLines -
        row.unavoidableReplacementProductLines -
        row.relocatedSchemaLines -
        row.relocatedTableLines -
        row.relocatedGeneratorLines -
        row.relocatedToolingLines -
        row.relocatedOracleLines
      if (row.credibleNetProductDeletion !== expected) {
        issues.push(`${row.id} credible net product deletion arithmetic does not balance`)
      }
      if (["retain", "move", "historical-only"].includes(row.action) &&
        row.credibleNetProductDeletion !== 0) {
        issues.push(`${row.id} action ${row.action} must receive zero deletion credit`)
      }
    }
  }
  return canonicalIssues(issues)
}

const planRank: Readonly<Record<FreezePlanId, number>> = {
  "006": 0,
  "007": 1,
  "008": 2,
  "008B": 3,
  "009": 4
}

const exactSingleCoverageIssues = (
  label: string,
  expected: ReadonlyArray<string>,
  actual: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const sorted = [...actual].sort(codePointCompare)
  return duplicates(actual).length === 0 && exactOrdered(sorted, expected)
    ? []
    : [`${label} must cover its exact required set once`]
}

export const wavesFreezeInvariantIssues = (
  waves: WavesFreezeFactsV1
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  issues.push(...sortedUniqueIssues("requiredProductRowIds", waves.requiredProductRowIds))
  issues.push(...sortedUniqueIssues("requiredPropositionIds", waves.requiredPropositionIds))
  issues.push(...sortedUniqueIssues("requiredMigrationUnitIds", waves.requiredMigrationUnitIds))
  const waveIds = waves.waves.map(({ id }) => id)
  if (duplicates(waveIds).length > 0) issues.push("wave ids must be unique")
  if (waves.waves.some((wave, index) => wave.order !== index + 1)) {
    issues.push("waves must be stored in exact contiguous execution order")
  }
  if (!exactOrdered(
    [...new Set(waves.waves.map(({ planId }) => planId))],
    ["006", "007", "008", "008B", "009"]
  ) || waves.waves.some((wave, index) => index > 0 &&
    planRank[wave.planId] < planRank[waves.waves[index - 1]!.planId])) {
    issues.push("waves must cover Plans 006, 007, 008, 008B, and 009 in exact order")
  }
  for (const wave of waves.waves) {
    for (const predecessor of wave.predecessorIds) {
      const predecessorIndex = waveIds.indexOf(predecessor)
      if (predecessorIndex < 0 || predecessorIndex >= wave.order - 1) {
        issues.push(`${wave.id} predecessor ${predecessor} is absent or not earlier`)
      }
    }
  }
  issues.push(...exactSingleCoverageIssues(
    "product row wave coverage",
    waves.requiredProductRowIds,
    waves.waves.flatMap(({ productRowIds }) => productRowIds)
  ))
  issues.push(...exactSingleCoverageIssues(
    "required proposition wave coverage",
    waves.requiredPropositionIds,
    waves.waves.flatMap(({ propositionIds }) => propositionIds)
  ))
  issues.push(...exactSingleCoverageIssues(
    "migration unit wave coverage",
    waves.requiredMigrationUnitIds,
    waves.waves.flatMap(({ migrationUnitIds }) => migrationUnitIds)
  ))
  return canonicalIssues(issues)
}

export const gatesFreezeInvariantIssues = (
  gates: GatesFreezeFactsV1
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  issues.push(...sortedUniqueIssues("requiredClaimIds", gates.requiredClaimIds))
  issues.push(...sortedUniqueIssues("requiredCaseIds", gates.requiredCaseIds))
  issues.push(...sortedUniqueIssues("gates", gates.gates.map(({ id }) => id)))
  if (!exactOrdered(gates.requiredCaseIds, V2_CASE_IDS)) {
    issues.push("requiredCaseIds must equal the exact ordered 16-case trial contract")
  }
  const coveredClaims = [...new Set(gates.gates.flatMap(({ claimIds }) => claimIds))]
    .sort(codePointCompare)
  const coveredCases = [...new Set(gates.gates.flatMap(({ caseIds }) => caseIds))]
    .sort(codePointCompare)
  if (!exactOrdered(coveredClaims, gates.requiredClaimIds)) {
    issues.push("gate claim coverage must equal the required claim set")
  }
  if (!exactOrdered(coveredCases, [...gates.requiredCaseIds].sort(codePointCompare))) {
    issues.push("gate case coverage must include all and only the 16 required cases")
  }
  if (duplicates(gates.gates.map(({ resultArtifact }) => resultArtifact)).length > 0) {
    issues.push("each gate must own one distinct result artifact")
  }
  for (const gate of gates.gates) {
    issues.push(...sortedUniqueIssues(
      `${gate.id}.immutableInputs`,
      gate.immutableInputs.map(({ id }) => id)
    ))
  }
  return canonicalIssues(issues)
}

export const systemFreezeInvariantIssues = (
  system: SystemFreezeFactsV1
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  for (const [label, values] of [
    ["concepts", system.concepts],
    ["states", system.states],
    ["events", system.events],
    ["commands", system.commands],
    ["forbiddenStates", system.forbiddenStates],
    ["durableFormats", system.durableFormats]
  ] as const) {
    issues.push(...sortedUniqueIssues(label, values.map(({ id }) => id)))
  }
  const entityIds = new Set([
    ...system.concepts,
    ...system.states,
    ...system.events,
    ...system.commands,
    ...system.durableFormats
  ].map(({ id }) => id))
  for (const forbidden of system.forbiddenStates) {
    if (forbidden.excludedBy.some((id) => !entityIds.has(id))) {
      issues.push(`${forbidden.id} excludedBy contains a dangling canonical entity`)
    }
  }
  const assignmentKeys = system.ownershipAssignments.map(
    ({ kind, subjectId }) => `${kind}:${subjectId}`
  )
  if (duplicates(assignmentKeys).length > 0) {
    issues.push("each ownership kind and subject must have exactly one owner")
  }
  issues.push(...sortedUniqueIssues(
    "targetFiles",
    system.targetFiles.map(({ path }) => path)
  ))
  issues.push(...sortedUniqueIssues(
    "dependencyNodes",
    system.dependencyNodes.map(({ id }) => id)
  ))
  issues.push(...graphIssues(
    "system dependencyDag",
    system.dependencyNodes.map(({ id }) => id),
    system.dependencyDag
  ))
  if (system.targetFiles.some(({ packageId, moduleId }) =>
    !system.dependencyNodes.some(({ id, kind }) => id === packageId && kind === "package") ||
    !system.dependencyNodes.some(({ id, kind }) => id === moduleId && kind === "module"))) {
    issues.push("every target file package and module must exist in dependencyNodes")
  }
  if (system.totalBudget.targetForecastProductLines * 100 >
      system.totalBudget.preservedPrototypeProductLines * 50 ||
    system.totalBudget.actualPercentage > 50) {
    issues.push("target forecast exceeds the frozen 50% product-source ceiling")
  }
  if (system.totalBudget.selectedMachineLines * 100 >
      system.totalBudget.selectedMachineReferenceLines * 60 ||
    system.totalBudget.selectedMachineActualPercentage > 60) {
    issues.push("selected machine exceeds the frozen 60% slice ceiling")
  }
  if (system.marginalBudget.medianGrossProductAdditionLines > 40 ||
    system.marginalBudget.p90GrossProductAdditionLines > 100 ||
    system.marginalBudget.maximumGrossProductAdditionLines > 200) {
    issues.push("marginal change measurements exceed the frozen budgets")
  }
  if (system.marginalBudget.p90GrossProductAdditionLines !==
    system.marginalBudget.maximumGrossProductAdditionLines) {
    issues.push("nine-probe nearest-rank p90 must equal the observed maximum")
  }
  for (const [label, values] of [
    ["coverage.productRowIds", system.coverage.productRowIds],
    ["coverage.propositionIds", system.coverage.propositionIds],
    ["coverage.migrationUnitIds", system.coverage.migrationUnitIds],
    ["coverage.publicUnitIds", system.coverage.publicUnitIds],
    ["coverage.durableFormatIds", system.coverage.durableFormatIds]
  ] as const) {
    issues.push(...sortedUniqueIssues(label, values))
  }
  return canonicalIssues(issues)
}

export const selectionAuthorityInvariantIssues = (
  selection: FreezeSelectionAuthorityV1
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  for (const [scope, coordinate] of [
    ["machine", selection.machine],
    ["topology", selection.topology]
  ] as const) {
    const hasDecision = coordinate.decisionDocumentId !== null &&
      coordinate.decisionFileSha256 !== null
    if ((coordinate.selectionMode === "maintainer-approved") !== hasDecision ||
      (coordinate.decisionDocumentId === null) !== (coordinate.decisionFileSha256 === null)) {
      issues.push(`${scope} selection mode and decision authority are inconsistent`)
    }
  }
  return canonicalIssues(issues)
}

export const freezeFactSetInvariantIssues = (
  factSet: FreezeFactSetV1
): ReadonlyArray<string> => {
  const issues: Array<string> = [
    ...surfaceFreezeInvariantIssues(factSet.surface),
    ...migrationFreezeInvariantIssues(factSet.migration),
    ...wavesFreezeInvariantIssues(factSet.waves),
    ...gatesFreezeInvariantIssues(factSet.gates),
    ...systemFreezeInvariantIssues(factSet.system)
  ]
  issues.push(...sortedUniqueIssues(
    "inputBindings",
    factSet.inputBindings.map(({ id }) => id)
  ))
  issues.push(...sortedUniqueIssues(
    "closedPrerequisites",
    factSet.closedPrerequisites.map(({ id }) => id)
  ))
  const closedIds = factSet.closedPrerequisites.map(({ id }) => id)
  if (!exactOrdered(closedIds, [...REQUIRED_FREEZE_PREREQUISITE_IDS].sort(codePointCompare))) {
    issues.push("closedPrerequisites must equal the exact frozen prerequisite set")
  }
  const inputIds = factSet.inputBindings.map(({ id }) => id)
  if (REQUIRED_FREEZE_INPUT_IDS.some((id) =>
    !inputIds.some((actual) => actual === id))) {
    issues.push("inputBindings omit one or more required freeze authorities")
  }
  const packageIds = factSet.surface.packages.map(({ packageId }) => packageId)
  const moduleIds = factSet.surface.packages.flatMap(({ moduleIds: ids }) => ids)
  for (const row of factSet.migration.rows) {
    if (row.target._tag === "Targeted" &&
      (!packageIds.includes(row.target.packageId) || !moduleIds.includes(row.target.moduleId))) {
      issues.push(`${row.id} targets a package or module absent from SURFACE facts`)
    }
  }
  const waveIds = factSet.waves.waves.map(({ id }) => id)
  const migrationRowIds = factSet.migration.rows.map(({ id }) => id)
  for (const wave of factSet.waves.waves) {
    if (wave.packageIds.some((id) => !packageIds.includes(id)) ||
      wave.moduleIds.some((id) => !moduleIds.includes(id))) {
      issues.push(`${wave.id} targets a package or module absent from SURFACE facts`)
    }
    if (wave.deletionMigrationRowIds.some((id) => !migrationRowIds.includes(id))) {
      issues.push(`${wave.id} has a dangling migration row`)
    }
  }
  const gateIds = factSet.gates.gates.map(({ id }) => id)
  for (const wave of factSet.waves.waves) {
    if (wave.gateIds.some((id) => !gateIds.includes(id))) {
      issues.push(`${wave.id} has a dangling gate`)
    }
  }
  for (const gate of factSet.gates.gates) {
    if (!waveIds.includes(gate.waveId)) issues.push(`${gate.id} has a dangling wave`)
  }
  if (!exactOrdered(
    [...factSet.system.dependencyNodes].map(({ id }) => id),
    factSet.surface.dependencyNodes.map(({ id }) => id)
  ) || !exactOrdered(
    factSet.system.dependencyDag.map((edge) => JSON.stringify(edge)),
    factSet.surface.dependencyDag.map((edge) => JSON.stringify(edge))
  )) {
    issues.push("SYSTEM target dependency graph must equal the SURFACE dependency graph")
  }
  if (!exactOrdered(factSet.system.coverage.productRowIds, factSet.waves.requiredProductRowIds) ||
    !exactOrdered(factSet.system.coverage.propositionIds, factSet.waves.requiredPropositionIds) ||
    !exactOrdered(factSet.system.coverage.migrationUnitIds, factSet.waves.requiredMigrationUnitIds)) {
    issues.push("SYSTEM coverage must equal exact WAVES coverage authority")
  }
  const { factSetId: _factSetId, ...body } = factSet
  if (factSet.factSetId !== computeFreezeFactSetId(body)) {
    issues.push("factSetId must bind the canonical freeze fact-set body")
  }
  return canonicalIssues(issues)
}

const assertIssues = (artifact: string, issues: ReadonlyArray<string>): void => {
  if (issues.length > 0) {
    throw new FreezeContractInvariantError(
      artifact,
      issues as [string, ...Array<string>]
    )
  }
}

export const FREEZE_FACT_SET_HASH_DOMAIN = "ts-release/architecture-freeze-facts/v1"
export const FREEZE_CONTRACT_HASH_DOMAIN = "ts-release/architecture-freeze-contract/v1"
export const SURFACE_FREEZE_HASH_DOMAIN = "ts-release/architecture-surface-freeze/v1"
export const MIGRATION_FREEZE_HASH_DOMAIN = "ts-release/architecture-migration-freeze/v1"
export const WAVES_FREEZE_HASH_DOMAIN = "ts-release/architecture-waves-freeze/v1"
export const GATES_FREEZE_HASH_DOMAIN = "ts-release/architecture-gates-freeze/v1"
export const SYSTEM_FREEZE_HASH_DOMAIN = "ts-release/architecture-system-freeze/v1"

export const computeFreezeFactSetId = (input: unknown) =>
  hashCanonicalValue(FREEZE_FACT_SET_HASH_DOMAIN, encodeFactSetBody(input))

export const computeFreezeContractId = (
  factSetId: typeof Sha256Hex.Type,
  selection: FreezeSelectionAuthorityV1
) => {
  assertIssues("selection", selectionAuthorityInvariantIssues(selection))
  return hashCanonicalValue(FREEZE_CONTRACT_HASH_DOMAIN, {
    factSetId,
    selection: Schema.encodeUnknownSync(FreezeSelectionAuthorityV1, strictOptions)(selection)
  })
}

export const makeFreezeFactSet = (input: unknown): FreezeFactSetV1 => {
  const body = Schema.decodeUnknownSync(FreezeFactSetBodyV1, strictOptions)(input)
  const factSet = new FreezeFactSetV1({ factSetId: computeFreezeFactSetId(body), ...body })
  assertIssues("freeze facts", freezeFactSetInvariantIssues(factSet))
  return factSet
}

export const decodeFreezeFactSet = Effect.fn("FreezeFactSetV1.decode")(
  function* (input: unknown) {
    const factSet = yield* decodeFactSetStructure(input)
    const issues = freezeFactSetInvariantIssues(factSet)
    if (issues.length > 0) {
      return yield* new FreezeContractInvariantError(
        "freeze facts",
        issues as [string, ...Array<string>]
      )
    }
    return factSet
  }
)

export const encodeFreezeFactSet = (factSet: FreezeFactSetV1): unknown => {
  assertIssues("freeze facts", freezeFactSetInvariantIssues(factSet))
  return encodeFactSetStructure(factSet)
}

type SurfaceBody = typeof SurfaceDocumentBody.Type
type MigrationBody = typeof MigrationDocumentBody.Type
type WavesBody = typeof WavesDocumentBody.Type
type GatesBody = typeof GatesDocumentBody.Type
type SystemBody = typeof SystemDocumentBody.Type

const makeDocument = <A>(
  domain: string,
  body: A,
  encodeBody: (body: A) => unknown,
  construct: (id: typeof Sha256Hex.Type) => SurfaceFreezeV1 | MigrationFreezeV1 |
    WavesFreezeV1 | GatesFreezeV1 | SystemFreezeV1
) => {
  const id = hashCanonicalValue(domain, encodeBody(body))
  return construct(id)
}

export const makeSurfaceFreeze = (body: SurfaceBody): SurfaceFreezeV1 => {
  assertIssues("SURFACE", surfaceFreezeInvariantIssues(body))
  return makeDocument(SURFACE_FREEZE_HASH_DOMAIN, body, encodeSurfaceBody,
    (documentId) => new SurfaceFreezeV1({ documentId, ...body })) as SurfaceFreezeV1
}

export const makeMigrationFreeze = (body: MigrationBody): MigrationFreezeV1 => {
  assertIssues("MIGRATION", migrationFreezeInvariantIssues(body))
  return makeDocument(MIGRATION_FREEZE_HASH_DOMAIN, body, encodeMigrationBody,
    (documentId) => new MigrationFreezeV1({ documentId, ...body })) as MigrationFreezeV1
}

export const makeWavesFreeze = (body: WavesBody): WavesFreezeV1 => {
  assertIssues("WAVES", wavesFreezeInvariantIssues(body))
  return makeDocument(WAVES_FREEZE_HASH_DOMAIN, body, encodeWavesBody,
    (documentId) => new WavesFreezeV1({ documentId, ...body })) as WavesFreezeV1
}

export const makeGatesFreeze = (body: GatesBody): GatesFreezeV1 => {
  assertIssues("GATES", gatesFreezeInvariantIssues(body))
  return makeDocument(GATES_FREEZE_HASH_DOMAIN, body, encodeGatesBody,
    (documentId) => new GatesFreezeV1({ documentId, ...body })) as GatesFreezeV1
}

export const makeSystemFreeze = (body: SystemBody): SystemFreezeV1 => {
  assertIssues("SYSTEM", systemFreezeInvariantIssues(body))
  assertIssues("SYSTEM selection", selectionAuthorityInvariantIssues(body.selection))
  return makeDocument(SYSTEM_FREEZE_HASH_DOMAIN, body, encodeSystemBody,
    (systemId) => new SystemFreezeV1({ systemId, ...body })) as SystemFreezeV1
}

const documentInvariantIssues = <A extends { readonly contractId: string }>(
  document: A,
  expectedContractId: string,
  expectedId: string,
  actualId: string,
  factIssues: ReadonlyArray<string>
): ReadonlyArray<string> => canonicalIssues([
  ...factIssues,
  ...(document.contractId === expectedContractId ? [] : ["contractId mismatch"]),
  ...(actualId === expectedId ? [] : ["document identity hash mismatch"])
])

export const decodeSurfaceFreeze = Effect.fn("SurfaceFreezeV1.decode")(
  function* (input: unknown, expectedContractId: typeof Sha256Hex.Type) {
    const document = yield* decodeSurfaceStructure(input)
    const { documentId: _documentId, ...body } = document
    const issues = documentInvariantIssues(
      document,
      expectedContractId,
      hashCanonicalValue(SURFACE_FREEZE_HASH_DOMAIN, encodeSurfaceBody(body)),
      document.documentId,
      surfaceFreezeInvariantIssues(document)
    )
    if (issues.length > 0) yield* new FreezeContractInvariantError("SURFACE", issues as [string, ...Array<string>])
    return document
  }
)

export const decodeMigrationFreeze = Effect.fn("MigrationFreezeV1.decode")(
  function* (input: unknown, expectedContractId: typeof Sha256Hex.Type) {
    const document = yield* decodeMigrationStructure(input)
    const { documentId: _documentId, ...body } = document
    const issues = documentInvariantIssues(
      document,
      expectedContractId,
      hashCanonicalValue(MIGRATION_FREEZE_HASH_DOMAIN, encodeMigrationBody(body)),
      document.documentId,
      migrationFreezeInvariantIssues(document)
    )
    if (issues.length > 0) yield* new FreezeContractInvariantError("MIGRATION", issues as [string, ...Array<string>])
    return document
  }
)

export const decodeWavesFreeze = Effect.fn("WavesFreezeV1.decode")(
  function* (input: unknown, expectedContractId: typeof Sha256Hex.Type) {
    const document = yield* decodeWavesStructure(input)
    const { documentId: _documentId, ...body } = document
    const issues = documentInvariantIssues(
      document,
      expectedContractId,
      hashCanonicalValue(WAVES_FREEZE_HASH_DOMAIN, encodeWavesBody(body)),
      document.documentId,
      wavesFreezeInvariantIssues(document)
    )
    if (issues.length > 0) yield* new FreezeContractInvariantError("WAVES", issues as [string, ...Array<string>])
    return document
  }
)

export const decodeGatesFreeze = Effect.fn("GatesFreezeV1.decode")(
  function* (input: unknown, expectedContractId: typeof Sha256Hex.Type) {
    const document = yield* decodeGatesStructure(input)
    const { documentId: _documentId, ...body } = document
    const issues = documentInvariantIssues(
      document,
      expectedContractId,
      hashCanonicalValue(GATES_FREEZE_HASH_DOMAIN, encodeGatesBody(body)),
      document.documentId,
      gatesFreezeInvariantIssues(document)
    )
    if (issues.length > 0) yield* new FreezeContractInvariantError("GATES", issues as [string, ...Array<string>])
    return document
  }
)

export const decodeSystemFreeze = Effect.fn("SystemFreezeV1.decode")(
  function* (input: unknown, expectedContractId: typeof Sha256Hex.Type) {
    const document = yield* decodeSystemStructure(input)
    const { systemId: _systemId, ...body } = document
    const issues = documentInvariantIssues(
      document,
      expectedContractId,
      hashCanonicalValue(SYSTEM_FREEZE_HASH_DOMAIN, encodeSystemBody(body)),
      document.systemId,
      [
        ...systemFreezeInvariantIssues(document),
        ...selectionAuthorityInvariantIssues(document.selection)
      ]
    )
    if (issues.length > 0) yield* new FreezeContractInvariantError("SYSTEM", issues as [string, ...Array<string>])
    return document
  }
)

export const encodeSurfaceFreeze = (document: SurfaceFreezeV1): unknown =>
  encodeSurfaceStructure(document)
export const encodeMigrationFreeze = (document: MigrationFreezeV1): unknown =>
  encodeMigrationStructure(document)
export const encodeWavesFreeze = (document: WavesFreezeV1): unknown =>
  encodeWavesStructure(document)
export const encodeGatesFreeze = (document: GatesFreezeV1): unknown =>
  encodeGatesStructure(document)
export const encodeSystemFreeze = (document: SystemFreezeV1): unknown =>
  encodeSystemStructure(document)
