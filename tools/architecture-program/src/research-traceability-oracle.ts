/**
 * Independent audit oracle for research traceability.
 *
 * This module is deliberately not imported by traceability-normalization.ts.
 * Normalization owns proposition text and source extraction; this file owns the
 * independently reviewed identity, denominator, ownership, state, and linkage
 * expectations used to reject a generator and output that agree with the same
 * omission. Keep the two authoring paths separate.
 */

const ids = (...chunks: ReadonlyArray<string>): ReadonlyArray<string> =>
  chunks.flatMap((chunk) => chunk.split(" ").filter((value) => value.length > 0))

export type ProductClass =
  | "product-outcome"
  | "maintained-destination"
  | "later-outcome"
  | "census-disposition"

export type PropositionDisposition =
  | "accept"
  | "reject"
  | "supersede"
  | "defer"
  | "adjacent"
  | "historical-only"

export type PropositionStatus =
  | "required"
  | "rewrite-missing"
  | "integration-pending"
  | "deferred-later"
  | "provisional-open"
  | "retired"
  | "pending-migration-decision"
  | "comparator-only"

export const PRODUCT_SOURCE_GROUPS: ReadonlyArray<{
  readonly sourceKey: string
  readonly expectedCount: number
  readonly sourceIds: ReadonlyArray<string>
  readonly propositionClass: ProductClass
  readonly disposition: PropositionDisposition
  readonly status: PropositionStatus
  readonly idNamespace: "outcome" | "census"
}> = [
  {
    sourceKey: "scorecard.selected",
    expectedCount: 69,
    sourceIds: ids(
      "K01 K02 K03 D01-01 D01-02 D01-03 D01-04 D01-05 D01-06",
      "D02-01 D02-02 D02-03 D02-04 D02-05 D02-06 D02-07",
      "D03-01 D03-02 D03-03 D03-04 D03-05 D03-06",
      "D04-01 D04-02 D04-03 D05-01 D05-02 D05-03",
      "D06-01 D06-02 D06-03 D06-04 D06-05 D06-06 D06-07",
      "D07-01 D07-02 D07-03",
      "P01-01 P01-02 P01-03 P01-04 P02-01 P02-02 P02-03 P03-01 P03-02 P04-01",
      "P05-01 P05-02 P05-03 P05-05 P05-06 P06-01 P07-01 P08-01",
      "P09-01 P09-02 P09-03 P10-01 P10-02 P10-03 P10-04",
      "Q01 Q02-01 Q02-02 AI01 AI02 AI03"
    ),
    propositionClass: "product-outcome",
    disposition: "accept",
    status: "rewrite-missing",
    idNamespace: "outcome"
  },
  {
    sourceKey: "scorecard.maintained",
    expectedCount: 7,
    sourceIds: ids("X01 X02 X03 X04 X05 X06 X07"),
    propositionClass: "maintained-destination",
    disposition: "defer",
    status: "deferred-later",
    idNamespace: "outcome"
  },
  {
    sourceKey: "scorecard.later",
    expectedCount: 30,
    sourceIds: ids(
      "P05-04 P05-07 P09-04 P09-05 P09-06 Q03 Q05-02 Q06-01 Q06-02 Q07",
      "L01 L02 L03 L04 L05 L06 L07 L08 L09 L10 L11 L12 L13 L14 L15 L16 L17 L18 L19 L20"
    ),
    propositionClass: "later-outcome",
    disposition: "defer",
    status: "deferred-later",
    idNamespace: "outcome"
  },
  {
    sourceKey: "scorecard.census-adjacent",
    expectedCount: 5,
    sourceIds: ids("ADJ01 ADJ02 ADJ03 ADJ04 ADJ05"),
    propositionClass: "census-disposition",
    disposition: "adjacent",
    status: "deferred-later",
    idNamespace: "census"
  },
  {
    sourceKey: "scorecard.census-rejected",
    expectedCount: 18,
    sourceIds: ids("M01 M02 M03 M04 M05 M06 M07 M08 M09 M10 M11 M12 M13 M14 E01 E02 E03 E04"),
    propositionClass: "census-disposition",
    disposition: "reject",
    status: "retired",
    idNamespace: "census"
  }
]

