import { Effect, Schema } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import {
  decodeCanonicalMaintainerDecisionDocument,
  type MaintainerDecisionDocumentV2
} from "./schema/maintainer-decision.js"
import { PlannedRepositoryPath, Sha256Hex } from "./schema/primitives.js"
import {
  type ArchitectureTrialResultV2,
  decodeMachineTrialResultStructure,
  decodeTopologyTrialResultStructure
} from "./schema/trial-result.js"
import {
  type ArchitectureTrialResultsV2,
  type MaintainerDecisionFileBindingV2,
  type TrialResultFileBindingV2,
  computeTrialSelectionOutcomeSha256,
  decodeTrialResultsAggregate
} from "./schema/trial-results-aggregate.js"
import type { TrialSelectionOutcome } from "./schema/trial-selection.js"
import { selectTrialCandidates } from "./schema/trial-selection.js"
import {
  type ArchitectureTrialSpecV2,
  decodeArchitectureTrialSpec
} from "./schema/trial-spec.js"
import {
  FreezeContractInvariantError,
  FreezeFactSetV1,
  FreezeSelectionAuthorityV1,
  GatesFreezeV1,
  MigrationFreezeV1,
  SelectedMachineFreezeCoordinateV1,
  SelectedTopologyFreezeCoordinateV1,
  SurfaceFreezeV1,
  SystemFreezeV1,
  WavesFreezeV1,
  computeFreezeContractId,
  decodeFreezeFactSet,
  encodeGatesFreeze,
  encodeMigrationFreeze,
  encodeSurfaceFreeze,
  encodeSystemFreeze,
  encodeWavesFreeze,
  makeGatesFreeze,
  makeMigrationFreeze,
  makeSurfaceFreeze,
  makeSystemFreeze,
  makeWavesFreeze,
  selectionAuthorityInvariantIssues,
  type ProjectionBinding
} from "./schema/freeze-contract.js"
import {
  V2MachineCandidateId,
  V2TopologyCandidateId,
  V2_CANDIDATE_DEFINITIONS,
  V2_MACHINE_CANDIDATE_IDS,
  V2_TOPOLOGY_CANDIDATE_IDS
} from "./schema/v2-ids.js"
import { hashCanonicalDocumentBytes, sha256Bytes } from "./trial-hash.js"
import type {
  TrialOutputEntry,
  TrialOutputFileSystemService
} from "./trial-orchestration.js"

export const FREEZE_ROOT = "docs/refactor/architecture-program/freeze"
export const FREEZE_ARTIFACT_PATHS = [
  `${FREEZE_ROOT}/SURFACE.json`,
  `${FREEZE_ROOT}/SURFACE.md`,
  `${FREEZE_ROOT}/MIGRATION.json`,
  `${FREEZE_ROOT}/MIGRATION.md`,
  `${FREEZE_ROOT}/WAVES.json`,
  `${FREEZE_ROOT}/WAVES.md`,
  `${FREEZE_ROOT}/GATES.json`,
  `${FREEZE_ROOT}/GATES.md`,
  `${FREEZE_ROOT}/SYSTEM.json`
] as const

export type FreezeArtifactPath = (typeof FREEZE_ARTIFACT_PATHS)[number]

export interface FreezeAuthorityFile {
  readonly path: string
  readonly bytes: Uint8Array
}

export interface FreezeGenerationRequest {
  readonly trialSpecBytes: Uint8Array
  readonly trialResultsBytes: Uint8Array
  readonly trialResultFiles: ReadonlyArray<FreezeAuthorityFile>
  readonly maintainerDecisionBytes: Uint8Array | null
  readonly factSetBytes: Uint8Array
  /** Exact files bound by FreezeFactSetV1.inputBindings, including the two fields above. */
  readonly authorityFiles: ReadonlyArray<FreezeAuthorityFile>
}

export interface GeneratedFreezeArtifact {
  readonly path: FreezeArtifactPath
  readonly bytes: Uint8Array
  readonly sha256: typeof Sha256Hex.Type
  readonly kind: "canonical-json" | "markdown"
}

export interface GeneratedFreezeBundle {
  readonly contractId: typeof Sha256Hex.Type
  readonly factSet: FreezeFactSetV1
  readonly selection: FreezeSelectionAuthorityV1
  readonly surface: SurfaceFreezeV1
  readonly migration: MigrationFreezeV1
  readonly waves: WavesFreezeV1
  readonly gates: GatesFreezeV1
  readonly system: SystemFreezeV1
  readonly artifacts: ReadonlyArray<GeneratedFreezeArtifact>
}

