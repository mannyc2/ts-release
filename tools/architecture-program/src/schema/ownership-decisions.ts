import { Effect, Schema } from "effect"
import {
  Description,
  ExistingRepositoryPath,
  GateId,
  GitRevision,
  OwnerId,
  ProgramId,
  Sha256Hex
} from "./primitives.js"
import {
  SourceCoordinate,
  sourceCoordinateKey,
  type SourceCoordinate as SourceCoordinateType
} from "./source-coordinate.js"

const OwnershipDecisionId = Schema.NonEmptyString.check(
  Schema.isPattern(/^OD0[1-9]-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)
).pipe(Schema.brand("OwnershipDecisionId"))

const OwnershipBlockerId = Schema.NonEmptyString.check(
  Schema.isPattern(/^OB0[1-6]-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)
).pipe(Schema.brand("OwnershipBlockerId"))

const DurableFormatPartitionId = Schema.NonEmptyString.check(
  Schema.isPattern(/^DF0[1-5]-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)
).pipe(Schema.brand("DurableFormatPartitionId"))

const ExternalEvidenceId = Schema.NonEmptyString.check(
  Schema.isPattern(/^EB0[1-2]-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)
).pipe(Schema.brand("ExternalEvidenceId"))

const GitTree = Schema.NonEmptyString.check(
  Schema.isPattern(/^[0-9a-f]{40}$/u)
).pipe(Schema.brand("GitTree"))

export const REQUIRED_OWNERSHIP_DECISION_IDS = [
  "OD01-journal-law",
  "OD02-cli-journal-deployment",
  "OD03-action-journal-deployment",
  "OD04-release-readiness-journal-deployment",
  "OD05-head-segment-roles",
  "OD06-effect-build-certification-classification",
  "OD07-apple-history-correlation",
  "OD08-hashed-file-tree-adoption",
  "OD09-durable-format-disposition"
] as const

export const REQUIRED_OWNERSHIP_BLOCKER_IDS = [
  "OB01-action-default-qualification",
  "OB02-plan004-terminal-reconciliation",
  "OB03-operational-s3-worm-cas-deployment",
  "OB04-external-payload-inventory",
  "OB05-product-journal-byte-limit",
  "OB06-terminal-apple-codec-correlation"
] as const

export const REQUIRED_DURABLE_FORMAT_PARTITION_IDS = [
  "DF01-internal-version-shaped-literals",
  "DF02-prototype-core-formats",
  "DF03-external-standard-identifiers",
  "DF04-full-observed-version-shaped-set",
  "DF05-local-escaped-json-evidence"
] as const

export const REQUIRED_EXTERNAL_EVIDENCE_IDS = [
  "EB01-generated-contract",
  "EB02-generated-public-api"
] as const

