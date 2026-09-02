import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { parseCanonicalJsonBytes } from "../src/canonical-document.js"
import { ArtifactId, MetricId, PlannedRepositoryPath, Sha256Hex } from "../src/schema/primitives.js"
import {
  MaintainerDecisionRequired,
  NoQualifyingCandidate,
  TrialCandidateObjectiveVector,
  TrialObjectiveValue,
  UniqueSelection
} from "../src/schema/trial-selection.js"
import {
  TrialEvaluationAuthorityV2,
  TrialResultFileBindingV2,
  TrialResultsAggregateInvariantError,
  UpstreamMachineResultBindingV2,
  decodeTrialResultsAggregate,
  encodeTrialResultsAggregate,
  makeTrialResultsAggregate
} from "../src/schema/trial-results-aggregate.js"
import { decodeArchitectureTrialSpec } from "../src/schema/trial-spec.js"
import {
  V2CandidateId,
  V2MachineCandidateId,
  V2_CANDIDATE_DEFINITIONS,
  V2_PROBE_IDS,
  type V2CandidateId as V2CandidateIdType
} from "../src/schema/v2-ids.js"

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(moduleDirectory, "../../..")
const spec = Effect.runSync(decodeArchitectureTrialSpec(parseCanonicalJsonBytes(
  new Uint8Array(readFileSync(resolve(
    repositoryRoot,
    "docs/refactor/architecture-program/inputs/trial-spec.json"
  )))
)))
const hash = (character: string) => Sha256Hex.make(character.repeat(64))
const trialSpecSha256 = hash("a")
const machineCandidateIds = spec.machineSelectionPolicy.candidateIds as readonly [
  typeof V2CandidateId.Type,
  ...Array<typeof V2CandidateId.Type>
]
const machineObjectiveMetricIds = spec.machineSelectionPolicy.objectiveMetricIds as readonly [
  typeof MetricId.Type,
  ...Array<typeof MetricId.Type>
]
const topologyCandidateIds = spec.topologySelectionPolicy.candidateIds as readonly [
  typeof V2CandidateId.Type,
  ...Array<typeof V2CandidateId.Type>
]
const topologyObjectiveMetricIds = spec.topologySelectionPolicy.objectiveMetricIds as readonly [
  typeof MetricId.Type,
  ...Array<typeof MetricId.Type>
]

const resultBinding = (
  candidateId: V2CandidateIdType,
  receiptCharacter: string,
  upstreamMachineReceipt: UpstreamMachineResultBindingV2 | null = null
): TrialResultFileBindingV2 => {
  const definition = V2_CANDIDATE_DEFINITIONS[candidateId]
  const policy = definition.scope === "machine"
    ? spec.machineSelectionPolicy
    : spec.topologySelectionPolicy
  return new TrialResultFileBindingV2({
    scope: definition.scope,
    candidateId,
    path: PlannedRepositoryPath.make(
      `docs/refactor/architecture-program/results/${definition.scope}/${candidateId}.json`
    ),
    fileSha256: hash(receiptCharacter === "f" ? "e" : "f"),
    receiptId: hash(receiptCharacter),
    runContextSha256: hash("b"),
    candidateManifestSha256: hash("c"),
    candidateTreeSha256: hash("d"),
    runnerSourceSha256: hash("e"),
    runnerNodeModulesSha256: hash("9"),
    upstreamMachineReceipt,
    evaluationAuthority: new TrialEvaluationAuthorityV2({
      probeEvaluations: V2_PROBE_IDS.map((probeId) => ({
        probeId,
        evaluatorId: null,
        recordSha256: null
      })),
      gateEvaluations: policy.hardGateIds.map((gateId) => ({
        gateId,
        evaluatorId: null,
        recordSha256: null
      })),
      objectiveDerivations: policy.objectiveMetricIds.map((metricId) => ({
        metricId,
        derivationId: ArtifactId.make("objective-derivation.test-v1"),
        recordSha256: hash("8")
      }))
    })
  })
}

const vector = (
  candidateId: V2CandidateIdType,
  receiptId: typeof Sha256Hex.Type,
  metricIds: ReadonlyArray<string>
) => new TrialCandidateObjectiveVector({
  candidateId,
  receiptId,
  values: metricIds.map((metricId, index) => new TrialObjectiveValue({
    metricId: MetricId.make(metricId),
    value: index + 1
  })) as [TrialObjectiveValue, ...Array<TrialObjectiveValue>]
})

const noMachine = () => new NoQualifyingCandidate({
  scope: "machine",
  candidateIds: machineCandidateIds,
  objectiveMetricIds: machineObjectiveMetricIds,
  objectiveVectors: [],
  rejectedCandidateIds: machineCandidateIds
})

