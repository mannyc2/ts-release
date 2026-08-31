import { Effect, Schema } from "effect"
import {
  ArtifactId,
  Description,
  ExistingRepositoryPath,
  GitRevision,
  LawId,
  MetricId,
  OwnerId,
  PlannedRepositoryPath,
  ProgramId,
  RoleId,
  Sha256Hex,
} from "./primitives.js"
import {
  CaseExecutionDefinition,
  ExecutionContract,
  InputBinding,
  MeasurementContract,
  ProbeExecutionDefinition,
  ReceiptContract,
  REQUIRED_CASE_ACTIONS,
  REQUIRED_CASE_EXECUTIONS,
  REQUIRED_INPUT_BINDINGS,
  REQUIRED_MEASUREMENT_METHODS,
  REQUIRED_PROBE_ACTION_IDS,
  REQUIRED_PROBE_ACTIONS,
  REQUIRED_TRIAL_LANES,
  definitionSha256,
  exactOrderedIssues,
  executionContractSha256,
  fixtureSha256,
  measurementContractSha256
} from "./trial-contract.js"
import {
  CaseFixtureV2,
  ExpectedCaseEvidenceV2,
  ProbeChangeDefinitionV2,
  caseFixtureSha256V2,
  expectedCaseEvidenceSha256V2,
  probeChangeDefinitionSha256V2
} from "./trial-evidence.js"
import {
  V2CaseId,
  V2GateId,
  V2MachineCandidateId,
  V2ProbeId,
  V2TopologyCandidateId,
  V2_CASE_IDS,
  V2_MACHINE_CANDIDATE_IDS,
  V2_MACHINE_GATE_IDS,
  V2_PROBE_IDS,
  V2_TOPOLOGY_CANDIDATE_IDS,
  V2_TOPOLOGY_GATE_IDS
} from "./v2-ids.js"
import {
  REQUIRED_CASE_FIXTURES,
  REQUIRED_CASE_TERMINAL_OUTCOMES as FIXTURE_CASE_TERMINAL_OUTCOMES,
  REQUIRED_EXPECTED_CASE_EVIDENCE,
  REQUIRED_PROBE_CHANGE_IDS,
  REQUIRED_PROBE_PARAMETER_ENTRIES
} from "../trial-fixture-registry.js"

export const REQUIRED_LAW_IDS = [
  "L01-single-canonical-durable-chain",
  "L02-single-pure-transition-owner",
  "L03-single-interpreter-cas-authority",
  "L04-facts-decisions-effects-separated",
  "L05-host-owned-single-journal",
  "L06-provider-vertical-ownership",
  "L07-open-provider-composition",
  "L08-host-neutral-kernel",
  "L09-lossless-effect-build-handoff",
  "L10-apple-operation-journal-boundary",
  "L11-hard-cut-or-one-shot-migration",
  "L12-generated-exact-public-surface",
  "L13-exact-acyclic-import-graph",
  "L14-total-owned-traceability"
] as const

export const REQUIRED_AUTHORITY_IDS = [
  "A01-plan-laws",
  "A02-trial-shape",
  "A03-machine-contract",
  "A04-topology-contract",
  "A05-launch-scorecard",
  "A06-provider-contract",
  "A07-fresh-runner",
  "A08-artifact-contract",
  "A09-v1-reference",
  "A10-effect-build-boundary",
  "A11-journal-law",
  "A12-cross-repository-boundary"
] as const

export const REQUIRED_LAW_STATEMENTS = [
  "One canonical durable chain; every other representation is a projection.",
  "One pure transition owner returns one explicit command or terminal report.",
  "One interpreter owns credentials, observation, append, authorization, and dispatch ordering; CAS is the sole constructor of dispatch authority.",
  "Facts are not decisions or effects; provider commitment is never inferred from an Effect exit or host retry.",
  "Exactly one host-selected JournalStore and one logical journal per release; consumer Layers cannot shadow journal, clock, transport, or approval.",
  "A provider vertical owns Intent and wire codecs, preparation, observation, dispatch, recovery law, tests, and docs; core imports no concrete provider.",
  "A second instance and packed external provider require zero kernel edits; provider siblings never import one another.",
  "Host-neutral code imports no Node or Bun implementation; CLI, Action, YAML, and providers never reconstruct lifecycle policy.",
  "Finalized effect-build file, tree, and tool values cross once, losslessly, with no shadow schema, mutable path, number-size narrowing, symlink traversal, or unjustified third artifact package.",
  "effect-build-apple owns concrete Apple operations and codecs; ts-release owns the sole release journal; commit-before-submission-ID remains inconclusive.",
  "Incompatible durable formats use a hard cut or explicit one-shot migration; no dual live reader or writer exists by default.",
  "Runtime and declaration exports, emitted modules, manifests, bins, and host entrypoints are generated and checked together.",
  "The package and import graph is acyclic, one-way, and justified by invariant, dependency, lifecycle, or consumer value rather than file count.",
  "Every claim, source, public symbol, durable codec, and selected row has one owner, disposition, successor wave, and executable gate."
] as const

const REQUIRED_AUTHORITIES = {
  "A01-plan-laws": {
    authorityKind: "normative",
    title: "Plan 005 non-negotiable target laws",
    ownerId: "architecture-program",
    gitRevision: null,
    sourceAnchor: { _tag: "LineRangeSourceAnchor", path: "advisor-plans/005-freeze-research-complete-system-contract.md", sha256: "f2af8b2b2a591e0e66ad18654d43a937a746b5f4dc5595e2e99cca96ab4aa965", startLine: 92, endLine: 122 }
  },
  "A02-trial-shape": {
    authorityKind: "normative",
    title: "Plan 005 candidate-neutral trial specification shape",
    ownerId: "architecture-program",
    gitRevision: null,
    sourceAnchor: { _tag: "LineRangeSourceAnchor", path: "advisor-plans/005-freeze-research-complete-system-contract.md", sha256: "f2af8b2b2a591e0e66ad18654d43a937a746b5f4dc5595e2e99cca96ab4aa965", startLine: 302, endLine: 339 }
  },
  "A03-machine-contract": {
    authorityKind: "normative",
    title: "Plan 005 deterministic machine trial contract",
    ownerId: "architecture-program",
    gitRevision: null,
    sourceAnchor: { _tag: "LineRangeSourceAnchor", path: "advisor-plans/005-freeze-research-complete-system-contract.md", sha256: "f2af8b2b2a591e0e66ad18654d43a937a746b5f4dc5595e2e99cca96ab4aa965", startLine: 424, endLine: 476 }
  },
  "A04-topology-contract": {
    authorityKind: "normative",
    title: "Plan 005 physical package and public topology trial contract",
    ownerId: "architecture-program",
    gitRevision: null,
    sourceAnchor: { _tag: "LineRangeSourceAnchor", path: "advisor-plans/005-freeze-research-complete-system-contract.md", sha256: "f2af8b2b2a591e0e66ad18654d43a937a746b5f4dc5595e2e99cca96ab4aa965", startLine: 478, endLine: 554 }
  },
  "A05-launch-scorecard": {
    authorityKind: "evidence",
    title: "Selected launch outcome scorecard",
    ownerId: "product-research",
    gitRevision: null,
    sourceAnchor: { _tag: "WholeFileSourceAnchor", path: "docs/refactor/research/launch-scorecard.md", sha256: "ea77afd876f2ce4b309d42ff9d0dab1cd5a9f702b0fb9ec9786f49ae3c7e7636" }
  },
  "A06-provider-contract": {
    authorityKind: "evidence",
    title: "Provider contract research",
    ownerId: "product-research",
    gitRevision: null,
    sourceAnchor: { _tag: "WholeFileSourceAnchor", path: "docs/refactor/research/provider-contracts.md", sha256: "66a450630affa48b0218aa5fcae2d0e940c20513484d31d51f07a5b8f88502e9" }
  },
  "A07-fresh-runner": {
    authorityKind: "evidence",
    title: "Fresh-runner resumability research",
    ownerId: "product-research",
    gitRevision: null,
    sourceAnchor: { _tag: "WholeFileSourceAnchor", path: "docs/refactor/research/fresh-runner-resumability.md", sha256: "fb3400abe9441dd92aefb2786011cc4f48d14a002954a5cf54d7e48a4484bd8a" }
  },
  "A08-artifact-contract": {
    authorityKind: "evidence",
    title: "Artifact model research",
    ownerId: "product-research",
    gitRevision: null,
    sourceAnchor: { _tag: "WholeFileSourceAnchor", path: "docs/refactor/research/artifact-model.md", sha256: "ff0056380d1484ae5cbb9eda7680955c53687a9939a9e77349926523c2990a14" }
  },
  "A09-v1-reference": {
    authorityKind: "evidence",
    title: "Advisor v1 reference evidence manifest",
    ownerId: "architecture-program",
    gitRevision: null,
    sourceAnchor: { _tag: "WholeFileSourceAnchor", path: "advisor-plans/evidence/v1-reference-manifest.json", sha256: "87e7271f668c4ba821b7935b0082d9b9b7987f6ee29a9a5639557983aa4941ea" }
  },
  "A10-effect-build-boundary": {
    authorityKind: "evidence",
    title: "Effect-build release-readiness boundary plan",
    ownerId: "architecture-program",
    gitRevision: "dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc",
    sourceAnchor: { _tag: "WholeFileSourceAnchor", path: "advisor-plans/004-establish-effect-build-release-readiness.md", sha256: "ad84b8b021fec89fcc24aa6d285ebb0e3d39629b7aaa88f806a4f9940af16ef7" }
  },
  "A11-journal-law": {
    authorityKind: "evidence",
    title: "Journal backend research",
    ownerId: "product-research",
    gitRevision: null,
    sourceAnchor: { _tag: "WholeFileSourceAnchor", path: "docs/refactor/research/journal-backends.md", sha256: "5ba93351a4cecb9f628e4108d6d16cbcf8939edab4378f1c73fcb04cf8ec8216" }
  },
  "A12-cross-repository-boundary": {
    authorityKind: "evidence",
    title: "Cross-repository delivery research",
    ownerId: "product-research",
    gitRevision: null,
    sourceAnchor: { _tag: "WholeFileSourceAnchor", path: "docs/refactor/research/cross-repository-delivery.md", sha256: "b5d767fb1f67f00cc716da50a16258cb2056280d3e0f777a933809734abb7c0a" }
  }
} as const