export class FreezeGenerationError extends Schema.TaggedError<FreezeGenerationError>()(
  "FreezeGenerationError",
  {
    issues: Schema.NonEmptyArray(Schema.String),
    message: Schema.String
  }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({ issues, message: `Architecture freeze generation blocked: ${issues.join("; ")}` })
  }
}

export class FreezePersistenceError extends Schema.TaggedError<FreezePersistenceError>()(
  "FreezePersistenceError",
  {
    path: Schema.String,
    reason: Schema.String,
    message: Schema.String
  }
) {
  constructor(path: string, reason: string) {
    super({ path, reason, message: `Architecture freeze persistence rejected ${path}: ${reason}` })
  }
}

const causeMessage = (cause: unknown): string => cause instanceof Error
  ? cause.message
  : String(cause)

const codePointCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0
const exactOrdered = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])
const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index])

const decodeCanonical = Effect.fn("FreezeGenerator.decodeCanonical")(
  function* <A, E>(
    label: string,
    bytes: Uint8Array,
    decode: (input: unknown) => Effect.Effect<A, E>
  ) {
    const parsed = yield* Effect.try({
      try: () => parseCanonicalJsonBytes(bytes),
      catch: (cause) => new FreezeGenerationError([
        `${label} is not CanonicalJsonV1: ${causeMessage(cause)}`
      ])
    })
    return yield* decode(parsed).pipe(Effect.mapError((cause) => new FreezeGenerationError([
      `${label} schema or invariant validation failed: ${causeMessage(cause)}`
    ])))
  }
)

const mapExactFiles = (
  label: string,
  files: ReadonlyArray<FreezeAuthorityFile>
): Map<string, Uint8Array> => {
  const map = new Map<string, Uint8Array>()
  for (const file of files) {
    if (map.has(file.path)) {
      throw new FreezeGenerationError([`${label} contains duplicate path ${file.path}`])
    }
    map.set(file.path, file.bytes)
  }
  return map
}

const bindingResultIssues = (
  binding: TrialResultFileBindingV2,
  result: ArchitectureTrialResultV2
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const context = result.runContext
  if (context.candidateId !== binding.candidateId ||
    context.candidateScope !== binding.scope ||
    result.receiptId !== binding.receiptId ||
    result.runContextSha256 !== binding.runContextSha256 ||
    context.candidateManifestSha256 !== binding.candidateManifestSha256 ||
    context.candidateTreeSha256 !== binding.candidateTreeSha256 ||
    context.runnerSourceSha256 !== binding.runnerSourceSha256 ||
    context.runnerNodeModulesSha256 !== binding.runnerNodeModulesSha256) {
    issues.push(`${binding.path} receipt identity differs from its aggregate binding`)
  }
  const upstream = context.upstreamMachineReceipt
  if ((upstream === null) !== (binding.upstreamMachineReceipt === null) ||
    (upstream !== null && binding.upstreamMachineReceipt !== null &&
      (upstream.selectedMachineCandidateId !==
          binding.upstreamMachineReceipt.selectedMachineCandidateId ||
        upstream.selectedMachineReceiptId !==
          binding.upstreamMachineReceipt.selectedMachineReceiptId))) {
    issues.push(`${binding.path} upstream machine receipt differs from its aggregate binding`)
  }
  const probeAuthority = result.probeReceipts.map((receipt) => {
    const execution = receipt.execution
    const record = execution._tag === "NotRun" || execution.terminalOutput === null
      ? null
      : execution.terminalOutput.evaluationRecord
    return {
      probeId: receipt.probeId,
      evaluatorId: record?.evaluatorId ?? null,
      recordSha256: record?.recordSha256 ?? null
    }
  })
  const gateAuthority = result.gateReceipts.map((receipt) => {
    const record = receipt.execution._tag === "NotRun"
      ? null
      : receipt.execution.evaluationRecord
    return {
      gateId: receipt.gateId,
      evaluatorId: record?.evaluatorId ?? null,
      recordSha256: record?.recordSha256 ?? null
    }
  })
  const objectiveAuthority = result.objectiveMetrics.map((metric) => ({
    metricId: metric.id,
    derivationId: metric.derivationRecord.derivationId,
    recordSha256: metric.derivationRecord.recordSha256
  }))
  if (!exactOrdered(
    probeAuthority.map((value) => JSON.stringify(value)),
    binding.evaluationAuthority.probeEvaluations.map((value) => JSON.stringify(value))
  ) || !exactOrdered(
    gateAuthority.map((value) => JSON.stringify(value)),
    binding.evaluationAuthority.gateEvaluations.map((value) => JSON.stringify(value))
  ) || !exactOrdered(
    objectiveAuthority.map((value) => JSON.stringify(value)),
    binding.evaluationAuthority.objectiveDerivations.map((value) => JSON.stringify(value))
  )) {
    issues.push(`${binding.path} evaluator authority differs from the exact receipt records`)
  }
  return issues
}