export const PRODUCT_OWNER_CODE_GROUPS: ReadonlyArray<{
  readonly code: string
  readonly sourceIds: ReadonlyArray<string>
  readonly ownerIds: ReadonlyArray<string>
}> = [
  { code: "A0", sourceIds: ids("D06-01"), ownerIds: ["consumer-application", "ts-release"] },
  { code: "AC", sourceIds: ids("D06-06"), ownerIds: ["consumer-application", "ts-release"] },
  { code: "AJ", sourceIds: ids("K02 D06-07"), ownerIds: ["ts-release"] },
  { code: "AP", sourceIds: ids("Q05-02"), ownerIds: ["ts-release"] },
  { code: "APP", sourceIds: ids("Q06-01 Q06-02"), ownerIds: ["ts-release"] },
  { code: "BA", sourceIds: ids("P02-01 P02-02 P02-03"), ownerIds: ["effect-build-archives"] },
  { code: "BAP", sourceIds: ids("P06-01 P07-01 P08-01 P09-01 P09-02 P10-03 P10-04 Q07"), ownerIds: ["effect-build-apple"] },
  { code: "BAP+AJ", sourceIds: ids("P10-01 P10-02"), ownerIds: ["effect-build-apple", "ts-release"] },
  { code: "BB", sourceIds: ids("P01-02"), ownerIds: ["effect-build-bun"] },
  { code: "BCK", sourceIds: ids("Q01"), ownerIds: ["ts-release"] },
  { code: "BCO", sourceIds: ids("P09-06"), ownerIds: ["effect-build-cosign"] },
  { code: "BD", sourceIds: ids("P01-03"), ownerIds: ["effect-build-deno"] },
  { code: "BGP", sourceIds: ids("P09-05"), ownerIds: ["effect-build-openpgp"] },
  { code: "BK", sourceIds: ids("K01 P01-01"), ownerIds: ["ts-release"] },
  { code: "BMX", sourceIds: ids("P05-06"), ownerIds: ["effect-build-nfpm"] },
  { code: "BN", sourceIds: ids("P05-01 P05-02 P05-03 P05-04 P05-05"), ownerIds: ["effect-build-nfpm"] },
  { code: "BOC", sourceIds: ids("Q03"), ownerIds: ["effect-build-oci", "ts-release"] },
  { code: "BS", sourceIds: ids("P01-04"), ownerIds: ["effect-build-node-sea"] },
  { code: "BSA", sourceIds: ids("P03-01 P03-02"), ownerIds: ["effect-build-archives"] },
  { code: "BSB", sourceIds: ids("Q02-01 Q02-02"), ownerIds: ["effect-build-sbom"] },
  { code: "BUV", sourceIds: ids("P04-01"), ownerIds: ["effect-build-python"] },
  { code: "BWS", sourceIds: ids("P09-03 P09-04"), ownerIds: ["effect-build-windows"] },
  { code: "BWX", sourceIds: ids("P05-07"), ownerIds: ["effect-build-windows"] },
  { code: "CF", sourceIds: ids("D02-04 D02-05"), ownerIds: ["ts-release"] },
  { code: "CI", sourceIds: ids("K03"), ownerIds: ["ts-release"] },
  { code: "CJ", sourceIds: ids("D02-06 D02-07"), ownerIds: ["ts-release"] },
  { code: "G0", sourceIds: ids("D03-01 D03-02 D03-03 D03-04"), ownerIds: ["ts-release"] },
  { code: "GJ", sourceIds: ids("D03-05 D03-06"), ownerIds: ["ts-release"] },
  { code: "JG", sourceIds: ids("D04-03 D05-03"), ownerIds: ["ts-release"] },
  { code: "MR", sourceIds: ids("D07-01 D07-02 D07-03"), ownerIds: ["ts-release"] },
  { code: "N0", sourceIds: ids("D01-01"), ownerIds: ["ts-release"] },
  { code: "N1", sourceIds: ids("D01-02"), ownerIds: ["ts-release"] },
  { code: "N2", sourceIds: ids("D01-03"), ownerIds: ["ts-release"] },
  { code: "N3", sourceIds: ids("D01-04 D01-05"), ownerIds: ["ts-release"] },
  { code: "NJ", sourceIds: ids("D01-06"), ownerIds: ["ts-release"] },
  { code: "PC", sourceIds: ids("D06-05"), ownerIds: ["external-provider", "ts-release"] },
  { code: "PD", sourceIds: ids("D06-02"), ownerIds: ["external-provider", "ts-release"] },
  { code: "PL", sourceIds: ids("D06-04"), ownerIds: ["external-provider", "ts-release"] },
  { code: "PT", sourceIds: ids("D06-03"), ownerIds: ["external-provider", "ts-release"] },
  { code: "R0", sourceIds: ids("D04-01 D05-01"), ownerIds: ["catalog-renderer"] },
  { code: "R0+RG", sourceIds: ids("AI02"), ownerIds: ["catalog-renderer", "ts-release"] },
  { code: "RG", sourceIds: ids("D04-02 D05-02"), ownerIds: ["ts-release"] },
  { code: "W0", sourceIds: ids("D02-01"), ownerIds: ["ts-release"] },
  { code: "W1", sourceIds: ids("D02-02"), ownerIds: ["ts-release"] },
  { code: "WJ", sourceIds: ids("D02-03"), ownerIds: ["ts-release"] },
  { code: "external", sourceIds: ids("X01 X02 X03 X04 X05 X06 X07"), ownerIds: ["external-provider"] },
  { code: "later", sourceIds: ids("L01 L02"), ownerIds: ["future-owner"] },
  { code: "later effect-build", sourceIds: ids("L03 L05 L06 L18 L19"), ownerIds: ["effect-build"] },
  { code: "later effect-build+provider", sourceIds: ids("L04"), ownerIds: ["effect-build", "future-provider"] },
  { code: "later policy integration", sourceIds: ids("L17"), ownerIds: ["ts-release"] },
  { code: "later producer+provider", sourceIds: ids("L07 L08 L09"), ownerIds: ["future-producer", "future-provider"] },
  { code: "later provider", sourceIds: ids("L14 L16"), ownerIds: ["future-provider"] },
  { code: "later provider package", sourceIds: ids("L15"), ownerIds: ["future-provider"] },
  { code: "later renderer+Git", sourceIds: ids("L10 L11 L12 L13"), ownerIds: ["catalog-renderer", "ts-release"] },
  { code: "later ts-release policy", sourceIds: ids("L20"), ownerIds: ["ts-release"] },
  { code: "validator", sourceIds: ids("AI01 AI03"), ownerIds: ["openai-plugin-validator"] }
]

export const PRODUCT_SUCCESSOR_GROUPS: ReadonlyArray<{
  readonly successorId: string
  readonly sourceIds: ReadonlyArray<string>
}> = [
  { successorId: "is.01-kernel", sourceIds: ids("K01") },
  { successorId: "is.02-npm", sourceIds: ids("D01-01 D01-02 D01-03 D01-04 D01-05 D01-06") },
  { successorId: "is.03-warehouse", sourceIds: ids("D02-01 D02-02 D02-03 D02-04 D02-05 D02-06 D02-07") },
  { successorId: "is.05-github", sourceIds: ids("D03-01 D03-02 D03-03 D03-04 D03-05 D03-06") },
  { successorId: "is.06-catalog-git", sourceIds: ids("D04-01 D04-02 D04-03 D05-01 D05-02 D05-03") },
  { successorId: "is.07-custom-provider", sourceIds: ids("D06-01 D06-02 D06-03 D06-04 D06-05 D06-06 D06-07") },
  {
    successorId: "is.08-artifacts",
    sourceIds: ids(
      "P01-01 P01-02 P01-03 P01-04 P02-01 P02-02 P02-03 P03-01 P03-02 P04-01",
      "P05-01 P05-02 P05-03 P05-05 P05-06 P06-01 P07-01 P08-01",
      "P09-01 P09-02 P09-03 P10-01 P10-02 P10-03 P10-04 Q01 Q02-01 Q02-02"
    )
  },
  { successorId: "is.09-ai-native", sourceIds: ids("D07-01 D07-02 D07-03 AI01 AI02 AI03") },
  { successorId: "is.10-action-self-release", sourceIds: ids("K02 K03") }
]