const REQUIRED_LAW_AUTHORITY_IDS: Readonly<Record<(typeof REQUIRED_LAW_IDS)[number], ReadonlyArray<string>>> = {
  "L01-single-canonical-durable-chain": ["A01-plan-laws", "A07-fresh-runner", "A11-journal-law"],
  "L02-single-pure-transition-owner": ["A01-plan-laws", "A07-fresh-runner"],
  "L03-single-interpreter-cas-authority": ["A01-plan-laws", "A07-fresh-runner"],
  "L04-facts-decisions-effects-separated": ["A01-plan-laws", "A07-fresh-runner"],
  "L05-host-owned-single-journal": ["A01-plan-laws", "A11-journal-law"],
  "L06-provider-vertical-ownership": ["A01-plan-laws", "A06-provider-contract"],
  "L07-open-provider-composition": ["A01-plan-laws", "A06-provider-contract"],
  "L08-host-neutral-kernel": ["A01-plan-laws", "A06-provider-contract"],
  "L09-lossless-effect-build-handoff": ["A01-plan-laws", "A08-artifact-contract", "A10-effect-build-boundary", "A12-cross-repository-boundary"],
  "L10-apple-operation-journal-boundary": ["A01-plan-laws", "A10-effect-build-boundary", "A12-cross-repository-boundary"],
  "L11-hard-cut-or-one-shot-migration": ["A01-plan-laws", "A09-v1-reference"],
  "L12-generated-exact-public-surface": ["A01-plan-laws", "A04-topology-contract"],
  "L13-exact-acyclic-import-graph": ["A01-plan-laws", "A04-topology-contract"],
  "L14-total-owned-traceability": ["A01-plan-laws", "A05-launch-scorecard", "A09-v1-reference"]
}

const REQUIRED_CASE_AUTHORITY_IDS: Readonly<Record<(typeof REQUIRED_CASE_IDS)[number], ReadonlyArray<string>>> = {
  "C01-initial-success": ["A03-machine-contract", "A05-launch-scorecard", "A07-fresh-runner", "A11-journal-law"],
  "C02-rejection-before-commit": ["A03-machine-contract", "A06-provider-contract", "A07-fresh-runner"],
  "C03-response-loss-satisfied-observation": ["A03-machine-contract", "A06-provider-contract", "A07-fresh-runner"],
  "C04-response-loss-inconclusive-stop": ["A03-machine-contract", "A06-provider-contract", "A07-fresh-runner"],
  "C05-core-git-cas-protected-replay": ["A03-machine-contract", "A07-fresh-runner", "A11-journal-law"],
  "C06-explicit-risk-acceptance": ["A03-machine-contract", "A07-fresh-runner"],
  "C07-concurrent-runners-single-cas-winner": ["A03-machine-contract", "A07-fresh-runner", "A11-journal-law"],
  "C08-request-endpoint-mismatch": ["A03-machine-contract", "A06-provider-contract", "A07-fresh-runner"],
  "C09-supersession-late-evidence": ["A03-machine-contract", "A07-fresh-runner", "A11-journal-law"],
  "C10-ambiguous-append-readback": ["A03-machine-contract", "A07-fresh-runner", "A11-journal-law"],
  "C11-malformed-provider-graph": ["A03-machine-contract", "A06-provider-contract"],
  "C12-external-provider-two-instances": ["A03-machine-contract", "A04-topology-contract", "A06-provider-contract"],
  "C13-apple-commit-before-id-loss": ["A03-machine-contract", "A07-fresh-runner", "A10-effect-build-boundary", "A12-cross-repository-boundary"],
  "C14-finalized-file-tree-adoption": ["A03-machine-contract", "A08-artifact-contract", "A10-effect-build-boundary", "A12-cross-repository-boundary"],
  "C15-host-dependency-shadowing": ["A03-machine-contract", "A04-topology-contract", "A06-provider-contract", "A11-journal-law"],
  "C16-journal-bound-symmetry": ["A03-machine-contract", "A11-journal-law"]
}

const REQUIRED_PROBE_AUTHORITY_IDS: Readonly<Record<(typeof REQUIRED_PROBE_IDS)[number], ReadonlyArray<string>>> = {
  "P01-second-provider-instance": ["A04-topology-contract", "A06-provider-contract"],
  "P02-packed-external-provider": ["A04-topology-contract", "A06-provider-contract"],
  "P03-new-first-party-provider": ["A04-topology-contract", "A06-provider-contract"],
  "P04-new-commitment-mechanism": ["A04-topology-contract", "A06-provider-contract", "A07-fresh-runner"],
  "P05-existing-provider-operation": ["A04-topology-contract", "A06-provider-contract"],
  "P06-journal-store-backend": ["A04-topology-contract", "A11-journal-law"],
  "P07-file-tree-producer-adapter": ["A04-topology-contract", "A08-artifact-contract", "A10-effect-build-boundary", "A12-cross-repository-boundary"],
  "P08-deliberate-public-export": ["A04-topology-contract"],
  "P09-difficult-recovery-transition": ["A04-topology-contract", "A07-fresh-runner", "A10-effect-build-boundary"]
}

export const REQUIRED_CASE_IDS = V2_CASE_IDS

export const REQUIRED_CASE_LAW_IDS: Readonly<Record<(typeof REQUIRED_CASE_IDS)[number], ReadonlyArray<string>>> = {
  "C01-initial-success": ["L01-single-canonical-durable-chain", "L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated", "L05-host-owned-single-journal"],
  "C02-rejection-before-commit": ["L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated", "L06-provider-vertical-ownership"],
  "C03-response-loss-satisfied-observation": ["L01-single-canonical-durable-chain", "L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated", "L06-provider-vertical-ownership"],
  "C04-response-loss-inconclusive-stop": ["L01-single-canonical-durable-chain", "L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated", "L06-provider-vertical-ownership"],
  "C05-core-git-cas-protected-replay": ["L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated", "L05-host-owned-single-journal"],
  "C06-explicit-risk-acceptance": ["L01-single-canonical-durable-chain", "L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated"],
  "C07-concurrent-runners-single-cas-winner": ["L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L05-host-owned-single-journal"],
  "C08-request-endpoint-mismatch": ["L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated", "L06-provider-vertical-ownership"],
  "C09-supersession-late-evidence": ["L01-single-canonical-durable-chain", "L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated", "L05-host-owned-single-journal"],
  "C10-ambiguous-append-readback": ["L01-single-canonical-durable-chain", "L03-single-interpreter-cas-authority", "L05-host-owned-single-journal"],
  "C11-malformed-provider-graph": ["L03-single-interpreter-cas-authority", "L06-provider-vertical-ownership", "L07-open-provider-composition"],
  "C12-external-provider-two-instances": ["L06-provider-vertical-ownership", "L07-open-provider-composition", "L13-exact-acyclic-import-graph"],
  "C13-apple-commit-before-id-loss": ["L01-single-canonical-durable-chain", "L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated", "L10-apple-operation-journal-boundary"],
  "C14-finalized-file-tree-adoption": ["L01-single-canonical-durable-chain", "L09-lossless-effect-build-handoff"],
  "C15-host-dependency-shadowing": ["L05-host-owned-single-journal", "L08-host-neutral-kernel", "L13-exact-acyclic-import-graph"],
  "C16-journal-bound-symmetry": ["L01-single-canonical-durable-chain", "L05-host-owned-single-journal"]
}