const decodeBoundResults = Effect.fn("FreezeGenerator.decodeBoundResults")(
  function* (
    aggregate: ArchitectureTrialResultsV2,
    files: ReadonlyArray<FreezeAuthorityFile>
  ) {
    const fileMap = yield* Effect.try({
      try: () => mapExactFiles("trialResultFiles", files),
      catch: (cause) => cause instanceof FreezeGenerationError
        ? cause
        : new FreezeGenerationError([causeMessage(cause)])
    })
    const bindings = [...aggregate.machineResults, ...aggregate.topologyResults]
    const expectedPaths = bindings.map(({ path }) => path)
    const actualPaths = [...fileMap.keys()]
    if (!exactOrdered([...actualPaths].sort(codePointCompare), [...expectedPaths].sort(codePointCompare))) {
      return yield* new FreezeGenerationError([
        "trialResultFiles must equal the aggregate's exact result-file set"
      ])
    }
    const results: Array<ArchitectureTrialResultV2> = []
    for (const binding of bindings) {
      const bytes = fileMap.get(binding.path)!
      if (sha256Bytes(bytes) !== binding.fileSha256) {
        return yield* new FreezeGenerationError([
          `${binding.path} bytes do not match the aggregate fileSha256`
        ])
      }
      const result: ArchitectureTrialResultV2 = binding.scope === "machine"
        ? yield* decodeCanonical(binding.path, bytes, decodeMachineTrialResultStructure)
        : yield* decodeCanonical(binding.path, bytes, decodeTopologyTrialResultStructure)
      const issues = bindingResultIssues(binding, result)
      if (issues.length > 0) {
        return yield* new FreezeGenerationError(issues as [string, ...Array<string>])
      }
      results.push(result)
    }
    return results
  }
)

const recomputeSelections = Effect.fn("FreezeGenerator.recomputeSelections")(
  function* (
    spec: ArchitectureTrialSpecV2,
    aggregate: ArchitectureTrialResultsV2,
    results: ReadonlyArray<ArchitectureTrialResultV2>
  ) {
    const machine = yield* selectTrialCandidates({
      scope: "machine",
      spec,
      results: results.filter(({ runContext }) => runContext.candidateScope === "machine")
    })
    if (computeTrialSelectionOutcomeSha256(machine) !==
      computeTrialSelectionOutcomeSha256(aggregate.machineSelection)) {
      return yield* new FreezeGenerationError([
        "machine selection does not reproduce from the exact bound receipts"
      ])
    }
    if (aggregate.topologySelection === null) return { machine, topology: null }
    const topology = yield* selectTrialCandidates({
      scope: "topology",
      spec,
      results: results.filter(({ runContext }) => runContext.candidateScope === "topology")
    })
    if (computeTrialSelectionOutcomeSha256(topology) !==
      computeTrialSelectionOutcomeSha256(aggregate.topologySelection)) {
      return yield* new FreezeGenerationError([
        "topology selection does not reproduce from the exact bound receipts"
      ])
    }
    return { machine, topology }
  }
)

const decisionForScope = (
  document: MaintainerDecisionDocumentV2 | null,
  scope: "machine" | "topology"
) => document?.decisions.find((decision) => decision.scope === scope)

