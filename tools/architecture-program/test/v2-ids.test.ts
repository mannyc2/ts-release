import { describe, expect, it } from "vitest"
import { Schema } from "effect"
import {
  V2CandidateId,
  V2CandidateModel,
  V2CandidateScope,
  V2CaseId,
  V2GateId,
  V2MachineCandidateId,
  V2MachineGateId,
  V2ProbeId,
  V2TopologyCandidateId,
  V2TopologyGateId,
  V2_CANDIDATE_DEFINITIONS,
  V2_CANDIDATE_IDS,
  V2_CANDIDATE_MODELS,
  V2_CANDIDATE_SCOPES,
  V2_CASE_IDS,
  V2_GATE_IDS,
  V2_MACHINE_CANDIDATE_IDS,
  V2_MACHINE_GATE_IDS,
  V2_PROBE_IDS,
  V2_TOPOLOGY_CANDIDATE_IDS,
  V2_TOPOLOGY_GATE_IDS
} from "../src/schema/v2-ids.js"

const expectedMachineCandidateIds = [
  "M1-extracted-fold",
  "M2-total-transition"
] as const

const expectedTopologyCandidateIds = [
  "T1-root",
  "T2-kernel-provider-bundle",
  "T3-provider-verticals"
] as const

const expectedCaseIds = [
  "C01-initial-success",
  "C02-rejection-before-commit",
  "C03-response-loss-satisfied-observation",
  "C04-response-loss-inconclusive-stop",
  "C05-core-git-cas-protected-replay",
  "C06-explicit-risk-acceptance",
  "C07-concurrent-runners-single-cas-winner",
  "C08-request-endpoint-mismatch",
  "C09-supersession-late-evidence",
  "C10-ambiguous-append-readback",
  "C11-malformed-provider-graph",
  "C12-external-provider-two-instances",
  "C13-apple-commit-before-id-loss",
  "C14-finalized-file-tree-adoption",
  "C15-host-dependency-shadowing",
  "C16-journal-bound-symmetry"
] as const

