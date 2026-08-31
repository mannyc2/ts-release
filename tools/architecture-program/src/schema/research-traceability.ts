import { Effect, Schema } from "effect"
import {
  ArtifactId,
  Description,
  EvidenceId,
  OwnerId,
  ProgramId,
  SourceRecordId,
  TraceabilityId,
  TraceabilityTargetId,
  WitnessKindId
} from "./primitives.js"
import { SourceCoordinate, sourceCoordinateKey } from "./source-coordinate.js"
import {
  INTERNAL_TRACEABILITY_TARGET_IDS,
  PRODUCT_CENSUS_SUCCESSOR_BY_SOURCE_ID,
  PRODUCT_INTEGRATION_PENDING_SOURCE_IDS,
  PRODUCT_OWNER_CODE_GROUPS,
  PRODUCT_SOURCE_GROUPS,
  PRODUCT_SUCCESSOR_GROUPS,
  RESOLVED_DECISION_BY_SOURCE_ID,
  SCORECARD_EVIDENCE_IDS,
  SUPPLEMENTAL_OWNER_GROUPS,
  SUPPLEMENTAL_SOURCE_GROUPS,
  SUPPLEMENTAL_STATE_GROUPS,
  SUPPLEMENTAL_SUCCESSOR_GROUPS,
  coordinateLocator,
  traceabilityIdForProductSource
} from "../research-traceability-oracle.js"
import { REQUIRED_OWNERSHIP_DECISION_IDS } from "./ownership-decisions.js"
import {
  REQUIRED_CASE_IDS,
  REQUIRED_LAW_IDS,
  REQUIRED_MACHINE_CANDIDATE_IDS,
  REQUIRED_MACHINE_GATE_IDS,
  REQUIRED_PROBE_IDS,
  REQUIRED_TOPOLOGY_CANDIDATE_IDS,
  REQUIRED_TOPOLOGY_GATE_IDS
} from "./trial-spec.js"

export const REQUIRED_WITNESS_KIND_IDS = [
  "witness.provider-acceptance",
  "witness.authoritative-metadata",
  "witness.intended-bytes",
  "witness.consumer-behavior",
  "witness.interruption-continuation"
] as const

export const REQUIRED_RESOLVED_LATER_SOURCE_IDS = [
  "P05-04",
  "P05-07",
  "P09-04",
  "P09-05",
  "P09-06",
  "Q03",
  "Q05-02",
  "Q06-01",
  "Q06-02",
  "Q07"
] as const

export const REQUIRED_DECISION_IDS = [
  "DEC01",
  "DEC02",
  "DEC03",
  "DEC04",
  "DEC05",
  "DEC06",
  "DEC07",
  "DEC08",
  "DEC09"
] as const

const PropositionClass = Schema.Literals([
  "product-outcome",
  "maintained-destination",
  "later-outcome",
  "census-disposition",
  "research-law",
  "rejected-candidate",
  "deferred-seam",
  "historical-lesson",
  "historical-api",
  "historical-format",
  "historical-topology",
  "historical-metric"
])

const PropositionDisposition = Schema.Literals([
  "accept",
  "reject",
  "supersede",
  "defer",
  "adjacent",
  "historical-only"
])

const PropositionStatus = Schema.Literals([
  "required",
  "rewrite-missing",
  "integration-pending",
  "deferred-later",
  "provisional-open",
  "retired",
  "pending-migration-decision",
  "comparator-only"
])

export class ResearchProposition extends Schema.Class<ResearchProposition>(
  "ResearchProposition"
)({
  id: TraceabilityId,
  sourceRecordId: Schema.Union([SourceRecordId, Schema.Null]),
  sourceCoordinates: Schema.NonEmptyArray(SourceCoordinate),
  proposition: Description,
  class: PropositionClass,
  disposition: PropositionDisposition,
  ownerIds: Schema.NonEmptyArray(OwnerId),
  sourceOwnerCode: Schema.Union([Description, Schema.Null]),
  requiredWitnessKinds: Schema.Array(WitnessKindId),
  witnessArtifactIds: Schema.Array(ArtifactId),
  evidenceIds: Schema.Array(EvidenceId),
  currentStatus: PropositionStatus,
  successorIds: Schema.Array(TraceabilityTargetId),
  productAuthority: Schema.Boolean,
  decisionId: Schema.Union([SourceRecordId, Schema.Null])
}) {}