const validateDecisionBinding = (
  scope: "machine" | "topology",
  selection: TrialSelectionOutcome,
  binding: MaintainerDecisionFileBindingV2 | null,
  document: MaintainerDecisionDocumentV2 | null,
  fileSha256: typeof Sha256Hex.Type | null
): ReadonlyArray<string> => {
  if (selection._tag !== "MaintainerDecisionRequired") {
    return binding === null && decisionForScope(document, scope) === undefined
      ? []
      : [`${scope} carries a maintainer decision without MaintainerDecisionRequired`]
  }
  const decision = decisionForScope(document, scope)
  if (binding === null || document === null || decision === undefined || fileSha256 === null) {
    return [`${scope} MaintainerDecisionRequired is not resolved by an exact decision file`]
  }
  return binding.fileSha256 === fileSha256 &&
    binding.selectionOutcomeSha256 === decision.selectionOutcomeSha256 &&
    binding.selectedCandidateId === decision.selectedCandidateId &&
    binding.selectedReceiptId === decision.selectedReceiptId
    ? []
    : [`${scope} maintainer decision file does not equal its aggregate binding`]
}

const resolveSelectionAuthority = Effect.fn("FreezeGenerator.resolveSelectionAuthority")(
  function* (
    aggregate: ArchitectureTrialResultsV2,
    maintainerDecisionBytes: Uint8Array | null
  ) {
    const needsDecision = aggregate.machineSelection._tag === "MaintainerDecisionRequired" ||
      aggregate.topologySelection?._tag === "MaintainerDecisionRequired"
    if (!needsDecision && maintainerDecisionBytes !== null) {
      return yield* new FreezeGenerationError([
        "maintainer-decision bytes are forbidden when both selections are unique"
      ])
    }
    const document = maintainerDecisionBytes === null
      ? null
      : yield* decodeCanonicalMaintainerDecisionDocument(maintainerDecisionBytes, {
        trialSpecSha256: aggregate.trialSpecSha256,
        machineSelection: aggregate.machineSelection,
        topologySelection: aggregate.topologySelection
      }).pipe(Effect.mapError((cause) => new FreezeGenerationError([
        `maintainer decision validation failed: ${causeMessage(cause)}`
      ])))
    const decisionSha = maintainerDecisionBytes === null
      ? null
      : sha256Bytes(maintainerDecisionBytes)
    const decisionIssues = [
      ...validateDecisionBinding(
        "machine",
        aggregate.machineSelection,
        aggregate.machineMaintainerDecision,
        document,
        decisionSha
      ),
      ...(aggregate.topologySelection === null
        ? aggregate.topologyMaintainerDecision === null
          ? []
          : ["topology maintainer decision exists without a topology selection"]
        : validateDecisionBinding(
          "topology",
          aggregate.topologySelection,
          aggregate.topologyMaintainerDecision,
          document,
          decisionSha
        ))
    ]
    if (decisionIssues.length > 0) {
      return yield* new FreezeGenerationError(
        decisionIssues as [string, ...Array<string>]
      )
    }
    if (aggregate.machineSelection._tag === "NoQualifyingCandidate" ||
      aggregate.topologySelection === null ||
      aggregate.topologySelection._tag === "NoQualifyingCandidate") {
      return yield* new FreezeGenerationError([
        "freeze requires one resolved qualifying machine/topology tuple"
      ])
    }

    const machineDecision = decisionForScope(document, "machine")
    const topologyDecision = decisionForScope(document, "topology")
    const machineId = aggregate.machineSelection._tag === "UniqueSelection"
      ? aggregate.machineSelection.selectedCandidateId
      : machineDecision!.selectedCandidateId
    const machineReceipt = aggregate.machineSelection._tag === "UniqueSelection"
      ? aggregate.machineSelection.selectedReceiptId
      : machineDecision!.selectedReceiptId
    const topologyId = aggregate.topologySelection._tag === "UniqueSelection"
      ? aggregate.topologySelection.selectedCandidateId
      : topologyDecision!.selectedCandidateId
    const topologyReceipt = aggregate.topologySelection._tag === "UniqueSelection"
      ? aggregate.topologySelection.selectedReceiptId
      : topologyDecision!.selectedReceiptId
    const exactMachineId = V2_MACHINE_CANDIDATE_IDS.find((id) => id === machineId)
    const exactTopologyId = V2_TOPOLOGY_CANDIDATE_IDS.find((id) => id === topologyId)
    if (V2_CANDIDATE_DEFINITIONS[machineId].scope !== "machine" ||
      V2_CANDIDATE_DEFINITIONS[topologyId].scope !== "topology" ||
      exactMachineId === undefined || exactTopologyId === undefined) {
      return yield* new FreezeGenerationError([
        "resolved tuple contains a candidate from the wrong scope"
      ])
    }
    const selection = new FreezeSelectionAuthorityV1({
      trialSpecSha256: aggregate.trialSpecSha256,
      trialResultsAggregateId: aggregate.aggregateId,
      trialResultsFileSha256: Sha256Hex.make("0".repeat(64)),
      machine: new SelectedMachineFreezeCoordinateV1({
        candidateId: V2MachineCandidateId.make(exactMachineId),
        receiptId: machineReceipt,
        selectionMode: aggregate.machineSelection._tag === "UniqueSelection"
          ? "unique"
          : "maintainer-approved",
        decisionDocumentId: machineDecision === undefined ? null : document!.documentId,
        decisionFileSha256: machineDecision === undefined ? null : decisionSha
      }),
      topology: new SelectedTopologyFreezeCoordinateV1({
        candidateId: V2TopologyCandidateId.make(exactTopologyId),
        receiptId: topologyReceipt,
        selectionMode: aggregate.topologySelection._tag === "UniqueSelection"
          ? "unique"
          : "maintainer-approved",
        decisionDocumentId: topologyDecision === undefined ? null : document!.documentId,
        decisionFileSha256: topologyDecision === undefined ? null : decisionSha
      })
    })
    const issues = selectionAuthorityInvariantIssues(selection)
    if (issues.length > 0) {
      return yield* new FreezeGenerationError(issues as [string, ...Array<string>])
    }
    return selection
  }
)