describe("trial-results aggregate authority", () => {
  it.effect("round-trips a machine STOP outcome with no invented topology evidence", () =>
    Effect.gen(function* () {
      const aggregate = makeTrialResultsAggregate({
        schemaVersion: "ts-release/architecture-trial-results/v2",
        programId: "ts-release-architecture-program",
        trialSpecSha256,
        machineResults: [
          resultBinding(V2CandidateId.make("M1-extracted-fold"), "1"),
          resultBinding(V2CandidateId.make("M2-total-transition"), "2")
        ],
        machineSelection: noMachine(),
        machineMaintainerDecision: null,
        topologyResults: [],
        topologySelection: null,
        topologyMaintainerDecision: null
      }, spec)

      const decoded = yield* decodeTrialResultsAggregate(
        encodeTrialResultsAggregate(aggregate, spec),
        spec
      )
      expect(decoded.aggregateId).toBe(aggregate.aggregateId)
      expect(decoded.machineSelection._tag).toBe("NoQualifyingCandidate")
      expect(decoded.topologyResults).toEqual([])
    }))

  it("binds every topology result to the exact selected machine receipt", () => {
    const machineBindings = [
      resultBinding(V2CandidateId.make("M1-extracted-fold"), "1"),
      resultBinding(V2CandidateId.make("M2-total-transition"), "2")
    ]
    const selectedMachine = machineBindings[0]!
    const machineSelection = new UniqueSelection({
      scope: "machine",
      candidateIds: machineCandidateIds,
      objectiveMetricIds: machineObjectiveMetricIds,
      objectiveVectors: [vector(
        selectedMachine.candidateId,
        selectedMachine.receiptId,
        spec.machineSelectionPolicy.objectiveMetricIds
      )],
      selectedCandidateId: selectedMachine.candidateId,
      selectedReceiptId: selectedMachine.receiptId,
      qualifyingCandidateIds: [selectedMachine.candidateId],
      dominatedCandidateIds: [],
      rejectedCandidateIds: [V2CandidateId.make("M2-total-transition")]
    })
    const upstream = new UpstreamMachineResultBindingV2({
      selectedMachineCandidateId: V2MachineCandidateId.make("M1-extracted-fold"),
      selectedMachineReceiptId: selectedMachine.receiptId
    })
    const topologyBindings = [
      resultBinding(V2CandidateId.make("T1-root"), "3", upstream),
      resultBinding(V2CandidateId.make("T2-kernel-provider-bundle"), "4", upstream),
      resultBinding(V2CandidateId.make("T3-provider-verticals"), "5", upstream)
    ]
    const selectedTopology = topologyBindings[0]!
    const topologySelection = new UniqueSelection({
      scope: "topology",
      candidateIds: topologyCandidateIds,
      objectiveMetricIds: topologyObjectiveMetricIds,
      objectiveVectors: [vector(
        selectedTopology.candidateId,
        selectedTopology.receiptId,
        spec.topologySelectionPolicy.objectiveMetricIds
      )],
      selectedCandidateId: selectedTopology.candidateId,
      selectedReceiptId: selectedTopology.receiptId,
      qualifyingCandidateIds: [selectedTopology.candidateId],
      dominatedCandidateIds: [],
      rejectedCandidateIds: [
        V2CandidateId.make("T2-kernel-provider-bundle"),
        V2CandidateId.make("T3-provider-verticals")
      ]
    })

    const aggregate = makeTrialResultsAggregate({
      schemaVersion: "ts-release/architecture-trial-results/v2",
      programId: "ts-release-architecture-program",
      trialSpecSha256,
      machineResults: machineBindings,
      machineSelection,
      machineMaintainerDecision: null,
      topologyResults: topologyBindings,
      topologySelection,
      topologyMaintainerDecision: null
    }, spec)
    expect(aggregate.topologyResults).toHaveLength(3)

    const broken = {
      ...encodeTrialResultsAggregate(aggregate, spec) as Record<string, unknown>,
      aggregateId: undefined
    }
    expect(() => makeTrialResultsAggregate(broken, spec)).toThrow()
  })

  it("rejects topology evidence before a machine decision", () => {
    const selection = new MaintainerDecisionRequired({
      scope: "machine",
      candidateIds: machineCandidateIds,
      objectiveMetricIds: machineObjectiveMetricIds,
      objectiveVectors: [
        vector(V2CandidateId.make("M1-extracted-fold"), hash("1"), spec.machineSelectionPolicy.objectiveMetricIds),
        vector(V2CandidateId.make("M2-total-transition"), hash("2"), spec.machineSelectionPolicy.objectiveMetricIds)
      ],
      qualifyingCandidateIds: machineCandidateIds,
      nonDominatedCandidateIds: machineCandidateIds,
      rejectedCandidateIds: []
    })
    expect(() => makeTrialResultsAggregate({
      schemaVersion: "ts-release/architecture-trial-results/v2",
      programId: "ts-release-architecture-program",
      trialSpecSha256,
      machineResults: [
        resultBinding(V2CandidateId.make("M1-extracted-fold"), "1"),
        resultBinding(V2CandidateId.make("M2-total-transition"), "2")
      ],
      machineSelection: selection,
      machineMaintainerDecision: null,
      topologyResults: [resultBinding(V2CandidateId.make("T1-root"), "3")],
      topologySelection: null,
      topologyMaintainerDecision: null
    }, spec)).toThrow(TrialResultsAggregateInvariantError)
  })
})