const CoverageContract = Schema.Struct({
  selectedProductOutcomes: Schema.Literal(69),
  resolvedLaterCandidates: Schema.Literal(10),
  deferredMaintainedDestinations: Schema.Literal(7),
  preexistingNamedLaterOutcomes: Schema.Literal(20),
  censusOnlyDispositions: Schema.Literal(23),
  productScopeRecords: Schema.Literal(129),
  acceptedResearchLaws: Schema.Literal(27),
  rejectedOrSupersededResearchPropositions: Schema.Literal(30),
  deferredOrProvisionalSeams: Schema.Literal(15),
  retainedHistoricalLessons: Schema.Literal(9),
  explicitHistoricalCommitments: Schema.Literal(16),
  normalizedResearchAndHistoryRecords: Schema.Literal(97),
  totalPropositions: Schema.Literal(226),
  unresolvedScorecardDecisions: Schema.Literal(0)
})

const NormalizationPolicy = Schema.Struct({
  productScopeAuthority: Schema.Literal("docs/refactor/research/launch-scorecard.md"),
  productRowsAreParsedAtomically: Schema.Literal(true),
  decisionRowsAreGroupingsNotPropositions: Schema.Literal(true),
  witnessKindsAreRequirementsNotObservedEvidence: Schema.Literal(true),
  historicalBudgetsAreComparatorsOnly: Schema.Literal(true),
  deferredRowsMayOmitSuccessors: Schema.Literal(true),
  requiredAndSupersededRowsRequireSuccessors: Schema.Literal(true),
  productAuthorityLimitedToScorecardAndCensus: Schema.Literal(true),
  independentSourceLedgerOracle: Schema.Literal(
    "tools/architecture-program/src/research-traceability-oracle.ts"
  ),
  exactSourceDenominatorsRequired: Schema.Literal(true),
  canonicalOwnersSeparatedFromSourceCodes: Schema.Literal(true),
  referencesResolveAgainstClosedRegistries: Schema.Literal(true)
})

export class ResearchTraceabilityV1 extends Schema.Class<ResearchTraceabilityV1>(
  "ResearchTraceabilityV1"
)({
  schemaVersion: Schema.Literal("ts-release/research-traceability/v1"),
  programId: ProgramId,
  coverage: CoverageContract,
  normalizationPolicy: NormalizationPolicy,
  propositions: Schema.Array(ResearchProposition)
}) {}

