import { constants } from "node:fs"
import { lstat, open, realpath } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"
import { Effect, Schema } from "effect"
import * as ts from "typescript"
import { parseCanonicalJsonBytes } from "./canonical-document.js"
import {
  decodeCandidateManifest,
  type ArchitectureCandidateManifestV2
} from "./schema/candidate-manifest.js"
import {
  decodeArchitectureBaseline,
  type ArchitectureBaselineV1
} from "./schema/baseline.js"
import { ArtifactId } from "./schema/primitives.js"
import {
  EvidenceEntryV2,
  EvidenceName,
  IntegerEvidenceValueV2,
  Sha256EvidenceValueV2,
  codePointCompare
} from "./schema/trial-evidence.js"
import type { ArchitectureGateInvocationV2 } from "./schema/harness-protocol.js"
import type { ArchitectureTrialSpecV2 } from "./schema/trial-spec.js"
import {
  inventoryCandidateTree,
  type CandidateTreeInventory
} from "./trial-inventory.js"
import { sha256Bytes } from "./trial-hash.js"

export const TRIAL_GATE_CANDIDATE_MANIFEST = "trial-candidate.json"
export const TRIAL_GATE_SANDBOX_REPOSITORY_ROOT = "/repo"
export const TRIAL_GATE_SANDBOX_CANDIDATE_ROOT = "/candidate"
export const TRIAL_GATE_SANDBOX_HOME = "/home/trial-gate"

type GateRequirement = ArchitectureTrialSpecV2["gateRequirements"][number]

const MACHINE_SOURCE_BUDGET_BASELINE_PATH =
  "docs/refactor/architecture-program/inputs/baseline.json"
const MACHINE_SOURCE_BUDGET_REFERENCE = {
  baselineId: "overlay-v1",
  commit: "2ef7a9a61fe40608d053569cbcd71e40fca5c181",
  comparisonSlice: "preserved-overlay-machine-interpreter",
  denominator: 5,
  modules: [
    ["src/release/application.ts", 1_086],
    ["src/release/next-attempt.ts", 606],
    ["src/release/state.ts", 422]
  ],
  numerator: 3,
  tree: "4e71a43c14f2dc980fadae024020d294270e6565"
} as const

export interface MachineSourceBudgetAuthority {
  readonly comparisonSlice: typeof MACHINE_SOURCE_BUDGET_REFERENCE.comparisonSlice
  readonly denominator: typeof MACHINE_SOURCE_BUDGET_REFERENCE.denominator
  readonly numerator: typeof MACHINE_SOURCE_BUDGET_REFERENCE.numerator
  readonly referenceProductLines: number
}

export class TrialGateContractError extends Schema.TaggedError<TrialGateContractError>()(
  "TrialGateContractError",
  {
    failureIds: Schema.NonEmptyArray(ArtifactId),
    message: Schema.String
  }
) {
  constructor(failureIds: readonly [typeof ArtifactId.Type, ...Array<typeof ArtifactId.Type>]) {
    super({
      failureIds,
      message: `Runner-owned gate contract failed: ${failureIds.join(", ")}`
    })
  }
}

export interface TrialGateInspection {
  readonly manifest: ArchitectureCandidateManifestV2
  readonly inventory: CandidateTreeInventory
  readonly difficultPathOwnerHops: number | null
  readonly invalidVersionStateCount: number | null
  readonly machineInterpreterProductLines: number | null
  readonly mainPathOwnerHops: number | null
  readonly packedByteCount: number | null
  readonly representableInvalidStateCount: number | null
  readonly sourceBudgetAuthority: MachineSourceBudgetAuthority | null
  readonly staticCheckCount: number
}

const canonicalFailureIds = (
  values: ReadonlyArray<string>
): [typeof ArtifactId.Type, ...Array<typeof ArtifactId.Type>] => {
  const ids = [...new Set(values)].sort(codePointCompare).map((value) => ArtifactId.make(value))
  return (ids.length === 0 ? [ArtifactId.make("gate.runner-contract-failed")] : ids) as [
    typeof ArtifactId.Type,
    ...Array<typeof ArtifactId.Type>
  ]
}