const ALL_GATE_IDS = [
  "GM01-shared-case-semantics",
  "GM02-law-and-owner-invariants",
  "GM03-construction-boundaries",
  "GM04-result-provenance",
  "GM05-machine-source-budget",
  "GM06-marginal-measurement",
  "GM07-candidate-equivalence",
  "GM08-metric-and-readability-completeness",
  "GM09-offline-nonmutation",
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

const currentSource = (path: string, sha256: string) => ({
  _tag: "CurrentWholeFileSourceCoordinate" as const,
  repositoryId: "ts-release",
  path,
  sha256
})

const SOURCES = {
  plan005: currentSource(
    "advisor-plans/005-freeze-research-complete-system-contract.md",
    "f2af8b2b2a591e0e66ad18654d43a937a746b5f4dc5595e2e99cca96ab4aa965"
  ),
  journal: currentSource(
    "docs/refactor/research/journal-backends.md",
    "5ba93351a4cecb9f628e4108d6d16cbcf8939edab4378f1c73fcb04cf8ec8216"
  ),
  resumability: currentSource(
    "docs/refactor/research/resumability.md",
    "b4e58b9e3a1927aad589247e3d54a9d0624fa1106a0af99e837e33ab6c280726"
  ),
  freshRunner: currentSource(
    "docs/refactor/research/fresh-runner-resumability.md",
    "fb3400abe9441dd92aefb2786011cc4f48d14a002954a5cf54d7e48a4484bd8a"
  ),
  artifactModel: currentSource(
    "docs/refactor/research/artifact-model.md",
    "ff0056380d1484ae5cbb9eda7680955c53687a9939a9e77349926523c2990a14"
  ),
  artifactStorage: currentSource(
    "docs/refactor/research/artifact-storage.md",
    "c962c3735e155e2ea1f3e4792bde6d466acd46efc6d8e1acb5ddc3a53b227fdf"
  ),
  crossRepository: currentSource(
    "docs/refactor/research/cross-repository-delivery.md",
    "b5d767fb1f67f00cc716da50a16258cb2056280d3e0f777a933809734abb7c0a"
  ),
  plan004: currentSource(
    "advisor-plans/004-establish-effect-build-release-readiness.md",
    "ad84b8b021fec89fcc24aa6d285ebb0e3d39629b7aaa88f806a4f9940af16ef7"
  ),
  lineage: currentSource(
    "advisor-plans/evidence/lineage-reconciliation.md",
    "e588f701fc80674d79bbd59470faa689ac6c92cab8a8cddc06d639a0e4815c99"
  ),
  v1Manifest: currentSource(
    "advisor-plans/evidence/v1-reference-manifest.json",
    "87e7271f668c4ba821b7935b0082d9b9b7987f6ee29a9a5639557983aa4941ea"
  )
} as const

const DecisionStatus = Schema.Literals([
  "selected",
  "blocked",
  "architecture-selected-qualification-blocked",
  "ownership-selected-field-classification-blocked",
  "selected-with-stop-inconclusive",
  "conceptual-selected-exact-packed-contract-blocked",
  "policy-selected-external-inventory-blocked"
])

export class OwnershipDecision extends Schema.Class<OwnershipDecision>("OwnershipDecision")({
  id: OwnershipDecisionId,
  title: Description,
  status: DecisionStatus,
  ownerId: OwnerId,
  decision: Description,
  requiredEvidence: Schema.Array(Description),
  externalEvidenceIds: Schema.Array(ExternalEvidenceId),
  blockerIds: Schema.Array(OwnershipBlockerId),
  dependentGateIds: Schema.Array(GateId),
  sourceCoordinates: Schema.NonEmptyArray(SourceCoordinate)
}) {}

export class ExternalEvidence extends Schema.Class<ExternalEvidence>("ExternalEvidence")({
  id: ExternalEvidenceId,
  repositoryId: Schema.Literal("effect-build"),
  gitRevision: GitRevision,
  gitTree: GitTree,
  artifactPath: ExistingRepositoryPath,
  artifactSha256: Sha256Hex,
  evidenceKind: Schema.Literals(["generated-contract", "generated-public-api"]),
  verification: Schema.Literal("git-object-content-sha256")
}) {}

export class OwnershipBlocker extends Schema.Class<OwnershipBlocker>("OwnershipBlocker")({
  id: OwnershipBlockerId,
  title: Description,
  status: Schema.Literal("open"),
  blocksFinalFreeze: Schema.Literal(true),
  requiredEvidence: Schema.NonEmptyArray(Description),
  dependentGateIds: Schema.NonEmptyArray(GateId),
  sourceCoordinates: Schema.NonEmptyArray(SourceCoordinate)
}) {}

export class DurableFormatPartition extends Schema.Class<DurableFormatPartition>(
  "DurableFormatPartition"
)({
  id: DurableFormatPartitionId,
  memberCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  setSha256: Sha256Hex,
  hashBasis: Schema.Literal("jq-1.7-sort-keys-compact-json-array-lf"),
  disposition: Schema.Literals([
    "hard-cut",
    "external-standards-not-prototype-compatibility",
    "inventory-only",
    "not-pr22-or-overlay-payload"
  ]),
  sourceCoordinate: SourceCoordinate
}) {}

export class UnresolvedExternalCopyInventory extends Schema.TaggedClass<UnresolvedExternalCopyInventory>()(
  "UnresolvedExternalCopyInventory",
  {
    status: Schema.Literal("blocked"),
    finding: Schema.Literal("unresolved-external"),
    localPr22OrOverlayPayload: Schema.Literal("none-proven"),
    externalCopies: Schema.Literal("unresolved-without-operator-inventory"),
    compatibilityPolicy: Schema.Literal(
      "no prototype reader or fallback; a discovered escaped coordinate requires an explicit one-shot migration row before certification"
    ),
    blockerId: Schema.Literal("OB04-external-payload-inventory"),
    sourceCoordinates: Schema.NonEmptyArray(SourceCoordinate)
  }
) {}

export class UnresolvedProductJournalByteLimit extends Schema.TaggedClass<UnresolvedProductJournalByteLimit>()(
  "UnresolvedProductJournalByteLimit",
  {
    status: Schema.Literal("blocked"),
    hasProductAuthority: Schema.Literal(false),
    trialFixtureLimitIsProductAuthority: Schema.Literal(false),
    numericLimitRecorded: Schema.Literal(false),
    blockerId: Schema.Literal("OB05-product-journal-byte-limit"),
    sourceCoordinates: Schema.NonEmptyArray(SourceCoordinate)
  }
) {}

export class OwnershipDecisionsV1 extends Schema.Class<OwnershipDecisionsV1>("OwnershipDecisionsV1")({
  schemaVersion: Schema.Literal("ts-release/ownership-decisions/v1"),
  programId: ProgramId,
  decisions: Schema.Array(OwnershipDecision),
  externalEvidence: Schema.Array(ExternalEvidence),
  blockers: Schema.Array(OwnershipBlocker),
  freezeBlockerIds: Schema.Array(OwnershipBlockerId),
  hardCutPartitions: Schema.Array(DurableFormatPartition),
  externalCopyInventory: UnresolvedExternalCopyInventory,
  productJournalByteLimit: UnresolvedProductJournalByteLimit
}) {}

const REQUIRED_DECISIONS = [
  {
    id: "OD01-journal-law",
    title: "Single logical journal law",
    status: "selected",
    ownerId: "ts-release",
    decision: "JournalStore.appendIfRevision is the sole storage law: at most one writer advances a revision, readers observe only complete events, committed success is durable and read-back visible, only Appended grants dispatch authority, and ambiguous storage outcomes reconcile before send. Each release has one host-selected store and one logical history; alternative backends never form peer histories.",
    requiredEvidence: [],
    externalEvidenceIds: [],
    blockerIds: [],
    dependentGateIds: [
      "GM01-shared-case-semantics",
      "GM02-law-and-owner-invariants",
      "GM03-construction-boundaries",
      "GM07-candidate-equivalence",
      "GT01-shared-fixture-machine-and-cases",
      "GT16-offline-nonmutation"
    ],
    sourceCoordinates: [SOURCES.plan005, SOURCES.journal, SOURCES.resumability, SOURCES.freshRunner]
  },
  {
    id: "OD02-cli-journal-deployment",
    title: "CLI journal deployment",
    status: "selected",
    ownerId: "ts-release",
    decision: "The first-party Bun CLI default is local SQLite at an explicit state path. One immediate transaction checks the expected revision and appends the complete event; only committed read-back success is Appended. This is not a cross-host or arbitrary network-filesystem guarantee.",
    requiredEvidence: [],
    externalEvidenceIds: [],
    blockerIds: [],
    dependentGateIds: ["GT04-packed-cli", "GT15-all-nine-marginal-probes", "GT16-offline-nonmutation"],
    sourceCoordinates: [SOURCES.journal, SOURCES.resumability]
  },
  {
    id: "OD03-action-journal-deployment",
    title: "GitHub Action journal deployment",
    status: "blocked",
    ownerId: "ts-release",
    decision: "The GitHub Action default remains unselected. A dedicated or orphan Git ref is the leading repository-native candidate, but S3 is not a general default and CI artifacts are transport rather than journal CAS. No candidate may create a peer history beside the release's host-selected journal.",
    requiredEvidence: [
      "Hosted two-runner CAS race against the exact Action deployment.",
      "Same-target no-op behavior distinguishes the successful CAS writer.",
      "Contents permissions, fork behavior, ref policy, privacy, and retention are qualified.",
      "Lost update responses are reconciled by authoritative read-back.",
      "Read and write enforce one symmetric product-authorized byte bound."
    ],
    externalEvidenceIds: [],
    blockerIds: ["OB01-action-default-qualification", "OB05-product-journal-byte-limit"],
    dependentGateIds: ["GT05-packed-github-action"],
    sourceCoordinates: [SOURCES.plan005, SOURCES.journal, SOURCES.lineage, SOURCES.v1Manifest]
  },
  {
    id: "OD04-release-readiness-journal-deployment",
    title: "Release-readiness journal deployment",
    status: "architecture-selected-qualification-blocked",
    ownerId: "ts-release",
    decision: "The release-readiness host uses one primary OIDC-scoped S3 namespace with immutable versioned WORM event segments and a conditionally updated CAS head. It has no workspace-local, artifact-only, Git-ref, or provider-specific fallback history. Qualification remains blocked until terminal Plan 004 reconciliation and an operational least-privilege response-loss-tested deployment exist.",
    requiredEvidence: [
      "Terminal Plan 004 coordinate is reconciled against the selected ts-release boundary.",
      "One least-privilege OIDC S3 namespace is operationally deployed.",
      "WORM retention and exact CAS response-loss branches pass protected tests."
    ],
    externalEvidenceIds: ["EB01-generated-contract", "EB02-generated-public-api"],
    blockerIds: ["OB02-plan004-terminal-reconciliation", "OB03-operational-s3-worm-cas-deployment"],
    dependentGateIds: [
      "GT07-lossless-effect-build-file-tree-adoption",
      "GT13-dry-run-build-publication-self-release",
      "GT16-offline-nonmutation"
    ],
    sourceCoordinates: [SOURCES.plan004, SOURCES.plan005, SOURCES.journal]
  },
  {
    id: "OD05-head-segment-roles",
    title: "CAS head and immutable segment roles",
    status: "selected",
    ownerId: "ts-release",
    decision: "Complete journal events are immutable or WORM segments. The small head is the sole mutable coordinate and advances only by expected-revision CAS. An uploaded but unreferenced segment is not history; ambiguous head updates require read-back before any dispatch decision. A segment store is never a second journal.",
    requiredEvidence: [],
    externalEvidenceIds: [],
    blockerIds: [],
    dependentGateIds: [
      "GM01-shared-case-semantics",
      "GM02-law-and-owner-invariants",
      "GM03-construction-boundaries",
      "GT05-packed-github-action",
      "GT16-offline-nonmutation"
    ],
    sourceCoordinates: [SOURCES.journal, SOURCES.freshRunner, SOURCES.plan004]
  },
  {
    id: "OD06-effect-build-certification-classification",
    title: "Effect-build certification classification",
    status: "ownership-selected-field-classification-blocked",
    ownerId: "architecture-program",
    decision: "Generated effect-build requirements, policy projections, deterministic build results, and certification summaries are derived evidence, not peer release facts. Provider-native facts created by external mutation, including Apple submission identity and status, are journaled once by ts-release. Exact terminal Plan 004 field-by-field classification remains required.",
    requiredEvidence: [
      "Terminal Plan 004 contract fields are classified as derived evidence or provider-native external facts without a third category."
    ],
    externalEvidenceIds: ["EB01-generated-contract"],
    blockerIds: ["OB02-plan004-terminal-reconciliation"],
    dependentGateIds: [
      "GM04-result-provenance",
      "GT07-lossless-effect-build-file-tree-adoption",
      "GT13-dry-run-build-publication-self-release"
    ],
    sourceCoordinates: [SOURCES.plan004, SOURCES.plan005, SOURCES.artifactStorage, SOURCES.crossRepository]
  },
  {
    id: "OD07-apple-history-correlation",
    title: "Apple history and correlation",
    status: "selected-with-stop-inconclusive",
    ownerId: "ts-release",
    decision: "effect-build-apple owns concrete submit, info, staple, and validation operations plus Apple submission identity, correlation checks, and outcome derivation. Its SubmissionReference family is Schema.Class-backed, but NotarizationTicket has no durable codec and submit exposes no idempotency or correlation key. ts-release owns the sole release journal, records the exact pre-dispatch artifact and request fingerprint plus provider-native submission and status facts, and decides continuation. If Apple may have committed before the submission ID was recorded and no authoritative correlation proves the result, continuation stops Inconclusive and never blindly resubmits.",
    requiredEvidence: [
      "Terminal package-private Apple codec and correlation contract is reconciled.",
      "Commit-before-ID response loss proves authoritative correlation or the exact Inconclusive stop."
    ],
    externalEvidenceIds: ["EB01-generated-contract", "EB02-generated-public-api"],
    blockerIds: ["OB02-plan004-terminal-reconciliation", "OB06-terminal-apple-codec-correlation"],
    dependentGateIds: [
      "GM01-shared-case-semantics",
      "GM03-construction-boundaries",
      "GM07-candidate-equivalence",
      "GT07-lossless-effect-build-file-tree-adoption"
    ],
    sourceCoordinates: [SOURCES.plan004, SOURCES.plan005, SOURCES.artifactStorage, SOURCES.crossRepository]
  },
  {
    id: "OD08-hashed-file-tree-adoption",
    title: "HashedFile and HashedTree adoption",
    status: "conceptual-selected-exact-packed-contract-blocked",
    ownerId: "architecture-program",
    decision: "The producer protocol is effect-build/artifact-adoption@1. HashedFile source values carry an absolute producer path, canonical decimal bytes, structured digest, provenance, and publication; HashedTree source values carry root, mode, ordered case-fold-unique entries, totalBytes, and manifestDigest. ts-release does not persist or copy producer paths: adoptFile returns path-free protocol, kind, logicalName, bytes, and digest, while adoptTree returns path-free protocol, kind, logicalName, totalBytes, and manifestDigest. Because the exported Hashed schemas are permissive Schema.declare boundaries and the adoption records have no exported strict codec, ts-release owns a strict versioned durable adoption envelope and reverifies content. It preserves entry modes, symlinks, and shared content identity and rejects duplicate logical names, unsafe traversal, narrowing, mutable-path identity, and aliased mutable bytes. The exact packed contract remains blocked on terminal Plan 004 reconciliation.",
    requiredEvidence: [
      "Exact effect-build/artifact-adoption@1 HashedFile, HashedTree, adoptFile, and adoptTree fields and hashes are reconciled from terminal Plan 004.",
      "A packed clean consumer proves file, tree, shared-content, mode, symlink, duplicate-name, traversal, and mutation cases."
    ],
    externalEvidenceIds: ["EB01-generated-contract", "EB02-generated-public-api"],
    blockerIds: ["OB02-plan004-terminal-reconciliation"],
    dependentGateIds: ["GM03-construction-boundaries", "GT07-lossless-effect-build-file-tree-adoption"],
    sourceCoordinates: [
      SOURCES.plan004,
      SOURCES.plan005,
      SOURCES.artifactModel,
      SOURCES.artifactStorage,
      SOURCES.crossRepository
    ]
  },
  {
    id: "OD09-durable-format-disposition",
    title: "Prototype durable-format disposition",
    status: "policy-selected-external-inventory-blocked",
    ownerId: "architecture-program",
    decision: "All 98 internal PR22 or overlay version-shaped literals, including the four prototype-core formats, are hard-cut prototype evidence and receive no default reader, writer, or fallback. The three external standard identifiers are standards, not prototype compatibility obligations. No local PR22 or overlay durable payload is proven. A discovered external copy requires one explicit one-shot migration row before certification; dual live readers or writers remain forbidden.",
    requiredEvidence: [
      "An operator inventory resolves whether any PR22 or overlay durable payload escaped to external storage."
    ],
    externalEvidenceIds: [],
    blockerIds: ["OB04-external-payload-inventory"],
    dependentGateIds: [
      "GM02-law-and-owner-invariants",
      "GM04-result-provenance",
      "GM07-candidate-equivalence",
      "GT12-version-skew-partial-publication",
      "GT15-all-nine-marginal-probes"
    ],
    sourceCoordinates: [SOURCES.plan005, SOURCES.lineage, SOURCES.v1Manifest]
  }
] as const

const REQUIRED_EXTERNAL_EVIDENCE = [
  {
    id: "EB01-generated-contract",
    repositoryId: "effect-build",
    gitRevision: "dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc",
    gitTree: "29cdac9bf9621aa3df12757e2720c093b17d742e",
    artifactPath: "tooling/effect-build-contract.json",
    artifactSha256: "6c9422466d7e449d8d4ce7cd0fdf38cb869456993bd00bbe7eb9b685cdc11d53",
    evidenceKind: "generated-contract",
    verification: "git-object-content-sha256"
  },
  {
    id: "EB02-generated-public-api",
    repositoryId: "effect-build",
    gitRevision: "dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc",
    gitTree: "29cdac9bf9621aa3df12757e2720c093b17d742e",
    artifactPath: "tooling/public-api.json",
    artifactSha256: "6bbbdcb00e75cd1f104aa658f4ddfe781719016a7568c7a59006ff435f52fac3",
    evidenceKind: "generated-public-api",
    verification: "git-object-content-sha256"
  }
] as const

const REQUIRED_BLOCKERS = [
  {
    id: "OB01-action-default-qualification",
    title: "Action journal default qualification",
    status: "open",
    blocksFinalFreeze: true,
    requiredEvidence: [
      "Select one Action default only after hosted two-runner, same-target no-op, permission, fork, ref-policy, privacy, retention, and response-loss evidence is exact."
    ],
    dependentGateIds: ["GT05-packed-github-action"],
    sourceCoordinates: [SOURCES.journal, SOURCES.plan005]
  },
  {
    id: "OB02-plan004-terminal-reconciliation",
    title: "Terminal Plan 004 reconciliation",
    status: "open",
    blocksFinalFreeze: true,
    requiredEvidence: [
      "Bind and reconcile the terminal Plan 004 coordinate, including exact-head, credentialed Apple, and cold-host receipts; merged PR24 and an in-progress advisor plan are not terminal boundary evidence."
    ],
    dependentGateIds: [
      "GM04-result-provenance",
      "GT07-lossless-effect-build-file-tree-adoption",
      "GT13-dry-run-build-publication-self-release"
    ],
    sourceCoordinates: [SOURCES.plan004, SOURCES.plan005]
  },
  {
    id: "OB03-operational-s3-worm-cas-deployment",
    title: "Operational S3 WORM and CAS deployment",
    status: "open",
    blocksFinalFreeze: true,
    requiredEvidence: [
      "Deploy the single least-privilege OIDC-scoped namespace and pass WORM retention, CAS race, response-loss read-back, and no-fallback tests."
    ],
    dependentGateIds: [
      "GT07-lossless-effect-build-file-tree-adoption",
      "GT13-dry-run-build-publication-self-release"
    ],
    sourceCoordinates: [SOURCES.plan004, SOURCES.journal]
  },
  {
    id: "OB04-external-payload-inventory",
    title: "External prototype-payload inventory",
    status: "open",
    blocksFinalFreeze: true,
    requiredEvidence: [
      "An operator-authoritative inventory resolves external copies and adds a hash-bound one-shot migration row for each discovered coordinate."
    ],
    dependentGateIds: [
      "GM02-law-and-owner-invariants",
      "GM04-result-provenance",
      "GT12-version-skew-partial-publication",
      "GT15-all-nine-marginal-probes"
    ],
    sourceCoordinates: [SOURCES.lineage, SOURCES.v1Manifest]
  },
  {
    id: "OB05-product-journal-byte-limit",
    title: "Product-authorized journal byte limit",
    status: "open",
    blocksFinalFreeze: true,
    requiredEvidence: [
      "Select one product-authorized journal byte limit and prove identical rejection behavior on every read and write path; the 64-byte C16 fixture is not product authority."
    ],
    dependentGateIds: ["GM03-construction-boundaries", "GT05-packed-github-action"],
    sourceCoordinates: [SOURCES.plan005, SOURCES.lineage, SOURCES.v1Manifest]
  },
  {
    id: "OB06-terminal-apple-codec-correlation",
    title: "Terminal Apple codec and correlation",
    status: "open",
    blocksFinalFreeze: true,
    requiredEvidence: [
      "Reconcile the terminal package-private Apple codec and prove authoritative commit-before-ID correlation or the exact Inconclusive no-resubmit stop."
    ],
    dependentGateIds: [
      "GM01-shared-case-semantics",
      "GM03-construction-boundaries",
      "GM07-candidate-equivalence",
      "GT07-lossless-effect-build-file-tree-adoption"
    ],
    sourceCoordinates: [SOURCES.plan004, SOURCES.artifactStorage, SOURCES.crossRepository]
  }
] as const

const REQUIRED_PARTITIONS = [
  {
    id: "DF01-internal-version-shaped-literals",
    memberCount: 98,
    setSha256: "35cfacf74de5b7f80d8b8fad64f3beb6a98c22cad19b00c042868de866b24ab3",
    hashBasis: "jq-1.7-sort-keys-compact-json-array-lf",
    disposition: "hard-cut",
    sourceCoordinate: SOURCES.v1Manifest
  },
  {
    id: "DF02-prototype-core-formats",
    memberCount: 4,
    setSha256: "1480e530f5c4e69a87360dc3e52354fde89119e4ac7f94433ab4cc793f23cf59",
    hashBasis: "jq-1.7-sort-keys-compact-json-array-lf",
    disposition: "hard-cut",
    sourceCoordinate: SOURCES.v1Manifest
  },
  {
    id: "DF03-external-standard-identifiers",
    memberCount: 3,
    setSha256: "02df4d864071e62df57ac3a4c88fab2a2c2ed02c9213e34a56b13233840ed34b",
    hashBasis: "jq-1.7-sort-keys-compact-json-array-lf",
    disposition: "external-standards-not-prototype-compatibility",
    sourceCoordinate: SOURCES.v1Manifest
  },
  {
    id: "DF04-full-observed-version-shaped-set",
    memberCount: 101,
    setSha256: "560146dcd1196e3e3b233ccdeaed5830b70c6eea29bb83920d63621e4fd34b18",
    hashBasis: "jq-1.7-sort-keys-compact-json-array-lf",
    disposition: "inventory-only",
    sourceCoordinate: SOURCES.v1Manifest
  },
  {
    id: "DF05-local-escaped-json-evidence",
    memberCount: 4,
    setSha256: "518da4b0209f88e37ab9b2d5838f7019c63d93f3e8f3eb50476d59ea31a55782",
    hashBasis: "jq-1.7-sort-keys-compact-json-array-lf",
    disposition: "not-pr22-or-overlay-payload",
    sourceCoordinate: SOURCES.v1Manifest
  }
] as const

const REQUIRED_EXTERNAL_COPY_INVENTORY = {
  _tag: "UnresolvedExternalCopyInventory",
  status: "blocked",
  finding: "unresolved-external",
  localPr22OrOverlayPayload: "none-proven",
  externalCopies: "unresolved-without-operator-inventory",
  compatibilityPolicy: "no prototype reader or fallback; a discovered escaped coordinate requires an explicit one-shot migration row before certification",
  blockerId: "OB04-external-payload-inventory",
  sourceCoordinates: [SOURCES.lineage, SOURCES.v1Manifest]
} as const

const REQUIRED_PRODUCT_JOURNAL_BYTE_LIMIT = {
  _tag: "UnresolvedProductJournalByteLimit",
  status: "blocked",
  hasProductAuthority: false,
  trialFixtureLimitIsProductAuthority: false,
  numericLimitRecorded: false,
  blockerId: "OB05-product-journal-byte-limit",
  sourceCoordinates: [SOURCES.plan005, SOURCES.lineage, SOURCES.v1Manifest]
} as const

export const ownershipDecisionsReferenceDocument = {
  schemaVersion: "ts-release/ownership-decisions/v1",
  programId: "ts-release-architecture-program",
  decisions: REQUIRED_DECISIONS,
  externalEvidence: REQUIRED_EXTERNAL_EVIDENCE,
  blockers: REQUIRED_BLOCKERS,
  freezeBlockerIds: REQUIRED_OWNERSHIP_BLOCKER_IDS,
  hardCutPartitions: REQUIRED_PARTITIONS,
  externalCopyInventory: REQUIRED_EXTERNAL_COPY_INVENTORY,
  productJournalByteLimit: REQUIRED_PRODUCT_JOURNAL_BYTE_LIMIT
} as const

const comparable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(comparable)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, item]) => [key, comparable(item)])
    )
  }
  return value
}

