import { readFile, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { Context, Effect, Layer, Schema } from "effect"
import {
  canonicalJsonBytes,
  parseCanonicalJsonBytes,
  parseStrictJson
} from "./canonical-document.js"
import {
  type ArchitectureCandidateManifestV2,
  decodeCandidateManifest,
  encodeCandidateManifest
} from "./schema/candidate-manifest.js"
import {
  type ArchitectureTrialSpecV2,
  decodeArchitectureTrialSpec,
  encodeArchitectureTrialSpec,
  gateDefinitionSha256
} from "./schema/trial-spec.js"
import {
  makeTrialRunContext,
  type TrialRunContextToolchain,
  type TrialRunContextV2
} from "./schema/run-context.js"
import type { Sha256Hex } from "./schema/primitives.js"
import {
  V2CandidateId,
  type V2CandidateId as V2CandidateIdType
} from "./schema/v2-ids.js"
import type { TrialResultPreflightAuthority } from "./schema/trial-result.js"
import {
  checkInputs,
  trialSpecInputPath
} from "./check-inputs.js"
import {
  makeSourceCoordinateGitAuthority,
  type SourceCoordinateGitAuthority
} from "./check-source-coordinate.js"
import {
  type CandidateTreeInventory,
  inventoryCandidateTree,
  inventoryCanonicalTree
} from "./trial-inventory.js"
import {
  TrialToolchain,
  type ResolvedTrialToolchain,
  type TrialToolchainService
} from "./trial-toolchain.js"
import { hashCanonicalDocumentBytes, sha256Bytes } from "./trial-hash.js"
import { computeTrialRunnerSourceClosureSha256 } from "./trial-runner-source-closure.js"
import {
  inventoryRuntimeDependencyTree,
  type ObservedRuntimeDependencyTree
} from "./trial-runtime-dependency-tree.js"

const architectureProgramPath = "tools/architecture-program"
const candidateManifestFileName = "trial-candidate.json"
const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeCandidateId = Schema.decodeUnknownEffect(V2CandidateId, strictOptions)

export type TrialRunnerCandidateDefinition =
  | ArchitectureTrialSpecV2["machineCandidates"][number]
  | ArchitectureTrialSpecV2["topologyCandidates"][number]

export interface TrialRunnerPreflightCheckedInputs {
  readonly trialSpec: ArchitectureTrialSpecV2
}

export interface TrialRunnerPreflightFileProbe {
  readonly read: (path: string) => Effect.Effect<Uint8Array, unknown, never>
  readonly realpath: (path: string) => Effect.Effect<string, unknown, never>
}

export interface TrialRunnerPreflightInventoryProbe {
  readonly candidate: (
    root: string,
    manifest: ArchitectureCandidateManifestV2
  ) => Effect.Effect<CandidateTreeInventory, unknown, never>
  readonly canonical: (root: string) => Effect.Effect<CandidateTreeInventory, unknown, never>
  readonly runtimeDependencies: (
    root: string
  ) => Effect.Effect<ObservedRuntimeDependencyTree, unknown, never>
}

export interface TrialRunnerPreflightDependencies {
  readonly files: TrialRunnerPreflightFileProbe
  readonly checkInputs: (
    repositoryRoot: string,
    gitAuthority: SourceCoordinateGitAuthority
  ) => Effect.Effect<TrialRunnerPreflightCheckedInputs, unknown, never>
  readonly inventory: TrialRunnerPreflightInventoryProbe
  readonly toolchain: TrialToolchainService
}

export class TrialRunnerPreflightError extends Schema.TaggedError<TrialRunnerPreflightError>()(
  "TrialRunnerPreflightError",
  {
    operation: Schema.String,
    path: Schema.String,
    reason: Schema.String,
    message: Schema.String
  }
) {
  constructor(operation: string, path: string, reason: string) {
    super({
      operation,
      path,
      reason,
      message: `Architecture trial runner preflight ${operation} failed for ${path}: ${reason}`
    })
  }
}

export interface PreparedTrialRun {
  readonly repositoryRoot: string
  readonly architectureProgramRoot: string
  readonly trialSpecPath: string
  readonly rawTrialSpecBytes: Uint8Array
  readonly rawTrialSpecSha256: Sha256Hex
  readonly trialSpec: ArchitectureTrialSpecV2
  readonly candidateDefinition: TrialRunnerCandidateDefinition
  readonly candidateRoot: string
  readonly candidateManifestPath: string
  readonly rawCandidateManifestBytes: Uint8Array
  readonly rawCandidateManifestSha256: Sha256Hex
  readonly candidateManifest: ArchitectureCandidateManifestV2
  readonly candidateTreeInventory: CandidateTreeInventory
  readonly runnerSourceRoot: string
  readonly runnerSourceInventory: CandidateTreeInventory
  readonly runnerPackageManifestPath: string
  readonly rawRunnerPackageManifestBytes: Uint8Array
  readonly runnerPackageManifestSha256: Sha256Hex
  readonly runnerTypeScriptConfigPath: string
  readonly rawRunnerTypeScriptConfigBytes: Uint8Array
  readonly runnerTypeScriptConfigSha256: Sha256Hex
  readonly runnerNodeModulesRoot: string
  readonly runnerNodeModulesTree: ObservedRuntimeDependencyTree
  readonly resolvedToolchain: ResolvedTrialToolchain
  readonly toolchain: TrialRunContextToolchain
  readonly runContext: TrialRunContextV2
  readonly validationAuthority: TrialResultPreflightAuthority
}

export interface TrialRunnerPreflightService {
  readonly prepare: (
    repositoryRoot: string,
    candidateId: V2CandidateIdType
  ) => Effect.Effect<PreparedTrialRun, TrialRunnerPreflightError, never>
}

const liveFiles: TrialRunnerPreflightFileProbe = {
  read: (path) => Effect.tryPromise(() => readFile(path)),
  realpath: (path) => Effect.tryPromise(() => realpath(path))
}

const liveDependencies: TrialRunnerPreflightDependencies = {
  files: liveFiles,
  checkInputs,
  inventory: {
    candidate: inventoryCandidateTree,
    canonical: inventoryCanonicalTree,
    runtimeDependencies: inventoryRuntimeDependencyTree
  },
  toolchain: {
    discover: (programRoot) => Effect.gen(function* () {
      const service = yield* TrialToolchain
      return yield* service.discover(programRoot)
    }).pipe(Effect.provide(TrialToolchain.layer)),
    discoverResolved: (programRoot) => Effect.gen(function* () {
      const service = yield* TrialToolchain
      return yield* service.discoverResolved(programRoot)
    }).pipe(Effect.provide(TrialToolchain.layer))
  }
}

const causeMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const dependencyEffect = <A>(
  operation: string,
  path: string,
  evaluate: () => Effect.Effect<A, unknown, never>
): Effect.Effect<A, TrialRunnerPreflightError, never> => Effect.try({
  try: evaluate,
  catch: (cause) => new TrialRunnerPreflightError(operation, path, causeMessage(cause))
}).pipe(
  Effect.flatMap((effect) => effect.pipe(Effect.mapError((cause) =>
    new TrialRunnerPreflightError(operation, path, causeMessage(cause)))))
)

const syncEffect = <A>(
  operation: string,
  path: string,
  evaluate: () => A
): Effect.Effect<A, TrialRunnerPreflightError, never> => Effect.try({
  try: evaluate,
  catch: (cause) => new TrialRunnerPreflightError(operation, path, causeMessage(cause))
})

const validateRepositoryRoot = (
  value: unknown
): Effect.Effect<string, TrialRunnerPreflightError, never> => {
  if (typeof value !== "string" || value.length === 0) {
    return Effect.fail(new TrialRunnerPreflightError(
      "validate repository root",
      String(value),
      "repositoryRoot must be a nonempty string"
    ))
  }
  if (!value.isWellFormed() || value !== value.normalize("NFC") || value.includes("\u0000")) {
    return Effect.fail(new TrialRunnerPreflightError(
      "validate repository root",
      value,
      "repositoryRoot must be well-formed NFC text without NUL"
    ))
  }
  return Effect.succeed(resolve(value))
}

const isContainedPath = (root: string, target: string): boolean => {
  const fromRoot = relative(root, target)
  return fromRoot === "" || (
    fromRoot !== ".." &&
    !fromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(fromRoot)
  )
}

const resolveExactRepositoryPath = Effect.fn("TrialRunnerPreflight.resolveExactRepositoryPath")(
  function* (
    dependencies: TrialRunnerPreflightDependencies,
    repositoryRoot: string,
    repositoryPath: string,
    operation: string
  ) {
    const lexicalPath = resolve(repositoryRoot, repositoryPath)
    if (!isContainedPath(repositoryRoot, lexicalPath)) {
      return yield* new TrialRunnerPreflightError(
        operation,
        repositoryPath,
        "lexical path escapes the repository root"
      )
    }
    const exactPath = yield* dependencyEffect(
      operation,
      lexicalPath,
      () => dependencies.files.realpath(lexicalPath)
    )
    if (!isAbsolute(exactPath)) {
      return yield* new TrialRunnerPreflightError(
        operation,
        lexicalPath,
        "realpath probe did not return an absolute path"
      )
    }
    const normalizedExactPath = resolve(exactPath)
    if (!isContainedPath(repositoryRoot, normalizedExactPath)) {
      return yield* new TrialRunnerPreflightError(
        operation,
        lexicalPath,
        `resolved path escapes the repository root (${normalizedExactPath})`
      )
    }
    if (normalizedExactPath !== lexicalPath) {
      return yield* new TrialRunnerPreflightError(
        operation,
        lexicalPath,
        `path traverses a symbolic link or alias (${normalizedExactPath})`
      )
    }
    return normalizedExactPath
  }
)

const exactBytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const validateRunnerPackageGateScripts = (
  bytes: Uint8Array,
  path: string
): Effect.Effect<void, TrialRunnerPreflightError> => syncEffect(
  "validate runner package gate scripts",
  path,
  () => {
    const document = parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    if (typeof document !== "object" || document === null || Array.isArray(document)) {
      throw new Error("package manifest must be a JSON object")
    }
    const scripts = (document as Readonly<Record<string, unknown>>)["scripts"]
    if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts)) {
      throw new Error("package manifest must define a scripts object")
    }
    const scriptRecord = scripts as Readonly<Record<string, unknown>>
    for (const id of ["gate:machine", "gate:topology"] as const) {
      const script = scriptRecord[id]
      if (script !== "false") {
        throw new Error(`package manifest ${id} must equal the frozen fail-closed script false`)
      }
    }
  }
)