const validateAuthorityFiles = Effect.fn("FreezeGenerator.validateAuthorityFiles")(
  function* (
    factSet: FreezeFactSetV1,
    files: ReadonlyArray<FreezeAuthorityFile>
  ) {
    const fileMap = yield* Effect.try({
      try: () => mapExactFiles("authorityFiles", files),
      catch: (cause) => cause instanceof FreezeGenerationError
        ? cause
        : new FreezeGenerationError([causeMessage(cause)])
    })
    const expectedPaths = factSet.inputBindings.map(({ path }) => path)
    if (!exactOrdered(
      [...fileMap.keys()].sort(codePointCompare),
      [...expectedPaths].sort(codePointCompare)
    )) {
      return yield* new FreezeGenerationError([
        "authorityFiles must equal the fact set's exact input-binding paths"
      ])
    }
    for (const binding of factSet.inputBindings) {
      const bytes = fileMap.get(binding.path)!
      if (sha256Bytes(bytes) !== binding.sha256) {
        return yield* new FreezeGenerationError([
          `${binding.path} does not match its freeze input binding`
        ])
      }
    }
  }
)

const markdownBytes = (lines: ReadonlyArray<string>): Uint8Array =>
  new TextEncoder().encode(`${lines.join("\n")}\n`)

const renderSurfaceMarkdown = (document: SurfaceFreezeV1): Uint8Array => markdownBytes([
  "# Frozen public surface",
  "",
  `Contract: \`${document.contractId}\``,
  `Document: \`${document.documentId}\``,
  "",
  "| Package | npm name | Visibility | Publication order |",
  "| --- | --- | --- | ---: |",
  ...document.packages.map((pkg) =>
    `| \`${pkg.packageId}\` | \`${pkg.npmName}\` | ${pkg.visibility} | ${pkg.publicationOrder} |`),
  "",
  `Dependency nodes: ${document.dependencyNodes.length}; exact edges: ${document.dependencyDag.length}.`
])

const renderMigrationMarkdown = (document: MigrationFreezeV1): Uint8Array => markdownBytes([
  "# Frozen migration ledger",
  "",
  `Contract: \`${document.contractId}\``,
  `Document: \`${document.documentId}\``,
  "",
  "| Row | Source unit | Kind | Action | Successor wave |",
  "| --- | --- | --- | --- | --- |",
  ...document.rows.map((row) =>
    `| \`${row.id}\` | \`${row.sourceUnitId}\` | ${row._tag} | ${row.action} | \`${row.successorWaveId}\` |`)
])

const renderWavesMarkdown = (document: WavesFreezeV1): Uint8Array => markdownBytes([
  "# Frozen implementation waves",
  "",
  `Contract: \`${document.contractId}\``,
  `Document: \`${document.documentId}\``,
  "",
  "| Order | Wave | Plan | Result artifact |",
  "| ---: | --- | --- | --- |",
  ...document.waves.map((wave) =>
    `| ${wave.order} | \`${wave.id}\` | ${wave.planId} | \`${wave.resultArtifact}\` |`)
])