export const PRODUCT_INTEGRATION_PENDING_SOURCE_IDS = ids("P01-02 P01-03 P01-04")

export const PRODUCT_CENSUS_SUCCESSOR_BY_SOURCE_ID: Readonly<Record<string, string>> = {
  ADJ05: "pr21.outcome.p01-01"
}

export const RESOLVED_DECISION_BY_SOURCE_ID: Readonly<Record<string, string>> = {
  "P05-04": "DEC01",
  "P05-07": "DEC02",
  "P09-04": "DEC02",
  "P09-05": "DEC03",
  "P09-06": "DEC04",
  Q03: "DEC05",
  "Q05-02": "DEC06",
  "Q06-01": "DEC07",
  "Q06-02": "DEC08",
  Q07: "DEC09"
}

export const SUPPLEMENTAL_SOURCE_GROUPS: ReadonlyArray<{
  readonly sourceKey: string
  readonly expectedCount: number
  readonly propositionIds: ReadonlyArray<string>
  readonly coordinateLocators: ReadonlyArray<string>
}> = [
  {
    sourceKey: "evidence.v1-reference",
    expectedCount: 3,
    propositionIds: ids("history.format.prepared-release-v2 history.format.release-evidence-v2 history.format.action-report-v2"),
    coordinateLocators: [
      "887a9fe2b35590f3088ffeee84f32722796e03ab:src/release/prepared.ts",
      "WORKTREE:advisor-plans/evidence/v1-reference-manifest.json"
    ]
  },
  {
    sourceKey: "history.plan-chain",
    expectedCount: 1,
    propositionIds: ids("history.lesson.total-and-marginal-complexity"),
    coordinateLocators: [
      "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/source-budget.json",
      ...ids(
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-173.json",
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-174.json",
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-175.json",
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-176.json",
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-177.json",
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-178.json",
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-179.json",
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-180.json",
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-181.json",
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-182.json",
        "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/reports/plan-183.json",
        "7690da13fc8c41f6fa6bb25442b60221e5a50f91:contracts/rewrite/reports/plan-184.json"
      )
    ]
  },
  {
    sourceKey: "history.plan184",
    expectedCount: 11,
    propositionIds: ids(
      "history.lesson.one-canon history.lesson.one-transition-effect-owner",
      "history.lesson.reviewed-bytes-equal-executed-bytes history.lesson.durable-uncertainty",
      "history.lesson.thin-hosts history.lesson.checked-acyclic-dag history.lesson.no-compatibility-peers",
      "history.lesson.independent-oracles history.metric.parity-107-customization",
      "history.metric.parity-33-pro history.metric.product-5871"
    ),
    coordinateLocators: [
      "86d30feba02c904e196288c3e3bd1316ee9050af:ARCHITECTURE.md",
      "86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/superiority.json"
    ]
  },
  {
    sourceKey: "history.plan184-api",
    expectedCount: 5,
    propositionIds: ids("history.api.make-release-api history.api.plan-promise history.api.review-execution-promise history.api.apply-promise history.api.dispose-promise"),
    coordinateLocators: [
      "86d30feba02c904e196288c3e3bd1316ee9050af:src/api/api.ts",
      "86d30feba02c904e196288c3e3bd1316ee9050af:src/api/types.ts"
    ]
  },
  {
    sourceKey: "history.plan184-budget",
    expectedCount: 1,
    propositionIds: ids("history.metric.product-budget-7800"),
    coordinateLocators: ["86d30feba02c904e196288c3e3bd1316ee9050af:contracts/rewrite/source-budget.json"]
  },
  {
    sourceKey: "history.plan184-format",
    expectedCount: 2,
    propositionIds: ids("history.format.release-plan-v6 history.format.run-ledger-v1"),
    coordinateLocators: [
      "86d30feba02c904e196288c3e3bd1316ee9050af:src/model/plan.ts",
      "86d30feba02c904e196288c3e3bd1316ee9050af:src/model/run.ts"
    ]
  },
  {
    sourceKey: "history.plan184-topology",
    expectedCount: 1,
    propositionIds: ids("history.topology.single-root-apps"),
    coordinateLocators: ["86d30feba02c904e196288c3e3bd1316ee9050af:package.json"]
  },
  {
    sourceKey: "research.artifact",
    expectedCount: 7,
    propositionIds: ids(
      "pr21.proposition.artifact-k3 pr21.proposition.one-way-finalization",
      "pr21.proposition.artifact-k1-release-shaped pr21.proposition.artifact-k2-content-only",
      "pr21.proposition.artifact-k4-path-canonical pr21.proposition.ambient-artifact-store",
      "pr21.proposition.h3-resolved-artifact-handle"
    ),
    coordinateLocators: ["WORKTREE:docs/refactor/research/artifact-model.md"]
  },
  {
    sourceKey: "research.artifact-storage",
    expectedCount: 5,
    propositionIds: ids(
      "pr21.proposition.effect-build-boundary pr21.proposition.apple-single-history",
      "pr21.proposition.universal-builder pr21.proposition.apple-commit-before-id-correlation",
      "pr21.proposition.artifact-kernel-package-extraction"
    ),
    coordinateLocators: ["WORKTREE:docs/refactor/research/artifact-storage.md"]
  },
  {
    sourceKey: "research.competitive-scope",
    expectedCount: 1,
    propositionIds: ids("pr21.proposition.goreleaser-heading-is-scope"),
    coordinateLocators: ["WORKTREE:docs/refactor/research/competitive-scope.md"]
  },
  {
    sourceKey: "research.decision-packet",
    expectedCount: 6,
    propositionIds: ids(
      "pr21.proposition.risk-accepted-fact pr21.proposition.replay-safety-capability",
      "pr21.proposition.final-provider-typescript-spelling pr21.proposition.shared-remote-journal-ux",
      "pr21.proposition.request-fingerprint-canonicalization pr21.proposition.receipt-observation-schema-migration"
    ),
    coordinateLocators: ["WORKTREE:docs/refactor/research/decision-packet.md"]
  },
  {
    sourceKey: "research.effect-architecture",
    expectedCount: 3,
    propositionIds: ids("pr21.proposition.provider-native-durable-values pr21.proposition.schema-and-scope-boundaries pr21.proposition.workflow-activity-kernel"),
    coordinateLocators: ["WORKTREE:docs/refactor/research/effect-architecture-patterns.md"]
  },
  {
    sourceKey: "research.effect-patterns",
    expectedCount: 5,
    propositionIds: ids(
      "pr21.proposition.effect-beta83-first-slice pr21.proposition.beta107-first-slice",
      "pr21.proposition.rc108-production-authority pr21.proposition.rc109-production-authority",
      "pr21.proposition.effect-build-compatible-effect-migration"
    ),
    coordinateLocators: ["WORKTREE:docs/refactor/research/effect-patterns.md"]
  },
  {
    sourceKey: "research.implementation-strategy",
    expectedCount: 1,
    propositionIds: ids("pr21.proposition.implementation-sequence"),
    coordinateLocators: ["WORKTREE:docs/refactor/research/implementation-strategy.md"]
  },
  {
    sourceKey: "research.index",
    expectedCount: 1,
    propositionIds: ids("pr21.proposition.effect-exit-implies-provider-commitment"),
    coordinateLocators: ["WORKTREE:docs/refactor/research/README.md"]
  },
  {
    sourceKey: "research.journal",
    expectedCount: 8,
    propositionIds: ids(
      "pr21.proposition.journal-store-law pr21.proposition.sqlite-local-default",
      "pr21.proposition.ci-artifact-journal-cas pr21.proposition.s3-required-default",
      "pr21.proposition.filesystem-portable-default pr21.proposition.git-ref-journal",
      "pr21.proposition.filesystem-generation-portability pr21.proposition.s3-journal"
    ),
    coordinateLocators: ["WORKTREE:docs/refactor/research/journal-backends.md"]
  },
  {
    sourceKey: "research.launch-scorecard",
    expectedCount: 5,
    propositionIds: ids(
      "pr21.proposition.generic-verify-phase pr21.proposition.github-tag-default-policy",
      "pr21.proposition.catalog-renderer-package-owner pr21.proposition.msix-production-credential-backend",
      "history.metric.parity-151"
    ),
    coordinateLocators: ["WORKTREE:docs/refactor/research/launch-scorecard.md"]
  },
  {
    sourceKey: "research.provider-contracts",
    expectedCount: 14,
    propositionIds: ids(
      "pr21.proposition.cas-only-auto-replay pr21.proposition.implementation-provenance-diagnostic",
      "pr21.proposition.provider-optional-operations pr21.proposition.write-only-provider",
      "pr21.proposition.provider-minimum-durable-definition pr21.proposition.consumer-scenario",
      "pr21.proposition.durable-consumer-acceptance pr21.proposition.provider-operation-id-function",
      "pr21.proposition.five-field-provider-law pr21.proposition.behavior-id-replay-gate",
      "pr21.proposition.whole-lockfile-replay-gate pr21.proposition.provider-self-asserted-replay",
      "pr21.proposition.core-provider-behavior-allowlist pr21.proposition.universal-publisher"
    ),
    coordinateLocators: ["WORKTREE:docs/refactor/research/provider-contracts.md"]
  },
  {
    sourceKey: "research.provider-runtime",
    expectedCount: 2,
    propositionIds: ids("pr21.proposition.ordinary-provider-composition pr21.proposition.global-provider-registry"),
    coordinateLocators: ["WORKTREE:docs/refactor/research/provider-extension-runtime.md"]
  },
  {
    sourceKey: "research.provider-wires",
    expectedCount: 4,
    propositionIds: ids(
      "pr21.proposition.npm-one-operation pr21.proposition.warehouse-one-operation-per-file",
      "pr21.proposition.npm-member-operation-ids pr21.proposition.generic-one-request-many-operations"
    ),
    coordinateLocators: ["WORKTREE:docs/refactor/research/provider-wire-models.md"]
  },
  {
    sourceKey: "research.replay-policy",
    expectedCount: 1,
    propositionIds: ids("pr21.proposition.application-trusted-nonstructural-law"),
    coordinateLocators: [
      "WORKTREE:docs/refactor/research/decision-packet.md",
      "WORKTREE:docs/refactor/research/resumability.md"
    ]
  },
  {
    sourceKey: "research.resumability",
    expectedCount: 10,
    propositionIds: ids(
      "pr21.proposition.canonical-durable-chain pr21.proposition.core-operation-identity",
      "pr21.proposition.strict-canonical-identity pr21.proposition.dispatch-before-send",
      "pr21.proposition.absence-is-not-fence pr21.proposition.four-replay-cases",
      "pr21.proposition.replay-vocabulary pr21.proposition.correspondence-not-law",
      "pr21.proposition.consumer-evidence-recorded-event pr21.proposition.replay-authorized-event"
    ),
    coordinateLocators: ["WORKTREE:docs/refactor/research/resumability.md"]
  }
]