const validateToolchainPackageManifestBinding = (
  tool: "typescript" | "effect",
  runnerNodeModulesRoot: string,
  runnerNodeModulesTree: ObservedRuntimeDependencyTree,
  binding: ResolvedTrialToolchain["packageManifests"]["typescript"]
): Effect.Effect<void, TrialRunnerPreflightError> => {
  const relativePath = `${tool}/package.json`
  const expectedPath = resolve(runnerNodeModulesRoot, relativePath)
  if (binding.path !== expectedPath) {
    return Effect.fail(new TrialRunnerPreflightError(
      `bind ${tool} package manifest`,
      binding.path,
      `toolchain package path must equal ${expectedPath}`
    ))
  }
  const entry = runnerNodeModulesTree.inventory.entries.find(
    (candidate) => candidate.path === relativePath
  )
  if (entry === undefined || entry._tag !== "RegularFile" ||
    entry.bytesSha256 !== binding.sha256) {
    return Effect.fail(new TrialRunnerPreflightError(
      `bind ${tool} package manifest`,
      binding.path,
      entry === undefined
        ? "runtime dependency tree omitted the package manifest"
        : entry._tag !== "RegularFile"
        ? "runtime dependency tree package manifest is not a regular file"
        : `runtime dependency hash ${entry.bytesSha256} does not equal toolchain hash ${binding.sha256}`
    ))
  }
  return Effect.void
}

