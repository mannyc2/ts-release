import type { SourceCoordinate } from "./schema/source-coordinate.js"

type PropositionClass =
  | "product-outcome"
  | "maintained-destination"
  | "later-outcome"
  | "census-disposition"
  | "research-law"
  | "rejected-candidate"
  | "deferred-seam"
  | "historical-lesson"
  | "historical-api"
  | "historical-format"
  | "historical-topology"
  | "historical-metric"

type PropositionDisposition = "accept" | "reject" | "supersede" | "defer" | "adjacent" | "historical-only"
type PropositionStatus =
  | "required"
  | "rewrite-missing"
  | "integration-pending"
  | "deferred-later"
  | "provisional-open"
  | "retired"
  | "pending-migration-decision"
  | "comparator-only"

type Proposition = {
  readonly id: string
  readonly sourceRecordId: string | null
  readonly sourceCoordinates: ReadonlyArray<SourceCoordinate>
  readonly proposition: string
  readonly class: PropositionClass
  readonly disposition: PropositionDisposition
  readonly ownerIds: ReadonlyArray<string>
  readonly sourceOwnerCode: string | null
  readonly requiredWitnessKinds: ReadonlyArray<string>
  readonly witnessArtifactIds: ReadonlyArray<string>
  readonly evidenceIds: ReadonlyArray<string>
  readonly currentStatus: PropositionStatus
  readonly successorIds: ReadonlyArray<string>
  readonly productAuthority: boolean
  readonly decisionId: string | null
}

type CurrentSource = {
  readonly path: string
  readonly sha256: string
}

type GitSource = CurrentSource & {
  readonly gitRevision: string
}

const currentSources = {
  scorecard: { path: "docs/refactor/research/launch-scorecard.md", sha256: "ea77afd876f2ce4b309d42ff9d0dab1cd5a9f702b0fb9ec9786f49ae3c7e7636" },
  decision: { path: "docs/refactor/research/decision-packet.md", sha256: "3126a9766e421cf764fa51865d3263fd0962e857ab2643d6dc487b6ef33d14f4" },
  resumability: { path: "docs/refactor/research/resumability.md", sha256: "b4e58b9e3a1927aad589247e3d54a9d0624fa1106a0af99e837e33ab6c280726" },
  providers: { path: "docs/refactor/research/provider-contracts.md", sha256: "66a450630affa48b0218aa5fcae2d0e940c20513484d31d51f07a5b8f88502e9" },
  providerRuntime: { path: "docs/refactor/research/provider-extension-runtime.md", sha256: "bd3a1f8320719291df7746a706e7cedf452ff37a33684d4c5741288f7244fa0e" },
  effectArchitecture: { path: "docs/refactor/research/effect-architecture-patterns.md", sha256: "713d6576aeaa3326d652b998819904ecfdd7f5efebfcb3cfbb1d3f368463b9b8" },
  providerWires: { path: "docs/refactor/research/provider-wire-models.md", sha256: "3644a5b47817604d4b4689300664ba8eaa754efeea549f38bd5ba7f88caf69d1" },
  journal: { path: "docs/refactor/research/journal-backends.md", sha256: "5ba93351a4cecb9f628e4108d6d16cbcf8939edab4378f1c73fcb04cf8ec8216" },
  artifact: { path: "docs/refactor/research/artifact-model.md", sha256: "ff0056380d1484ae5cbb9eda7680955c53687a9939a9e77349926523c2990a14" },
  storage: { path: "docs/refactor/research/artifact-storage.md", sha256: "c962c3735e155e2ea1f3e4792bde6d466acd46efc6d8e1acb5ddc3a53b227fdf" },
  effect: { path: "docs/refactor/research/effect-patterns.md", sha256: "a1b11f7e65ad96518e204d868b0ed5ab185675ca953626845afb1a46c5e5b915" },
  strategy: { path: "docs/refactor/research/implementation-strategy.md", sha256: "ba9e359e935f8bf9319a1ce86f12c5f435fb6992d0b2db97aa7e2b165bcafe84" },
  competitive: { path: "docs/refactor/research/competitive-scope.md", sha256: "eeef07c49a90eab683bd58f164be41ec9cf5d951a3eb940fc118911c2d221cc0" },
  researchIndex: { path: "docs/refactor/research/README.md", sha256: "d6ae55b4cbccef141451145f022b0d9197cc8c98fe7f0d7fd5a08d9bec307c5f" },
  v1Reference: { path: "advisor-plans/evidence/v1-reference-manifest.json", sha256: "87e7271f668c4ba821b7935b0082d9b9b7987f6ee29a9a5639557983aa4941ea" }
} as const satisfies Readonly<Record<string, CurrentSource>>