const expectedProbeIds = [
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

const expectedMachineGateIds = [
  "GM01-shared-case-semantics",
  "GM02-law-and-owner-invariants",
  "GM03-construction-boundaries",
  "GM04-result-provenance",
  "GM05-machine-source-budget",
  "GM06-marginal-measurement",
  "GM07-candidate-equivalence",
  "GM08-metric-and-readability-completeness",
  "GM09-offline-nonmutation"
] as const

const expectedTopologyGateIds = [
  "GT01-shared-fixture-machine-and-cases",
  "GT02-packed-library-node",
  "GT03-packed-library-bun",
  "GT04-packed-cli",
  "GT05-packed-github-action",
  "GT06-packed-external-provider-two-instances",
  "GT07-lossless-effect-build-file-tree-adoption",
  "GT08-exact-runtime-declaration-surface",
  "GT09-exact-emitted-packed-inventory",
  "GT10-exact-static-type-dynamic-manifest-graph",
  "GT11-no-cycle-sibling-reversal-or-host-edge",
  "GT12-version-skew-partial-publication",
  "GT13-dry-run-build-publication-self-release",
  "GT14-tree-shaking-and-packed-bytes",
  "GT15-all-nine-marginal-probes",
  "GT16-offline-nonmutation"
] as const

describe("architecture trial v2 exact identifiers", () => {
  it("owns the exact ordered candidate, case, probe, and gate sets", () => {
    expect(V2_MACHINE_CANDIDATE_IDS).toEqual(expectedMachineCandidateIds)
    expect(V2_TOPOLOGY_CANDIDATE_IDS).toEqual(expectedTopologyCandidateIds)
    expect(V2_CANDIDATE_IDS).toEqual([
      ...expectedMachineCandidateIds,
      ...expectedTopologyCandidateIds
    ])
    expect(V2_CASE_IDS).toEqual(expectedCaseIds)
    expect(V2_PROBE_IDS).toEqual(expectedProbeIds)
    expect(V2_MACHINE_GATE_IDS).toEqual(expectedMachineGateIds)
    expect(V2_TOPOLOGY_GATE_IDS).toEqual(expectedTopologyGateIds)
    expect(V2_GATE_IDS).toEqual([...expectedMachineGateIds, ...expectedTopologyGateIds])
  })

  it("owns the exact candidate scope, model, and implementation-root mapping", () => {
    expect(V2_CANDIDATE_SCOPES).toEqual(["machine", "topology"])
    expect(V2_CANDIDATE_MODELS).toEqual([
      "extracted-fold",
      "total-transition",
      "root",
      "kernel-provider-bundle",
      "provider-verticals"
    ])
    expect(V2_CANDIDATE_DEFINITIONS).toEqual({
      "M1-extracted-fold": {
        scope: "machine",
        model: "extracted-fold",
        implementationRoot: "prototypes/research-complete-machine/M1-extracted-fold"
      },
      "M2-total-transition": {
        scope: "machine",
        model: "total-transition",
        implementationRoot: "prototypes/research-complete-machine/M2-total-transition"
      },
      "T1-root": {
        scope: "topology",
        model: "root",
        implementationRoot: "prototypes/research-complete-topology/T1-root"
      },
      "T2-kernel-provider-bundle": {
        scope: "topology",
        model: "kernel-provider-bundle",
        implementationRoot: "prototypes/research-complete-topology/T2-kernel-provider-bundle"
      },
      "T3-provider-verticals": {
        scope: "topology",
        model: "provider-verticals",
        implementationRoot: "prototypes/research-complete-topology/T3-provider-verticals"
      }
    })
  })

  it("decodes every exact literal and rejects syntactically plausible additions", () => {
    const decodeCandidate = Schema.decodeUnknownSync(V2CandidateId)
    const decodeMachineCandidate = Schema.decodeUnknownSync(V2MachineCandidateId)
    const decodeTopologyCandidate = Schema.decodeUnknownSync(V2TopologyCandidateId)
    const decodeCase = Schema.decodeUnknownSync(V2CaseId)
    const decodeProbe = Schema.decodeUnknownSync(V2ProbeId)
    const decodeGate = Schema.decodeUnknownSync(V2GateId)
    const decodeMachineGate = Schema.decodeUnknownSync(V2MachineGateId)
    const decodeTopologyGate = Schema.decodeUnknownSync(V2TopologyGateId)
    const decodeScope = Schema.decodeUnknownSync(V2CandidateScope)
    const decodeModel = Schema.decodeUnknownSync(V2CandidateModel)

    expect(V2_CANDIDATE_IDS.map((id) => decodeCandidate(id))).toEqual(V2_CANDIDATE_IDS)
    expect(V2_MACHINE_CANDIDATE_IDS.map((id) => decodeMachineCandidate(id))).toEqual(V2_MACHINE_CANDIDATE_IDS)
    expect(V2_TOPOLOGY_CANDIDATE_IDS.map((id) => decodeTopologyCandidate(id))).toEqual(V2_TOPOLOGY_CANDIDATE_IDS)
    expect(V2_CASE_IDS.map((id) => decodeCase(id))).toEqual(V2_CASE_IDS)
    expect(V2_PROBE_IDS.map((id) => decodeProbe(id))).toEqual(V2_PROBE_IDS)
    expect(V2_GATE_IDS.map((id) => decodeGate(id))).toEqual(V2_GATE_IDS)
    expect(V2_MACHINE_GATE_IDS.map((id) => decodeMachineGate(id))).toEqual(V2_MACHINE_GATE_IDS)
    expect(V2_TOPOLOGY_GATE_IDS.map((id) => decodeTopologyGate(id))).toEqual(V2_TOPOLOGY_GATE_IDS)
    expect(V2_CANDIDATE_SCOPES.map((scope) => decodeScope(scope))).toEqual(V2_CANDIDATE_SCOPES)
    expect(V2_CANDIDATE_MODELS.map((model) => decodeModel(model))).toEqual(V2_CANDIDATE_MODELS)

    for (const [decode, invented] of [
      [decodeCandidate, "M3-invented"],
      [decodeCase, "C17-invented-case"],
      [decodeProbe, "P10-invented-probe"],
      [decodeGate, "GT01-packed-node-library"],
      [decodeScope, "combined"],
      [decodeModel, "hybrid"]
    ] as const) {
      expect(() => decode(invented)).toThrow()
    }
  })
})