const readCanonicalTrialSpec = Effect.fn("TrialRunnerPreflight.readCanonicalTrialSpec")(
  function* (
    dependencies: TrialRunnerPreflightDependencies,
    repositoryRoot: string,
    checked: TrialRunnerPreflightCheckedInputs
  ) {
    if (typeof checked !== "object" || checked === null || !("trialSpec" in checked)) {
      return yield* new TrialRunnerPreflightError(
        "check architecture inputs",
        repositoryRoot,
        "input checker returned no decoded trialSpec"
      )
    }
    const trialSpecPath = yield* resolveExactRepositoryPath(
      dependencies,
      repositoryRoot,
      trialSpecInputPath,
      "resolve canonical trial specification"
    )
    const rawBytes = yield* dependencyEffect(
      "read canonical trial specification",
      trialSpecPath,
      () => dependencies.files.read(trialSpecPath)
    )
    if (!(rawBytes instanceof Uint8Array)) {
      return yield* new TrialRunnerPreflightError(
        "read canonical trial specification",
        trialSpecPath,
        "file probe did not return bytes"
      )
    }
    const stableBytes = new Uint8Array(rawBytes)
    const parsed = yield* syncEffect(
      "parse canonical trial specification",
      trialSpecPath,
      () => parseCanonicalJsonBytes(stableBytes)
    )
    const trialSpec = yield* decodeArchitectureTrialSpec(parsed).pipe(Effect.mapError((cause) =>
      new TrialRunnerPreflightError(
        "strict-decode canonical trial specification",
        trialSpecPath,
        causeMessage(cause)
      )))
    const checkedBytes = yield* syncEffect(
      "bind checked trial specification",
      trialSpecPath,
      () => canonicalJsonBytes(encodeArchitectureTrialSpec(checked.trialSpec))
    )
    if (!exactBytesEqual(stableBytes, checkedBytes)) {
      return yield* new TrialRunnerPreflightError(
        "bind checked trial specification",
        trialSpecPath,
        "canonical document bytes do not equal the specification accepted by checkInputs"
      )
    }
    const rawTrialSpecSha256 = yield* syncEffect(
      "hash canonical trial specification",
      trialSpecPath,
      () => hashCanonicalDocumentBytes(stableBytes)
    )
    return { trialSpecPath, rawBytes: stableBytes, rawTrialSpecSha256, trialSpec }
  }
)

