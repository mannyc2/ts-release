import { Schema } from "effect"
import type { ArchitectureBaselineV1 } from "./schema/baseline.js"
import type { FreezeFactSetV1 } from "./schema/freeze-contract.js"
import {
  REQUIRED_FREEZE_PREREQUISITE_IDS
} from "./schema/freeze-contract.js"
import type { OwnershipDecisionsV1 } from "./schema/ownership-decisions.js"
import { ArtifactId, Description, Sha256Hex } from "./schema/primitives.js"
import type { ArchitectureTrialResultsV2 } from "./schema/trial-results-aggregate.js"
import { hashCanonicalValue } from "./trial-hash.js"

const ReadinessBlocker = Schema.Struct({
  id: ArtifactId,
  source: Schema.Literals([
    "ownership-decisions",
    "baseline",
    "trial-results",
    "freeze-facts"
  ]),
  reason: Description,
  requiredEvidence: Schema.NonEmptyArray(Description)
})
export type ReadinessBlocker = typeof ReadinessBlocker.Type

const SharedReadinessFields = {
  schemaVersion: Schema.Literal("ts-release/architecture-freeze-readiness/v1"),
  programId: Schema.Literal("ts-release-architecture-program")
} as const

const BlockedReadinessBody = Schema.TaggedStruct("Blocked", {
  ...SharedReadinessFields,
  blockers: Schema.NonEmptyArray(ReadinessBlocker)
})

const ReadyReadinessBody = Schema.TaggedStruct("Ready", {
  ...SharedReadinessFields,
  trialResultsAggregateId: Sha256Hex,
  factSetId: Sha256Hex
})

const FreezeReadinessBodyV1 = Schema.Union([BlockedReadinessBody, ReadyReadinessBody])

export class BlockedFreezeReadinessV1 extends Schema.TaggedClass<
  BlockedFreezeReadinessV1
>()("Blocked", {
  reportId: Sha256Hex,
  ...SharedReadinessFields,
  blockers: Schema.NonEmptyArray(ReadinessBlocker)
}) {}

export class ReadyFreezeReadinessV1 extends Schema.TaggedClass<ReadyFreezeReadinessV1>()(
  "Ready",
  {
    reportId: Sha256Hex,
    ...SharedReadinessFields,
    trialResultsAggregateId: Sha256Hex,
    factSetId: Sha256Hex
  }
) {}

export const FreezeReadinessReportV1 = Schema.Union([
  BlockedFreezeReadinessV1,
  ReadyFreezeReadinessV1
])
export type FreezeReadinessReportV1 = typeof FreezeReadinessReportV1.Type

export interface FreezeReadinessInput {
  readonly baseline: ArchitectureBaselineV1
  readonly ownership: OwnershipDecisionsV1
  readonly trialResults: ArchitectureTrialResultsV2 | null
  readonly factSet: FreezeFactSetV1 | null
}

export const FREEZE_READINESS_HASH_DOMAIN = "ts-release/architecture-freeze-readiness/v1"

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const encodeReadinessBody = Schema.encodeUnknownSync(FreezeReadinessBodyV1, strictOptions)
const encodeReadiness = Schema.encodeUnknownSync(FreezeReadinessReportV1, strictOptions)

const description = (value: string) => Description.make(value)
const blocker = (
  id: string,
  source: ReadinessBlocker["source"],
  reason: string,
  requiredEvidence: ReadonlyArray<string>
): ReadinessBlocker => ({
  id: ArtifactId.make(id),
  source,
  reason: description(reason),
  requiredEvidence: requiredEvidence.map(description) as [
    typeof Description.Type,
    ...Array<typeof Description.Type>
  ]
})

const candidatePrerequisiteId: Readonly<Record<string, string>> = {
  "M1-extracted-fold": "prerequisite.candidate-baseline-m1",
  "M2-total-transition": "prerequisite.candidate-baseline-m2",
  "T1-root": "prerequisite.candidate-baseline-t1",
  "T2-kernel-provider-bundle": "prerequisite.candidate-baseline-t2",
  "T3-provider-verticals": "prerequisite.candidate-baseline-t3"
}

const selectedCoordinate = (
  selection: ArchitectureTrialResultsV2["machineSelection"],
  decision: ArchitectureTrialResultsV2["machineMaintainerDecision"]
): boolean => selection._tag === "UniqueSelection" ||
  (selection._tag === "MaintainerDecisionRequired" && decision !== null)