export const REQUIRED_CASE_OBSERVATION_IDS: Readonly<Record<(typeof REQUIRED_CASE_IDS)[number], ReadonlyArray<string>>> = {
  "C01-initial-success": ["terminal-report-derived", "one-logical-journal", "every-dispatch-has-prior-authority", "no-blind-replay"],
  "C02-rejection-before-commit": ["rejection-durable-before-terminal", "provider-dispatch-count-zero", "terminal-rejection-derived"],
  "C03-response-loss-satisfied-observation": ["dispatch-started-without-receipt", "fresh-observation-proves-satisfied", "dispatch-count-remains-one", "late-fact-preserved"],
  "C04-response-loss-inconclusive-stop": ["dispatch-started-without-receipt", "absence-is-not-replay-fence", "terminal-inconclusive", "dispatch-count-remains-one"],
  "C05-core-git-cas-protected-replay": ["expected-old-desired-new-recorded", "fresh-head-equals-expected-old", "cas-constructs-dispatch-authority", "at-most-one-replay", "terminal-derived-from-observation"],
  "C06-explicit-risk-acceptance": ["inconclusive-precedes-risk-request", "risk-acceptance-durable", "risk-binds-operation-and-request", "dispatch-requires-risk-authority"],
  "C07-concurrent-runners-single-cas-winner": ["runners-read-same-revision", "exactly-one-append-cas-winner", "loser-refolds-before-effect", "provider-dispatch-count-one"],
  "C08-request-endpoint-mismatch": ["request-fingerprint-mismatch-detected", "endpoint-or-auth-scope-mismatch-detected", "observation-count-zero", "dispatch-count-zero", "correspondence-mismatch-stops"],
  "C09-supersession-late-evidence": ["superseding-event-wins-decision-order", "late-receipt-appended", "late-observation-appended", "late-evidence-does-not-reopen-terminal", "report-preserves-supersession-and-late-facts"],
  "C10-ambiguous-append-readback": ["append-outcome-ambiguous", "readback-before-reappend", "matching-event-is-satisfied", "nonmatching-head-stops-without-reappend", "no-duplicate-event"],
  "C11-malformed-provider-graph": ["complete-graph-decoded-before-effects", "duplicate-definition-or-operation-id-rejected", "dangling-definition-rejected", "provider-effect-count-zero"],
  "C12-external-provider-two-instances": ["external-provider-loaded-by-import-and-layer", "two-instances-bind-distinct-endpoints-and-credentials", "definition-resolution-unambiguous", "kernel-patch-empty", "sibling-patch-empty"],
  "C13-apple-commit-before-id-loss": ["commit-may-precede-submission-id", "missing-id-does-not-prove-absence", "no-blind-resubmission", "terminal-inconclusive", "ts-release-journal-preserves-apple-facts"],
  "C14-finalized-file-tree-adoption": ["canonical-decimal-size-no-number-narrowing", "preserve-path-mode-symlink-shared-content", "duplicate-name-rejected", "mutable-path-rejected", "symlink-traversal-rejected", "lossless-roundtrip"],
  "C15-host-dependency-shadowing": ["host-selects-single-journal-store", "consumer-shadow-rejected", "consumer-cannot-shadow-clock-transport-approval", "neutral-code-has-no-host-import", "provider-effect-count-zero"],
  "C16-journal-bound-symmetry": ["exact-limit-write-succeeds", "exact-limit-read-succeeds", "one-byte-over-write-rejected-before-append", "one-byte-over-read-rejected", "read-write-bounds-identical"]
}

export const REQUIRED_CASE_TERMINAL_OUTCOMES = FIXTURE_CASE_TERMINAL_OUTCOMES

export const REQUIRED_PROBE_IDS = V2_PROBE_IDS

export const REQUIRED_PROBE_LAW_IDS: Readonly<Record<(typeof REQUIRED_PROBE_IDS)[number], ReadonlyArray<string>>> = {
  "P01-second-provider-instance": ["L05-host-owned-single-journal", "L07-open-provider-composition", "L13-exact-acyclic-import-graph"],
  "P02-packed-external-provider": ["L06-provider-vertical-ownership", "L07-open-provider-composition", "L12-generated-exact-public-surface", "L13-exact-acyclic-import-graph"],
  "P03-new-first-party-provider": ["L06-provider-vertical-ownership", "L07-open-provider-composition", "L13-exact-acyclic-import-graph"],
  "P04-new-commitment-mechanism": ["L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated", "L06-provider-vertical-ownership", "L11-hard-cut-or-one-shot-migration", "L14-total-owned-traceability"],
  "P05-existing-provider-operation": ["L02-single-pure-transition-owner", "L06-provider-vertical-ownership", "L07-open-provider-composition", "L14-total-owned-traceability"],
  "P06-journal-store-backend": ["L05-host-owned-single-journal", "L08-host-neutral-kernel", "L13-exact-acyclic-import-graph"],
  "P07-file-tree-producer-adapter": ["L09-lossless-effect-build-handoff", "L13-exact-acyclic-import-graph"],
  "P08-deliberate-public-export": ["L12-generated-exact-public-surface", "L14-total-owned-traceability"],
  "P09-difficult-recovery-transition": ["L01-single-canonical-durable-chain", "L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated", "L06-provider-vertical-ownership", "L10-apple-operation-journal-boundary", "L11-hard-cut-or-one-shot-migration", "L14-total-owned-traceability"]
}

export const REQUIRED_PROBE_ZERO_TOUCH_ROLE_IDS: Readonly<Record<(typeof REQUIRED_PROBE_IDS)[number], ReadonlyArray<string>>> = {
  "P01-second-provider-instance": ["role-kernel"],
  "P02-packed-external-provider": ["role-kernel"],
  "P03-new-first-party-provider": ["role-bun-host", "role-cli-host", "role-first-party-provider-a", "role-first-party-provider-b", "role-github-action-host", "role-machine", "role-node-host"],
  "P04-new-commitment-mechanism": [],
  "P05-existing-provider-operation": ["role-bun-host", "role-cli-host", "role-first-party-provider-b", "role-github-action-host", "role-kernel", "role-machine", "role-node-host"],
  "P06-journal-store-backend": ["role-first-party-provider-a", "role-first-party-provider-b", "role-machine", "role-packed-external-provider"],
  "P07-file-tree-producer-adapter": ["role-first-party-provider-a", "role-first-party-provider-b", "role-kernel-workflow", "role-packed-external-provider"],
  "P08-deliberate-public-export": [],
  "P09-difficult-recovery-transition": []
}

export const REQUIRED_PROBE_CHANGE_KINDS: Readonly<Record<(typeof REQUIRED_PROBE_IDS)[number], ReadonlyArray<string>>> = {
  "P01-second-provider-instance": [],
  "P02-packed-external-provider": ["ordinary-import-and-layer", "packed-consumer"],
  "P03-new-first-party-provider": [],
  "P04-new-commitment-mechanism": ["authority", "command", "state"],
  "P05-existing-provider-operation": [],
  "P06-journal-store-backend": [],
  "P07-file-tree-producer-adapter": [],
  "P08-deliberate-public-export": ["declaration-surface", "emitted-inventory", "runtime-surface"],
  "P09-difficult-recovery-transition": ["durable-format-review", "migration-review"]
}

export const REQUIRED_PROBE_MEASUREMENT_IDS = [
  "before-tree-sha256",
  "after-tree-sha256",
  "patch-sha256",
  "gross-product-additions",
  "gross-product-deletions",
  "files-touched",
  "modules-touched",
  "packages-touched",
  "concepts-touched",
  "central-branches-touched",
  "public-surface-delta",
  "durable-format-delta",
  "dependency-dag-delta"
] as const

export const REQUIRED_MACHINE_CANDIDATE_IDS = V2_MACHINE_CANDIDATE_IDS

const REQUIRED_MACHINE_CANDIDATES = {
  "M1-extracted-fold": {
    model: "extracted-fold",
    hypothesis: "Minimal extraction of the current fold, decision, and application grammar.",
    implementationRoot: "prototypes/research-complete-machine/M1-extracted-fold"
  },
  "M2-total-transition": {
    model: "total-transition",
    hypothesis: "One total transition table plus one typed effect interpreter.",
    implementationRoot: "prototypes/research-complete-machine/M2-total-transition"
  }
} as const

export const REQUIRED_TOPOLOGY_CANDIDATE_IDS = V2_TOPOLOGY_CANDIDATE_IDS

const REQUIRED_TOPOLOGY_CANDIDATES = {
  "T1-root": {
    model: "root",
    hypothesis: "One public root library with provider namespaces and host subpaths.",
    implementationRoot: "prototypes/research-complete-topology/T1-root"
  },
  "T2-kernel-provider-bundle": {
    model: "kernel-provider-bundle",
    hypothesis: "A neutral kernel plus one aggregate first-party-provider package, with hosts as subpaths or applications.",
    implementationRoot: "prototypes/research-complete-topology/T2-kernel-provider-bundle"
  },
  "T3-provider-verticals": {
    model: "provider-verticals",
    hypothesis: "A neutral kernel plus package-per-provider verticals.",
    implementationRoot: "prototypes/research-complete-topology/T3-provider-verticals"
  }
} as const

export const REQUIRED_MACHINE_GATE_IDS = V2_MACHINE_GATE_IDS

export const REQUIRED_TOPOLOGY_GATE_IDS = V2_TOPOLOGY_GATE_IDS

type RequiredGateId = (typeof REQUIRED_MACHINE_GATE_IDS)[number] | (typeof REQUIRED_TOPOLOGY_GATE_IDS)[number]