const sameRecord = (actual: unknown, expected: unknown): boolean =>
  JSON.stringify(comparable(actual)) === JSON.stringify(comparable(expected))

const exactOrderedIds = (
  label: string,
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
  issues: Array<string>
): void => {
  const duplicateIds = actual.filter((id, index) => actual.indexOf(id) !== index)
  if (duplicateIds.length > 0) {
    issues.push(`${label} contains duplicate ids: ${[...new Set(duplicateIds)].join(", ")}`)
  }
  if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
    issues.push(`${label} must equal the required ordered set [${expected.join(", ")}]`)
  }
}

const checkReferences = (
  label: string,
  references: ReadonlyArray<string>,
  available: ReadonlySet<string>,
  issues: Array<string>
): void => {
  const duplicates = references.filter((id, index) => references.indexOf(id) !== index)
  if (duplicates.length > 0) {
    issues.push(`${label} contains duplicate references: ${[...new Set(duplicates)].join(", ")}`)
  }
  for (const reference of references) {
    if (!available.has(reference)) issues.push(`${label} has dangling reference ${reference}`)
  }
}

const checkSourceCoordinates = (
  label: string,
  coordinates: ReadonlyArray<SourceCoordinateType>,
  issues: Array<string>
): void => {
  const keys = coordinates.map(sourceCoordinateKey)
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index)
  if (duplicates.length > 0) issues.push(`${label} contains duplicate source coordinates`)
  for (const coordinate of coordinates) {
    if ("startLine" in coordinate && coordinate.startLine > coordinate.endLine) {
      issues.push(`${label} contains an inverted source line range`)
    }
  }
}