const exactOrdered = (
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>
): boolean => left.length === right.length && left.every((value, index) => value === right[index])

const sameNode = (
  left: Awaited<ReturnType<typeof lstat>>,
  right: Awaited<ReturnType<typeof lstat>>
): boolean => left.dev === right.dev && left.ino === right.ino && left.mode === right.mode &&
  left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs

const readStableFile = Effect.fn("TrialGateContract.readStableFile")(function* (
  path: string,
  expectedSha256?: string
) {
  const handle = yield* Effect.acquireRelease(
    Effect.tryPromise(() => open(path, constants.O_RDONLY | constants.O_NOFOLLOW)),
    (value) => Effect.promise(() => value.close()).pipe(Effect.orDie)
  )
  const before = yield* Effect.tryPromise(() => handle.stat())
  if (!before.isFile()) return yield* Effect.fail(new Error(`${path} is not a regular file`))
  const bytes = new Uint8Array(yield* Effect.tryPromise(() => handle.readFile()))
  const after = yield* Effect.tryPromise(() => handle.stat())
  const pathAfter = yield* Effect.tryPromise(() => lstat(path))
  if (!after.isFile() || pathAfter.isSymbolicLink() || !pathAfter.isFile() ||
    !sameNode(before, after) || !sameNode(after, pathAfter) || bytes.byteLength !== after.size) {
    return yield* Effect.fail(new Error(`${path} changed while it was read`))
  }
  if (expectedSha256 !== undefined && sha256Bytes(bytes) !== expectedSha256) {
    return yield* Effect.fail(new Error(`${path} does not equal its inventoried digest`))
  }
  return bytes
})

const exactMachineSourceBudgetAuthority = (
  baseline: ArchitectureBaselineV1,
  spec: ArchitectureTrialSpecV2
): MachineSourceBudgetAuthority | null => {
  const policy = spec.machineSelectionPolicy.sourceBudget
  if (policy.comparisonSlice !== MACHINE_SOURCE_BUDGET_REFERENCE.comparisonSlice ||
    policy.numerator !== MACHINE_SOURCE_BUDGET_REFERENCE.numerator ||
    policy.denominator !== MACHINE_SOURCE_BUDGET_REFERENCE.denominator ||
    baseline.comparisonPolicy.sourceCompressionReferenceId !==
      MACHINE_SOURCE_BUDGET_REFERENCE.baselineId) return null
  const reference = baseline.baselines.find(({ id }) =>
    id === MACHINE_SOURCE_BUDGET_REFERENCE.baselineId)
  if (reference === undefined ||
    reference.commit !== MACHINE_SOURCE_BUDGET_REFERENCE.commit ||
    reference.tree !== MACHINE_SOURCE_BUDGET_REFERENCE.tree) return null
  const overlayTree = baseline.evidenceSources.find(({ id }) => id === "evidence.overlay-tree")
  if (overlayTree?._tag !== "GitTreeEvidence" ||
    overlayTree.commit !== MACHINE_SOURCE_BUDGET_REFERENCE.commit ||
    overlayTree.tree !== MACHINE_SOURCE_BUDGET_REFERENCE.tree) return null

  let referenceProductLines = 0
  for (const [path, physicalLines] of MACHINE_SOURCE_BUDGET_REFERENCE.modules) {
    const matches = reference.sourceInventory.topModules.filter((module) => module.path === path)
    if (matches.length !== 1 || matches[0]!.physicalLines !== physicalLines) return null
    referenceProductLines += physicalLines
  }
  if (referenceProductLines !== 2_114) return null
  return Object.freeze({
    comparisonSlice: MACHINE_SOURCE_BUDGET_REFERENCE.comparisonSlice,
    denominator: MACHINE_SOURCE_BUDGET_REFERENCE.denominator,
    numerator: MACHINE_SOURCE_BUDGET_REFERENCE.numerator,
    referenceProductLines
  })
}