const findCandidateDefinition = (
  spec: ArchitectureTrialSpecV2,
  candidateId: V2CandidateIdType
): {
  readonly definition: TrialRunnerCandidateDefinition
  readonly scope: "machine" | "topology"
} | undefined => {
  const machine = spec.machineCandidates.find(({ id }) => id === candidateId)
  if (machine !== undefined) return { definition: machine, scope: "machine" }
  const topology = spec.topologyCandidates.find(({ id }) => id === candidateId)
  return topology === undefined ? undefined : { definition: topology, scope: "topology" }
}

const readCandidateManifest = Effect.fn("TrialRunnerPreflight.readCandidateManifest")(
  function* (
    dependencies: TrialRunnerPreflightDependencies,
    candidateRoot: string,
    candidateId: V2CandidateIdType,
    scope: "machine" | "topology",
    definition: TrialRunnerCandidateDefinition
  ) {
    const candidateManifestPath = resolve(candidateRoot, candidateManifestFileName)
    const realManifestPath = yield* dependencyEffect(
      "resolve candidate manifest",
      candidateManifestPath,
      () => dependencies.files.realpath(candidateManifestPath)
    )
    if (!isAbsolute(realManifestPath)) {
      return yield* new TrialRunnerPreflightError(
        "resolve candidate manifest",
        candidateManifestPath,
        "realpath probe did not return an absolute path"
      )
    }
    const normalizedManifestPath = resolve(realManifestPath)
    if (!isContainedPath(candidateRoot, normalizedManifestPath)) {
      return yield* new TrialRunnerPreflightError(
        "resolve candidate manifest",
        candidateManifestPath,
        `resolved path escapes the candidate root (${normalizedManifestPath})`
      )
    }
    if (normalizedManifestPath !== candidateManifestPath) {
      return yield* new TrialRunnerPreflightError(
        "resolve candidate manifest",
        candidateManifestPath,
        `path traverses a symbolic link or alias (${normalizedManifestPath})`
      )
    }
    const rawBytes = yield* dependencyEffect(
      "read candidate manifest",
      candidateManifestPath,
      () => dependencies.files.read(candidateManifestPath)
    )
    if (!(rawBytes instanceof Uint8Array)) {
      return yield* new TrialRunnerPreflightError(
        "read candidate manifest",
        candidateManifestPath,
        "file probe did not return bytes"
      )
    }
    const stableBytes = new Uint8Array(rawBytes)
    const parsed = yield* syncEffect(
      "parse canonical candidate manifest",
      candidateManifestPath,
      () => parseCanonicalJsonBytes(stableBytes)
    )
    const manifest = yield* decodeCandidateManifest(parsed).pipe(Effect.mapError((cause) =>
      new TrialRunnerPreflightError(
        "strict-decode candidate manifest",
        candidateManifestPath,
        causeMessage(cause)
      )))
    const encodedManifest = yield* syncEffect(
      "bind canonical candidate manifest",
      candidateManifestPath,
      () => canonicalJsonBytes(encodeCandidateManifest(manifest))
    )
    if (!exactBytesEqual(stableBytes, encodedManifest)) {
      return yield* new TrialRunnerPreflightError(
        "bind canonical candidate manifest",
        candidateManifestPath,
        "schema encoding changed the canonical manifest bytes"
      )
    }
    const expectedIdentity = {
      candidateId,
      scope,
      model: definition.model,
      implementationRoot: definition.implementationRoot
    }
    for (const field of ["candidateId", "scope", "model", "implementationRoot"] as const) {
      if (manifest[field] !== expectedIdentity[field]) {
        return yield* new TrialRunnerPreflightError(
          "validate candidate manifest identity",
          candidateManifestPath,
          `${field} must equal ${JSON.stringify(expectedIdentity[field])}, received ` +
            JSON.stringify(manifest[field])
        )
      }
    }
    const rawCandidateManifestSha256 = yield* syncEffect(
      "hash candidate manifest",
      candidateManifestPath,
      () => hashCanonicalDocumentBytes(stableBytes)
    )
    return {
      candidateManifestPath,
      rawBytes: stableBytes,
      rawCandidateManifestSha256,
      manifest
    }
  }
)