export class ResearchTraceabilityInvariantError extends Schema.TaggedError<ResearchTraceabilityInvariantError>()(
  "ResearchTraceabilityInvariantError",
  {
    issues: Schema.NonEmptyArray(Schema.String),
    message: Schema.String
  }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Research traceability invariant failure: ${issues.join("; ")}`
    })
  }
}

const duplicates = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]

const expectedClassCounts: Readonly<Record<string, number>> = {
  "product-outcome": 69,
  "maintained-destination": 7,
  "later-outcome": 30,
  "census-disposition": 23,
  "research-law": 27,
  "rejected-candidate": 30,
  "deferred-seam": 15,
  "historical-lesson": 9,
  "historical-api": 5,
  "historical-format": 5,
  "historical-topology": 1,
  "historical-metric": 5
}

const productGroupBySourceId = new Map(
  PRODUCT_SOURCE_GROUPS.flatMap((group) =>
    group.sourceIds.map((sourceId) => [sourceId, group] as const))
)
const productOwnerBySourceId = new Map(
  PRODUCT_OWNER_CODE_GROUPS.flatMap((group) =>
    group.sourceIds.map((sourceId) => [sourceId, group] as const))
)
const productSuccessorBySourceId = new Map(
  PRODUCT_SUCCESSOR_GROUPS.flatMap((group) =>
    group.sourceIds.map((sourceId) => [sourceId, group.successorId] as const))
)
const supplementalSourceById = new Map(
  SUPPLEMENTAL_SOURCE_GROUPS.flatMap((group) =>
    group.propositionIds.map((id) => [id, group] as const))
)
const supplementalStateById = new Map(
  SUPPLEMENTAL_STATE_GROUPS.flatMap((group) =>
    group.propositionIds.map((id) => [id, group] as const))
)
const supplementalOwnerById = new Map(
  SUPPLEMENTAL_OWNER_GROUPS.flatMap((group) =>
    group.propositionIds.map((id) => [id, group.ownerIds] as const))
)
const supplementalSuccessorById = new Map(
  SUPPLEMENTAL_SUCCESSOR_GROUPS.flatMap((group) =>
    group.propositionIds.map((id) => [id, group.successorIds] as const))
)

const expectedProductIds = PRODUCT_SOURCE_GROUPS.flatMap((group) =>
  group.sourceIds.map((sourceId) => traceabilityIdForProductSource(sourceId, group.idNamespace)))
const expectedSupplementalIds = SUPPLEMENTAL_SOURCE_GROUPS.flatMap(({ propositionIds }) => propositionIds)
const expectedPropositionIds = [...expectedProductIds, ...expectedSupplementalIds]
const expectedProductSourceIds = PRODUCT_SOURCE_GROUPS.flatMap(({ sourceIds }) => sourceIds)

const knownEvidenceIds = new Set<string>([
  ...SCORECARD_EVIDENCE_IDS,
  ...SUPPLEMENTAL_SOURCE_GROUPS.map(({ sourceKey }) => sourceKey)
])
const knownTargetIds = new Set<string>([
  ...REQUIRED_LAW_IDS,
  ...REQUIRED_CASE_IDS,
  ...REQUIRED_PROBE_IDS,
  ...REQUIRED_MACHINE_CANDIDATE_IDS,
  ...REQUIRED_TOPOLOGY_CANDIDATE_IDS,
  ...REQUIRED_MACHINE_GATE_IDS,
  ...REQUIRED_TOPOLOGY_GATE_IDS,
  ...REQUIRED_OWNERSHIP_DECISION_IDS,
  ...REQUIRED_WITNESS_KIND_IDS,
  ...INTERNAL_TRACEABILITY_TARGET_IDS,
  ...expectedPropositionIds
])

const exactOrderedValues = (
  label: string,
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
  issues: Array<string>
): void => {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    issues.push(`${label} must equal [${expected.join(", ")}], received [${actual.join(", ")}]`)
  }
}

const exactUnorderedValues = (
  label: string,
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
  issues: Array<string>
): void => {
  exactOrderedValues(label, [...actual].sort(), [...expected].sort(), issues)
}

const checkOracleGroups = (
  label: string,
  groups: ReadonlyArray<ReadonlyArray<string>>,
  expectedTotal: number,
  issues: Array<string>
): void => {
  const values = groups.flatMap((group) => group)
  const duplicateValues = duplicates(values)
  if (duplicateValues.length > 0) {
    issues.push(`${label} oracle contains duplicate ids: ${duplicateValues.join(", ")}`)
  }
  if (values.length !== expectedTotal) {
    issues.push(`${label} oracle must contain ${expectedTotal} ids, received ${values.length}`)
  }
}

export const researchTraceabilityInvariantIssues = (
  document: ResearchTraceabilityV1
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  if (document.programId !== "ts-release-architecture-program") {
    issues.push("programId must remain ts-release-architecture-program")
  }
  if (document.propositions.length !== 226) {
    issues.push(`propositions must contain exactly 226 rows, received ${document.propositions.length}`)
  }

  const ids = document.propositions.map(({ id }) => id)
  const duplicateIds = duplicates(ids)
  if (duplicateIds.length > 0) issues.push(`duplicate proposition ids: ${duplicateIds.join(", ")}`)
  exactUnorderedValues("proposition ids", ids, expectedPropositionIds, issues)

  for (const group of PRODUCT_SOURCE_GROUPS) {
    if (group.sourceIds.length !== group.expectedCount) {
      issues.push(`${group.sourceKey} oracle denominator is ${group.expectedCount}, but its ledger contains ${group.sourceIds.length} ids`)
    }
    const actual = document.propositions.filter(({ sourceRecordId }) =>
      sourceRecordId !== null && group.sourceIds.includes(sourceRecordId)).length
    if (actual !== group.expectedCount) {
      issues.push(`${group.sourceKey} must contain ${group.expectedCount} rows, received ${actual}`)
    }
  }
  for (const group of SUPPLEMENTAL_SOURCE_GROUPS) {
    if (group.propositionIds.length !== group.expectedCount) {
      issues.push(`${group.sourceKey} oracle denominator is ${group.expectedCount}, but its ledger contains ${group.propositionIds.length} ids`)
    }
    const rows = document.propositions.filter(({ id }) => group.propositionIds.includes(id))
    if (rows.length !== group.expectedCount) {
      issues.push(`${group.sourceKey} must contain ${group.expectedCount} rows, received ${rows.length}`)
    }
    const actualLocators = [...new Set(rows.flatMap(({ sourceCoordinates }) =>
      sourceCoordinates.map(coordinateLocator)))]
    exactUnorderedValues(`${group.sourceKey} coordinate locators`, actualLocators, group.coordinateLocators, issues)
  }
  checkOracleGroups("product source", PRODUCT_SOURCE_GROUPS.map(({ sourceIds }) => sourceIds), 129, issues)
  checkOracleGroups("product owner", PRODUCT_OWNER_CODE_GROUPS.map(({ sourceIds }) => sourceIds), 106, issues)
  checkOracleGroups("product successor", PRODUCT_SUCCESSOR_GROUPS.map(({ sourceIds }) => sourceIds), 69, issues)
  checkOracleGroups("supplemental source", SUPPLEMENTAL_SOURCE_GROUPS.map(({ propositionIds }) => propositionIds), 97, issues)
  checkOracleGroups("supplemental state", SUPPLEMENTAL_STATE_GROUPS.map(({ propositionIds }) => propositionIds), 97, issues)
  checkOracleGroups("supplemental owner", SUPPLEMENTAL_OWNER_GROUPS.map(({ propositionIds }) => propositionIds), 97, issues)
  checkOracleGroups("supplemental successor", SUPPLEMENTAL_SUCCESSOR_GROUPS.map(({ propositionIds }) => propositionIds), 97, issues)

  const sourceRecordIds = document.propositions.flatMap(({ sourceRecordId }) =>
    sourceRecordId === null ? [] : [sourceRecordId])
  const duplicateSourceRecordIds = duplicates(sourceRecordIds)
  if (duplicateSourceRecordIds.length > 0) {
    issues.push(`duplicate source record ids: ${duplicateSourceRecordIds.join(", ")}`)
  }
  exactUnorderedValues("product source record ids", sourceRecordIds, expectedProductSourceIds, issues)

  for (const [className, expected] of Object.entries(expectedClassCounts)) {
    const actual = document.propositions.filter((row) => row.class === className).length
    if (actual !== expected) issues.push(`${className} rows must total ${expected}, received ${actual}`)
  }

  const productAuthorityRows = document.propositions.filter(({ productAuthority }) => productAuthority)
  if (productAuthorityRows.length !== 129) {
    issues.push(`productAuthority must identify exactly 129 rows, received ${productAuthorityRows.length}`)
  }
  exactUnorderedValues(
    "product authority ids",
    productAuthorityRows.map(({ id }) => id),
    expectedProductIds,
    issues
  )

  exactUnorderedValues(
    "resolved-later source oracle",
    Object.keys(RESOLVED_DECISION_BY_SOURCE_ID),
    REQUIRED_RESOLVED_LATER_SOURCE_IDS,
    issues
  )
  exactUnorderedValues(
    "resolved-later decision oracle",
    [...new Set(Object.values(RESOLVED_DECISION_BY_SOURCE_ID))],
    REQUIRED_DECISION_IDS,
    issues
  )

  for (const row of document.propositions) {
    const productGroup = row.sourceRecordId === null
      ? undefined
      : productGroupBySourceId.get(row.sourceRecordId)
    if (productGroup !== undefined && row.sourceRecordId !== null) {
      const expectedId = traceabilityIdForProductSource(row.sourceRecordId, productGroup.idNamespace)
      if (row.id !== expectedId) issues.push(`${row.sourceRecordId} must use proposition id ${expectedId}`)
      if (!row.productAuthority) issues.push(`${row.id} must carry product authority`)
      if (row.class !== productGroup.propositionClass) {
        issues.push(`${row.id} must have class ${productGroup.propositionClass}`)
      }
      if (row.disposition !== productGroup.disposition) {
        issues.push(`${row.id} must have disposition ${productGroup.disposition}`)
      }
      const expectedStatus = PRODUCT_INTEGRATION_PENDING_SOURCE_IDS.includes(row.sourceRecordId)
        ? "integration-pending"
        : productGroup.status
      if (row.currentStatus !== expectedStatus) {
        issues.push(`${row.id} must have current status ${expectedStatus}`)
      }
      const ownerGroup = productOwnerBySourceId.get(row.sourceRecordId)
      if (productGroup.idNamespace === "census") {
        if (row.sourceOwnerCode !== null) issues.push(`${row.id} census row cannot carry a source owner code`)
        exactOrderedValues(`${row.id} owners`, row.ownerIds, ["product-scope"], issues)
      } else if (ownerGroup === undefined) {
        issues.push(`${row.id} has no owner-code oracle entry`)
      } else {
        if (row.sourceOwnerCode !== ownerGroup.code) {
          issues.push(`${row.id} source owner code must be ${ownerGroup.code}`)
        }
        exactOrderedValues(`${row.id} owners`, row.ownerIds, ownerGroup.ownerIds, issues)
      }
      const selectedSuccessor = productSuccessorBySourceId.get(row.sourceRecordId)
      const censusSuccessor = PRODUCT_CENSUS_SUCCESSOR_BY_SOURCE_ID[row.sourceRecordId]
      const expectedSuccessors = selectedSuccessor === undefined
        ? (censusSuccessor === undefined ? [] : [censusSuccessor])
        : [selectedSuccessor]
      exactOrderedValues(`${row.id} successors`, row.successorIds, expectedSuccessors, issues)
      const expectedDecision = RESOLVED_DECISION_BY_SOURCE_ID[row.sourceRecordId] ?? null
      if (row.decisionId !== expectedDecision) {
        issues.push(`${row.id} decision must be ${expectedDecision ?? "null"}`)
      }
      if (row.sourceCoordinates.length !== 1) {
        issues.push(`${row.id} must have exactly one atomic scorecard coordinate`)
      } else {
        const coordinate = row.sourceCoordinates[0]
        if (coordinate._tag !== "CurrentLineRangeSourceCoordinate" ||
          coordinate.path !== "docs/refactor/research/launch-scorecard.md" ||
          coordinate.startLine !== coordinate.endLine) {
          issues.push(`${row.id} must use one atomic current scorecard line coordinate`)
        }
      }
      if (productGroup.idNamespace === "census") {
        exactOrderedValues(`${row.id} evidence ids`, row.evidenceIds, [], issues)
      } else if (row.evidenceIds.length === 0) {
        issues.push(`${row.id} must retain at least one scorecard evidence id`)
      }
    } else {
      if (row.sourceRecordId !== null) issues.push(`${row.id} references unknown source record ${row.sourceRecordId}`)
      if (row.productAuthority) issues.push(`${row.id} cannot carry product authority outside the product ledger`)
      if (row.sourceOwnerCode !== null) issues.push(`${row.id} supplemental row cannot carry a source owner code`)
      const sourceGroup = supplementalSourceById.get(row.id)
      const stateGroup = supplementalStateById.get(row.id)
      const expectedOwners = supplementalOwnerById.get(row.id)
      const expectedSuccessors = supplementalSuccessorById.get(row.id)
      if (sourceGroup === undefined || stateGroup === undefined ||
        expectedOwners === undefined || expectedSuccessors === undefined) {
        issues.push(`${row.id} is absent from one or more independent supplemental oracle partitions`)
      } else {
        exactOrderedValues(`${row.id} evidence ids`, row.evidenceIds, [sourceGroup.sourceKey], issues)
        if (row.class !== stateGroup.propositionClass) {
          issues.push(`${row.id} must have class ${stateGroup.propositionClass}`)
        }
        if (row.disposition !== stateGroup.disposition) {
          issues.push(`${row.id} must have disposition ${stateGroup.disposition}`)
        }
        if (row.currentStatus !== stateGroup.status) {
          issues.push(`${row.id} must have current status ${stateGroup.status}`)
        }
        exactOrderedValues(`${row.id} owners`, row.ownerIds, expectedOwners, issues)
        exactOrderedValues(`${row.id} successors`, row.successorIds, expectedSuccessors, issues)
        const allowedLocators = new Set(sourceGroup.coordinateLocators)
        for (const coordinate of row.sourceCoordinates) {
          const locator = coordinateLocator(coordinate)
          if (!allowedLocators.has(locator)) {
            issues.push(`${row.id} uses source coordinate outside ${sourceGroup.sourceKey}: ${locator}`)
          }
        }
      }
      if (row.decisionId !== null) issues.push(`${row.id} cannot carry a scorecard decision id`)
    }

    const ownerDuplicates = duplicates(row.ownerIds)
    if (ownerDuplicates.length > 0) {
      issues.push(`${row.id} contains duplicate owners: ${ownerDuplicates.join(", ")}`)
    }
    const witnessDuplicates = duplicates(row.requiredWitnessKinds)
    if (witnessDuplicates.length > 0) {
      issues.push(`${row.id} contains duplicate witness requirements: ${witnessDuplicates.join(", ")}`)
    }
    for (const witnessKind of row.requiredWitnessKinds) {
      if (!REQUIRED_WITNESS_KIND_IDS.includes(
        witnessKind as (typeof REQUIRED_WITNESS_KIND_IDS)[number]
      )) issues.push(`${row.id} contains unknown witness kind ${witnessKind}`)
    }
    const evidenceDuplicates = duplicates(row.evidenceIds)
    if (evidenceDuplicates.length > 0) {
      issues.push(`${row.id} contains duplicate evidence ids: ${evidenceDuplicates.join(", ")}`)
    }
    for (const evidenceId of row.evidenceIds) {
      if (!knownEvidenceIds.has(evidenceId)) issues.push(`${row.id} references unknown evidence ${evidenceId}`)
    }
    const successorDuplicates = duplicates(row.successorIds)
    if (successorDuplicates.length > 0) {
      issues.push(`${row.id} contains duplicate successors: ${successorDuplicates.join(", ")}`)
    }
    for (const successorId of row.successorIds) {
      if (!knownTargetIds.has(successorId)) issues.push(`${row.id} references unknown successor ${successorId}`)
    }
    const coordinateDuplicates = duplicates(row.sourceCoordinates.map(sourceCoordinateKey))
    if (coordinateDuplicates.length > 0) {
      issues.push(`${row.id} contains duplicate source coordinates`)
    }
    if ((row.disposition === "accept" || row.disposition === "supersede" ||
      row.currentStatus === "required") && row.successorIds.length === 0) {
      issues.push(`${row.id} is required/accepted/superseded without a successor`)
    }
    if (row.witnessArtifactIds.length > 0) {
      issues.push(`${row.id} claims obtained witness artifacts before trial execution`)
    }
  }

  return issues
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeDocument = Schema.decodeUnknownEffect(ResearchTraceabilityV1, strictOptions)
const encodeDocument = Schema.encodeUnknownSync(ResearchTraceabilityV1, strictOptions)

export const decodeResearchTraceability = Effect.fn("ResearchTraceabilityV1.decode")(
  function* (input: unknown) {
    const document = yield* decodeDocument(input)
    const issues = researchTraceabilityInvariantIssues(document)
    if (issues.length > 0) {
      return yield* Effect.fail(new ResearchTraceabilityInvariantError(
        issues as [string, ...Array<string>]
      ))
    }
    return document
  }
)

export const encodeResearchTraceability = (document: ResearchTraceabilityV1): unknown => {
  const issues = researchTraceabilityInvariantIssues(document)
  if (issues.length > 0) {
    throw new ResearchTraceabilityInvariantError(issues as [string, ...Array<string>])
  }
  return encodeDocument(document)
}