export const REQUIRED_GATE_LAW_IDS: Readonly<Record<RequiredGateId, ReadonlyArray<string>>> = {
  "GM01-shared-case-semantics": REQUIRED_LAW_IDS,
  "GM02-law-and-owner-invariants": REQUIRED_LAW_IDS,
  "GM03-construction-boundaries": ["L03-single-interpreter-cas-authority", "L05-host-owned-single-journal", "L09-lossless-effect-build-handoff", "L13-exact-acyclic-import-graph"],
  "GM04-result-provenance": ["L14-total-owned-traceability"],
  "GM05-machine-source-budget": ["L14-total-owned-traceability"],
  "GM06-marginal-measurement": REQUIRED_LAW_IDS,
  "GM07-candidate-equivalence": REQUIRED_LAW_IDS,
  "GM08-metric-and-readability-completeness": ["L14-total-owned-traceability"],
  "GM09-offline-nonmutation": REQUIRED_LAW_IDS,
  "GT01-shared-fixture-machine-and-cases": REQUIRED_LAW_IDS,
  "GT02-packed-library-node": ["L08-host-neutral-kernel", "L09-lossless-effect-build-handoff", "L12-generated-exact-public-surface", "L13-exact-acyclic-import-graph"],
  "GT03-packed-library-bun": ["L08-host-neutral-kernel", "L09-lossless-effect-build-handoff", "L12-generated-exact-public-surface", "L13-exact-acyclic-import-graph"],
  "GT04-packed-cli": ["L08-host-neutral-kernel", "L12-generated-exact-public-surface", "L13-exact-acyclic-import-graph"],
  "GT05-packed-github-action": ["L03-single-interpreter-cas-authority", "L05-host-owned-single-journal", "L08-host-neutral-kernel", "L12-generated-exact-public-surface", "L13-exact-acyclic-import-graph"],
  "GT06-packed-external-provider-two-instances": ["L06-provider-vertical-ownership", "L07-open-provider-composition", "L13-exact-acyclic-import-graph"],
  "GT07-lossless-effect-build-file-tree-adoption": ["L09-lossless-effect-build-handoff", "L10-apple-operation-journal-boundary"],
  "GT08-exact-runtime-declaration-surface": ["L12-generated-exact-public-surface"],
  "GT09-exact-emitted-packed-inventory": ["L12-generated-exact-public-surface"],
  "GT10-exact-static-type-dynamic-manifest-graph": ["L06-provider-vertical-ownership", "L07-open-provider-composition", "L08-host-neutral-kernel", "L13-exact-acyclic-import-graph"],
  "GT11-no-cycle-sibling-reversal-or-host-edge": ["L06-provider-vertical-ownership", "L07-open-provider-composition", "L08-host-neutral-kernel", "L13-exact-acyclic-import-graph"],
  "GT12-version-skew-partial-publication": ["L12-generated-exact-public-surface", "L13-exact-acyclic-import-graph"],
  "GT13-dry-run-build-publication-self-release": ["L12-generated-exact-public-surface", "L13-exact-acyclic-import-graph"],
  "GT14-tree-shaking-and-packed-bytes": ["L12-generated-exact-public-surface", "L14-total-owned-traceability"],
  "GT15-all-nine-marginal-probes": REQUIRED_LAW_IDS,
  "GT16-offline-nonmutation": REQUIRED_LAW_IDS
}

export const REQUIRED_GATE_CASE_IDS: Readonly<Record<RequiredGateId, ReadonlyArray<string>>> = {
  "GM01-shared-case-semantics": REQUIRED_CASE_IDS,
  "GM02-law-and-owner-invariants": [],
  "GM03-construction-boundaries": ["C11-malformed-provider-graph", "C14-finalized-file-tree-adoption", "C15-host-dependency-shadowing", "C16-journal-bound-symmetry"],
  "GM04-result-provenance": [],
  "GM05-machine-source-budget": [],
  "GM06-marginal-measurement": [],
  "GM07-candidate-equivalence": REQUIRED_CASE_IDS,
  "GM08-metric-and-readability-completeness": [],
  "GM09-offline-nonmutation": REQUIRED_CASE_IDS,
  "GT01-shared-fixture-machine-and-cases": REQUIRED_CASE_IDS,
  "GT02-packed-library-node": ["C01-initial-success", "C14-finalized-file-tree-adoption", "C16-journal-bound-symmetry"],
  "GT03-packed-library-bun": ["C01-initial-success", "C14-finalized-file-tree-adoption", "C16-journal-bound-symmetry"],
  "GT04-packed-cli": ["C01-initial-success", "C04-response-loss-inconclusive-stop", "C16-journal-bound-symmetry"],
  "GT05-packed-github-action": ["C01-initial-success", "C03-response-loss-satisfied-observation", "C04-response-loss-inconclusive-stop", "C07-concurrent-runners-single-cas-winner", "C15-host-dependency-shadowing", "C16-journal-bound-symmetry"],
  "GT06-packed-external-provider-two-instances": ["C11-malformed-provider-graph", "C12-external-provider-two-instances", "C15-host-dependency-shadowing", "C16-journal-bound-symmetry"],
  "GT07-lossless-effect-build-file-tree-adoption": ["C13-apple-commit-before-id-loss", "C14-finalized-file-tree-adoption"],
  "GT08-exact-runtime-declaration-surface": [],
  "GT09-exact-emitted-packed-inventory": [],
  "GT10-exact-static-type-dynamic-manifest-graph": ["C11-malformed-provider-graph", "C12-external-provider-two-instances", "C15-host-dependency-shadowing"],
  "GT11-no-cycle-sibling-reversal-or-host-edge": ["C11-malformed-provider-graph", "C12-external-provider-two-instances", "C15-host-dependency-shadowing"],
  "GT12-version-skew-partial-publication": [],
  "GT13-dry-run-build-publication-self-release": [],
  "GT14-tree-shaking-and-packed-bytes": [],
  "GT15-all-nine-marginal-probes": ["C12-external-provider-two-instances", "C14-finalized-file-tree-adoption"],
  "GT16-offline-nonmutation": REQUIRED_CASE_IDS
}

export const REQUIRED_GATE_PROBE_IDS: Readonly<Record<RequiredGateId, ReadonlyArray<string>>> = {
  "GM01-shared-case-semantics": [],
  "GM02-law-and-owner-invariants": [],
  "GM03-construction-boundaries": [],
  "GM04-result-provenance": [],
  "GM05-machine-source-budget": [],
  "GM06-marginal-measurement": REQUIRED_PROBE_IDS,
  "GM07-candidate-equivalence": REQUIRED_PROBE_IDS,
  "GM08-metric-and-readability-completeness": [],
  "GM09-offline-nonmutation": [],
  "GT01-shared-fixture-machine-and-cases": [],
  "GT02-packed-library-node": [],
  "GT03-packed-library-bun": [],
  "GT04-packed-cli": [],
  "GT05-packed-github-action": [],
  "GT06-packed-external-provider-two-instances": [],
  "GT07-lossless-effect-build-file-tree-adoption": [],
  "GT08-exact-runtime-declaration-surface": [],
  "GT09-exact-emitted-packed-inventory": [],
  "GT10-exact-static-type-dynamic-manifest-graph": [],
  "GT11-no-cycle-sibling-reversal-or-host-edge": [],
  "GT12-version-skew-partial-publication": [],
  "GT13-dry-run-build-publication-self-release": [],
  "GT14-tree-shaking-and-packed-bytes": [],
  "GT15-all-nine-marginal-probes": REQUIRED_PROBE_IDS,
  "GT16-offline-nonmutation": []
}

export const REQUIRED_MACHINE_METRIC_IDS = [
  "representable-invalid-state-count",
  "machine-interpreter-product-lines",
  "probe-median-gross-product-additions",
  "probe-p90-gross-product-additions",
  "probe-max-central-branches-touched",
  "main-path-owner-hops",
  "difficult-path-owner-hops"
] as const

export const REQUIRED_TOPOLOGY_METRIC_IDS = [
  "invalid-version-publication-state-count",
  "dependency-edge-count",
  "public-runtime-plus-declaration-commitment-count",
  "product-source-lines",
  "probe-median-gross-product-additions",
  "probe-p90-gross-product-additions",
  "probe-max-central-branches-touched",
  "packed-byte-count"
] as const

const PositiveLine = Schema.Int.check(Schema.isGreaterThan(0))

export class WholeFileSourceAnchor extends Schema.TaggedClass<WholeFileSourceAnchor>()(
  "WholeFileSourceAnchor",
  {
    path: ExistingRepositoryPath,
    sha256: Sha256Hex
  }
) {}

export class LineRangeSourceAnchor extends Schema.TaggedClass<LineRangeSourceAnchor>()(
  "LineRangeSourceAnchor",
  {
    path: ExistingRepositoryPath,
    sha256: Sha256Hex,
    startLine: PositiveLine,
    endLine: PositiveLine
  }
) {}

export const SourceAnchor = Schema.Union([WholeFileSourceAnchor, LineRangeSourceAnchor])
export type SourceAnchor = typeof SourceAnchor.Type

const Authority = Schema.Struct({
  id: ArtifactId,
  authorityKind: Schema.Literals(["normative", "evidence"]),
  title: Description,
  ownerId: OwnerId,
  gitRevision: Schema.Union([GitRevision, Schema.Null]),
  sourceAnchor: SourceAnchor
})

const Law = Schema.Struct({
  id: LawId,
  statement: Description,
  authorityIds: Schema.NonEmptyArray(ArtifactId)
})

const MachineCase = Schema.Struct({
  id: V2CaseId,
  title: Description,
  lawIds: Schema.NonEmptyArray(LawId),
  authorityIds: Schema.NonEmptyArray(ArtifactId),
  requiredObservationIds: Schema.NonEmptyArray(ArtifactId),
  requiredTerminalOutcome: Schema.Literals(["Succeeded", "Rejected", "Inconclusive", "SafeStop"]),
  fixture: CaseFixtureV2,
  expectedEvidence: ExpectedCaseEvidenceV2,
  execution: CaseExecutionDefinition
})

const CandidateSharedFields = {
  hypothesis: Description,
  implementationRoot: PlannedRepositoryPath,
  authorityIds: Schema.NonEmptyArray(ArtifactId),
  lawIds: Schema.Array(LawId),
  caseIds: Schema.Array(V2CaseId),
  probeIds: Schema.Array(V2ProbeId),
  gateIds: Schema.Array(V2GateId)
} as const

const MachineCandidate = Schema.Struct({
  id: V2MachineCandidateId,
  model: Schema.Literals(["extracted-fold", "total-transition"]),
  ...CandidateSharedFields
})

const FixtureRole = Schema.Struct({
  id: RoleId,
  kind: Schema.Literals([
    "kernel",
    "machine",
    "kernel-workflow",
    "first-party-provider-vertical",
    "packed-external-provider",
    "Node",
    "Bun",
    "CLI",
    "GitHub-Action",
    "effect-build-file-tree-adopter",
    "generated-public-surface"
  ]),
  parentRoleId: Schema.Union([RoleId, Schema.Null])
})