/** Loads only the hash-bound baseline evidence needed by GM05. */
export const loadMachineSourceBudgetAuthority = Effect.fn(
  "TrialGateContract.loadMachineSourceBudgetAuthority"
)(function* (
  repositoryRoot: string,
  spec: ArchitectureTrialSpecV2
) {
  const observed = yield* Effect.result(Effect.gen(function* () {
    const binding = spec.inputBindings.find(({ id }) => id === "B02-baseline")
    if (binding === undefined || binding.path !== MACHINE_SOURCE_BUDGET_BASELINE_PATH) {
      return yield* Effect.fail(new Error("baseline input binding is unavailable"))
    }
    const bytes = yield* Effect.scoped(readStableFile(
      resolve(repositoryRoot, binding.path),
      binding.sha256
    ))
    const value = yield* Effect.try({
      try: () => parseCanonicalJsonBytes(bytes),
      catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
    })
    const baseline = yield* decodeArchitectureBaseline(value).pipe(
      Effect.mapError((cause) => new Error(cause.message))
    )
    const authority = exactMachineSourceBudgetAuthority(baseline, spec)
    return authority === null
      ? yield* Effect.fail(new Error("exact machine source budget slice is unavailable"))
      : authority
  }))
  if (observed._tag === "Failure") {
    return yield* new TrialGateContractError(canonicalFailureIds([
      "gate.runner-source-budget-denominator-unavailable"
    ]))
  }
  return observed.success
})

const decodeManifestAt = Effect.fn("TrialGateContract.decodeManifestAt")(function* (
  root: string
) {
  const exactRoot = yield* Effect.tryPromise(() => realpath(root))
  if (!isAbsolute(root) || resolve(root) !== root || exactRoot !== root) {
    return yield* Effect.fail(new Error("inspection root must be one canonical absolute path"))
  }
  const rootStat = yield* Effect.tryPromise(() => lstat(root))
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    return yield* Effect.fail(new Error("inspection root must be a real directory"))
  }
  const manifestPath = join(root, TRIAL_GATE_CANDIDATE_MANIFEST)
  const exactManifestPath = yield* Effect.tryPromise(() => realpath(manifestPath))
  if (exactManifestPath !== manifestPath) {
    return yield* Effect.fail(new Error("candidate manifest must not traverse a link or alias"))
  }
  const bytes = yield* Effect.scoped(readStableFile(manifestPath))
  const value = yield* Effect.try({
    try: () => parseCanonicalJsonBytes(bytes),
    catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
  })
  return yield* decodeCandidateManifest(value).pipe(Effect.mapError((cause) => new Error(cause.message)))
})

const graphHasCycle = (
  manifest: ArchitectureCandidateManifestV2
): boolean => {
  const edges = new Map<string, Array<string>>()
  for (const edge of manifest.dependencyEdges) {
    const targets = edges.get(edge.fromId) ?? []
    targets.push(edge.toId)
    edges.set(edge.fromId, targets)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true
    if (visited.has(node)) return false
    visiting.add(node)
    for (const target of edges.get(node) ?? []) if (visit(target)) return true
    visiting.delete(node)
    visited.add(node)
    return false
  }
  return [...new Set(manifest.dependencyEdges.flatMap(({ fromId, toId }) => [fromId, toId]))]
    .some(visit)
}

const hasMachineToProviderDependency = (
  manifest: ArchitectureCandidateManifestV2
): boolean => {
  const machineNodes = new Set<string>()
  const providerNodes = new Set<string>()
  for (const file of manifest.files) {
    const nodes = [file.moduleId, file.packageId].filter((id): id is NonNullable<typeof id> =>
      id !== null)
    if (file.ownerRoleIds.some((ownerId) =>
      ownerId === "role-machine" || ownerId === "role-kernel-workflow")) {
      nodes.forEach((id) => machineNodes.add(id))
    }
    if (file.ownerRoleIds.some((ownerId) => ownerId.includes("provider"))) {
      nodes.forEach((id) => providerNodes.add(id))
    }
  }
  return manifest.dependencyEdges.some(({ fromId, toId }) =>
    machineNodes.has(fromId) && (providerNodes.has(toId) || toId.includes("provider")))
}