export const ownershipDecisionInvariantIssues = (
  document: OwnershipDecisionsV1
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  if (document.programId !== "ts-release-architecture-program") {
    issues.push("programId must remain ts-release-architecture-program")
  }

  const decisionIds = document.decisions.map(({ id }) => id)
  const externalEvidenceIds = document.externalEvidence.map(({ id }) => id)
  const blockerIds = document.blockers.map(({ id }) => id)
  const partitionIds = document.hardCutPartitions.map(({ id }) => id)
  exactOrderedIds("decisions", decisionIds, REQUIRED_OWNERSHIP_DECISION_IDS, issues)
  exactOrderedIds("externalEvidence", externalEvidenceIds, REQUIRED_EXTERNAL_EVIDENCE_IDS, issues)
  exactOrderedIds("blockers", blockerIds, REQUIRED_OWNERSHIP_BLOCKER_IDS, issues)
  exactOrderedIds("freezeBlockerIds", document.freezeBlockerIds, REQUIRED_OWNERSHIP_BLOCKER_IDS, issues)
  exactOrderedIds("hardCutPartitions", partitionIds, REQUIRED_DURABLE_FORMAT_PARTITION_IDS, issues)

  const blockerSet = new Set<string>(blockerIds)
  const externalEvidenceSet = new Set<string>(externalEvidenceIds)
  const gateSet = new Set<string>(ALL_GATE_IDS)
  for (const [index, decision] of document.decisions.entries()) {
    checkReferences(`decision ${decision.id} blockerIds`, decision.blockerIds, blockerSet, issues)
    checkReferences(
      `decision ${decision.id} externalEvidenceIds`,
      decision.externalEvidenceIds,
      externalEvidenceSet,
      issues
    )
    checkReferences(`decision ${decision.id} dependentGateIds`, decision.dependentGateIds, gateSet, issues)
    checkSourceCoordinates(`decision ${decision.id}`, decision.sourceCoordinates, issues)
    if (decision.status === "selected" && decision.blockerIds.length > 0) {
      issues.push(`selected decision ${decision.id} must not retain blockers`)
    }
    if (decision.status !== "selected" && decision.blockerIds.length === 0) {
      issues.push(`qualified or blocked decision ${decision.id} must name a blocker`)
    }
    const expected = REQUIRED_DECISIONS[index]
    if (expected === undefined || !sameRecord(decision, expected)) {
      issues.push(`decision ${decision.id} changed its predeclared ownership, status, evidence, gates, or provenance`)
    }
  }

  for (const [index, evidence] of document.externalEvidence.entries()) {
    const expected = REQUIRED_EXTERNAL_EVIDENCE[index]
    if (expected === undefined || !sameRecord(evidence, expected)) {
      issues.push(`external evidence ${evidence.id} changed its commit, tree, path, hash, or classification`)
    }
  }

  for (const [index, blocker] of document.blockers.entries()) {
    checkReferences(`blocker ${blocker.id} dependentGateIds`, blocker.dependentGateIds, gateSet, issues)
    checkSourceCoordinates(`blocker ${blocker.id}`, blocker.sourceCoordinates, issues)
    const expected = REQUIRED_BLOCKERS[index]
    if (expected === undefined || !sameRecord(blocker, expected)) {
      issues.push(`blocker ${blocker.id} changed its required evidence, gates, or provenance`)
    }
  }

  for (const [index, partition] of document.hardCutPartitions.entries()) {
    const expected = REQUIRED_PARTITIONS[index]
    if (expected === undefined || !sameRecord(partition, expected)) {
      issues.push(`durable format partition ${partition.id} changed its count, hash, disposition, or provenance`)
    }
  }

  if (!sameRecord(document.externalCopyInventory, REQUIRED_EXTERNAL_COPY_INVENTORY)) {
    issues.push("external copy inventory must remain blocked without operator-authoritative evidence")
  }
  if (!sameRecord(document.productJournalByteLimit, REQUIRED_PRODUCT_JOURNAL_BYTE_LIMIT)) {
    issues.push("product journal byte limit must remain unresolved and non-authoritative")
  }
  checkSourceCoordinates("externalCopyInventory", document.externalCopyInventory.sourceCoordinates, issues)
  checkSourceCoordinates("productJournalByteLimit", document.productJournalByteLimit.sourceCoordinates, issues)

  return issues
}