const ProviderInstance = Schema.Struct({
  id: RoleId,
  providerRoleId: RoleId,
  endpointClass: Schema.Literals(["staging", "production", "primary"])
})

const TopologyFixture = Schema.Struct({
  artifactId: ArtifactId,
  fixtureSha256: Sha256Hex,
  constructionActionIds: Schema.NonEmptyArray(ArtifactId),
  roles: Schema.Array(FixtureRole),
  providerInstances: Schema.Array(ProviderInstance),
  finalizedArtifactKinds: Schema.Array(Schema.Literals(["finalized-file", "finalized-tree"])),
  actionPlacement: Schema.Literal("host-application"),
  externalProviderLoading: Schema.Literal("ordinary-import-and-layer"),
  sharedLawIds: Schema.Array(LawId),
  sharedCaseIds: Schema.Array(V2CaseId),
  sharedProbeIds: Schema.Array(V2ProbeId)
})

const TopologyCandidate = Schema.Struct({
  id: V2TopologyCandidateId,
  model: Schema.Literals(["root", "kernel-provider-bundle", "provider-verticals"]),
  fixtureArtifactId: ArtifactId,
  ...CandidateSharedFields
})

const MarginalProbe = Schema.Struct({
  id: V2ProbeId,
  title: Description,
  lawIds: Schema.NonEmptyArray(LawId),
  authorityIds: Schema.NonEmptyArray(ArtifactId),
  requiredZeroTouchRoleIds: Schema.Array(RoleId),
  requiredChangeKinds: Schema.Array(Schema.Literals([
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
  ])),
  requiredMeasurementIds: Schema.Array(MetricId),
  changeDefinition: ProbeChangeDefinitionV2,
  execution: ProbeExecutionDefinition
})

const GateRequirement = Schema.Struct({
  id: V2GateId,
  scope: Schema.Literals(["machine", "topology"]),
  title: Description,
  authorityIds: Schema.NonEmptyArray(ArtifactId),
  lawIds: Schema.Array(LawId),
  caseIds: Schema.Array(V2CaseId),
  probeIds: Schema.Array(V2ProbeId),
  command: Schema.NonEmptyArray(Description),
  expectedExit: Schema.Literal(0),
  resultSchemaId: ArtifactId,
  hard: Schema.Literal(true),
  networkAccess: Schema.Literal(false),
  credentials: Schema.Literal(false),
  mutatesExternalState: Schema.Literal(false),
  onFailure: Schema.Literal("RejectCandidate")
})

const SelectionRuleFields = {
  firstPhase: Schema.Literal("reject-any-hard-gate-failure"),
  secondPhase: Schema.Literal("componentwise-strict-pareto"),
  dominanceRule: Schema.Literal("no-worse-on-every-objective-and-strictly-better-on-at-least-one"),
  winnerRule: Schema.Literal("only-survivor-or-survivor-dominating-every-other-survivor"),
  objectiveDirection: Schema.Literal("minimize"),
  zeroQualifierOutcome: Schema.Literal("NoQualifyingCandidate"),
  unresolvedOutcome: Schema.Literal("MaintainerDecisionRequired"),
  winnerOutcome: Schema.Literal("UniqueSelection"),
  weightedScoring: Schema.Literal("forbidden"),
  rankSums: Schema.Literal("forbidden"),
  lexicographicTieBreaks: Schema.Literal("forbidden"),
  implicitDefaults: Schema.Literal("forbidden")
} as const

const MachineSelectionPolicy = Schema.Struct({
  candidateIds: Schema.Array(V2MachineCandidateId),
  hardGateIds: Schema.Array(V2GateId),
  objectiveMetricIds: Schema.Array(MetricId),
  sourceBudget: Schema.Struct({
    numerator: Schema.Literal(3),
    denominator: Schema.Literal(5),
    comparisonSlice: Schema.Literal("preserved-overlay-machine-interpreter"),
    relocationCharged: Schema.Literal(true)
  }),
  ...SelectionRuleFields
})

const TopologySelectionPolicy = Schema.Struct({
  candidateIds: Schema.Array(V2TopologyCandidateId),
  hardGateIds: Schema.Array(V2GateId),
  objectiveMetricIds: Schema.Array(MetricId),
  marginalBudget: Schema.Struct({
    sampleUnit: Schema.Literal("one-nonzero-observation-per-predeclared-probe"),
    quantileMethod: Schema.Literal("nearest-rank"),
    medianGrossProductAdditionLinesAtMost: Schema.Literal(40),
    p90GrossProductAdditionLinesAtMost: Schema.Literal(100),
    maximumGrossProductAdditionLinesAtMost: Schema.Literal(200),
    p90IsEffectiveMaximumForNineProbes: Schema.Literal(true)
  }),
  ...SelectionRuleFields
})

export class ArchitectureTrialSpecV2 extends Schema.Class<ArchitectureTrialSpecV2>(
  "ArchitectureTrialSpecV2"
)({
  schemaVersion: Schema.Literal("ts-release/architecture-trial-spec/v2"),
  programId: ProgramId,
  inputBindings: Schema.Array(InputBinding),
  executionContract: ExecutionContract,
  measurementContract: MeasurementContract,
  authorities: Schema.Array(Authority),
  laws: Schema.Array(Law),
  machineCases: Schema.Array(MachineCase),
  machineCandidates: Schema.Array(MachineCandidate),
  topologyFixture: TopologyFixture,
  topologyCandidates: Schema.Array(TopologyCandidate),
  marginalProbes: Schema.Array(MarginalProbe),
  gateRequirements: Schema.Array(GateRequirement),
  machineSelectionPolicy: MachineSelectionPolicy,
  topologySelectionPolicy: TopologySelectionPolicy,
  receiptContract: ReceiptContract
}) {}