const makeContext = Effect.fn("TrialRunnerPreflight.makeRunContext")(
  function* (
    trialSpec: ArchitectureTrialSpecV2,
    rawTrialSpecSha256: Sha256Hex,
    candidateId: V2CandidateIdType,
    scope: "machine" | "topology",
    definition: TrialRunnerCandidateDefinition,
    rawCandidateManifestSha256: Sha256Hex,
    candidateTreeInventory: CandidateTreeInventory,
    runnerSourceSha256: Sha256Hex,
    runnerNodeModulesSha256: Sha256Hex,
    toolchain: TrialRunContextToolchain
  ) {
    return yield* syncEffect("construct run context", candidateId, () => makeTrialRunContext({
      schemaVersion: "ts-release/architecture-trial-run-context/v2",
      trialSpecSha256: rawTrialSpecSha256,
      executionContractSha256: trialSpec.executionContract.contractSha256,
      measurementContractSha256: trialSpec.measurementContract.contractSha256,
      topologyFixtureSha256: trialSpec.topologyFixture.fixtureSha256,
      candidateId,
      candidateScope: scope,
      candidateModel: definition.model,
      implementationRoot: definition.implementationRoot,
      candidateManifestSha256: rawCandidateManifestSha256,
      candidateTreeSha256: candidateTreeInventory.treeSha256,
      runnerSourceSha256,
      runnerNodeModulesSha256,
      toolchain,
      caseDefinitionBindings: trialSpec.machineCases.map((machineCase) => ({
        caseId: machineCase.id,
        definitionSha256: machineCase.execution.definitionSha256,
        fixtureSha256: machineCase.execution.fixtureSha256,
        expectedEvidenceSha256: machineCase.execution.expectedEvidenceSha256
      })),
      probeDefinitionBindings: trialSpec.marginalProbes.map((probe) => ({
        probeId: probe.id,
        definitionSha256: probe.execution.definitionSha256,
        baseFixtureSha256: probe.execution.baseFixtureSha256,
        changeDefinitionSha256: probe.execution.changeDefinitionSha256
      })),
      gateDefinitionBindings: trialSpec.gateRequirements
        .filter(({ scope: gateScope }) => gateScope === scope)
        .map((gate) => ({
          gateId: gate.id,
          definitionSha256: gateDefinitionSha256(gate)
        }))
    }))
  }
)