const exportedStringArrayCount = Effect.fn(
  "TrialGateContract.exportedStringArrayCount"
)(function* (
  root: string,
  manifest: ArchitectureCandidateManifestV2,
  inventory: CandidateTreeInventory,
  exportName: string
) {
  const entries = new Map(inventory.entries.map((entry) => [entry.path, entry] as const))
  const counts: Array<number> = []
  for (const file of manifest.files.filter(({ path }) => path.endsWith(".ts"))) {
    const entry = entries.get(file.path)
    if (entry === undefined) return null
    const bytes = yield* Effect.scoped(readStableFile(join(root, file.path), entry.sha256))
    const text = yield* Effect.try({
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      catch: () => new Error(`${file.path} is not UTF-8`)
    })
    const source = ts.createSourceFile(file.path, text, ts.ScriptTarget.ESNext, true)
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(
        ({ kind }) => kind === ts.SyntaxKind.ExportKeyword
      )) continue
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName) continue
        let initializer = declaration.initializer
        if (initializer !== undefined && ts.isAsExpression(initializer)) {
          initializer = initializer.expression
        }
        if (initializer === undefined || !ts.isArrayLiteralExpression(initializer) ||
          initializer.elements.some((element) => !ts.isStringLiteral(element))) return null
        counts.push(initializer.elements.length)
      }
    }
  }
  return counts.length === 1 ? counts[0]! : null
})

const productSourceLaneIds: ReadonlySet<string> = new Set([
  "action-source",
  "generated-product-input",
  "product-source"
])

const physicalLineCount = (bytes: Uint8Array): number => {
  if (bytes.byteLength === 0) return 0
  let lines = 0
  for (const byte of bytes) if (byte === 0x0a) lines += 1
  return bytes[bytes.byteLength - 1] === 0x0a ? lines : lines + 1
}

const machineInterpreterProductLines = Effect.fn(
  "TrialGateContract.machineInterpreterProductLines"
)(function* (
  root: string,
  manifest: ArchitectureCandidateManifestV2,
  inventory: CandidateTreeInventory
) {
  const entries = new Map(inventory.entries.map((entry) => [entry.path, entry] as const))
  let found = false
  let total = 0
  for (const file of manifest.files) {
    if (!productSourceLaneIds.has(file.laneId) || !file.ownerRoleIds.some((ownerId) =>
      ownerId === "role-machine" || ownerId === "role-kernel-workflow")) continue
    const entry = entries.get(file.path)
    if (entry === undefined) return null
    const bytes = yield* Effect.scoped(readStableFile(join(root, file.path), entry.sha256))
    const utf8 = yield* Effect.result(Effect.try({
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      catch: () => new Error(`${file.path} is not UTF-8`)
    }))
    if (utf8._tag === "Failure") return null
    found = true
    total += physicalLineCount(bytes)
    if (!Number.isSafeInteger(total)) return null
  }
  return found && total > 0 ? total : null
})

const ownerHops = (
  manifest: ArchitectureCandidateManifestV2,
  conceptId: "concept.main-path" | "concept.difficult-path"
): number | null => {
  const files = manifest.files.filter(({ conceptIds }) => conceptIds.some((id) => id === conceptId))
  if (files.length === 0 || files.some(({ ownerRoleIds }) => ownerRoleIds.length === 0)) return null
  const owners = new Set(files.flatMap(({ ownerRoleIds }) => ownerRoleIds))
  return owners.size === 0 ? null : owners.size - 1
}