const renderGatesMarkdown = (document: GatesFreezeV1): Uint8Array => markdownBytes([
  "# Frozen executable gates",
  "",
  `Contract: \`${document.contractId}\``,
  `Document: \`${document.documentId}\``,
  "",
  "| Gate | Wave | Host | Command |",
  "| --- | --- | --- | --- |",
  ...document.gates.map((gate) =>
    `| \`${gate.id}\` | \`${gate.waveId}\` | ${gate.host} | \`${[gate.command, ...gate.argv].join(" ")}\` |`)
])

const jsonArtifact = (
  path: FreezeArtifactPath,
  value: unknown
): GeneratedFreezeArtifact => {
  const bytes = canonicalJsonBytes(value)
  return { path, bytes, sha256: sha256Bytes(bytes), kind: "canonical-json" }
}

const markdownArtifact = (
  path: FreezeArtifactPath,
  bytes: Uint8Array
): GeneratedFreezeArtifact => ({
  path,
  bytes,
  sha256: sha256Bytes(bytes),
  kind: "markdown"
})

const projectionBinding = (
  artifact: ProjectionBinding["artifact"],
  documentId: typeof Sha256Hex.Type,
  json: GeneratedFreezeArtifact,
  markdown: GeneratedFreezeArtifact
): ProjectionBinding => ({
  artifact,
  jsonPath: PlannedRepositoryPath.make(json.path),
  jsonSha256: json.sha256,
  documentId,
  markdownPath: PlannedRepositoryPath.make(markdown.path),
  markdownSha256: markdown.sha256
})

export const generateFreezeBundle = Effect.fn("FreezeGenerator.generate")(
  function* (request: FreezeGenerationRequest) {
    const spec = yield* decodeCanonical(
      "trial-spec.json",
      request.trialSpecBytes,
      decodeArchitectureTrialSpec
    )
    const aggregate = yield* decodeCanonical(
      "trial-results.json",
      request.trialResultsBytes,
      (input) => decodeTrialResultsAggregate(input, spec)
    )
    const trialSpecSha256 = hashCanonicalDocumentBytes(request.trialSpecBytes)
    if (aggregate.trialSpecSha256 !== trialSpecSha256) {
      return yield* new FreezeGenerationError([
        "trial-results aggregate does not bind the exact canonical trial specification"
      ])
    }
    const results = yield* decodeBoundResults(aggregate, request.trialResultFiles)
    yield* recomputeSelections(spec, aggregate, results)
    const selectionDraft = yield* resolveSelectionAuthority(
      aggregate,
      request.maintainerDecisionBytes
    )
    const selection = new FreezeSelectionAuthorityV1({
      ...selectionDraft,
      trialResultsFileSha256: sha256Bytes(request.trialResultsBytes)
    })
    const factSet = yield* decodeCanonical(
      "freeze fact set",
      request.factSetBytes,
      decodeFreezeFactSet
    )
    yield* validateAuthorityFiles(factSet, request.authorityFiles)
    const trialSpecBinding = factSet.inputBindings.find(({ id }) => id === "input.trial-spec")
    const resultsBinding = factSet.inputBindings.find(({ id }) => id === "result.trial-results")
    if (trialSpecBinding?.sha256 !== trialSpecSha256 ||
      resultsBinding?.sha256 !== selection.trialResultsFileSha256) {
      return yield* new FreezeGenerationError([
        "freeze facts do not bind the exact validated trial spec and results bytes"
      ])
    }

    const contractId = computeFreezeContractId(factSet.factSetId, selection)
    const surface = makeSurfaceFreeze({
      schemaVersion: "ts-release/architecture-surface-freeze/v1",
      programId: "ts-release-architecture-program",
      contractId,
      ...factSet.surface
    })
    const migration = makeMigrationFreeze({
      schemaVersion: "ts-release/architecture-migration-freeze/v1",
      programId: "ts-release-architecture-program",
      contractId,
      ...factSet.migration
    })
    const waves = makeWavesFreeze({
      schemaVersion: "ts-release/architecture-waves-freeze/v1",
      programId: "ts-release-architecture-program",
      contractId,
      ...factSet.waves
    })
    const gates = makeGatesFreeze({
      schemaVersion: "ts-release/architecture-gates-freeze/v1",
      programId: "ts-release-architecture-program",
      contractId,
      ...factSet.gates
    })

    const surfaceJson = jsonArtifact(FREEZE_ARTIFACT_PATHS[0], encodeSurfaceFreeze(surface))
    const surfaceMarkdown = markdownArtifact(FREEZE_ARTIFACT_PATHS[1], renderSurfaceMarkdown(surface))
    const migrationJson = jsonArtifact(FREEZE_ARTIFACT_PATHS[2], encodeMigrationFreeze(migration))
    const migrationMarkdown = markdownArtifact(
      FREEZE_ARTIFACT_PATHS[3],
      renderMigrationMarkdown(migration)
    )
    const wavesJson = jsonArtifact(FREEZE_ARTIFACT_PATHS[4], encodeWavesFreeze(waves))
    const wavesMarkdown = markdownArtifact(FREEZE_ARTIFACT_PATHS[5], renderWavesMarkdown(waves))
    const gatesJson = jsonArtifact(FREEZE_ARTIFACT_PATHS[6], encodeGatesFreeze(gates))
    const gatesMarkdown = markdownArtifact(FREEZE_ARTIFACT_PATHS[7], renderGatesMarkdown(gates))
    const projectionBindings: [ProjectionBinding, ...Array<ProjectionBinding>] = [
      projectionBinding("SURFACE", surface.documentId, surfaceJson, surfaceMarkdown),
      projectionBinding("MIGRATION", migration.documentId, migrationJson, migrationMarkdown),
      projectionBinding("WAVES", waves.documentId, wavesJson, wavesMarkdown),
      projectionBinding("GATES", gates.documentId, gatesJson, gatesMarkdown)
    ]
    const system = makeSystemFreeze({
      schemaVersion: "ts-release/architecture-system-freeze/v1",
      programId: "ts-release-architecture-program",
      contractId,
      factSetId: factSet.factSetId,
      inputBindings: [...factSet.inputBindings],
      selection,
      sourceCoordinates: [...factSet.sourceCoordinates],
      projectionBindings,
      ...factSet.system
    })
    const systemJson = jsonArtifact(FREEZE_ARTIFACT_PATHS[8], encodeSystemFreeze(system))
    return {
      contractId,
      factSet,
      selection,
      surface,
      migration,
      waves,
      gates,
      system,
      artifacts: [
        surfaceJson,
        surfaceMarkdown,
        migrationJson,
        migrationMarkdown,
        wavesJson,
        wavesMarkdown,
        gatesJson,
        gatesMarkdown,
        systemJson
      ]
    } satisfies GeneratedFreezeBundle
  }
)