export const makeTrialRunnerPreflight = (
  dependencies: TrialRunnerPreflightDependencies = liveDependencies
): TrialRunnerPreflightService => {
  const prepare = Effect.fn("TrialRunnerPreflight.prepare")(function* (
    repositoryRootInput: string,
    candidateIdInput: V2CandidateIdType
  ) {
    const candidateId = yield* decodeCandidateId(candidateIdInput).pipe(Effect.mapError((cause) =>
      new TrialRunnerPreflightError("validate candidate id", String(candidateIdInput), causeMessage(cause))))
    const lexicalRepositoryRoot = yield* validateRepositoryRoot(repositoryRootInput)
    const repositoryRoot = yield* dependencyEffect(
      "resolve repository root",
      lexicalRepositoryRoot,
      () => dependencies.files.realpath(lexicalRepositoryRoot)
    )
    if (!isAbsolute(repositoryRoot)) {
      return yield* new TrialRunnerPreflightError(
        "resolve repository root",
        lexicalRepositoryRoot,
        "realpath probe did not return an absolute path"
      )
    }
    const exactRepositoryRoot = resolve(repositoryRoot)
    const architectureProgramRoot = yield* resolveExactRepositoryPath(
      dependencies,
      exactRepositoryRoot,
      architectureProgramPath,
      "resolve architecture program root"
    )
    const resolvedToolchain = yield* dependencyEffect(
      "discover external toolchain",
      architectureProgramRoot,
      () => dependencies.toolchain.discoverResolved(architectureProgramRoot)
    )
    const sourceCoordinateGitAuthority = makeSourceCoordinateGitAuthority(
      resolvedToolchain.gitExecutablePath,
      resolvedToolchain.context.gitExecutableSha256
    )
    const checked = yield* dependencyEffect(
      "check architecture inputs",
      exactRepositoryRoot,
      () => dependencies.checkInputs(exactRepositoryRoot, sourceCoordinateGitAuthority)
    )
    const canonicalSpec = yield* readCanonicalTrialSpec(dependencies, exactRepositoryRoot, checked)
    const candidate = findCandidateDefinition(canonicalSpec.trialSpec, candidateId)
    if (candidate === undefined) {
      return yield* new TrialRunnerPreflightError(
        "resolve candidate definition",
        candidateId,
        "candidate is absent from the checked canonical trial specification"
      )
    }
    const candidateRoot = yield* resolveExactRepositoryPath(
      dependencies,
      exactRepositoryRoot,
      candidate.definition.implementationRoot,
      "resolve candidate implementation root"
    )
    const manifestDocument = yield* readCandidateManifest(
      dependencies,
      candidateRoot,
      candidateId,
      candidate.scope,
      candidate.definition
    )
    const runnerSourceRoot = yield* resolveExactRepositoryPath(
      dependencies,
      exactRepositoryRoot,
      canonicalSpec.trialSpec.receiptContract.runnerSourceRoot,
      "resolve runner source root"
    )
    const runnerPackageManifestPath = yield* resolveExactRepositoryPath(
      dependencies,
      exactRepositoryRoot,
      canonicalSpec.trialSpec.receiptContract.runnerPackageManifestPath,
      "resolve runner package manifest"
    )
    const runnerTypeScriptConfigPath = yield* resolveExactRepositoryPath(
      dependencies,
      exactRepositoryRoot,
      canonicalSpec.trialSpec.receiptContract.runnerTypeScriptConfigPath,
      "resolve runner TypeScript configuration"
    )
    const runnerNodeModulesRoot = yield* resolveExactRepositoryPath(
      dependencies,
      exactRepositoryRoot,
      `${architectureProgramPath}/node_modules`,
      "resolve runner node_modules root"
    )
    const candidateTreeInventory = yield* dependencyEffect(
      "inventory candidate tree",
      candidateRoot,
      () => dependencies.inventory.candidate(candidateRoot, manifestDocument.manifest)
    )
    const observedManifest = candidateTreeInventory.entries.find(
      ({ path }) => path === candidateManifestFileName
    )
    if (observedManifest === undefined ||
      observedManifest.sha256 !== manifestDocument.rawCandidateManifestSha256) {
      return yield* new TrialRunnerPreflightError(
        "bind candidate manifest to candidate tree",
        manifestDocument.candidateManifestPath,
        observedManifest === undefined
          ? "candidate tree inventory omitted trial-candidate.json"
          : `inventory hash ${observedManifest.sha256} does not equal the accepted manifest hash ` +
            manifestDocument.rawCandidateManifestSha256
      )
    }
    const runnerSourceInventory = yield* dependencyEffect(
      "inventory runner source tree",
      runnerSourceRoot,
      () => dependencies.inventory.canonical(runnerSourceRoot)
    )
    const rawRunnerPackageManifest = yield* dependencyEffect(
      "read runner package manifest",
      runnerPackageManifestPath,
      () => dependencies.files.read(runnerPackageManifestPath)
    )
    if (!(rawRunnerPackageManifest instanceof Uint8Array)) {
      return yield* new TrialRunnerPreflightError(
        "read runner package manifest",
        runnerPackageManifestPath,
        "file probe returned a non-Uint8Array value"
      )
    }
    const rawRunnerPackageManifestBytes = new Uint8Array(rawRunnerPackageManifest)
    yield* validateRunnerPackageGateScripts(
      rawRunnerPackageManifestBytes,
      runnerPackageManifestPath
    )
    const runnerPackageManifestSha256 = sha256Bytes(rawRunnerPackageManifestBytes)
    const rawRunnerTypeScriptConfig = yield* dependencyEffect(
      "read runner TypeScript configuration",
      runnerTypeScriptConfigPath,
      () => dependencies.files.read(runnerTypeScriptConfigPath)
    )
    if (!(rawRunnerTypeScriptConfig instanceof Uint8Array)) {
      return yield* new TrialRunnerPreflightError(
        "read runner TypeScript configuration",
        runnerTypeScriptConfigPath,
        "file probe returned a non-Uint8Array value"
      )
    }
    const rawRunnerTypeScriptConfigBytes = new Uint8Array(rawRunnerTypeScriptConfig)
    const runnerTypeScriptConfigSha256 = sha256Bytes(rawRunnerTypeScriptConfigBytes)
    const runnerSourceSha256 = computeTrialRunnerSourceClosureSha256(
      runnerSourceInventory.treeSha256,
      runnerPackageManifestSha256,
      runnerTypeScriptConfigSha256
    )
    const runnerNodeModulesTree = yield* dependencyEffect(
      "inventory runner runtime dependency tree",
      runnerNodeModulesRoot,
      () => dependencies.inventory.runtimeDependencies(runnerNodeModulesRoot)
    )
    if (runnerNodeModulesTree.root.root !== runnerNodeModulesRoot ||
      runnerNodeModulesTree.root.realPath !== runnerNodeModulesRoot) {
      return yield* new TrialRunnerPreflightError(
        "bind runner runtime dependency root",
        runnerNodeModulesRoot,
        "runtime dependency inventory did not retain the exact resolved node_modules root"
      )
    }
    yield* validateToolchainPackageManifestBinding(
      "typescript",
      runnerNodeModulesRoot,
      runnerNodeModulesTree,
      resolvedToolchain.packageManifests.typescript
    )
    yield* validateToolchainPackageManifestBinding(
      "effect",
      runnerNodeModulesRoot,
      runnerNodeModulesTree,
      resolvedToolchain.packageManifests.effect
    )
    const toolchain = resolvedToolchain.context
    const runContext = yield* makeContext(
      canonicalSpec.trialSpec,
      canonicalSpec.rawTrialSpecSha256,
      candidateId,
      candidate.scope,
      candidate.definition,
      manifestDocument.rawCandidateManifestSha256,
      candidateTreeInventory,
      runnerSourceSha256,
      runnerNodeModulesTree.inventory.treeSha256,
      toolchain
    )
    const validationAuthority: TrialResultPreflightAuthority = {
      trialSpec: canonicalSpec.trialSpec,
      rawTrialSpecSha256: canonicalSpec.rawTrialSpecSha256,
      candidateManifest: manifestDocument.manifest,
      rawCandidateManifestSha256: manifestDocument.rawCandidateManifestSha256,
      candidateTreeSha256: candidateTreeInventory.treeSha256,
      runnerSourceSha256,
      runnerNodeModulesSha256: runnerNodeModulesTree.inventory.treeSha256,
      toolchain
    }
    return {
      repositoryRoot: exactRepositoryRoot,
      architectureProgramRoot,
      trialSpecPath: canonicalSpec.trialSpecPath,
      rawTrialSpecBytes: canonicalSpec.rawBytes,
      rawTrialSpecSha256: canonicalSpec.rawTrialSpecSha256,
      trialSpec: canonicalSpec.trialSpec,
      candidateDefinition: candidate.definition,
      candidateRoot,
      candidateManifestPath: manifestDocument.candidateManifestPath,
      rawCandidateManifestBytes: manifestDocument.rawBytes,
      rawCandidateManifestSha256: manifestDocument.rawCandidateManifestSha256,
      candidateManifest: manifestDocument.manifest,
      candidateTreeInventory,
      runnerSourceRoot,
      runnerSourceInventory,
      runnerPackageManifestPath,
      rawRunnerPackageManifestBytes,
      runnerPackageManifestSha256,
      runnerTypeScriptConfigPath,
      rawRunnerTypeScriptConfigBytes,
      runnerTypeScriptConfigSha256,
      runnerNodeModulesRoot,
      runnerNodeModulesTree,
      resolvedToolchain,
      toolchain,
      runContext,
      validationAuthority
    }
  })
  return { prepare }
}

export class TrialRunnerPreflight extends Context.Service<
  TrialRunnerPreflight,
  TrialRunnerPreflightService
>()("@ts-release/architecture-program/TrialRunnerPreflight") {
  static readonly layer = Layer.sync(TrialRunnerPreflight, () => makeTrialRunnerPreflight())
}

export const makeTrialRunnerPreflightLayer = (
  dependencies: TrialRunnerPreflightDependencies
) => Layer.sync(TrialRunnerPreflight, () => makeTrialRunnerPreflight(dependencies))

export const TrialRunnerPreflightLive = TrialRunnerPreflight.layer