const historicalSources = {
  architecture: { gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "ARCHITECTURE.md", sha256: "286d7aaf5712be910078190135376432e005330697edf68c08232945d08a10f7" },
  superiority: { gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/superiority.json", sha256: "4413bc7bf98440d8af730a0e2ec9a7c4a2c9e108874b3c45d21ef0a0f4fdb374" },
  sourceBudget: { gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/source-budget.json", sha256: "05e9fe4d4d41d999ca2d99ff5a9e8f31de0ff4173887876c2a5ab6b35b435bd2" },
  api: { gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "src/api/api.ts", sha256: "7a34547d8ae546b8154f7e106a7efd6e4f4269d54d601a3c8f8af7d596811ce5" },
  apiTypes: { gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "src/api/types.ts", sha256: "243f9475f1e91b36b084402e28a48adb7b0bfdb4d233f8f7b3553cba3fb78daa" },
  plan: { gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "src/model/plan.ts", sha256: "fb4333033e341a8c1dd2a3d0613ecba7449891754df89c76823b2e2a0000fedb" },
  run: { gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "src/model/run.ts", sha256: "68f54e9a7e9b49524a6aba1ac3ca0c700a7705ba018c44410a2f635b207d582e" },
  package: { gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "package.json", sha256: "a302d91cb59a8b3244ff477fd365304ab3f15faf5da1ac394b04d1d35b041f56" },
  prepared: { gitRevision: "887a9fe2b35590f3088ffeee84f32722796e03ab", path: "src/release/prepared.ts", sha256: "fd3787907f58e590981c976cb48c0772cb61c1e57ebe57d16aff780216a8bfd9" }
} as const satisfies Readonly<Record<string, GitSource>>

const currentCoordinate = (source: CurrentSource, startLine?: number, endLine?: number): SourceCoordinate =>
  startLine === undefined || endLine === undefined
    ? { _tag: "CurrentWholeFileSourceCoordinate", repositoryId: "ts-release", ...source } as SourceCoordinate
    : { _tag: "CurrentLineRangeSourceCoordinate", repositoryId: "ts-release", ...source, startLine, endLine } as SourceCoordinate

const gitCoordinate = (source: GitSource, startLine?: number, endLine?: number): SourceCoordinate =>
  startLine === undefined || endLine === undefined
    ? { _tag: "GitWholeFileSourceCoordinate", repositoryId: "ts-release", ...source } as SourceCoordinate
    : { _tag: "GitLineRangeSourceCoordinate", repositoryId: "ts-release", ...source, startLine, endLine } as SourceCoordinate

const witnessKinds: Readonly<Record<string, string>> = {
  A: "witness.provider-acceptance",
  M: "witness.authoritative-metadata",
  B: "witness.intended-bytes",
  C: "witness.consumer-behavior",
  J: "witness.interruption-continuation"
}

const resolvedDecisionIds: Readonly<Record<string, string>> = {
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

// This normalization table translates the scorecard's compact source notation.
// The independent audit copy lives in research-traceability-oracle.ts and is
// intentionally not imported here.
const scorecardOwnerIds: Readonly<Record<string, ReadonlyArray<string>>> = {
  A0: ["consumer-application", "ts-release"],
  AC: ["consumer-application", "ts-release"],
  AJ: ["ts-release"],
  AP: ["ts-release"],
  APP: ["ts-release"],
  BA: ["effect-build-archives"],
  BAP: ["effect-build-apple"],
  "BAP+AJ": ["effect-build-apple", "ts-release"],
  BB: ["effect-build-bun"],
  BCK: ["ts-release"],
  BCO: ["effect-build-cosign"],
  BD: ["effect-build-deno"],
  BGP: ["effect-build-openpgp"],
  BK: ["ts-release"],
  BMX: ["effect-build-nfpm"],
  BN: ["effect-build-nfpm"],
  BOC: ["effect-build-oci", "ts-release"],
  BS: ["effect-build-node-sea"],
  BSA: ["effect-build-archives"],
  BSB: ["effect-build-sbom"],
  BUV: ["effect-build-python"],
  BWS: ["effect-build-windows"],
  BWX: ["effect-build-windows"],
  CF: ["ts-release"],
  CI: ["ts-release"],
  CJ: ["ts-release"],
  G0: ["ts-release"],
  GJ: ["ts-release"],
  JG: ["ts-release"],
  MR: ["ts-release"],
  N0: ["ts-release"],
  N1: ["ts-release"],
  N2: ["ts-release"],
  N3: ["ts-release"],
  NJ: ["ts-release"],
  PC: ["external-provider", "ts-release"],
  PD: ["external-provider", "ts-release"],
  PL: ["external-provider", "ts-release"],
  PT: ["external-provider", "ts-release"],
  R0: ["catalog-renderer"],
  "R0+RG": ["catalog-renderer", "ts-release"],
  RG: ["ts-release"],
  W0: ["ts-release"],
  W1: ["ts-release"],
  WJ: ["ts-release"],
  external: ["external-provider"],
  later: ["future-owner"],
  "later effect-build": ["effect-build"],
  "later effect-build+provider": ["effect-build", "future-provider"],
  "later policy integration": ["ts-release"],
  "later producer+provider": ["future-producer", "future-provider"],
  "later provider": ["future-provider"],
  "later provider package": ["future-provider"],
  "later renderer+Git": ["catalog-renderer", "ts-release"],
  "later ts-release policy": ["ts-release"],
  validator: ["openai-plugin-validator"]
}

const selectedSuccessor = (sourceId: string): string => {
  if (sourceId === "K01") return "is.01-kernel"
  if (sourceId === "K02" || sourceId === "K03") return "is.10-action-self-release"
  if (sourceId.startsWith("D01-")) return "is.02-npm"
  if (sourceId.startsWith("D02-")) return "is.03-warehouse"
  if (sourceId.startsWith("D03-")) return "is.05-github"
  if (sourceId.startsWith("D04-") || sourceId.startsWith("D05-")) return "is.06-catalog-git"
  if (sourceId.startsWith("D06-")) return "is.07-custom-provider"
  if (sourceId.startsWith("D07-") || sourceId.startsWith("AI")) return "is.09-ai-native"
  return "is.08-artifacts"
}

const expandEvidenceIds = (field: string): ReadonlyArray<string> => field.split(",").flatMap((rawToken) => {
  const token = rawToken.trim()
  const range = /^(S)([0-9]{2})-S?([0-9]{2})$/u.exec(token)
  if (range === null) {
    if (!/^S[0-9]{2}$/u.test(token)) throw new Error(`unknown scorecard evidence id ${token}`)
    return [token]
  }
  const first = Number(range[2])
  const last = Number(range[3])
  if (last < first) throw new Error(`reversed scorecard evidence range ${token}`)
  return Array.from({ length: last - first + 1 }, (_, index) => `S${String(first + index).padStart(2, "0")}`)
})

const parseProductScope = (scorecard: string): ReadonlyArray<Proposition> => {
  const lines = scorecard.split("\n")
  const records: Array<Proposition> = []
  for (const [index, line] of lines.entries()) {
    if (/^(?:K\d|D\d|P\d|Q\d|AI\d|X\d|L\d)[A-Z0-9-]*\|/u.test(line)) {
      const fields = line.split("|").map((field) => field.trim())
      if (fields.length !== 12) throw new Error(`scorecard row ${index + 1} has ${fields.length} fields`)
      const [sourceId, , proposition, ownerStatusCode, , , oracle, , , dispositionCode, , sources] = fields
      if (sourceId === undefined || proposition === undefined || ownerStatusCode === undefined ||
        oracle === undefined || dispositionCode === undefined || sources === undefined) {
        throw new Error(`scorecard row ${index + 1} is incomplete`)
      }
      const witnessMatch = /\[((?:A|M|B|C|J)(?:,(?:A|M|B|C|J))*)\]/u.exec(oracle)
      if (witnessMatch?.[1] === undefined) throw new Error(`scorecard row ${sourceId} has no witness set`)
      const requiredWitnessKinds = witnessMatch[1].split(",").map((id) => witnessKinds[id] ?? "")
      if (requiredWitnessKinds.some((id) => id.length === 0)) throw new Error(`scorecard row ${sourceId} has an unknown witness`)
      if (dispositionCode !== "V" && dispositionCode !== "X" && dispositionCode !== "L") {
        throw new Error(`scorecard row ${sourceId} has unknown disposition ${dispositionCode}`)
      }
      const ownerIds = scorecardOwnerIds[ownerStatusCode]
      if (ownerIds === undefined) throw new Error(`scorecard row ${sourceId} has unknown owner code ${ownerStatusCode}`)
      const isSelected = dispositionCode === "V"
      const isMaintainedDestination = dispositionCode === "X"
      const decisionId = resolvedDecisionIds[sourceId] ?? null
      records.push({
        id: `pr21.outcome.${sourceId.toLowerCase()}`,
        sourceRecordId: sourceId,
        sourceCoordinates: [currentCoordinate(currentSources.scorecard, index + 1, index + 1)],
        proposition,
        class: isSelected ? "product-outcome" : isMaintainedDestination ? "maintained-destination" : "later-outcome",
        disposition: isSelected ? "accept" : "defer",
        ownerIds,
        sourceOwnerCode: ownerStatusCode,
        requiredWitnessKinds,
        witnessArtifactIds: [],
        evidenceIds: expandEvidenceIds(sources),
        currentStatus: isSelected
          ? (["BB", "BD", "BS", "BE"].includes(ownerStatusCode) ? "integration-pending" : "rewrite-missing")
          : "deferred-later",
        successorIds: isSelected ? [selectedSuccessor(sourceId)] : [],
        productAuthority: true,
        decisionId
      })
      continue
    }

    const censusMatch = /^\| `((?:ADJ|M|E)[0-9]{2})` \| ([^|]+) \| ([^|]+) \|$/u.exec(line)
    if (censusMatch?.[1] !== undefined && censusMatch[2] !== undefined && censusMatch[3] !== undefined) {
      const sourceId = censusMatch[1]
      const isAdjacent = sourceId.startsWith("ADJ")
      records.push({
        id: `pr21.census.${sourceId.toLowerCase()}`,
        sourceRecordId: sourceId,
        sourceCoordinates: [currentCoordinate(currentSources.scorecard, index + 1, index + 1)],
        proposition: censusMatch[3].trim(),
        class: "census-disposition",
        disposition: isAdjacent ? "adjacent" : "reject",
        ownerIds: ["product-scope"],
        sourceOwnerCode: null,
        requiredWitnessKinds: [],
        witnessArtifactIds: [],
        evidenceIds: [],
        currentStatus: isAdjacent ? "deferred-later" : "retired",
        successorIds: sourceId === "ADJ05" ? ["pr21.outcome.p01-01"] : [],
        productAuthority: true,
        decisionId: null
      })
    }
  }
  return records
}

type Seed = Omit<Proposition, "sourceRecordId" | "sourceCoordinates" | "sourceOwnerCode" |
  "requiredWitnessKinds" | "witnessArtifactIds" | "evidenceIds" | "productAuthority" | "decisionId"> & {
    readonly sources: ReadonlyArray<SourceCoordinate>
    readonly evidenceId: string
  }

const seed = (
  id: string,
  proposition: string,
  propositionClass: PropositionClass,
  disposition: PropositionDisposition,
  ownerId: string,
  currentStatus: PropositionStatus,
  successorIds: ReadonlyArray<string>,
  sources: ReadonlyArray<SourceCoordinate>,
  evidenceId: string
): Seed => ({ id, proposition, class: propositionClass, disposition, ownerIds: [ownerId], currentStatus, successorIds, sources, evidenceId })

const acceptedResearchSeeds: ReadonlyArray<Seed> = [
  seed("pr21.proposition.canonical-durable-chain", "Bundle, plan, and journal form the canonical durable chain; indexes and reports are derived.", "research-law", "accept", "release-machine", "required", ["L01-single-canonical-durable-chain"], [currentCoordinate(currentSources.resumability, 14, 28)], "research.resumability"),
  seed("pr21.proposition.core-operation-identity", "Core hashes definition ID, schema version, and canonical Intent; plan ID scopes the durable operation key.", "research-law", "accept", "provider-contract", "required", ["L01-single-canonical-durable-chain", "L06-provider-vertical-ownership"], [currentCoordinate(currentSources.resumability, 30, 51)], "research.resumability"),
  seed("pr21.proposition.strict-canonical-identity", "Strict canonical JSON plus domain-separated length framing owns bundle, plan, and operation identities.", "research-law", "accept", "release-machine", "required", ["L01-single-canonical-durable-chain"], [currentCoordinate(currentSources.resumability, 47, 51)], "research.resumability"),
  seed("pr21.proposition.dispatch-before-send", "A durable DispatchStarted event precedes every external send.", "research-law", "accept", "release-machine", "required", ["L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated"], [currentCoordinate(currentSources.resumability, 68, 107)], "research.resumability"),
  seed("pr21.proposition.risk-accepted-fact", "RiskAccepted is a new human authorization fact, not a replay inference.", "research-law", "accept", "release-machine", "required", ["C06-explicit-risk-acceptance"], [currentCoordinate(currentSources.decision, 18, 20)], "research.decision-packet"),
  seed("pr21.proposition.absence-is-not-fence", "Observed absence cannot fence an earlier in-flight request.", "research-law", "accept", "release-machine", "required", ["C04-response-loss-inconclusive-stop"], [currentCoordinate(currentSources.resumability, 109, 120)], "research.resumability"),
  seed("pr21.proposition.four-replay-cases", "Dispatch is authorized only initially, after proven non-commit, by trusted replay protection, or by explicit risk acceptance.", "research-law", "accept", "release-machine", "required", ["C01-initial-success", "C02-rejection-before-commit", "C05-core-git-cas-protected-replay", "C06-explicit-risk-acceptance"], [currentCoordinate(currentSources.resumability, 109, 120)], "research.resumability"),
  seed("pr21.proposition.replay-vocabulary", "Replay protection uses append-only versioned None, IdempotencyKey, CompareAndSwap, and ExactDuplicateAccepted scheme IDs.", "research-law", "accept", "provider-contract", "required", ["L04-facts-decisions-effects-separated"], [currentCoordinate(currentSources.resumability, 158, 172)], "research.resumability"),
  seed("pr21.proposition.correspondence-not-law", "Core transport proves recorded/sent request correspondence but cannot assert a remote protocol replay law.", "research-law", "accept", "provider-contract", "required", ["L04-facts-decisions-effects-separated", "L06-provider-vertical-ownership"], [currentCoordinate(currentSources.resumability, 122, 156)], "research.resumability"),
  seed("pr21.proposition.cas-only-auto-replay", "The first vNext slice enables automatic replay only for structurally evidenced core compare-and-swap operations.", "research-law", "accept", "provider-contract", "required", ["C05-core-git-cas-protected-replay"], [currentCoordinate(currentSources.providers, 175, 195)], "research.provider-contracts"),
  seed("pr21.proposition.implementation-provenance-diagnostic", "Package, source, and lock identity are diagnostics rather than replay authority.", "research-law", "accept", "provider-contract", "required", ["C08-request-endpoint-mismatch"], [currentCoordinate(currentSources.providers, 90, 115)], "research.provider-contracts"),
  seed("pr21.proposition.provider-optional-operations", "Prepare, observe, and correct are provider-local optional operations rather than universal core methods.", "research-law", "accept", "provider-contract", "required", ["L06-provider-vertical-ownership"], [currentCoordinate(currentSources.providers, 9, 20)], "research.provider-contracts"),
  seed("pr21.proposition.write-only-provider", "A write-only provider is valid and must stop inconclusive when it cannot establish a safe continuation fact.", "research-law", "accept", "provider-contract", "required", ["C04-response-loss-inconclusive-stop"], [currentCoordinate(currentSources.providers, 9, 20)], "research.provider-contracts"),
  seed("pr21.proposition.ordinary-provider-composition", "Providers load through ordinary application imports and Layers without a global allowlist or registry.", "research-law", "accept", "provider-contract", "required", ["L07-open-provider-composition"], [currentCoordinate(currentSources.providerRuntime, 5, 18)], "research.provider-runtime"),
  seed("pr21.proposition.provider-minimum-durable-definition", "The durable provider minimum is definition ID, Intent schema version, and an Intent Schema with canonical encoding.", "research-law", "accept", "provider-contract", "required", ["L06-provider-vertical-ownership"], [currentCoordinate(currentSources.providers, 117, 148)], "research.provider-contracts"),
  seed("pr21.proposition.provider-native-durable-values", "Authority-bearing receipts, observations, and durable errors remain provider-native values.", "research-law", "accept", "provider-contract", "required", ["L06-provider-vertical-ownership"], [currentCoordinate(currentSources.effectArchitecture, 45, 53)], "research.effect-architecture"),
  seed("pr21.proposition.npm-one-operation", "Initial npm publication is one operation with composite version and initial-tag facets.", "research-law", "accept", "npm-provider", "required", ["pr21.outcome.d01-01"], [currentCoordinate(currentSources.providerWires, 13, 59)], "research.provider-wires"),
  seed("pr21.proposition.warehouse-one-operation-per-file", "Warehouse commits one distribution file per provider operation.", "research-law", "accept", "warehouse-provider", "required", ["pr21.outcome.d02-03"], [currentCoordinate(currentSources.providerWires, 73, 101)], "research.provider-wires"),
  seed("pr21.proposition.journal-store-law", "JournalStore.appendIfRevision is the substitutable conditional-append storage law.", "research-law", "accept", "journal-contract", "required", ["L05-host-owned-single-journal", "C07-concurrent-runners-single-cas-winner", "C10-ambiguous-append-readback"], [currentCoordinate(currentSources.journal, 6, 30)], "research.journal"),
  seed("pr21.proposition.sqlite-local-default", "The Bun CLI default is SQLite at an explicit local state path, with no cross-host guarantee.", "research-law", "accept", "journal-deployment", "required", ["P06-journal-store-backend"], [currentCoordinate(currentSources.journal, 68, 88)], "research.journal"),
  seed("pr21.proposition.artifact-k3", "Immutable content objects plus a logical artifact mapping are the selected internal artifact kernel.", "research-law", "accept", "artifact-contract", "required", ["L09-lossless-effect-build-handoff"], [currentCoordinate(currentSources.artifact, 123, 143)], "research.artifact"),
  seed("pr21.proposition.one-way-finalization", "Finalized bundles are immutable and construction-only mutation remains private.", "research-law", "accept", "artifact-contract", "required", ["L09-lossless-effect-build-handoff"], [currentCoordinate(currentSources.artifact, 18, 59)], "research.artifact"),
  seed("pr21.proposition.effect-build-boundary", "effect-build produces and transforms; ts-release adopts, journals, publishes, and reports.", "research-law", "accept", "cross-repository-boundary", "required", ["L09-lossless-effect-build-handoff"], [currentCoordinate(currentSources.storage, 53, 73)], "research.artifact-storage"),
  seed("pr21.proposition.apple-single-history", "effect-build-apple owns concrete Apple operations while ts-release owns the sole release history.", "research-law", "accept", "apple-boundary", "required", ["L10-apple-operation-journal-boundary"], [currentCoordinate(currentSources.storage, 75, 108)], "research.artifact-storage"),
  seed("pr21.proposition.effect-beta83-first-slice", "The first production slice remains on the exactly aligned Effect 4.0.0-beta.83 family.", "research-law", "accept", "effect-alignment", "required", ["plan.006.effect-boundary"], [currentCoordinate(currentSources.effect, 117, 153)], "research.effect-patterns"),
  seed("pr21.proposition.schema-and-scope-boundaries", "Schema guards durable and unknown data while Scope owns temporary resources.", "research-law", "accept", "effect-architecture", "required", ["L08-host-neutral-kernel", "L09-lossless-effect-build-handoff"], [currentCoordinate(currentSources.effectArchitecture, 96, 108)], "research.effect-architecture"),
  seed("pr21.proposition.implementation-sequence", "Implementation follows the admitted wire-first ten-step sequence.", "research-law", "accept", "architecture-program", "required", ["is.01-kernel", "is.02-npm", "is.03-warehouse", "is.04-git", "is.05-github", "is.06-catalog-git", "is.07-custom-provider", "is.08-artifacts", "is.09-ai-native", "is.10-action-self-release"], [currentCoordinate(currentSources.strategy, 7, 21)], "research.implementation-strategy")
]

const rejectedResearchSeeds: ReadonlyArray<Seed> = [
  seed("pr21.proposition.consumer-scenario", "ConsumerScenario is not a durable provider capability or universal release-domain fact.", "rejected-candidate", "supersede", "provider-contract", "retired", ["witness.consumer-behavior"], [currentCoordinate(currentSources.providers, 9, 20)], "research.provider-contracts"),
  seed("pr21.proposition.durable-consumer-acceptance", "Durable consumer acceptance records are not part of the release journal.", "rejected-candidate", "supersede", "release-machine", "retired", ["witness.consumer-behavior"], [currentCoordinate(currentSources.providers, 9, 20)], "research.provider-contracts"),
  seed("pr21.proposition.consumer-evidence-recorded-event", "ConsumerEvidenceRecorded is a derived-evidence projection rather than a canonical journal event.", "rejected-candidate", "supersede", "release-machine", "retired", ["projection.consumer-evidence"], [currentCoordinate(currentSources.resumability, 53, 66)], "research.resumability"),
  seed("pr21.proposition.replay-safety-capability", "ReplaySafetyCapability does not exist as a peer capability fact.", "rejected-candidate", "supersede", "release-machine", "retired", ["L03-single-interpreter-cas-authority"], [currentCoordinate(currentSources.decision, 15, 18)], "research.decision-packet"),
  seed("pr21.proposition.replay-authorized-event", "ReplayAuthorized is a pure decision projection, not a durable event.", "rejected-candidate", "supersede", "release-machine", "retired", ["L02-single-pure-transition-owner"], [currentCoordinate(currentSources.resumability, 53, 66)], "research.resumability"),
  seed("pr21.proposition.provider-operation-id-function", "Provider-authored operation identity is superseded by core-derived identity.", "rejected-candidate", "supersede", "provider-contract", "retired", ["pr21.proposition.core-operation-identity"], [currentCoordinate(currentSources.providers, 42, 88)], "research.provider-contracts"),
  seed("pr21.proposition.five-field-provider-law", "A probe-selected five-field provider shape is test input, not an exact architectural minimum.", "rejected-candidate", "reject", "provider-contract", "retired", ["pr21.proposition.provider-minimum-durable-definition"], [currentCoordinate(currentSources.providers, 22, 38)], "research.provider-contracts"),
  seed("pr21.proposition.behavior-id-replay-gate", "A behavior identifier cannot independently authorize replay.", "rejected-candidate", "reject", "provider-contract", "retired", ["pr21.proposition.implementation-provenance-diagnostic"], [currentCoordinate(currentSources.providers, 90, 115)], "research.provider-contracts"),
  seed("pr21.proposition.whole-lockfile-replay-gate", "Whole-lockfile identity cannot independently authorize replay.", "rejected-candidate", "reject", "provider-contract", "retired", ["pr21.proposition.implementation-provenance-diagnostic"], [currentCoordinate(currentSources.providers, 90, 115)], "research.provider-contracts"),
  seed("pr21.proposition.provider-self-asserted-replay", "A provider cannot assert a trusted replay law at resume time.", "rejected-candidate", "reject", "provider-contract", "retired", ["pr21.proposition.cas-only-auto-replay"], [currentCoordinate(currentSources.providers, 175, 195)], "research.provider-contracts"),
  seed("pr21.proposition.core-provider-behavior-allowlist", "Core does not contain a behavior allowlist for provider implementations.", "rejected-candidate", "reject", "provider-contract", "retired", ["pr21.proposition.ordinary-provider-composition"], [currentCoordinate(currentSources.providers, 175, 195)], "research.provider-contracts"),
  seed("pr21.proposition.universal-publisher", "A universal publisher erases provider-native commitment laws and is rejected.", "rejected-candidate", "reject", "provider-contract", "retired", ["L06-provider-vertical-ownership"], [currentCoordinate(currentSources.providers, 9, 20)], "research.provider-contracts"),
  seed("pr21.proposition.global-provider-registry", "A global provider registry is rejected in favor of application composition.", "rejected-candidate", "reject", "provider-contract", "retired", ["L07-open-provider-composition"], [currentCoordinate(currentSources.providerRuntime, 112, 118)], "research.provider-runtime"),
  seed("pr21.proposition.npm-member-operation-ids", "npm memberOperationIds are superseded by one composite publication operation.", "rejected-candidate", "supersede", "npm-provider", "retired", ["pr21.proposition.npm-one-operation"], [currentCoordinate(currentSources.providerWires, 50, 59)], "research.provider-wires"),
  seed("pr21.proposition.generic-one-request-many-operations", "A generic one-request-to-many-operations rule is rejected; providers own their native commit units.", "rejected-candidate", "reject", "provider-contract", "retired", ["L06-provider-vertical-ownership"], [currentCoordinate(currentSources.providerWires, 107, 116)], "research.provider-wires"),
  seed("pr21.proposition.universal-builder", "A universal builder is rejected in favor of concrete effect-build operations.", "rejected-candidate", "reject", "artifact-contract", "retired", ["pr21.proposition.effect-build-boundary"], [currentCoordinate(currentSources.storage, 53, 73)], "research.artifact-storage"),
  seed("pr21.proposition.artifact-k1-release-shaped", "The release-shaped artifact kernel is rejected because it embeds publication meaning in content storage.", "rejected-candidate", "reject", "artifact-contract", "retired", ["pr21.proposition.artifact-k3"], [currentCoordinate(currentSources.artifact, 86, 107)], "research.artifact"),
  seed("pr21.proposition.artifact-k2-content-only", "A content-only artifact kernel is rejected because it loses logical artifact identity.", "rejected-candidate", "reject", "artifact-contract", "retired", ["pr21.proposition.artifact-k3"], [currentCoordinate(currentSources.artifact, 109, 121)], "research.artifact"),
  seed("pr21.proposition.artifact-k4-path-canonical", "A path-canonical artifact kernel is rejected because mutable locations cannot own identity.", "rejected-candidate", "reject", "artifact-contract", "retired", ["pr21.proposition.artifact-k3"], [currentCoordinate(currentSources.artifact, 145, 160)], "research.artifact"),
  seed("pr21.proposition.ambient-artifact-store", "An ambient artifact store is rejected in favor of explicit construction and adoption boundaries.", "rejected-candidate", "reject", "artifact-contract", "retired", ["L09-lossless-effect-build-handoff"], [currentCoordinate(currentSources.artifact, 264, 281)], "research.artifact"),
  seed("pr21.proposition.ci-artifact-journal-cas", "CI artifacts cannot implement the conditional-append winner law and are rejected as journal authority.", "rejected-candidate", "reject", "journal-deployment", "retired", ["L05-host-owned-single-journal"], [currentCoordinate(currentSources.journal, 161, 172)], "research.journal"),
  seed("pr21.proposition.s3-required-default", "S3 is not a scope-implied mandatory journal deployment.", "rejected-candidate", "reject", "journal-deployment", "retired", ["pr21.proposition.sqlite-local-default"], [currentCoordinate(currentSources.journal, 143, 159)], "research.journal"),
  seed("pr21.proposition.filesystem-portable-default", "Filesystem generations are not a proven portable first-party default.", "rejected-candidate", "reject", "journal-deployment", "retired", ["pr21.proposition.sqlite-local-default"], [currentCoordinate(currentSources.journal, 43, 66)], "research.journal"),
  seed("pr21.proposition.beta107-first-slice", "Effect beta.107 is superseded as first-slice production authority.", "rejected-candidate", "supersede", "effect-alignment", "retired", ["pr21.proposition.effect-beta83-first-slice"], [currentCoordinate(currentSources.effect, 155, 184)], "research.effect-patterns"),
  seed("pr21.proposition.rc108-production-authority", "Effect rc.108 is a private-tool comparator, not production authority.", "rejected-candidate", "supersede", "effect-alignment", "comparator-only", ["pr21.proposition.effect-beta83-first-slice"], [currentCoordinate(currentSources.effect, 165, 184)], "research.effect-patterns"),
  seed("pr21.proposition.rc109-production-authority", "Effect rc.109 is a comparator, not production authority.", "rejected-candidate", "supersede", "effect-alignment", "comparator-only", ["pr21.proposition.effect-beta83-first-slice"], [currentCoordinate(currentSources.effect, 165, 184)], "research.effect-patterns"),
  seed("pr21.proposition.workflow-activity-kernel", "Workflow and Activity are deferred rather than used to manufacture provider commitment knowledge.", "rejected-candidate", "reject", "effect-architecture", "deferred-later", ["plan.006.after-wire-complete"], [currentCoordinate(currentSources.effectArchitecture, 110, 114)], "research.effect-architecture"),
  seed("pr21.proposition.effect-exit-implies-provider-commitment", "An Effect exit cannot establish provider commitment.", "rejected-candidate", "reject", "release-machine", "retired", ["L04-facts-decisions-effects-separated"], [currentCoordinate(currentSources.researchIndex, 137, 141)], "research.index"),
  seed("pr21.proposition.generic-verify-phase", "A generic verify phase is rejected; acceptance, metadata, bytes, consumer behavior, and continuation remain distinct.", "rejected-candidate", "reject", "product-scope", "retired", ["witness.provider-acceptance", "witness.authoritative-metadata", "witness.intended-bytes", "witness.consumer-behavior", "witness.interruption-continuation"], [currentCoordinate(currentSources.scorecard, 13, 16)], "research.launch-scorecard"),
  seed("pr21.proposition.goreleaser-heading-is-scope", "A GoReleaser feature heading is not an atomic product outcome.", "rejected-candidate", "reject", "product-scope", "retired", ["registry.atomic-launch-scorecard"], [currentCoordinate(currentSources.competitive, 150, 158)], "research.competitive-scope")
]

const deferredSeamSeeds: ReadonlyArray<Seed> = [
  seed("pr21.proposition.final-provider-typescript-spelling", "The final ProviderDefinition TypeScript spelling remains a topology and public-surface decision.", "deferred-seam", "defer", "provider-contract", "provisional-open", ["freeze.SURFACE"], [currentCoordinate(currentSources.decision, 133, 145)], "research.decision-packet"),
  seed("pr21.proposition.application-trusted-nonstructural-law", "A future application-trusted nonstructural replay-law binding is deferred beyond the first slice.", "deferred-seam", "defer", "application-policy", "deferred-later", ["post-v1.replay-policy"], [currentCoordinate(currentSources.decision, 133, 145), currentCoordinate(currentSources.resumability, 254, 259)], "research.replay-policy"),
  seed("pr21.proposition.shared-remote-journal-ux", "The general shared or remote JournalStore deployment and GitHub Actions default UX remain open.", "deferred-seam", "defer", "journal-deployment", "provisional-open", ["OD03-action-journal-deployment"], [currentCoordinate(currentSources.decision, 133, 145)], "research.decision-packet"),
  seed("pr21.proposition.git-ref-journal", "A dedicated Git ref remains an unqualified JournalStore candidate.", "deferred-seam", "defer", "journal-deployment", "provisional-open", ["OD03-action-journal-deployment"], [currentCoordinate(currentSources.journal, 90, 141)], "research.journal"),
  seed("pr21.proposition.filesystem-generation-portability", "Filesystem generations remain a later conformance implementation rather than the default.", "deferred-seam", "defer", "journal-deployment", "provisional-open", ["P06-journal-store-backend"], [currentCoordinate(currentSources.journal, 43, 66)], "research.journal"),
  seed("pr21.proposition.s3-journal", "S3 remains an optional deployment and a release-readiness-specific selection.", "deferred-seam", "defer", "journal-deployment", "deferred-later", ["OD04-release-readiness-journal-deployment"], [currentCoordinate(currentSources.journal, 143, 159)], "research.journal"),
  seed("pr21.proposition.apple-commit-before-id-correlation", "Apple acceptance before durable submission-reference append remains safely inconclusive without authoritative correlation.", "deferred-seam", "defer", "apple-boundary", "provisional-open", ["C13-apple-commit-before-id-loss", "OD07-apple-history-correlation"], [currentCoordinate(currentSources.storage, 93, 117)], "research.artifact-storage"),
  seed("pr21.proposition.request-fingerprint-canonicalization", "Exact request-fingerprint canonicalization remains a machine-trial decision.", "deferred-seam", "defer", "provider-contract", "provisional-open", ["M1-extracted-fold", "M2-total-transition"], [currentCoordinate(currentSources.decision, 133, 145)], "research.decision-packet"),
  seed("pr21.proposition.receipt-observation-schema-migration", "Provider receipt and observation schema migration remains an explicit freeze decision.", "deferred-seam", "defer", "provider-contract", "provisional-open", ["freeze.MIGRATION"], [currentCoordinate(currentSources.decision, 133, 145)], "research.decision-packet"),
  seed("pr21.proposition.effect-build-compatible-effect-migration", "The repository-wide Effect migration compatible with effect-build is deferred until an aligned published beta passes strict declarations.", "deferred-seam", "defer", "effect-alignment", "deferred-later", ["plan.004", "plan.008"], [currentCoordinate(currentSources.effect, 117, 134)], "research.effect-patterns"),
  seed("pr21.proposition.h3-resolved-artifact-handle", "The exact resolved-artifact-handle representation remains open to the machine and topology trials.", "deferred-seam", "defer", "artifact-contract", "provisional-open", ["C14-finalized-file-tree-adoption", "GT07-lossless-effect-build-file-tree-adoption"], [currentCoordinate(currentSources.artifact, 293, 317)], "research.artifact"),
  seed("pr21.proposition.artifact-kernel-package-extraction", "A third shared artifact package is deferred until a second real consumer justifies extraction.", "deferred-seam", "defer", "artifact-contract", "deferred-later", ["topology.second-real-consumer"], [currentCoordinate(currentSources.storage, 37, 51)], "research.artifact-storage"),
  seed("pr21.proposition.github-tag-default-policy", "The lightweight-versus-annotated GitHub tag default remains an implementation policy decision.", "deferred-seam", "defer", "github-provider", "provisional-open", ["pr21.outcome.d03-01"], [currentCoordinate(currentSources.scorecard, 109, 109)], "research.launch-scorecard"),
  seed("pr21.proposition.catalog-renderer-package-owner", "The concrete catalog renderer package owner remains a topology decision.", "deferred-seam", "defer", "package-topology", "provisional-open", ["pr21.outcome.d04-01"], [currentCoordinate(currentSources.scorecard, 115, 115)], "research.launch-scorecard"),
  seed("pr21.proposition.msix-production-credential-backend", "The production Authenticode credential backend remains open without removing the selected mechanics.", "deferred-seam", "defer", "windows-provider", "provisional-open", ["pr21.outcome.p09-03", "plan.009"], [currentCoordinate(currentSources.scorecard, 153, 153)], "research.launch-scorecard")
]

const planReportCoordinates: ReadonlyArray<SourceCoordinate> = [
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-173.json", sha256: "9a6e2d534cd8e076112ee76896f413222efabce05423c9054a25645f27326abf" }),
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-174.json", sha256: "606f1397270e95a35b260b1c13fe8162840f2d1f3dae3ede97a8c21c24493062" }),
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-175.json", sha256: "2784510b225304362b19d487474302ebe920aa6750737a881bb1357b7e9d42c5" }),
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-176.json", sha256: "a961515df6f0b684bdcfa56ebfdb4dd173e41d64cea1f9f0c7815afebb38b15c" }),
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-177.json", sha256: "4679f905e5cf468dfdc64aa599a73b2da5ba155d549919f83941d1af1e1ddf11" }),
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-178.json", sha256: "685757d01d1684a953a794c6b4d3a1d12ef79b2fa95486cd55b56e73368687cd" }),
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-179.json", sha256: "2d94ca6fc659bec1dd08c40babc5107dbe06976fad21e73f911721446ecebaa6" }),
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-180.json", sha256: "0647a8cc75b11da90e0be7c16b844e8fd2085ea7e7e97c03ab778b747c38cbb2" }),
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-181.json", sha256: "d12d70cd63146b365623186325441e11231aecaa05b9c629da76b4016a184212" }),
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-182.json", sha256: "10aa5dbf489bcfc77b4f71a31caaf34f6ff7052be88619f1a7e5247bf6f6ad2f" }),
  gitCoordinate({ gitRevision: "86d30feba02c904e196288c3e3bd1316ee9050af", path: "contracts/rewrite/reports/plan-183.json", sha256: "88958df94520fcb183774cdc023d6bfc47f9f5cf02ff9133c50ebcd50879a57b" }),
  gitCoordinate({ gitRevision: "7690da13fc8c41f6fa6bb25442b60221e5a50f91", path: "contracts/rewrite/reports/plan-184.json", sha256: "06a5520cb3572a990ca2f7caa36206cf3eecec0abcb6eb1628bdc39ce2487ea0" })
]

const historicalLessonSeeds: ReadonlyArray<Seed> = [
  seed("history.lesson.one-canon", "One canonical representation owns each durable fact and all other forms are projections.", "historical-lesson", "historical-only", "historical-rewrite", "comparator-only", ["L01-single-canonical-durable-chain"], [gitCoordinate(historicalSources.architecture, 64, 96)], "history.plan184"),
  seed("history.lesson.one-transition-effect-owner", "One transition owner and one effect owner prevent lifecycle reconstruction across hosts.", "historical-lesson", "historical-only", "historical-rewrite", "comparator-only", ["L02-single-pure-transition-owner", "L03-single-interpreter-cas-authority"], [gitCoordinate(historicalSources.architecture, 3, 5), gitCoordinate(historicalSources.architecture, 82, 83), gitCoordinate(historicalSources.architecture, 123, 138)], "history.plan184"),
  seed("history.lesson.reviewed-bytes-equal-executed-bytes", "Reviewed canonical bytes must be the exact bytes executed by the interpreter.", "historical-lesson", "historical-only", "historical-rewrite", "comparator-only", ["L03-single-interpreter-cas-authority", "L04-facts-decisions-effects-separated"], [gitCoordinate(historicalSources.architecture, 66, 80), gitCoordinate(historicalSources.architecture, 118, 121), gitCoordinate(historicalSources.architecture, 153, 155), gitCoordinate(historicalSources.superiority)], "history.plan184"),
  seed("history.lesson.durable-uncertainty", "Ambiguous external mutation remains durable uncertainty and cannot be converted into success by process completion.", "historical-lesson", "historical-only", "historical-rewrite", "comparator-only", ["L04-facts-decisions-effects-separated"], [gitCoordinate(historicalSources.architecture, 123, 138), gitCoordinate(historicalSources.superiority)], "history.plan184"),
  seed("history.lesson.thin-hosts", "CLI and Action hosts stay thin and do not reconstruct transition policy.", "historical-lesson", "historical-only", "historical-rewrite", "comparator-only", ["L08-host-neutral-kernel"], [gitCoordinate(historicalSources.architecture, 3, 5), gitCoordinate(historicalSources.architecture, 140, 155)], "history.plan184"),
  seed("history.lesson.checked-acyclic-dag", "The physical import graph must be exact, checked, and acyclic.", "historical-lesson", "historical-only", "historical-rewrite", "comparator-only", ["L13-exact-acyclic-import-graph"], [gitCoordinate(historicalSources.architecture, 37, 62)], "history.plan184"),
  seed("history.lesson.no-compatibility-peers", "Compatibility layers must not become peer canonical workflows or durable formats.", "historical-lesson", "historical-only", "historical-rewrite", "comparator-only", ["L11-hard-cut-or-one-shot-migration"], [gitCoordinate(historicalSources.architecture, 34, 35), gitCoordinate(historicalSources.architecture, 85, 97)], "history.plan184"),
  seed("history.lesson.independent-oracles", "Independent oracles and explicit evidence denominators are required for credible parity and superiority claims.", "historical-lesson", "historical-only", "historical-rewrite", "comparator-only", ["L12-generated-exact-public-surface", "L14-total-owned-traceability"], [gitCoordinate(historicalSources.architecture, 157, 167), gitCoordinate(historicalSources.superiority)], "history.plan184"),
  seed("history.lesson.total-and-marginal-complexity", "Total source size and marginal change amplification must be measured separately with relocation charged.", "historical-lesson", "historical-only", "historical-rewrite", "comparator-only", ["L14-total-owned-traceability"], [gitCoordinate(historicalSources.sourceBudget), ...planReportCoordinates], "history.plan-chain")
]

const historicalCommitmentSeeds: ReadonlyArray<Seed> = [
  seed("history.api.make-release-api", "The historical makeReleaseApi(layer) Promise facade constructor is not frozen as the target API.", "historical-api", "supersede", "historical-public-api", "retired", ["freeze.SURFACE"], [gitCoordinate(historicalSources.api, 35, 76)], "history.plan184-api"),
  seed("history.api.plan-promise", "The historical plan(input) Promise API is not frozen as the target API.", "historical-api", "supersede", "historical-public-api", "retired", ["freeze.SURFACE"], [gitCoordinate(historicalSources.apiTypes, 48, 51)], "history.plan184-api"),
  seed("history.api.review-execution-promise", "The historical Promise review-execution API is not frozen as the target API.", "historical-api", "supersede", "historical-public-api", "retired", ["freeze.SURFACE"], [gitCoordinate(historicalSources.apiTypes, 52, 54)], "history.plan184-api"),
  seed("history.api.apply-promise", "The historical apply(input) Promise API is not frozen as the target API.", "historical-api", "supersede", "historical-public-api", "retired", ["freeze.SURFACE"], [gitCoordinate(historicalSources.apiTypes, 55, 55)], "history.plan184-api"),
  seed("history.api.dispose-promise", "The historical dispose Promise API is not frozen as the target API.", "historical-api", "supersede", "historical-public-api", "retired", ["freeze.SURFACE"], [gitCoordinate(historicalSources.apiTypes, 55, 55)], "history.plan184-api"),
  seed("history.format.prepared-release-v2", "PreparedReleaseV2 and prepared-release/v2 require coordinate-specific one-shot migration review; no live compatibility reader is implied.", "historical-format", "supersede", "architecture-migration", "pending-migration-decision", ["OD09-durable-format-disposition", "freeze.MIGRATION"], [gitCoordinate(historicalSources.prepared, 173, 180)], "evidence.v1-reference"),
  seed("history.format.release-plan-v6", "The historical narrow-product release-plan/v6 format remains a comparator rather than target authority.", "historical-format", "supersede", "architecture-migration", "comparator-only", ["freeze.SYSTEM"], [gitCoordinate(historicalSources.plan, 20, 23)], "history.plan184-format"),
  seed("history.format.run-ledger-v1", "The historical narrow-product run ledger is superseded by the selected journal contract.", "historical-format", "supersede", "architecture-migration", "comparator-only", ["freeze.SYSTEM"], [gitCoordinate(historicalSources.run, 119, 125)], "history.plan184-format"),
  seed("history.format.release-evidence-v2", "Escaped release-evidence/v2 bytes remain historical evidence and require an explicit migration disposition.", "historical-format", "supersede", "architecture-migration", "pending-migration-decision", ["OD09-durable-format-disposition", "freeze.MIGRATION"], [currentCoordinate(currentSources.v1Reference)], "evidence.v1-reference"),
  seed("history.format.action-report-v2", "Escaped action-report/v2 bytes remain historical derived evidence and are not a target journal input.", "historical-format", "supersede", "architecture-migration", "pending-migration-decision", ["OD09-durable-format-disposition", "freeze.MIGRATION"], [currentCoordinate(currentSources.v1Reference)], "evidence.v1-reference"),
  seed("history.topology.single-root-apps", "The historical single root package with apps workspaces and no packages workspace is admitted only as topology candidate T1.", "historical-topology", "supersede", "package-topology", "comparator-only", ["T1-root"], [gitCoordinate(historicalSources.package, 2, 40)], "history.plan184-topology"),
  seed("history.metric.parity-151", "The 151-case GoReleaser census is a historical denominator, not the current product-scope total.", "historical-metric", "supersede", "product-scope", "comparator-only", ["registry.atomic-launch-scorecard"], [currentCoordinate(currentSources.scorecard, 323, 334)], "research.launch-scorecard"),
  seed("history.metric.parity-107-customization", "The 107 scoped customization rows are a historical narrow-product comparator.", "historical-metric", "historical-only", "historical-rewrite", "comparator-only", ["baseline.plan184"], [gitCoordinate(historicalSources.architecture, 165, 166)], "history.plan184"),
  seed("history.metric.parity-33-pro", "The 33 scoped Pro rows are a historical narrow-product comparator.", "historical-metric", "historical-only", "historical-rewrite", "comparator-only", ["baseline.plan184"], [gitCoordinate(historicalSources.architecture, 165, 166)], "history.plan184"),
  seed("history.metric.product-5871", "The certified 5,871 semantic product-line count is a scoped Plan 184 comparator and not a physical target budget.", "historical-metric", "historical-only", "historical-rewrite", "comparator-only", ["baseline.plan184"], [gitCoordinate(historicalSources.architecture, 157, 166)], "history.plan184"),
  seed("history.metric.product-budget-7800", "The historical 7,800 semantic-line ceiling is superseded by Plan 005 physical and marginal arithmetic.", "historical-metric", "supersede", "architecture-program", "comparator-only", ["baseline.physical-source-policy"], [gitCoordinate(historicalSources.sourceBudget)], "history.plan184-budget")
]

const supplementalPropositions = [
  ...acceptedResearchSeeds,
  ...rejectedResearchSeeds,
  ...deferredSeamSeeds,
  ...historicalLessonSeeds,
  ...historicalCommitmentSeeds
].map((entry): Proposition => ({
  id: entry.id,
  sourceRecordId: null,
  sourceCoordinates: entry.sources,
  proposition: entry.proposition,
  class: entry.class,
  disposition: entry.disposition,
  ownerIds: entry.ownerIds,
  sourceOwnerCode: null,
  requiredWitnessKinds: [],
  witnessArtifactIds: [],
  evidenceIds: [entry.evidenceId],
  currentStatus: entry.currentStatus,
  successorIds: entry.successorIds,
  productAuthority: false,
  decisionId: null
}))

export const buildResearchTraceabilityDocument = (scorecard: string): unknown => ({
  schemaVersion: "ts-release/research-traceability/v1",
  programId: "ts-release-architecture-program",
  coverage: {
    selectedProductOutcomes: 69,
    resolvedLaterCandidates: 10,
    deferredMaintainedDestinations: 7,
    preexistingNamedLaterOutcomes: 20,
    censusOnlyDispositions: 23,
    productScopeRecords: 129,
    acceptedResearchLaws: 27,
    rejectedOrSupersededResearchPropositions: 30,
    deferredOrProvisionalSeams: 15,
    retainedHistoricalLessons: 9,
    explicitHistoricalCommitments: 16,
    normalizedResearchAndHistoryRecords: 97,
    totalPropositions: 226,
    unresolvedScorecardDecisions: 0
  },
  normalizationPolicy: {
    productScopeAuthority: "docs/refactor/research/launch-scorecard.md",
    productRowsAreParsedAtomically: true,
    decisionRowsAreGroupingsNotPropositions: true,
    witnessKindsAreRequirementsNotObservedEvidence: true,
    historicalBudgetsAreComparatorsOnly: true,
    deferredRowsMayOmitSuccessors: true,
    requiredAndSupersededRowsRequireSuccessors: true,
    productAuthorityLimitedToScorecardAndCensus: true,
    independentSourceLedgerOracle: "tools/architecture-program/src/research-traceability-oracle.ts",
    exactSourceDenominatorsRequired: true,
    canonicalOwnersSeparatedFromSourceCodes: true,
    referencesResolveAgainstClosedRegistries: true
  },
  propositions: [...parseProductScope(scorecard), ...supplementalPropositions]
})