const packedByteCount = (
  manifest: ArchitectureCandidateManifestV2,
  inventory: CandidateTreeInventory
): number | null => {
  const entries = new Map(inventory.entries.map((entry) => [entry.path, entry] as const))
  let found = false
  let total = 0
  for (const file of manifest.files) {
    if (file.laneId !== "delivery-bundle") continue
    const entry = entries.get(file.path)
    if (entry === undefined) return null
    found = true
    total += entry.bytes
    if (!Number.isSafeInteger(total)) return null
  }
  return found ? total : null
}

const packedGateIds: ReadonlySet<string> = new Set([
  "GT02-packed-library-node",
  "GT03-packed-library-bun",
  "GT04-packed-cli",
  "GT05-packed-github-action",
  "GT06-packed-external-provider-two-instances",
  "GT07-lossless-effect-build-file-tree-adoption",
  "GT09-exact-emitted-packed-inventory",
  "GT13-dry-run-build-publication-self-release",
  "GT14-tree-shaking-and-packed-bytes"
])

const staticIssues = (
  gate: GateRequirement,
  manifest: ArchitectureCandidateManifestV2,
  inventory: CandidateTreeInventory,
  invalidVersionStateCount: number | null,
  observedPackedByteCount: number | null,
  representableInvalidStateCount: number | null,
  observedMachineInterpreterProductLines: number | null,
  mainPathOwnerHops: number | null,
  difficultPathOwnerHops: number | null,
  sourceBudgetAuthority: MachineSourceBudgetAuthority | null
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  if (!gate.hard || gate.expectedExit !== 0 || gate.credentials || gate.networkAccess ||
    gate.mutatesExternalState || gate.onFailure !== "RejectCandidate") {
    issues.push("gate.runner-declaration-not-fail-closed")
  }
  if (gate.scope !== manifest.scope) issues.push("gate.runner-scope-mismatch")
  if (manifest.files.length !== inventory.entries.length) {
    issues.push("gate.runner-manifest-inventory-mismatch")
  }
  if (gate.id === "GT08-exact-runtime-declaration-surface" &&
    manifest.publicSurfaceIds.length === 0) {
    issues.push("gate.runner-public-surface-empty")
  }
  if ((gate.id === "GM02-law-and-owner-invariants" ||
    gate.id === "GT10-exact-static-type-dynamic-manifest-graph" ||
    gate.id === "GT11-no-cycle-sibling-reversal-or-host-edge") && graphHasCycle(manifest)) {
    issues.push("gate.runner-dependency-cycle")
  }
  if ((gate.id === "GM02-law-and-owner-invariants" ||
    gate.id === "GT10-exact-static-type-dynamic-manifest-graph" ||
    gate.id === "GT11-no-cycle-sibling-reversal-or-host-edge") &&
    hasMachineToProviderDependency(manifest)) {
    issues.push("gate.runner-machine-provider-dependency")
  }
  if (gate.id === "GT12-version-skew-partial-publication" &&
    invalidVersionStateCount === null) {
    issues.push("gate.runner-invalid-version-states-unavailable")
  }
  if (packedGateIds.has(gate.id) &&
    (observedPackedByteCount === null || observedPackedByteCount === 0)) {
    issues.push("gate.runner-delivery-bundle-unavailable")
  }
  if (gate.id === "GM05-machine-source-budget") {
    if (observedMachineInterpreterProductLines === null) {
      issues.push("gate.runner-machine-source-unavailable")
    }
    if (sourceBudgetAuthority === null) {
      issues.push("gate.runner-source-budget-denominator-unavailable")
    } else if (observedMachineInterpreterProductLines !== null &&
      observedMachineInterpreterProductLines * sourceBudgetAuthority.denominator >
        sourceBudgetAuthority.referenceProductLines * sourceBudgetAuthority.numerator) {
      issues.push("gate.runner-machine-source-budget-exceeded")
    }
  }
  if (gate.id === "GM08-metric-and-readability-completeness") {
    if (representableInvalidStateCount === null) {
      issues.push("gate.runner-representable-invalid-states-unavailable")
    }
    if (observedMachineInterpreterProductLines === null) {
      issues.push("gate.runner-machine-source-unavailable")
    }
    if (mainPathOwnerHops === null) {
      issues.push("gate.runner-main-path-owner-hops-unavailable")
    }
    if (difficultPathOwnerHops === null) {
      issues.push("gate.runner-difficult-path-owner-hops-unavailable")
    }
  }
  return issues
}