export const SUPPLEMENTAL_STATE_GROUPS: ReadonlyArray<{
  readonly propositionClass: string
  readonly disposition: PropositionDisposition
  readonly status: PropositionStatus
  readonly propositionIds: ReadonlyArray<string>
}> = [
  {
    propositionClass: "research-law",
    disposition: "accept",
    status: "required",
    propositionIds: ids(
      "pr21.proposition.canonical-durable-chain pr21.proposition.core-operation-identity",
      "pr21.proposition.strict-canonical-identity pr21.proposition.dispatch-before-send",
      "pr21.proposition.risk-accepted-fact pr21.proposition.absence-is-not-fence",
      "pr21.proposition.four-replay-cases pr21.proposition.replay-vocabulary",
      "pr21.proposition.correspondence-not-law pr21.proposition.cas-only-auto-replay",
      "pr21.proposition.implementation-provenance-diagnostic pr21.proposition.provider-optional-operations",
      "pr21.proposition.write-only-provider pr21.proposition.ordinary-provider-composition",
      "pr21.proposition.provider-minimum-durable-definition pr21.proposition.provider-native-durable-values",
      "pr21.proposition.npm-one-operation pr21.proposition.warehouse-one-operation-per-file",
      "pr21.proposition.journal-store-law pr21.proposition.sqlite-local-default",
      "pr21.proposition.artifact-k3 pr21.proposition.one-way-finalization",
      "pr21.proposition.effect-build-boundary pr21.proposition.apple-single-history",
      "pr21.proposition.effect-beta83-first-slice pr21.proposition.schema-and-scope-boundaries",
      "pr21.proposition.implementation-sequence"
    )
  },
  {
    propositionClass: "rejected-candidate",
    disposition: "reject",
    status: "retired",
    propositionIds: ids(
      "pr21.proposition.five-field-provider-law pr21.proposition.behavior-id-replay-gate",
      "pr21.proposition.whole-lockfile-replay-gate pr21.proposition.provider-self-asserted-replay",
      "pr21.proposition.core-provider-behavior-allowlist pr21.proposition.universal-publisher",
      "pr21.proposition.global-provider-registry pr21.proposition.generic-one-request-many-operations",
      "pr21.proposition.universal-builder pr21.proposition.artifact-k1-release-shaped",
      "pr21.proposition.artifact-k2-content-only pr21.proposition.artifact-k4-path-canonical",
      "pr21.proposition.ambient-artifact-store pr21.proposition.ci-artifact-journal-cas",
      "pr21.proposition.s3-required-default pr21.proposition.filesystem-portable-default",
      "pr21.proposition.effect-exit-implies-provider-commitment pr21.proposition.generic-verify-phase",
      "pr21.proposition.goreleaser-heading-is-scope"
    )
  },
  {
    propositionClass: "rejected-candidate",
    disposition: "supersede",
    status: "retired",
    propositionIds: ids(
      "pr21.proposition.consumer-scenario pr21.proposition.durable-consumer-acceptance",
      "pr21.proposition.consumer-evidence-recorded-event pr21.proposition.replay-safety-capability",
      "pr21.proposition.replay-authorized-event pr21.proposition.provider-operation-id-function",
      "pr21.proposition.npm-member-operation-ids pr21.proposition.beta107-first-slice"
    )
  },
  {
    propositionClass: "rejected-candidate",
    disposition: "supersede",
    status: "comparator-only",
    propositionIds: ids("pr21.proposition.rc108-production-authority pr21.proposition.rc109-production-authority")
  },
  {
    propositionClass: "rejected-candidate",
    disposition: "reject",
    status: "deferred-later",
    propositionIds: ids("pr21.proposition.workflow-activity-kernel")
  },
  {
    propositionClass: "deferred-seam",
    disposition: "defer",
    status: "deferred-later",
    propositionIds: ids(
      "pr21.proposition.application-trusted-nonstructural-law pr21.proposition.s3-journal",
      "pr21.proposition.effect-build-compatible-effect-migration pr21.proposition.artifact-kernel-package-extraction"
    )
  },
  {
    propositionClass: "deferred-seam",
    disposition: "defer",
    status: "provisional-open",
    propositionIds: ids(
      "pr21.proposition.final-provider-typescript-spelling pr21.proposition.shared-remote-journal-ux",
      "pr21.proposition.git-ref-journal pr21.proposition.filesystem-generation-portability",
      "pr21.proposition.apple-commit-before-id-correlation pr21.proposition.request-fingerprint-canonicalization",
      "pr21.proposition.receipt-observation-schema-migration pr21.proposition.h3-resolved-artifact-handle",
      "pr21.proposition.github-tag-default-policy pr21.proposition.catalog-renderer-package-owner",
      "pr21.proposition.msix-production-credential-backend"
    )
  },
  {
    propositionClass: "historical-lesson",
    disposition: "historical-only",
    status: "comparator-only",
    propositionIds: ids(
      "history.lesson.one-canon history.lesson.one-transition-effect-owner",
      "history.lesson.reviewed-bytes-equal-executed-bytes history.lesson.durable-uncertainty",
      "history.lesson.thin-hosts history.lesson.checked-acyclic-dag history.lesson.no-compatibility-peers",
      "history.lesson.independent-oracles history.lesson.total-and-marginal-complexity"
    )
  },
  {
    propositionClass: "historical-api",
    disposition: "supersede",
    status: "retired",
    propositionIds: ids("history.api.make-release-api history.api.plan-promise history.api.review-execution-promise history.api.apply-promise history.api.dispose-promise")
  },
  {
    propositionClass: "historical-format",
    disposition: "supersede",
    status: "pending-migration-decision",
    propositionIds: ids("history.format.prepared-release-v2 history.format.release-evidence-v2 history.format.action-report-v2")
  },
  {
    propositionClass: "historical-format",
    disposition: "supersede",
    status: "comparator-only",
    propositionIds: ids("history.format.release-plan-v6 history.format.run-ledger-v1")
  },
  {
    propositionClass: "historical-topology",
    disposition: "supersede",
    status: "comparator-only",
    propositionIds: ids("history.topology.single-root-apps")
  },
  {
    propositionClass: "historical-metric",
    disposition: "supersede",
    status: "comparator-only",
    propositionIds: ids("history.metric.parity-151 history.metric.product-budget-7800")
  },
  {
    propositionClass: "historical-metric",
    disposition: "historical-only",
    status: "comparator-only",
    propositionIds: ids("history.metric.parity-107-customization history.metric.parity-33-pro history.metric.product-5871")
  }
]

