import { Schema } from "effect"

export const V2_MACHINE_CANDIDATE_IDS = [
  "M1-extracted-fold",
  "M2-total-transition"
] as const

export const V2_TOPOLOGY_CANDIDATE_IDS = [
  "T1-root",
  "T2-kernel-provider-bundle",
  "T3-provider-verticals"
] as const

export const V2_CANDIDATE_IDS = [
  ...V2_MACHINE_CANDIDATE_IDS,
  ...V2_TOPOLOGY_CANDIDATE_IDS
] as const

export const V2_CASE_IDS = [
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

export const V2_PROBE_IDS = [
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

export const V2_MACHINE_GATE_IDS = [
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

export const V2_TOPOLOGY_GATE_IDS = [
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

export const V2_GATE_IDS = [
  ...V2_MACHINE_GATE_IDS,
  ...V2_TOPOLOGY_GATE_IDS
] as const

export const V2_CANDIDATE_SCOPES = ["machine", "topology"] as const

export const V2_CANDIDATE_MODELS = [
  "extracted-fold",
  "total-transition",
  "root",
  "kernel-provider-bundle",
  "provider-verticals"
] as const

export const V2MachineCandidateId = Schema.Literals(V2_MACHINE_CANDIDATE_IDS)
export type V2MachineCandidateId = typeof V2MachineCandidateId.Type

export const V2TopologyCandidateId = Schema.Literals(V2_TOPOLOGY_CANDIDATE_IDS)
export type V2TopologyCandidateId = typeof V2TopologyCandidateId.Type

export const V2CandidateId = Schema.Literals(V2_CANDIDATE_IDS)
export type V2CandidateId = typeof V2CandidateId.Type

export const V2CaseId = Schema.Literals(V2_CASE_IDS)
export type V2CaseId = typeof V2CaseId.Type

export const V2ProbeId = Schema.Literals(V2_PROBE_IDS)
export type V2ProbeId = typeof V2ProbeId.Type

export const V2MachineGateId = Schema.Literals(V2_MACHINE_GATE_IDS)
export type V2MachineGateId = typeof V2MachineGateId.Type

export const V2TopologyGateId = Schema.Literals(V2_TOPOLOGY_GATE_IDS)
export type V2TopologyGateId = typeof V2TopologyGateId.Type

export const V2GateId = Schema.Literals(V2_GATE_IDS)
export type V2GateId = typeof V2GateId.Type

export const V2CandidateScope = Schema.Literals(V2_CANDIDATE_SCOPES)
export type V2CandidateScope = typeof V2CandidateScope.Type

export const V2CandidateModel = Schema.Literals(V2_CANDIDATE_MODELS)
export type V2CandidateModel = typeof V2CandidateModel.Type

export const V2_CANDIDATE_DEFINITIONS = {
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
} as const satisfies Readonly<Record<V2CandidateId, {
  readonly scope: V2CandidateScope
  readonly model: V2CandidateModel
  readonly implementationRoot: string
}>>

export type V2CandidateDefinition = (typeof V2_CANDIDATE_DEFINITIONS)[V2CandidateId]