export const inspectGateCandidate = Effect.fn("TrialGateContract.inspectGateCandidate")(
  function* (input: {
    readonly gate: GateRequirement
    readonly candidateId: string
    readonly candidateTreeSha256: string
    readonly inspectionRoot: string
    readonly sourceBudgetAuthority?: MachineSourceBudgetAuthority | null
  }) {
    const observed = yield* Effect.result(Effect.gen(function* () {
      const manifest = yield* decodeManifestAt(input.inspectionRoot)
      const inventory = yield* inventoryCandidateTree(input.inspectionRoot, manifest)
      const invalidVersionStateCount = input.gate.id === "GT12-version-skew-partial-publication"
        ? yield* exportedStringArrayCount(
            input.inspectionRoot,
            manifest,
            inventory,
            "INVALID_VERSION_STATES"
          )
        : null
      const representableInvalidStateCount =
        input.gate.id === "GM08-metric-and-readability-completeness"
          ? yield* exportedStringArrayCount(
              input.inspectionRoot,
              manifest,
              inventory,
              "FORBIDDEN_TRANSITIONS"
            )
          : null
      const observedMachineInterpreterProductLines =
        input.gate.id === "GM05-machine-source-budget" ||
          input.gate.id === "GM08-metric-and-readability-completeness"
          ? yield* machineInterpreterProductLines(input.inspectionRoot, manifest, inventory)
          : null
      const mainPathOwnerHops = input.gate.id === "GM08-metric-and-readability-completeness"
        ? ownerHops(manifest, "concept.main-path")
        : null
      const difficultPathOwnerHops = input.gate.id === "GM08-metric-and-readability-completeness"
        ? ownerHops(manifest, "concept.difficult-path")
        : null
      const observedPackedByteCount = packedGateIds.has(input.gate.id)
        ? packedByteCount(manifest, inventory)
        : null
      return {
        manifest,
        inventory,
        difficultPathOwnerHops,
        invalidVersionStateCount,
        mainPathOwnerHops,
        observedMachineInterpreterProductLines,
        observedPackedByteCount,
        representableInvalidStateCount
      }
    }))
    if (observed._tag === "Failure") {
      return yield* new TrialGateContractError(canonicalFailureIds([
        "gate.runner-inspection-failed"
      ]))
    }
    const {
      manifest,
      inventory,
      difficultPathOwnerHops,
      invalidVersionStateCount,
      mainPathOwnerHops,
      observedMachineInterpreterProductLines,
      observedPackedByteCount,
      representableInvalidStateCount
    } = observed.success
    const issues = [
      ...(manifest.candidateId === input.candidateId ? [] : ["gate.runner-candidate-mismatch"]),
      ...(inventory.treeSha256 === input.candidateTreeSha256
        ? []
        : ["gate.runner-tree-mismatch"]),
      ...staticIssues(
        input.gate,
        manifest,
        inventory,
        invalidVersionStateCount,
        observedPackedByteCount,
        representableInvalidStateCount,
        observedMachineInterpreterProductLines,
        mainPathOwnerHops,
        difficultPathOwnerHops,
        input.sourceBudgetAuthority ?? null
      )
    ]
    if (issues.length > 0) {
      return yield* new TrialGateContractError(canonicalFailureIds(issues))
    }
    return {
      manifest,
      inventory,
      difficultPathOwnerHops,
      invalidVersionStateCount,
      machineInterpreterProductLines: observedMachineInterpreterProductLines,
      mainPathOwnerHops,
      packedByteCount: input.gate.id === "GT14-tree-shaking-and-packed-bytes"
        ? observedPackedByteCount
        : null,
      representableInvalidStateCount,
      sourceBudgetAuthority: input.gate.id === "GM05-machine-source-budget"
        ? input.sourceBudgetAuthority ?? null
        : null,
      staticCheckCount: 5 + (input.gate.scope === "topology" ? 1 : 0)
    } satisfies TrialGateInspection
  }
)