export class TrialSpecInvariantError extends Schema.TaggedError<TrialSpecInvariantError>()(
  "TrialSpecInvariantError",
  {
    issues: Schema.NonEmptyArray(Schema.String),
    message: Schema.String
  }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture trial specification invariant failure: ${issues.join("; ")}`
    })
  }
}

const exactOrderedIds = (
  label: string,
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
  issues: Array<string>
): void => {
  const duplicates = actual.filter((id, index) => actual.indexOf(id) !== index)
  if (duplicates.length > 0) issues.push(`${label} contains duplicate ids: ${[...new Set(duplicates)].join(", ")}`)
  if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
    issues.push(`${label} must equal the required ordered set [${expected.join(", ")}]`)
  }
}

const checkReferences = (
  label: string,
  actual: ReadonlyArray<string>,
  available: ReadonlySet<string>,
  issues: Array<string>
): void => {
  const duplicates = actual.filter((id, index) => actual.indexOf(id) !== index)
  if (duplicates.length > 0) issues.push(`${label} contains duplicate references: ${[...new Set(duplicates)].join(", ")}`)
  for (const id of actual) {
    if (!available.has(id)) issues.push(`${label} has dangling reference ${id}`)
  }
}

const expectedFixtureRoles = [
  ["role-kernel", "kernel", null],
  ["role-machine", "machine", "role-kernel"],
  ["role-kernel-workflow", "kernel-workflow", "role-kernel"],
  ["role-first-party-provider-a", "first-party-provider-vertical", null],
  ["role-first-party-provider-b", "first-party-provider-vertical", null],
  ["role-packed-external-provider", "packed-external-provider", null],
  ["role-node-host", "Node", null],
  ["role-bun-host", "Bun", null],
  ["role-cli-host", "CLI", null],
  ["role-github-action-host", "GitHub-Action", null],
  ["role-effect-build-adopter", "effect-build-file-tree-adopter", null],
  ["role-surface-generator", "generated-public-surface", null]
] as const

const expectedProviderInstances = [
  ["provider-a-staging", "role-first-party-provider-a", "staging"],
  ["provider-a-production", "role-first-party-provider-a", "production"],
  ["provider-b-primary", "role-first-party-provider-b", "primary"],
  ["external-provider-primary", "role-packed-external-provider", "primary"]
] as const

const expectedTopologyConstructionActions = [
  "fixture.construct-kernel",
  "fixture.construct-machine",
  "fixture.construct-two-first-party-providers",
  "fixture.construct-two-provider-instances",
  "fixture.pack-external-provider",
  "fixture.construct-node-bun-cli-action-hosts",
  "fixture.construct-effect-build-adopter",
  "fixture.generate-public-surface"
] as const

const expectedAdapter = (mode: "case" | "probe" | "gate") => ({
  executorId: "candidate-harness-v2",
  argv: ["bun", "run", "trial-adapter.ts", mode],
  inputTransport: "canonical-json-stdin",
  outputTransport: "canonical-json-stdout",
  stderrPolicy: "empty",
  workingDirectoryPolicy: "isolated-candidate-copy",
  timeoutMilliseconds: 30_000,
  outputLimitBytes: 1_048_576,
  networkAccess: false,
  credentials: false,
  mutatesExternalState: false
}) as const

const expectedReceiptIdentityFields = [
  "schema-version",
  "program-id",
  "run-context-sha256",
  "run-context",
  "preflight-failures",
  "case-receipts",
  "probe-receipts",
  "gate-receipts",
  "objective-metrics",
  "qualification"
] as const

export const machineCaseFixtureSha256 = (
  machineCase: ArchitectureTrialSpecV2["machineCases"][number]
) => caseFixtureSha256V2(machineCase.fixture)

export const machineCaseDefinitionSha256 = (
  machineCase: ArchitectureTrialSpecV2["machineCases"][number]
) => definitionSha256("case", {
  caseId: machineCase.id,
  definitionId: machineCase.execution.definitionId,
  fixtureSha256: machineCase.execution.fixtureSha256,
  expectedEvidenceSha256: machineCase.execution.expectedEvidenceSha256,
  executionContractSha256: machineCase.execution.executionContractSha256,
  executorId: machineCase.execution.executorId,
  assertionIds: machineCase.execution.assertionIds,
  requiredObservationIds: machineCase.requiredObservationIds,
  requiredTerminalOutcome: machineCase.requiredTerminalOutcome,
  inputSchemaId: machineCase.execution.inputSchemaId,
  outputSchemaId: machineCase.execution.outputSchemaId
})

export const topologyFixtureSha256 = (
  topologyFixture: ArchitectureTrialSpecV2["topologyFixture"]
) => fixtureSha256("topology", {
  artifactId: topologyFixture.artifactId,
  constructionActionIds: topologyFixture.constructionActionIds,
  roles: topologyFixture.roles,
  providerInstances: topologyFixture.providerInstances,
  finalizedArtifactKinds: topologyFixture.finalizedArtifactKinds,
  actionPlacement: topologyFixture.actionPlacement,
  externalProviderLoading: topologyFixture.externalProviderLoading,
  sharedLawIds: topologyFixture.sharedLawIds,
  sharedCaseIds: topologyFixture.sharedCaseIds,
  sharedProbeIds: topologyFixture.sharedProbeIds
})

export const marginalProbeDefinitionSha256 = (
  probe: ArchitectureTrialSpecV2["marginalProbes"][number]
) => definitionSha256("probe", {
  probeId: probe.id,
  definitionId: probe.execution.definitionId,
  fixtureId: probe.execution.fixtureId,
  baseFixtureSha256: probe.execution.baseFixtureSha256,
  changeDefinitionSha256: probe.execution.changeDefinitionSha256,
  executionContractSha256: probe.execution.executionContractSha256,
  measurementContractSha256: probe.execution.measurementContractSha256,
  executorId: probe.execution.executorId,
  actionId: probe.execution.actionId,
  inputSchemaId: probe.execution.inputSchemaId,
  outputSchemaId: probe.execution.outputSchemaId,
  nonZeroObservationRequired: probe.execution.nonZeroObservationRequired,
  requiredZeroTouchRoleIds: probe.requiredZeroTouchRoleIds,
  requiredChangeKinds: probe.requiredChangeKinds,
  requiredMeasurementIds: probe.requiredMeasurementIds
})

export const gateDefinitionSha256 = (
  gate: ArchitectureTrialSpecV2["gateRequirements"][number]
) => definitionSha256("gate", {
  id: gate.id,
  scope: gate.scope,
  title: gate.title,
  authorityIds: gate.authorityIds,
  lawIds: gate.lawIds,
  caseIds: gate.caseIds,
  probeIds: gate.probeIds,
  command: gate.command,
  expectedExit: gate.expectedExit,
  resultSchemaId: gate.resultSchemaId,
  hard: gate.hard,
  networkAccess: gate.networkAccess,
  credentials: gate.credentials,
  mutatesExternalState: gate.mutatesExternalState,
  onFailure: gate.onFailure
})

export const trialSpecInvariantIssues = (spec: ArchitectureTrialSpecV2): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const authorityIds = spec.authorities.map(({ id }) => id)
  const lawIds = spec.laws.map(({ id }) => id)
  const caseIds = spec.machineCases.map(({ id }) => id)
  const probeIds = spec.marginalProbes.map(({ id }) => id)
  const machineCandidateIds = spec.machineCandidates.map(({ id }) => id)
  const topologyCandidateIds = spec.topologyCandidates.map(({ id }) => id)
  const gateIds = spec.gateRequirements.map(({ id }) => id)

  if (spec.programId !== "ts-release-architecture-program") {
    issues.push("programId must remain ts-release-architecture-program")
  }
  issues.push(...exactOrderedIssues("inputBindings", spec.inputBindings, REQUIRED_INPUT_BINDINGS))

  const executionContract = spec.executionContract
  issues.push(...exactOrderedIssues(
    "executionContract.caseActions",
    executionContract.caseActions.map(({ id, semantics }) => [id, semantics]),
    REQUIRED_CASE_ACTIONS
  ))
  issues.push(...exactOrderedIssues(
    "executionContract.probeActions",
    executionContract.probeActions.map(({ id, semantics }) => [id, semantics]),
    REQUIRED_PROBE_ACTIONS
  ))
  for (const [mode, actual] of [
    ["case", executionContract.caseAdapter],
    ["probe", executionContract.probeAdapter],
    ["gate", executionContract.gateAdapter]
  ] as const) {
    if (JSON.stringify(actual) !== JSON.stringify(expectedAdapter(mode))) {
      issues.push(`executionContract ${mode} adapter must preserve the closed candidate-harness-v2 argv`)
    }
  }
  if (executionContract.candidateOutputAuthority !== "raw-evidence-only" ||
    executionContract.evaluationAuthority !== "runner-only") {
    issues.push("executionContract must keep candidate output raw and runner evaluation authoritative")
  }
  if (JSON.stringify(executionContract.closedEnvironment) !== JSON.stringify({
    inheritedVariableNames: ["PATH"],
    locale: "C",
    timezone: "UTC",
    credentialVariablePolicy: "reject-and-strip",
    proxyVariablePolicy: "reject-and-strip"
  })) {
    issues.push("executionContract must preserve the closed PATH-only C/UTC environment")
  }
  if (executionContract.contractSha256 !== executionContractSha256(executionContract)) {
    issues.push("executionContract contractSha256 does not bind its canonical v2 body")
  }

  const measurementContract = spec.measurementContract
  issues.push(...exactOrderedIssues(
    "measurementContract.sourceLanes",
    measurementContract.sourceLanes.map(({ id, countsTowardProductSource }) => [id, countsTowardProductSource]),
    REQUIRED_TRIAL_LANES
  ))
  issues.push(...exactOrderedIssues(
    "measurementContract.methods",
    measurementContract.methods.map(({ id, unit, algorithmId, classificationAuthority }) => [
      id,
      unit,
      algorithmId,
      classificationAuthority
    ]),
    REQUIRED_MEASUREMENT_METHODS
  ))
  if (measurementContract.candidateManifestPath !== "trial-candidate.json" ||
    measurementContract.candidateAdapterPath !== "trial-adapter.ts" ||
    JSON.stringify(measurementContract.diffArgv) !== JSON.stringify([
      "git", "diff", "--no-index", "--numstat", "--no-renames", "--diff-algorithm=myers", "--"
    ]) ||
    JSON.stringify(measurementContract.requiredToolchainBindings) !== JSON.stringify([
      "bun", "typescript", "effect", "git"
    ])) {
    issues.push("measurementContract changed its fixed candidate files, diff argv, or toolchain bindings")
  }
  if (measurementContract.contractSha256 !== measurementContractSha256(measurementContract)) {
    issues.push("measurementContract contractSha256 does not bind its canonical v2 body")
  }

  const receiptContract = spec.receiptContract
  if (receiptContract.machineResultRoot !== "docs/refactor/architecture-program/results/machine" ||
    receiptContract.topologyResultRoot !== "docs/refactor/architecture-program/results/topology" ||
    receiptContract.runnerSourceRoot !== "tools/architecture-program/src") {
    issues.push("receiptContract changed a prescribed result or runner source path")
  }
  issues.push(...exactOrderedIssues(
    "receiptContract.requiredInputBindingIds",
    receiptContract.requiredInputBindingIds,
    REQUIRED_INPUT_BINDINGS.map(({ id }) => id)
  ))
  issues.push(...exactOrderedIssues(
    "receiptContract.identityFieldIds",
    receiptContract.identityFieldIds,
    expectedReceiptIdentityFields
  ))
  exactOrderedIds("authorities", authorityIds, REQUIRED_AUTHORITY_IDS, issues)
  exactOrderedIds("laws", lawIds, REQUIRED_LAW_IDS, issues)
  exactOrderedIds("machineCases", caseIds, REQUIRED_CASE_IDS, issues)
  exactOrderedIds("marginalProbes", probeIds, REQUIRED_PROBE_IDS, issues)
  exactOrderedIds("machineCandidates", machineCandidateIds, REQUIRED_MACHINE_CANDIDATE_IDS, issues)
  exactOrderedIds("topologyCandidates", topologyCandidateIds, REQUIRED_TOPOLOGY_CANDIDATE_IDS, issues)
  exactOrderedIds(
    "gateRequirements",
    gateIds,
    [...REQUIRED_MACHINE_GATE_IDS, ...REQUIRED_TOPOLOGY_GATE_IDS],
    issues
  )

  const authoritySet = new Set<string>(authorityIds)
  const lawSet = new Set<string>(lawIds)
  const caseSet = new Set<string>(caseIds)
  const probeSet = new Set<string>(probeIds)
  const gateSet = new Set<string>(gateIds)

  for (const authority of spec.authorities) {
    const authorityId = authority.id as (typeof REQUIRED_AUTHORITY_IDS)[number]
    const expected = REQUIRED_AUTHORITIES[authorityId]
    const sourceAnchor = authority.sourceAnchor
    const expectedAnchor = expected?.sourceAnchor
    const anchorMatches = expectedAnchor !== undefined &&
      sourceAnchor._tag === expectedAnchor._tag &&
      sourceAnchor.path === expectedAnchor.path &&
      sourceAnchor.sha256 === expectedAnchor.sha256 &&
      (sourceAnchor._tag !== "LineRangeSourceAnchor" || (
        expectedAnchor._tag === "LineRangeSourceAnchor" &&
        sourceAnchor.startLine === expectedAnchor.startLine &&
        sourceAnchor.endLine === expectedAnchor.endLine
      ))
    if (expected === undefined ||
      authority.authorityKind !== expected.authorityKind ||
      authority.title !== expected.title ||
      authority.ownerId !== expected.ownerId ||
      authority.gitRevision !== expected.gitRevision ||
      !anchorMatches) {
      issues.push(`authority ${authority.id} changed its predeclared provenance coordinate`)
    }
  }

  for (const [index, law] of spec.laws.entries()) {
    const lawId = law.id as (typeof REQUIRED_LAW_IDS)[number]
    checkReferences(`law ${law.id} authorityIds`, law.authorityIds, authoritySet, issues)
    exactOrderedIds(`law ${law.id} authorityIds`, law.authorityIds, REQUIRED_LAW_AUTHORITY_IDS[lawId] ?? [], issues)
    if (law.statement !== REQUIRED_LAW_STATEMENTS[index]) {
      issues.push(`law ${law.id} statement does not preserve the required law`)
    }
  }
  for (const machineCase of spec.machineCases) {
    const caseId = machineCase.id as (typeof REQUIRED_CASE_IDS)[number]
    checkReferences(`case ${machineCase.id} lawIds`, machineCase.lawIds, lawSet, issues)
    checkReferences(`case ${machineCase.id} authorityIds`, machineCase.authorityIds, authoritySet, issues)
    const requiredLawIds = REQUIRED_CASE_LAW_IDS[caseId]
    const requiredObservationIds = REQUIRED_CASE_OBSERVATION_IDS[caseId]
    const requiredTerminalOutcome = REQUIRED_CASE_TERMINAL_OUTCOMES[caseId]
    if (requiredLawIds !== undefined) {
      exactOrderedIds(`case ${machineCase.id} lawIds`, machineCase.lawIds, requiredLawIds, issues)
    }
    exactOrderedIds(
      `case ${machineCase.id} authorityIds`,
      machineCase.authorityIds,
      REQUIRED_CASE_AUTHORITY_IDS[caseId] ?? [],
      issues
    )
    exactOrderedIds(
      `case ${machineCase.id} requiredObservationIds`,
      machineCase.requiredObservationIds,
      requiredObservationIds ?? [],
      issues
    )
    if (machineCase.requiredTerminalOutcome !== requiredTerminalOutcome) {
      issues.push(`case ${machineCase.id} terminal outcome must be ${requiredTerminalOutcome ?? "defined"}`)
    }
    if (caseFixtureSha256V2(machineCase.fixture) !==
      caseFixtureSha256V2(REQUIRED_CASE_FIXTURES[caseId])) {
      issues.push(`case ${machineCase.id} must preserve the exact runner-owned fixture payload`)
    }
    if (expectedCaseEvidenceSha256V2(machineCase.expectedEvidence) !==
      expectedCaseEvidenceSha256V2(REQUIRED_EXPECTED_CASE_EVIDENCE[caseId])) {
      issues.push(`case ${machineCase.id} must preserve the exact runner-owned expected evidence`)
    }
    const expectedExecution = REQUIRED_CASE_EXECUTIONS[caseId]
    if (machineCase.execution.definitionId !== `${machineCase.id}-executable-definition` ||
      machineCase.execution.fixtureId !== `${machineCase.id}-canonical-fixture` ||
      machineCase.execution.executionContractSha256 !== executionContract.contractSha256) {
      issues.push(`case ${machineCase.id} changed its v2 definition, fixture, or execution-contract binding`)
    }
    if (expectedExecution !== undefined) {
      issues.push(...exactOrderedIssues(
        `case ${machineCase.id} actionIds`,
        machineCase.execution.actionIds,
        expectedExecution.actionIds
      ))
      issues.push(...exactOrderedIssues(
        `case ${machineCase.id} faultIds`,
        machineCase.execution.faultIds,
        expectedExecution.faultIds
      ))
    }
    issues.push(...exactOrderedIssues(
      `case ${machineCase.id} assertionIds`,
      machineCase.execution.assertionIds,
      requiredObservationIds ?? []
    ))
    if (machineCase.execution.fixtureSha256 !== machineCaseFixtureSha256(machineCase)) {
      issues.push(`case ${machineCase.id} fixtureSha256 does not bind its executable fixture`)
    }
    if (machineCase.execution.expectedEvidenceSha256 !==
      expectedCaseEvidenceSha256V2(machineCase.expectedEvidence)) {
      issues.push(`case ${machineCase.id} expectedEvidenceSha256 does not bind runner-owned evidence`)
    }
    if (machineCase.execution.definitionSha256 !== machineCaseDefinitionSha256(machineCase)) {
      issues.push(`case ${machineCase.id} definitionSha256 does not bind its executable definition`)
    }
  }
  for (const probe of spec.marginalProbes) {
    const probeId = probe.id as (typeof REQUIRED_PROBE_IDS)[number]
    checkReferences(`probe ${probe.id} lawIds`, probe.lawIds, lawSet, issues)
    checkReferences(`probe ${probe.id} authorityIds`, probe.authorityIds, authoritySet, issues)
    exactOrderedIds(
      `probe ${probe.id} authorityIds`,
      probe.authorityIds,
      REQUIRED_PROBE_AUTHORITY_IDS[probeId] ?? [],
      issues
    )
    exactOrderedIds(`probe ${probe.id} lawIds`, probe.lawIds, REQUIRED_PROBE_LAW_IDS[probeId] ?? [], issues)
    exactOrderedIds(
      `probe ${probe.id} zero-touch roles`,
      probe.requiredZeroTouchRoleIds,
      REQUIRED_PROBE_ZERO_TOUCH_ROLE_IDS[probeId] ?? [],
      issues
    )
    exactOrderedIds(
      `probe ${probe.id} required change kinds`,
      probe.requiredChangeKinds,
      REQUIRED_PROBE_CHANGE_KINDS[probeId] ?? [],
      issues
    )
    exactOrderedIds(
      `probe ${probe.id} measurement ids`,
      probe.requiredMeasurementIds,
      REQUIRED_PROBE_MEASUREMENT_IDS,
      issues
    )
    const expectedChangeDefinition = {
      schemaVersion: "architecture-probe-change-definition-v2",
      probeId,
      changeId: REQUIRED_PROBE_CHANGE_IDS[probeId],
      baseFixtureSha256: spec.topologyFixture.fixtureSha256,
      actionId: REQUIRED_PROBE_ACTION_IDS[probeId],
      parameters: REQUIRED_PROBE_PARAMETER_ENTRIES[probeId],
      requiredZeroTouchRoleIds: REQUIRED_PROBE_ZERO_TOUCH_ROLE_IDS[probeId],
      requiredChangeKinds: REQUIRED_PROBE_CHANGE_KINDS[probeId]
    }
    if (probeChangeDefinitionSha256V2(probe.changeDefinition) !==
      probeChangeDefinitionSha256V2(expectedChangeDefinition)) {
      issues.push(`probe ${probe.id} must preserve the exact runner-owned change definition`)
    }
    if (probe.execution.definitionId !== `${probe.id}-executable-definition` ||
      probe.execution.baseFixtureSha256 !== spec.topologyFixture.fixtureSha256 ||
      probe.execution.executionContractSha256 !== executionContract.contractSha256 ||
      probe.execution.measurementContractSha256 !== measurementContract.contractSha256 ||
      probe.execution.actionId !== REQUIRED_PROBE_ACTION_IDS[probeId]) {
      issues.push(`probe ${probe.id} changed its v2 definition, fixture, action, or contract binding`)
    }
    if (probe.execution.changeDefinitionSha256 !==
      probeChangeDefinitionSha256V2(probe.changeDefinition)) {
      issues.push(`probe ${probe.id} changeDefinitionSha256 does not bind its change payload`)
    }
    if (probe.execution.definitionSha256 !== marginalProbeDefinitionSha256(probe)) {
      issues.push(`probe ${probe.id} definitionSha256 does not bind its executable definition`)
    }
  }
  for (const gate of spec.gateRequirements) {
    const requiredGateId = gate.id as RequiredGateId
    checkReferences(`gate ${gate.id} lawIds`, gate.lawIds, lawSet, issues)
    checkReferences(`gate ${gate.id} caseIds`, gate.caseIds, caseSet, issues)
    checkReferences(`gate ${gate.id} probeIds`, gate.probeIds, probeSet, issues)
    checkReferences(`gate ${gate.id} authorityIds`, gate.authorityIds, authoritySet, issues)
    exactOrderedIds(`gate ${gate.id} lawIds`, gate.lawIds, REQUIRED_GATE_LAW_IDS[requiredGateId] ?? [], issues)
    exactOrderedIds(`gate ${gate.id} caseIds`, gate.caseIds, REQUIRED_GATE_CASE_IDS[requiredGateId] ?? [], issues)
    exactOrderedIds(`gate ${gate.id} probeIds`, gate.probeIds, REQUIRED_GATE_PROBE_IDS[requiredGateId] ?? [], issues)
    exactOrderedIds(
      `gate ${gate.id} authorityIds`,
      gate.authorityIds,
      [gate.scope === "machine" ? "A03-machine-contract" : "A04-topology-contract"],
      issues
    )
    const expectedResultSchemaId = gate.scope === "machine" ? "machine-trial-result-v2" : "topology-trial-result-v2"
    if (gate.resultSchemaId !== expectedResultSchemaId) {
      issues.push(`gate ${gate.id} must bind ${expectedResultSchemaId}`)
    }
    if ((gate.id.startsWith("GM") ? "machine" : "topology") !== gate.scope) {
      issues.push(`gate ${gate.id} scope does not match its id`)
    }
    const expectedCommand = [
      "bun",
      "run",
      "--cwd",
      "tools/architecture-program",
      gate.scope === "machine" ? "gate:machine" : "gate:topology",
      "--",
      "--gate",
      gate.id
    ]
    if (JSON.stringify(gate.command) !== JSON.stringify(expectedCommand)) {
      issues.push(`gate ${gate.id} command must remain the predeclared candidate-neutral argv`)
    }
  }

  for (const candidate of spec.machineCandidates) {
    const candidateId = candidate.id as (typeof REQUIRED_MACHINE_CANDIDATE_IDS)[number]
    const expected = REQUIRED_MACHINE_CANDIDATES[candidateId]
    checkReferences(`machine candidate ${candidate.id} authorityIds`, candidate.authorityIds, authoritySet, issues)
    exactOrderedIds(`machine candidate ${candidate.id} authorityIds`, candidate.authorityIds, ["A03-machine-contract"], issues)
    exactOrderedIds(`machine candidate ${candidate.id} lawIds`, candidate.lawIds, REQUIRED_LAW_IDS, issues)
    exactOrderedIds(`machine candidate ${candidate.id} caseIds`, candidate.caseIds, REQUIRED_CASE_IDS, issues)
    exactOrderedIds(`machine candidate ${candidate.id} probeIds`, candidate.probeIds, REQUIRED_PROBE_IDS, issues)
    exactOrderedIds(`machine candidate ${candidate.id} gateIds`, candidate.gateIds, REQUIRED_MACHINE_GATE_IDS, issues)
    checkReferences(`machine candidate ${candidate.id} gateIds`, candidate.gateIds, gateSet, issues)
    if (expected !== undefined && (
      candidate.model !== expected.model ||
      candidate.hypothesis !== expected.hypothesis ||
      candidate.implementationRoot !== expected.implementationRoot
    )) {
      issues.push(`machine candidate ${candidate.id} changed its predeclared model, hypothesis, or root`)
    }
  }
  for (const candidate of spec.topologyCandidates) {
    const candidateId = candidate.id as (typeof REQUIRED_TOPOLOGY_CANDIDATE_IDS)[number]
    const expected = REQUIRED_TOPOLOGY_CANDIDATES[candidateId]
    checkReferences(`topology candidate ${candidate.id} authorityIds`, candidate.authorityIds, authoritySet, issues)
    exactOrderedIds(`topology candidate ${candidate.id} authorityIds`, candidate.authorityIds, ["A04-topology-contract"], issues)
    exactOrderedIds(`topology candidate ${candidate.id} lawIds`, candidate.lawIds, REQUIRED_LAW_IDS, issues)
    exactOrderedIds(`topology candidate ${candidate.id} caseIds`, candidate.caseIds, REQUIRED_CASE_IDS, issues)
    exactOrderedIds(`topology candidate ${candidate.id} probeIds`, candidate.probeIds, REQUIRED_PROBE_IDS, issues)
    exactOrderedIds(`topology candidate ${candidate.id} gateIds`, candidate.gateIds, REQUIRED_TOPOLOGY_GATE_IDS, issues)
    if (candidate.fixtureArtifactId !== spec.topologyFixture.artifactId) {
      issues.push(`topology candidate ${candidate.id} does not bind the shared fixture`)
    }
    checkReferences(`topology candidate ${candidate.id} gateIds`, candidate.gateIds, gateSet, issues)
    if (expected !== undefined && (
      candidate.model !== expected.model ||
      candidate.hypothesis !== expected.hypothesis ||
      candidate.implementationRoot !== expected.implementationRoot
    )) {
      issues.push(`topology candidate ${candidate.id} changed its predeclared model, hypothesis, or root`)
    }
  }

  exactOrderedIds("topologyFixture.sharedLawIds", spec.topologyFixture.sharedLawIds, REQUIRED_LAW_IDS, issues)
  exactOrderedIds("topologyFixture.sharedCaseIds", spec.topologyFixture.sharedCaseIds, REQUIRED_CASE_IDS, issues)
  exactOrderedIds("topologyFixture.sharedProbeIds", spec.topologyFixture.sharedProbeIds, REQUIRED_PROBE_IDS, issues)
  if (spec.topologyFixture.artifactId !== "F01-shared-topology-fixture") {
    issues.push("topologyFixture artifactId must remain F01-shared-topology-fixture")
  }
  issues.push(...exactOrderedIssues(
    "topologyFixture.constructionActionIds",
    spec.topologyFixture.constructionActionIds,
    expectedTopologyConstructionActions
  ))
  if (spec.topologyFixture.fixtureSha256 !== topologyFixtureSha256(spec.topologyFixture)) {
    issues.push("topologyFixture fixtureSha256 does not bind its canonical v2 fixture")
  }
  const actualRoles = spec.topologyFixture.roles.map(({ id, kind, parentRoleId }) => [id, kind, parentRoleId] as const)
  if (JSON.stringify(actualRoles) !== JSON.stringify(expectedFixtureRoles)) {
    issues.push("topologyFixture roles must preserve the exact kernel/provider/host/Action/artifact fixture")
  }
  const actualInstances = spec.topologyFixture.providerInstances.map(
    ({ id, providerRoleId, endpointClass }) => [id, providerRoleId, endpointClass] as const
  )
  if (JSON.stringify(actualInstances) !== JSON.stringify(expectedProviderInstances)) {
    issues.push("topologyFixture must preserve two provider-a instances, provider-b, and the packed external provider")
  }
  if (JSON.stringify(spec.topologyFixture.finalizedArtifactKinds) !== JSON.stringify(["finalized-file", "finalized-tree"])) {
    issues.push("topologyFixture must preserve both finalized-file and finalized-tree literals")
  }

  exactOrderedIds(
    "machineSelectionPolicy.candidateIds",
    spec.machineSelectionPolicy.candidateIds,
    REQUIRED_MACHINE_CANDIDATE_IDS,
    issues
  )
  exactOrderedIds(
    "machineSelectionPolicy.hardGateIds",
    spec.machineSelectionPolicy.hardGateIds,
    REQUIRED_MACHINE_GATE_IDS,
    issues
  )
  exactOrderedIds(
    "machineSelectionPolicy.objectiveMetricIds",
    spec.machineSelectionPolicy.objectiveMetricIds,
    REQUIRED_MACHINE_METRIC_IDS,
    issues
  )
  exactOrderedIds(
    "topologySelectionPolicy.candidateIds",
    spec.topologySelectionPolicy.candidateIds,
    REQUIRED_TOPOLOGY_CANDIDATE_IDS,
    issues
  )
  exactOrderedIds(
    "topologySelectionPolicy.hardGateIds",
    spec.topologySelectionPolicy.hardGateIds,
    REQUIRED_TOPOLOGY_GATE_IDS,
    issues
  )
  exactOrderedIds(
    "topologySelectionPolicy.objectiveMetricIds",
    spec.topologySelectionPolicy.objectiveMetricIds,
    REQUIRED_TOPOLOGY_METRIC_IDS,
    issues
  )

  const gateById = new Map<string, (typeof spec.gateRequirements)[number]>(
    spec.gateRequirements.map((gate) => [gate.id, gate])
  )
  exactOrderedIds("GM01 caseIds", gateById.get("GM01-shared-case-semantics")?.caseIds ?? [], REQUIRED_CASE_IDS, issues)
  exactOrderedIds("GM02 lawIds", gateById.get("GM02-law-and-owner-invariants")?.lawIds ?? [], REQUIRED_LAW_IDS, issues)
  exactOrderedIds("GM06 probeIds", gateById.get("GM06-marginal-measurement")?.probeIds ?? [], REQUIRED_PROBE_IDS, issues)
  exactOrderedIds("GM09 caseIds", gateById.get("GM09-offline-nonmutation")?.caseIds ?? [], REQUIRED_CASE_IDS, issues)
  exactOrderedIds("GT01 caseIds", gateById.get("GT01-shared-fixture-machine-and-cases")?.caseIds ?? [], REQUIRED_CASE_IDS, issues)
  exactOrderedIds("GT15 probeIds", gateById.get("GT15-all-nine-marginal-probes")?.probeIds ?? [], REQUIRED_PROBE_IDS, issues)
  exactOrderedIds("GT16 caseIds", gateById.get("GT16-offline-nonmutation")?.caseIds ?? [], REQUIRED_CASE_IDS, issues)

  return issues
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeTrialSpec = Schema.decodeUnknownEffect(ArchitectureTrialSpecV2, strictOptions)

export const decodeArchitectureTrialSpec = Effect.fn("ArchitectureTrialSpecV2.decode")(
  function* (input: unknown) {
    const spec = yield* decodeTrialSpec(input)
    const issues = trialSpecInvariantIssues(spec)
    if (issues.length > 0) {
      yield* new TrialSpecInvariantError(issues as [string, ...Array<string>])
    }
    return spec
  }
)

const encodeTrialSpecStructure = Schema.encodeUnknownSync(ArchitectureTrialSpecV2, strictOptions)

export const encodeArchitectureTrialSpec = (spec: ArchitectureTrialSpecV2): unknown => {
  const issues = trialSpecInvariantIssues(spec)
  if (issues.length > 0) {
    throw new TrialSpecInvariantError(issues as [string, ...Array<string>])
  }
  return encodeTrialSpecStructure(spec)
}

export const candidateNeutralTopLevelKeys = [
  "schemaVersion",
  "programId",
  "inputBindings",
  "executionContract",
  "measurementContract",
  "authorities",
  "laws",
  "machineCases",
  "machineCandidates",
  "topologyFixture",
  "topologyCandidates",
  "marginalProbes",
  "gateRequirements",
  "machineSelectionPolicy",
  "topologySelectionPolicy",
  "receiptContract"
] as const