const inspectExact = (
  entry: TrialOutputEntry,
  artifact: GeneratedFreezeArtifact
): "missing" | "exact" | "invalid" => entry._tag === "Missing"
  ? "missing"
  : entry._tag === "RegularFile" && equalBytes(entry.bytes, artifact.bytes)
  ? "exact"
  : "invalid"

/**
 * Publishes projections in deterministic order and SYSTEM last. Existing exact
 * bytes are idempotent; any different file, symlink, or non-file blocks before
 * the first write, so generated authority is never silently replaced.
 */
export const persistFreezeBundle = Effect.fn("FreezeGenerator.persist")(
  function* (
    repositoryRoot: string,
    bundle: GeneratedFreezeBundle,
    outputFileSystem: TrialOutputFileSystemService
  ) {
    const states: Array<"missing" | "exact"> = []
    for (const artifact of bundle.artifacts) {
      const entry = yield* outputFileSystem.inspect(repositoryRoot, artifact.path)
      const state = inspectExact(entry, artifact)
      if (state === "invalid") {
        return yield* new FreezePersistenceError(
          artifact.path,
          "existing artifact is not the exact generated bytes"
        )
      }
      states.push(state)
    }
    for (const [index, artifact] of bundle.artifacts.entries()) {
      if (states[index] === "exact") continue
      yield* outputFileSystem.writeAtomically(
        repositoryRoot,
        artifact.path,
        artifact.bytes,
        null
      )
      const persisted = yield* outputFileSystem.inspect(repositoryRoot, artifact.path)
      if (persisted._tag !== "RegularFile" || !equalBytes(persisted.bytes, artifact.bytes)) {
        return yield* new FreezePersistenceError(
          artifact.path,
          "atomic writer did not publish the exact generated bytes"
        )
      }
    }
  }
)

export type FreezeGeneratorError = FreezeGenerationError | FreezeContractInvariantError