export const invocationMatchesGate = (
  invocation: ArchitectureGateInvocationV2,
  gate: GateRequirement
): boolean => invocation.gateId === gate.id &&
  exactOrdered(invocation.lawIds, gate.lawIds) &&
  exactOrdered(invocation.caseIds, gate.caseIds) &&
  exactOrdered(invocation.probeIds, gate.probeIds)

export const trialGateInspectionFacts = (
  inspection: TrialGateInspection
): [EvidenceEntryV2, ...Array<EvidenceEntryV2>] => {
  const values: Array<{
    readonly name: string
    readonly value: IntegerEvidenceValueV2 | Sha256EvidenceValueV2
  }> = [
    {
      name: "runner.candidate-file-count",
      value: new IntegerEvidenceValueV2({ value: inspection.inventory.entries.length })
    },
    {
      name: "runner.candidate-tree-sha256",
      value: new Sha256EvidenceValueV2({ value: inspection.inventory.treeSha256 })
    },
    ...(inspection.difficultPathOwnerHops === null ? [] : [{
      name: "runner.difficult-path-owner-hops",
      value: new IntegerEvidenceValueV2({ value: inspection.difficultPathOwnerHops })
    }]),
    {
      name: "runner.gate-check-count",
      value: new IntegerEvidenceValueV2({ value: inspection.staticCheckCount })
    },
    ...(inspection.invalidVersionStateCount === null ? [] : [{
      name: "runner.invalid-version-state-count",
      value: new IntegerEvidenceValueV2({ value: inspection.invalidVersionStateCount })
    }]),
    ...(inspection.machineInterpreterProductLines === null ? [] : [{
      name: "runner.machine-interpreter-product-lines",
      value: new IntegerEvidenceValueV2({ value: inspection.machineInterpreterProductLines })
    }]),
    ...(inspection.mainPathOwnerHops === null ? [] : [{
      name: "runner.main-path-owner-hops",
      value: new IntegerEvidenceValueV2({ value: inspection.mainPathOwnerHops })
    }]),
    {
      name: "runner.manifest-file-count",
      value: new IntegerEvidenceValueV2({ value: inspection.manifest.files.length })
    },
    ...(inspection.packedByteCount === null ? [] : [{
      name: "runner.packed-byte-count",
      value: new IntegerEvidenceValueV2({ value: inspection.packedByteCount })
    }]),
    ...(inspection.representableInvalidStateCount === null ? [] : [{
      name: "runner.representable-invalid-state-count",
      value: new IntegerEvidenceValueV2({ value: inspection.representableInvalidStateCount })
    }]),
    ...(inspection.sourceBudgetAuthority === null ? [] : [
      {
        name: "runner.source-budget-denominator",
        value: new IntegerEvidenceValueV2({ value: inspection.sourceBudgetAuthority.denominator })
      },
      {
        name: "runner.source-budget-numerator",
        value: new IntegerEvidenceValueV2({ value: inspection.sourceBudgetAuthority.numerator })
      },
      {
        name: "runner.source-budget-reference-lines",
        value: new IntegerEvidenceValueV2({
          value: inspection.sourceBudgetAuthority.referenceProductLines
        })
      }
    ])
  ]
  values.sort((left, right) => codePointCompare(left.name, right.name))
  return values.map((entry, index) => new EvidenceEntryV2({
    sequence: index + 1,
    name: EvidenceName.make(entry.name),
    value: entry.value
  })) as [EvidenceEntryV2, ...Array<EvidenceEntryV2>]
}