export const SUPPLEMENTAL_OWNER_GROUPS: ReadonlyArray<{
  readonly ownerIds: ReadonlyArray<string>
  readonly propositionIds: ReadonlyArray<string>
}> = [
  { ownerIds: ["apple-boundary"], propositionIds: ids("pr21.proposition.apple-single-history pr21.proposition.apple-commit-before-id-correlation") },
  { ownerIds: ["application-policy"], propositionIds: ids("pr21.proposition.application-trusted-nonstructural-law") },
  { ownerIds: ["architecture-migration"], propositionIds: ids("history.format.prepared-release-v2 history.format.release-plan-v6 history.format.run-ledger-v1 history.format.release-evidence-v2 history.format.action-report-v2") },
  { ownerIds: ["architecture-program"], propositionIds: ids("pr21.proposition.implementation-sequence history.metric.product-budget-7800") },
  { ownerIds: ["artifact-contract"], propositionIds: ids("pr21.proposition.artifact-k3 pr21.proposition.one-way-finalization pr21.proposition.universal-builder pr21.proposition.artifact-k1-release-shaped pr21.proposition.artifact-k2-content-only pr21.proposition.artifact-k4-path-canonical pr21.proposition.ambient-artifact-store pr21.proposition.h3-resolved-artifact-handle pr21.proposition.artifact-kernel-package-extraction") },
  { ownerIds: ["cross-repository-boundary"], propositionIds: ids("pr21.proposition.effect-build-boundary") },
  { ownerIds: ["effect-alignment"], propositionIds: ids("pr21.proposition.effect-beta83-first-slice pr21.proposition.beta107-first-slice pr21.proposition.rc108-production-authority pr21.proposition.rc109-production-authority pr21.proposition.effect-build-compatible-effect-migration") },
  { ownerIds: ["effect-architecture"], propositionIds: ids("pr21.proposition.schema-and-scope-boundaries pr21.proposition.workflow-activity-kernel") },
  { ownerIds: ["github-provider"], propositionIds: ids("pr21.proposition.github-tag-default-policy") },
  { ownerIds: ["historical-public-api"], propositionIds: ids("history.api.make-release-api history.api.plan-promise history.api.review-execution-promise history.api.apply-promise history.api.dispose-promise") },
  { ownerIds: ["historical-rewrite"], propositionIds: ids("history.lesson.one-canon history.lesson.one-transition-effect-owner history.lesson.reviewed-bytes-equal-executed-bytes history.lesson.durable-uncertainty history.lesson.thin-hosts history.lesson.checked-acyclic-dag history.lesson.no-compatibility-peers history.lesson.independent-oracles history.lesson.total-and-marginal-complexity history.metric.parity-107-customization history.metric.parity-33-pro history.metric.product-5871") },
  { ownerIds: ["journal-contract"], propositionIds: ids("pr21.proposition.journal-store-law") },
  { ownerIds: ["journal-deployment"], propositionIds: ids("pr21.proposition.sqlite-local-default pr21.proposition.ci-artifact-journal-cas pr21.proposition.s3-required-default pr21.proposition.filesystem-portable-default pr21.proposition.shared-remote-journal-ux pr21.proposition.git-ref-journal pr21.proposition.filesystem-generation-portability pr21.proposition.s3-journal") },
  { ownerIds: ["npm-provider"], propositionIds: ids("pr21.proposition.npm-one-operation pr21.proposition.npm-member-operation-ids") },
  { ownerIds: ["package-topology"], propositionIds: ids("pr21.proposition.catalog-renderer-package-owner history.topology.single-root-apps") },
  { ownerIds: ["product-scope"], propositionIds: ids("pr21.proposition.generic-verify-phase pr21.proposition.goreleaser-heading-is-scope history.metric.parity-151") },
  { ownerIds: ["provider-contract"], propositionIds: ids("pr21.proposition.core-operation-identity pr21.proposition.replay-vocabulary pr21.proposition.correspondence-not-law pr21.proposition.cas-only-auto-replay pr21.proposition.implementation-provenance-diagnostic pr21.proposition.provider-optional-operations pr21.proposition.write-only-provider pr21.proposition.ordinary-provider-composition pr21.proposition.provider-minimum-durable-definition pr21.proposition.provider-native-durable-values pr21.proposition.consumer-scenario pr21.proposition.provider-operation-id-function pr21.proposition.five-field-provider-law pr21.proposition.behavior-id-replay-gate pr21.proposition.whole-lockfile-replay-gate pr21.proposition.provider-self-asserted-replay pr21.proposition.core-provider-behavior-allowlist pr21.proposition.universal-publisher pr21.proposition.global-provider-registry pr21.proposition.generic-one-request-many-operations pr21.proposition.final-provider-typescript-spelling pr21.proposition.request-fingerprint-canonicalization pr21.proposition.receipt-observation-schema-migration") },
  { ownerIds: ["release-machine"], propositionIds: ids("pr21.proposition.canonical-durable-chain pr21.proposition.strict-canonical-identity pr21.proposition.dispatch-before-send pr21.proposition.risk-accepted-fact pr21.proposition.absence-is-not-fence pr21.proposition.four-replay-cases pr21.proposition.durable-consumer-acceptance pr21.proposition.consumer-evidence-recorded-event pr21.proposition.replay-safety-capability pr21.proposition.replay-authorized-event pr21.proposition.effect-exit-implies-provider-commitment") },
  { ownerIds: ["warehouse-provider"], propositionIds: ids("pr21.proposition.warehouse-one-operation-per-file") },
  { ownerIds: ["windows-provider"], propositionIds: ids("pr21.proposition.msix-production-credential-backend") }
]