export class OwnershipDecisionsInvariantError extends Schema.TaggedError<OwnershipDecisionsInvariantError>()(
  "OwnershipDecisionsInvariantError",
  {
    issues: Schema.NonEmptyArray(Schema.String),
    message: Schema.String
  }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Ownership decision invariant failure: ${issues.join("; ")}`
    })
  }
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeOwnershipDocument = Schema.decodeUnknownEffect(OwnershipDecisionsV1, strictOptions)

export const decodeOwnershipDecisions = Effect.fn("OwnershipDecisionsV1.decode")(
  function* (input: unknown) {
    const document = yield* decodeOwnershipDocument(input)
    const issues = ownershipDecisionInvariantIssues(document)
    if (issues.length > 0) {
      yield* new OwnershipDecisionsInvariantError(issues as [string, ...Array<string>])
    }
    return document
  }
)

const encodeOwnershipDocument = Schema.encodeUnknownSync(OwnershipDecisionsV1, strictOptions)

export const encodeOwnershipDecisions = (document: OwnershipDecisionsV1): unknown => {
  const issues = ownershipDecisionInvariantIssues(document)
  if (issues.length > 0) {
    throw new OwnershipDecisionsInvariantError(issues as [string, ...Array<string>])
  }
  return encodeOwnershipDocument(document)
}