const trialResultBlockers = (
  results: ArchitectureTrialResultsV2 | null
): ReadonlyArray<ReadinessBlocker> => {
  if (results === null) {
    return [blocker(
      "prerequisite.trial-results",
      "trial-results",
      "The canonical tool-produced trial-results aggregate is absent.",
      ["Run and validate both machine candidates before any topology or freeze selection."]
    )]
  }
  const blockers: Array<ReadinessBlocker> = []
  if (results.machineSelection._tag === "NoQualifyingCandidate") {
    blockers.push(blocker(
      "prerequisite.machine-selection",
      "trial-results",
      "No machine candidate qualified under the frozen selection policy.",
      ["Produce a qualifying machine receipt without weakening a hard gate."]
    ))
  } else if (!selectedCoordinate(results.machineSelection, results.machineMaintainerDecision)) {
    blockers.push(blocker(
      "prerequisite.machine-maintainer-decision",
      "trial-results",
      "Machine selection requires an exact hash-bound maintainer decision.",
      ["Validate one maintainer decision for a non-dominated machine receipt."]
    ))
  }
  if (!selectedCoordinate(results.machineSelection, results.machineMaintainerDecision)) {
    return blockers
  }
  if (results.topologySelection === null) {
    blockers.push(blocker(
      "prerequisite.topology-results",
      "trial-results",
      "Topology trials have not produced a selection outcome for the resolved machine.",
      ["Run all three topology candidates against the exact selected machine receipt."]
    ))
  } else if (results.topologySelection._tag === "NoQualifyingCandidate") {
    blockers.push(blocker(
      "prerequisite.topology-selection",
      "trial-results",
      "No topology candidate qualified under the frozen selection policy.",
      ["Produce a qualifying topology receipt without weakening a hard gate."]
    ))
  } else if (results.topologySelection._tag === "MaintainerDecisionRequired" &&
    results.topologyMaintainerDecision === null) {
    blockers.push(blocker(
      "prerequisite.topology-maintainer-decision",
      "trial-results",
      "Topology selection requires an exact hash-bound maintainer decision.",
      ["Validate one maintainer decision for a non-dominated topology receipt."]
    ))
  }
  return blockers
}

export const computeFreezeReadinessReportId = (input: unknown) =>
  hashCanonicalValue(FREEZE_READINESS_HASH_DOMAIN, encodeReadinessBody(input))

/**
 * Reports current authority; it never treats a trial fixture or an in-memory
 * fact packet as closure for an input document that still declares a blocker.
 */
export const assessFreezeReadiness = (
  input: FreezeReadinessInput
): FreezeReadinessReportV1 => {
  const blockers: Array<ReadinessBlocker> = []
  for (const open of input.ownership.blockers) {
    blockers.push({
      id: ArtifactId.make(open.id),
      source: "ownership-decisions",
      reason: description(`${open.title}: the canonical ownership input still marks this blocker open.`),
      requiredEvidence: [...open.requiredEvidence]
    })
  }
  blockers.push(blocker(
    "prerequisite.plan004-terminal-coordinate",
    "baseline",
    input.baseline.terminalEffectBuildCoordinateStatus.reason,
    ["Replace the pending baseline status with hash-bound terminal reconciliation evidence."]
  ))
  for (const pending of input.baseline.candidateBaselines) {
    const id = candidatePrerequisiteId[pending.candidateId]
    if (id === undefined) continue
    blockers.push(blocker(
      id,
      "baseline",
      pending.reason,
      pending.requiredEvidence
    ))
  }
  blockers.push(...trialResultBlockers(input.trialResults))
  if (input.factSet === null) {
    blockers.push(blocker(
      "prerequisite.freeze-fact-set",
      "freeze-facts",
      "No validated versioned full-product freeze fact authority is available.",
      [
        "Derive exact surface, migration, wave, gate, ownership, budget, and ancestry facts without inventing product authority."
      ]
    ))
  } else {
    const required = new Set(REQUIRED_FREEZE_PREREQUISITE_IDS)
    const closed = input.factSet.closedPrerequisites.map(({ id }) => id)
    if ([...required].some((id) => !closed.some((actual) => actual === id))) {
      blockers.push(blocker(
        "prerequisite.freeze-fact-set-closure",
        "freeze-facts",
        "The freeze fact authority does not bind every required prerequisite closure.",
        ["Regenerate the fact authority from all exact closure evidence."]
      ))
    }
  }

  blockers.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  if (blockers.length > 0) {
    const body = {
      _tag: "Blocked" as const,
      schemaVersion: "ts-release/architecture-freeze-readiness/v1" as const,
      programId: "ts-release-architecture-program" as const,
      blockers: blockers as [ReadinessBlocker, ...Array<ReadinessBlocker>]
    }
    return new BlockedFreezeReadinessV1({
      reportId: computeFreezeReadinessReportId(body),
      ...body
    })
  }
  const body = {
    _tag: "Ready" as const,
    schemaVersion: "ts-release/architecture-freeze-readiness/v1" as const,
    programId: "ts-release-architecture-program" as const,
    trialResultsAggregateId: input.trialResults!.aggregateId,
    factSetId: input.factSet!.factSetId
  }
  return new ReadyFreezeReadinessV1({
    reportId: computeFreezeReadinessReportId(body),
    ...body
  })
}

export const encodeFreezeReadinessReport = (
  report: FreezeReadinessReportV1
): unknown => encodeReadiness(report)