export const SUPPLEMENTAL_SUCCESSOR_GROUPS: ReadonlyArray<{
  readonly successorIds: ReadonlyArray<string>
  readonly propositionIds: ReadonlyArray<string>
}> = [
  { successorIds: ["C01-initial-success", "C02-rejection-before-commit", "C05-core-git-cas-protected-replay", "C06-explicit-risk-acceptance"], propositionIds: ids("pr21.proposition.four-replay-cases") },
  { successorIds: ["C04-response-loss-inconclusive-stop"], propositionIds: ids("pr21.proposition.absence-is-not-fence pr21.proposition.write-only-provider") },
  { successorIds: ["C05-core-git-cas-protected-replay"], propositionIds: ids("pr21.proposition.cas-only-auto-replay") },
  { successorIds: ["C06-explicit-risk-acceptance"], propositionIds: ids("pr21.proposition.risk-accepted-fact") },
  { successorIds: ["C08-request-endpoint-mismatch"], propositionIds: ids("pr21.proposition.implementation-provenance-diagnostic") },
  { successorIds: ["C13-apple-commit-before-id-loss", "OD07-apple-history-correlation"], propositionIds: ids("pr21.proposition.apple-commit-before-id-correlation") },
  { successorIds: ["C14-finalized-file-tree-adoption", "GT07-lossless-effect-build-file-tree-adoption"], propositionIds: ids("pr21.proposition.h3-resolved-artifact-handle") },
  { successorIds: ["L01-single-canonical-durable-chain"], propositionIds: ids("pr21.proposition.canonical-durable-chain pr21.proposition.strict-canonical-identity history.lesson.one-canon") },
  { successorIds: ["L01-single-canonical-durable-chain", "L06-provider-vertical-ownership"], propositionIds: ids("pr21.proposition.core-operation-identity") },
  { successorIds: ["L02-single-pure-transition-owner"], propositionIds: ids("pr21.proposition.replay-authorized-event") },
  { successorIds: ["L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority"], propositionIds: ids("history.lesson.one-transition-effect-owner") },
  { successorIds: ["L03-single-interpreter-cas-authority"], propositionIds: ids("pr21.proposition.replay-safety-capability") },
  { successorIds: ["L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated"], propositionIds: ids("pr21.proposition.dispatch-before-send history.lesson.reviewed-bytes-equal-executed-bytes") },
  { successorIds: ["L04-facts-decisions-effects-separated"], propositionIds: ids("pr21.proposition.replay-vocabulary pr21.proposition.effect-exit-implies-provider-commitment history.lesson.durable-uncertainty") },
  { successorIds: ["L04-facts-decisions-effects-separated", "L06-provider-vertical-ownership"], propositionIds: ids("pr21.proposition.correspondence-not-law") },
  { successorIds: ["L05-host-owned-single-journal"], propositionIds: ids("pr21.proposition.ci-artifact-journal-cas") },
  { successorIds: ["L05-host-owned-single-journal", "C07-concurrent-runners-single-cas-winner", "C10-ambiguous-append-readback"], propositionIds: ids("pr21.proposition.journal-store-law") },
  { successorIds: ["L06-provider-vertical-ownership"], propositionIds: ids("pr21.proposition.provider-optional-operations pr21.proposition.provider-minimum-durable-definition pr21.proposition.provider-native-durable-values pr21.proposition.universal-publisher pr21.proposition.generic-one-request-many-operations") },
  { successorIds: ["L07-open-provider-composition"], propositionIds: ids("pr21.proposition.ordinary-provider-composition pr21.proposition.global-provider-registry") },
  { successorIds: ["L08-host-neutral-kernel"], propositionIds: ids("history.lesson.thin-hosts") },
  { successorIds: ["L08-host-neutral-kernel", "L09-lossless-effect-build-handoff"], propositionIds: ids("pr21.proposition.schema-and-scope-boundaries") },
  { successorIds: ["L09-lossless-effect-build-handoff"], propositionIds: ids("pr21.proposition.artifact-k3 pr21.proposition.one-way-finalization pr21.proposition.effect-build-boundary pr21.proposition.ambient-artifact-store") },
  { successorIds: ["L10-apple-operation-journal-boundary"], propositionIds: ids("pr21.proposition.apple-single-history") },
  { successorIds: ["L11-hard-cut-or-one-shot-migration"], propositionIds: ids("history.lesson.no-compatibility-peers") },
  { successorIds: ["L12-generated-exact-public-surface", "L14-total-owned-traceability"], propositionIds: ids("history.lesson.independent-oracles") },
  { successorIds: ["L13-exact-acyclic-import-graph"], propositionIds: ids("history.lesson.checked-acyclic-dag") },
  { successorIds: ["L14-total-owned-traceability"], propositionIds: ids("history.lesson.total-and-marginal-complexity") },
  { successorIds: ["M1-extracted-fold", "M2-total-transition"], propositionIds: ids("pr21.proposition.request-fingerprint-canonicalization") },
  { successorIds: ["OD03-action-journal-deployment"], propositionIds: ids("pr21.proposition.shared-remote-journal-ux pr21.proposition.git-ref-journal") },
  { successorIds: ["OD04-release-readiness-journal-deployment"], propositionIds: ids("pr21.proposition.s3-journal") },
  { successorIds: ["OD09-durable-format-disposition", "freeze.MIGRATION"], propositionIds: ids("history.format.prepared-release-v2 history.format.release-evidence-v2 history.format.action-report-v2") },
  { successorIds: ["P06-journal-store-backend"], propositionIds: ids("pr21.proposition.sqlite-local-default pr21.proposition.filesystem-generation-portability") },
  { successorIds: ["T1-root"], propositionIds: ids("history.topology.single-root-apps") },
  { successorIds: ["baseline.physical-source-policy"], propositionIds: ids("history.metric.product-budget-7800") },
  { successorIds: ["baseline.plan184"], propositionIds: ids("history.metric.parity-107-customization history.metric.parity-33-pro history.metric.product-5871") },
  { successorIds: ["freeze.MIGRATION"], propositionIds: ids("pr21.proposition.receipt-observation-schema-migration") },
  { successorIds: ["freeze.SURFACE"], propositionIds: ids("pr21.proposition.final-provider-typescript-spelling history.api.make-release-api history.api.plan-promise history.api.review-execution-promise history.api.apply-promise history.api.dispose-promise") },
  { successorIds: ["freeze.SYSTEM"], propositionIds: ids("history.format.release-plan-v6 history.format.run-ledger-v1") },
  { successorIds: ["is.01-kernel", "is.02-npm", "is.03-warehouse", "is.04-git", "is.05-github", "is.06-catalog-git", "is.07-custom-provider", "is.08-artifacts", "is.09-ai-native", "is.10-action-self-release"], propositionIds: ids("pr21.proposition.implementation-sequence") },
  { successorIds: ["plan.004", "plan.008"], propositionIds: ids("pr21.proposition.effect-build-compatible-effect-migration") },
  { successorIds: ["plan.006.after-wire-complete"], propositionIds: ids("pr21.proposition.workflow-activity-kernel") },
  { successorIds: ["plan.006.effect-boundary"], propositionIds: ids("pr21.proposition.effect-beta83-first-slice") },
  { successorIds: ["post-v1.replay-policy"], propositionIds: ids("pr21.proposition.application-trusted-nonstructural-law") },
  { successorIds: ["pr21.outcome.d01-01"], propositionIds: ids("pr21.proposition.npm-one-operation") },
  { successorIds: ["pr21.outcome.d02-03"], propositionIds: ids("pr21.proposition.warehouse-one-operation-per-file") },
  { successorIds: ["pr21.outcome.d03-01"], propositionIds: ids("pr21.proposition.github-tag-default-policy") },
  { successorIds: ["pr21.outcome.d04-01"], propositionIds: ids("pr21.proposition.catalog-renderer-package-owner") },
  { successorIds: ["pr21.outcome.p09-03", "plan.009"], propositionIds: ids("pr21.proposition.msix-production-credential-backend") },
  { successorIds: ["pr21.proposition.artifact-k3"], propositionIds: ids("pr21.proposition.artifact-k1-release-shaped pr21.proposition.artifact-k2-content-only pr21.proposition.artifact-k4-path-canonical") },
  { successorIds: ["pr21.proposition.cas-only-auto-replay"], propositionIds: ids("pr21.proposition.provider-self-asserted-replay") },
  { successorIds: ["pr21.proposition.core-operation-identity"], propositionIds: ids("pr21.proposition.provider-operation-id-function") },
  { successorIds: ["pr21.proposition.effect-beta83-first-slice"], propositionIds: ids("pr21.proposition.beta107-first-slice pr21.proposition.rc108-production-authority pr21.proposition.rc109-production-authority") },
  { successorIds: ["pr21.proposition.effect-build-boundary"], propositionIds: ids("pr21.proposition.universal-builder") },
  { successorIds: ["pr21.proposition.implementation-provenance-diagnostic"], propositionIds: ids("pr21.proposition.behavior-id-replay-gate pr21.proposition.whole-lockfile-replay-gate") },
  { successorIds: ["pr21.proposition.npm-one-operation"], propositionIds: ids("pr21.proposition.npm-member-operation-ids") },
  { successorIds: ["pr21.proposition.ordinary-provider-composition"], propositionIds: ids("pr21.proposition.core-provider-behavior-allowlist") },
  { successorIds: ["pr21.proposition.provider-minimum-durable-definition"], propositionIds: ids("pr21.proposition.five-field-provider-law") },
  { successorIds: ["pr21.proposition.sqlite-local-default"], propositionIds: ids("pr21.proposition.s3-required-default pr21.proposition.filesystem-portable-default") },
  { successorIds: ["projection.consumer-evidence"], propositionIds: ids("pr21.proposition.consumer-evidence-recorded-event") },
  { successorIds: ["registry.atomic-launch-scorecard"], propositionIds: ids("pr21.proposition.goreleaser-heading-is-scope history.metric.parity-151") },
  { successorIds: ["topology.second-real-consumer"], propositionIds: ids("pr21.proposition.artifact-kernel-package-extraction") },
  { successorIds: ["witness.consumer-behavior"], propositionIds: ids("pr21.proposition.consumer-scenario pr21.proposition.durable-consumer-acceptance") },
  { successorIds: ["witness.provider-acceptance", "witness.authoritative-metadata", "witness.intended-bytes", "witness.consumer-behavior", "witness.interruption-continuation"], propositionIds: ids("pr21.proposition.generic-verify-phase") }
]

export const SCORECARD_EVIDENCE_IDS: ReadonlyArray<string> = Array.from(
  { length: 52 },
  (_, index) => `S${String(index + 1).padStart(2, "0")}`
)

export const INTERNAL_TRACEABILITY_TARGET_IDS = ids(
  "freeze.MIGRATION freeze.SURFACE freeze.SYSTEM",
  "is.01-kernel is.02-npm is.03-warehouse is.04-git is.05-github",
  "is.06-catalog-git is.07-custom-provider is.08-artifacts is.09-ai-native is.10-action-self-release",
  "plan.004 plan.006.after-wire-complete plan.006.effect-boundary plan.008 plan.009",
  "post-v1.replay-policy projection.consumer-evidence registry.atomic-launch-scorecard",
  "topology.second-real-consumer baseline.physical-source-policy baseline.plan184"
)

export const traceabilityIdForProductSource = (
  sourceId: string,
  namespace: "outcome" | "census"
): string => `pr21.${namespace}.${sourceId.toLowerCase()}`

export const coordinateLocator = (coordinate: {
  readonly gitRevision?: string
  readonly path: string
}): string => `${coordinate.gitRevision ?? "WORKTREE"}:${coordinate.path}`
