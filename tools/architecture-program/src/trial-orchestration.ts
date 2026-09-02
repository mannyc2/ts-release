import { randomUUID } from "node:crypto"
import { constants } from "node:fs"
import {
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  unlink
} from "node:fs/promises"
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { Context, Effect, Layer, Schema } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import { PlannedRepositoryPath, Sha256Hex } from "./schema/primitives.js"
import { SelectedMachineReceiptBindingV2 } from "./schema/run-context.js"
import {
  type ArchitectureTrialResultV2,
  type MachineTrialResultV2,
  type TopologyTrialResultV2,
  encodeMachineTrialResult,
  encodeTopologyTrialResult
} from "./schema/trial-result.js"
import {
  TrialSelectionInvariantError,
  selectTrialCandidates
} from "./schema/trial-selection.js"
import {
  type ArchitectureTrialResultsV2,
  TrialEvaluationAuthorityV2,
  TrialResultFileBindingV2,
  UpstreamMachineResultBindingV2,
  encodeTrialResultsAggregate,
  makeTrialResultsAggregate
} from "./schema/trial-results-aggregate.js"
import type { ArchitectureTrialSpecV2 } from "./schema/trial-spec.js"
import {
  V2MachineCandidateId,
  V2_MACHINE_CANDIDATE_IDS,
  V2_TOPOLOGY_CANDIDATE_IDS,
  type V2CandidateId
} from "./schema/v2-ids.js"
import { readStableContainedRegularFile } from "./stable-contained-file.js"
import { sha256Bytes } from "./trial-hash.js"
import {
  TrialRunner,
  TrialRunnerLive,
  type CompletedTrialRun,
  type TrialRunnerError,
  type TrialRunnerService
} from "./trial-runner.js"

export const TRIAL_RESULTS_AGGREGATE_PATH =
  "docs/refactor/architecture-program/results/trial-results.json"

export type TrialOutputEntry =
  | { readonly _tag: "Missing" }
  | { readonly _tag: "RegularFile"; readonly bytes: Uint8Array }
  | { readonly _tag: "SymbolicLink" }
  | { readonly _tag: "Other" }

export class TrialOutputFileSystemError extends Schema.TaggedError<
  TrialOutputFileSystemError
>()("TrialOutputFileSystemError", {
  operation: Schema.String,
  path: Schema.String,
  reason: Schema.String,
  message: Schema.String
}) {
  constructor(operation: string, path: string, reason: string) {
    super({
      operation,
      path,
      reason,
      message: `Architecture trial output ${operation} failed for ${path}: ${reason}`
    })
  }
}

export class TrialReceiptEncodingError extends Schema.TaggedError<
  TrialReceiptEncodingError
>()("TrialReceiptEncodingError", {
  candidateId: Schema.String,
  reason: Schema.String,
  message: Schema.String
}) {
  constructor(candidateId: string, reason: string) {
    super({
      candidateId,
      reason,
      message: `Architecture trial receipt encoding failed for ${candidateId}: ${reason}`
    })
  }
}

export class TrialOrchestrationInvariantError extends Schema.TaggedError<
  TrialOrchestrationInvariantError
>()("TrialOrchestrationInvariantError", {
  issues: Schema.NonEmptyArray(Schema.String),
  message: Schema.String
}) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture trial orchestration invariant failure: ${issues.join("; ")}`
    })
  }
}

export class TrialOutputPersistenceError extends Schema.TaggedError<
  TrialOutputPersistenceError
>()("TrialOutputPersistenceError", {
  path: Schema.String,
  reason: Schema.String,
  message: Schema.String
}) {
  constructor(path: string, reason: string) {
    super({
      path,
      reason,
      message: `Architecture trial output persistence rejected ${path}: ${reason}`
    })
  }
}

export interface TrialOutputFileSystemService {
  readonly inspect: (
    repositoryRoot: string,
    path: string
  ) => Effect.Effect<TrialOutputEntry, TrialOutputFileSystemError>
  readonly writeAtomically: (
    repositoryRoot: string,
    path: string,
    bytes: Uint8Array,
    expectedExistingSha256: typeof Sha256Hex.Type | null
  ) => Effect.Effect<void, TrialOutputFileSystemError>
}

export class TrialOutputFileSystem extends Context.Service<
  TrialOutputFileSystem,
  TrialOutputFileSystemService
>()("@ts-release/architecture-program/TrialOutputFileSystem") {}

const causeReason = (cause: unknown): string => cause instanceof Error
  ? cause.message
  : String(cause)

const isMissingError = (cause: unknown): boolean =>
  typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT"

const contained = (root: string, target: string): boolean => {
  const pathFromRoot = relative(root, target)
  return pathFromRoot === "" ||
    (pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot))
}

const resolveOutputPath = (
  repositoryRoot: string,
  repositoryRelativePath: string
): { readonly root: string; readonly target: string } => {
  const root = resolve(repositoryRoot)
  const target = resolve(root, repositoryRelativePath)
  if (!contained(root, target)) throw new Error("output path escapes the repository root")
  return { root, target }
}

const inspectLiveOutput = async (
  repositoryRoot: string,
  repositoryRelativePath: string
): Promise<TrialOutputEntry> => {
  const { target } = resolveOutputPath(repositoryRoot, repositoryRelativePath)
  let stat: Awaited<ReturnType<typeof lstat>>
  try {
    stat = await lstat(target)
  } catch (cause) {
    if (isMissingError(cause)) return { _tag: "Missing" }
    throw cause
  }
  if (stat.isSymbolicLink()) return { _tag: "SymbolicLink" }
  if (!stat.isFile()) return { _tag: "Other" }
  return {
    _tag: "RegularFile",
    bytes: await readStableContainedRegularFile(repositoryRoot, repositoryRelativePath)
  }
}

const ensureOutputParent = async (
  repositoryRoot: string,
  repositoryRelativePath: string
): Promise<string> => {
  const { root, target } = resolveOutputPath(repositoryRoot, repositoryRelativePath)
  const exactRoot = await realpath(root)
  if (exactRoot !== root) throw new Error("repository root must not be a symbolic-link alias")
  const parentRelative = relative(root, dirname(target))
  let current = root
  for (const segment of parentRelative === "" ? [] : parentRelative.split(sep)) {
    current = resolve(current, segment)
    try {
      await mkdir(current, { mode: 0o755 })
    } catch (cause) {
      if (!(typeof cause === "object" && cause !== null && "code" in cause && cause.code === "EEXIST")) {
        throw cause
      }
    }
    const stat = await lstat(current)
    if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(current) !== current) {
      throw new Error(`output parent is not an exact non-symlink directory: ${current}`)
    }
  }
  return dirname(target)
}

const assertExpectedOutput = async (
  repositoryRoot: string,
  repositoryRelativePath: string,
  expectedExistingSha256: typeof Sha256Hex.Type | null
): Promise<void> => {
  const current = await inspectLiveOutput(repositoryRoot, repositoryRelativePath)
  if (expectedExistingSha256 === null) {
    if (current._tag !== "Missing") throw new Error("output appeared before atomic publication")
    return
  }
  if (current._tag !== "RegularFile" || sha256Bytes(current.bytes) !== expectedExistingSha256) {
    throw new Error("existing output changed before atomic replacement")
  }
}

const writeLiveOutputAtomically = async (
  repositoryRoot: string,
  repositoryRelativePath: string,
  bytes: Uint8Array,
  expectedExistingSha256: typeof Sha256Hex.Type | null
): Promise<void> => {
  const { target } = resolveOutputPath(repositoryRoot, repositoryRelativePath)
  const parent = await ensureOutputParent(repositoryRoot, repositoryRelativePath)
  await assertExpectedOutput(repositoryRoot, repositoryRelativePath, expectedExistingSha256)
  const temporaryPath = resolve(
    parent,
    `.${basename(target)}.trial-output-${randomUUID()}.tmp`
  )
  let temporaryExists = false
  try {
    const handle = await open(
      temporaryPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o644
    )
    temporaryExists = true
    try {
      await handle.writeFile(bytes)
      await handle.chmod(0o644)
      await handle.sync()
      const stat = await handle.stat()
      if (!stat.isFile() || stat.size !== bytes.byteLength) {
        throw new Error("temporary output did not retain the exact byte length")
      }
    } finally {
      await handle.close()
    }

    await assertExpectedOutput(repositoryRoot, repositoryRelativePath, expectedExistingSha256)
    if (expectedExistingSha256 === null) {
      await link(temporaryPath, target)
      await unlink(temporaryPath)
    } else {
      await rename(temporaryPath, target)
    }
    temporaryExists = false

    const directoryHandle = await open(parent, constants.O_RDONLY)
    try {
      await directoryHandle.sync()
    } finally {
      await directoryHandle.close()
    }
  } finally {
    if (temporaryExists) {
      try {
        await unlink(temporaryPath)
      } catch {
        // Preserve the original publication failure; a private temp file is not authority.
      }
    }
  }
}

export const makeNodeTrialOutputFileSystem = (): TrialOutputFileSystemService => ({
  inspect: Effect.fn("TrialOutputFileSystem.inspect")(function* (
    repositoryRoot: string,
    path: string
  ) {
    return yield* Effect.tryPromise({
      try: () => inspectLiveOutput(repositoryRoot, path),
      catch: (cause) => new TrialOutputFileSystemError("inspect", path, causeReason(cause))
    })
  }),
  writeAtomically: Effect.fn("TrialOutputFileSystem.writeAtomically")(function* (
    repositoryRoot: string,
    path: string,
    bytes: Uint8Array,
    expectedExistingSha256: typeof Sha256Hex.Type | null
  ) {
    yield* Effect.tryPromise({
      try: () => writeLiveOutputAtomically(
        repositoryRoot,
        path,
        bytes,
        expectedExistingSha256
      ),
      catch: (cause) => new TrialOutputFileSystemError(
        "atomic write",
        path,
        causeReason(cause)
      )
    })
  })
})

export const TrialOutputFileSystemLive = Layer.sync(
  TrialOutputFileSystem,
  makeNodeTrialOutputFileSystem
)

export type EncodeCompletedTrialRun = (
  completed: CompletedTrialRun
) => Effect.Effect<Uint8Array, TrialReceiptEncodingError>

export const encodeCompletedTrialRun: EncodeCompletedTrialRun = Effect.fn(
  "TrialOrchestration.encodeCompletedTrialRun"
)(function* (completed) {
  const candidateId = completed.result.runContext.candidateId
  return yield* Effect.try({
    try: () => canonicalJsonBytes(
      completed.result.schemaVersion === "machine-trial-result-v2"
        ? encodeMachineTrialResult(
          completed.result as MachineTrialResultV2,
          completed.validationAuthority
        )
        : encodeTopologyTrialResult(
          completed.result as TopologyTrialResultV2,
          completed.validationAuthority
        )
    ),
    catch: (cause) => new TrialReceiptEncodingError(candidateId, causeReason(cause))
  })
})

interface PreparedResult {
  readonly completed: CompletedTrialRun
  readonly bytes: Uint8Array
}

export interface MakeTrialOrchestrationOptions {
  readonly runner: TrialRunnerService
  readonly outputFileSystem: TrialOutputFileSystemService
  /** Test seam; live assembly always uses the strict contextual receipt encoder above. */
  readonly encodeCompleted?: EncodeCompletedTrialRun
}

export type TrialOrchestrationError =
  | TrialRunnerError
  | TrialOutputFileSystemError
  | TrialOutputPersistenceError
  | TrialReceiptEncodingError
  | TrialOrchestrationInvariantError
  | TrialSelectionInvariantError

export interface TrialOrchestrationService {
  readonly run: (
    repositoryRoot: string
  ) => Effect.Effect<ArchitectureTrialResultsV2, TrialOrchestrationError>
}

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index])

const persistCanonicalOutput = Effect.fn("TrialOrchestration.persistCanonicalOutput")(
  function* (
    outputFileSystem: TrialOutputFileSystemService,
    repositoryRoot: string,
    path: string,
    bytes: Uint8Array
  ) {
    yield* Effect.try({
      try: () => parseCanonicalJsonBytes(bytes),
      catch: (cause) => new TrialOutputPersistenceError(
        path,
        `new output is not CanonicalJsonV1: ${causeReason(cause)}`
      )
    })
    const existing = yield* outputFileSystem.inspect(repositoryRoot, path)
    let expectedExistingSha256: typeof Sha256Hex.Type | null = null
    if (existing._tag === "SymbolicLink") {
      return yield* new TrialOutputPersistenceError(path, "existing output is a symbolic link")
    }
    if (existing._tag === "Other") {
      return yield* new TrialOutputPersistenceError(path, "existing output is not a regular file")
    }
    if (existing._tag === "RegularFile") {
      yield* Effect.try({
        try: () => parseCanonicalJsonBytes(existing.bytes),
        catch: (cause) => new TrialOutputPersistenceError(
          path,
          `existing output is not CanonicalJsonV1: ${causeReason(cause)}`
        )
      })
      if (bytesEqual(existing.bytes, bytes)) return sha256Bytes(bytes)
      expectedExistingSha256 = sha256Bytes(existing.bytes)
    }
    yield* outputFileSystem.writeAtomically(
      repositoryRoot,
      path,
      bytes,
      expectedExistingSha256
    )
    const persisted = yield* outputFileSystem.inspect(repositoryRoot, path)
    if (persisted._tag !== "RegularFile" || !bytesEqual(persisted.bytes, bytes)) {
      return yield* new TrialOutputPersistenceError(
        path,
        "atomic writer did not publish the exact canonical bytes"
      )
    }
    return sha256Bytes(bytes)
  }
)

const trialResultPath = (
  spec: ArchitectureTrialSpecV2,
  result: ArchitectureTrialResultV2
): string => {
  const root = result.runContext.candidateScope === "machine"
    ? spec.receiptContract.machineResultRoot
    : spec.receiptContract.topologyResultRoot
  return `${root}/${result.runContext.candidateId}.json`
}

const assertPreparedIdentity = Effect.fn("TrialOrchestration.assertPreparedIdentity")(
  function* (
    prepared: PreparedResult,
    expectedCandidateId: V2CandidateId,
    expectedMachineReceipt: SelectedMachineReceiptBindingV2 | null
  ) {
    const result = prepared.completed.result
    const authority = prepared.completed.validationAuthority
    const issues: Array<string> = []
    if (result.runContext.candidateId !== expectedCandidateId) {
      issues.push(`runner returned ${result.runContext.candidateId} for ${expectedCandidateId}`)
    }
    if (authority.expectedReceiptId !== result.receiptId) {
      issues.push(`${expectedCandidateId} result does not equal external expectedReceiptId`)
    }
    if (authority.rawTrialSpecSha256 !== result.runContext.trialSpecSha256) {
      issues.push(`${expectedCandidateId} trial-spec authority differs from the run context`)
    }
    if (authority.rawCandidateManifestSha256 !== result.runContext.candidateManifestSha256 ||
      authority.candidateTreeSha256 !== result.runContext.candidateTreeSha256 ||
      authority.runnerSourceSha256 !== result.runContext.runnerSourceSha256 ||
      authority.runnerNodeModulesSha256 !== result.runContext.runnerNodeModulesSha256) {
      issues.push(`${expectedCandidateId} external validation authority differs from the run context`)
    }
    const upstream = result.runContext.upstreamMachineReceipt
    if (expectedMachineReceipt === null) {
      if (upstream !== null || result.runContext.candidateScope !== "machine") {
        issues.push(`${expectedCandidateId} is not an unbound machine result`)
      }
    } else if (upstream === null || result.runContext.candidateScope !== "topology" ||
      upstream.selectedMachineCandidateId !== expectedMachineReceipt.selectedMachineCandidateId ||
      upstream.selectedMachineReceiptId !== expectedMachineReceipt.selectedMachineReceiptId) {
      issues.push(`${expectedCandidateId} does not bind the exact selected machine receipt`)
    }
    if (issues.length > 0) {
      return yield* new TrialOrchestrationInvariantError(
        issues as [string, ...Array<string>]
      )
    }
  }
)

const assertSharedTrialSpec = Effect.fn("TrialOrchestration.assertSharedTrialSpec")(
  function* (prepared: ReadonlyArray<PreparedResult>, expectedSha256?: typeof Sha256Hex.Type) {
    const first = prepared[0]
    if (first === undefined) {
      return yield* new TrialOrchestrationInvariantError(["candidate result set is empty"])
    }
    const trialSpecSha256 = expectedSha256 ??
      first.completed.validationAuthority.rawTrialSpecSha256
    const issues = prepared.flatMap(({ completed }) =>
      completed.validationAuthority.rawTrialSpecSha256 === trialSpecSha256
        ? []
        : [`${completed.result.runContext.candidateId} used a different trial-spec authority`]
    )
    if (issues.length > 0) {
      return yield* new TrialOrchestrationInvariantError(
        issues as [string, ...Array<string>]
      )
    }
    return {
      spec: first.completed.validationAuthority.trialSpec,
      trialSpecSha256
    }
  }
)

const resultBinding = (
  prepared: PreparedResult,
  path: string,
  fileSha256: typeof Sha256Hex.Type
): TrialResultFileBindingV2 => {
  const { result, validationAuthority } = prepared.completed
  const upstream = result.runContext.upstreamMachineReceipt
  return new TrialResultFileBindingV2({
    scope: result.runContext.candidateScope,
    candidateId: result.runContext.candidateId,
    path: PlannedRepositoryPath.make(path),
    fileSha256,
    receiptId: validationAuthority.expectedReceiptId,
    runContextSha256: result.runContextSha256,
    candidateManifestSha256: validationAuthority.rawCandidateManifestSha256,
    candidateTreeSha256: validationAuthority.candidateTreeSha256,
    runnerSourceSha256: validationAuthority.runnerSourceSha256,
    runnerNodeModulesSha256: validationAuthority.runnerNodeModulesSha256,
    upstreamMachineReceipt: upstream === null
      ? null
      : new UpstreamMachineResultBindingV2({
        selectedMachineCandidateId: upstream.selectedMachineCandidateId,
        selectedMachineReceiptId: upstream.selectedMachineReceiptId
      }),
    evaluationAuthority: new TrialEvaluationAuthorityV2({
      probeEvaluations: [...validationAuthority.evaluationAuthority.probeEvaluations],
      gateEvaluations: [...validationAuthority.evaluationAuthority.gateEvaluations],
      objectiveDerivations: [...validationAuthority.evaluationAuthority.objectiveDerivations]
    })
  })
}

export const makeTrialOrchestration = (
  options: MakeTrialOrchestrationOptions
): TrialOrchestrationService => {
  const encodeCompleted = options.encodeCompleted ?? encodeCompletedTrialRun

  const runCandidates = Effect.fn("TrialOrchestration.runCandidates")(function* (
    repositoryRoot: string,
    candidateIds: ReadonlyArray<V2CandidateId>,
    upstreamMachineReceipt: SelectedMachineReceiptBindingV2 | null
  ) {
    const prepared: Array<PreparedResult> = []
    for (const candidateId of candidateIds) {
      const completed = yield* options.runner.run(
        repositoryRoot,
        candidateId,
        upstreamMachineReceipt
      )
      const bytes = yield* encodeCompleted(completed)
      const result = { completed, bytes }
      yield* assertPreparedIdentity(result, candidateId, upstreamMachineReceipt)
      prepared.push(result)
    }
    return prepared
  })

  const persistResults = Effect.fn("TrialOrchestration.persistResults")(function* (
    repositoryRoot: string,
    spec: ArchitectureTrialSpecV2,
    prepared: ReadonlyArray<PreparedResult>
  ) {
    const bindings: Array<TrialResultFileBindingV2> = []
    for (const result of prepared) {
      const path = trialResultPath(spec, result.completed.result)
      const fileSha256 = yield* persistCanonicalOutput(
        options.outputFileSystem,
        repositoryRoot,
        path,
        result.bytes
      )
      bindings.push(resultBinding(result, path, fileSha256))
    }
    return bindings
  })

  const persistAggregate = Effect.fn("TrialOrchestration.persistAggregate")(function* (
    repositoryRoot: string,
    spec: ArchitectureTrialSpecV2,
    body: Parameters<typeof makeTrialResultsAggregate>[0]
  ) {
    const aggregate = yield* Effect.try({
      try: () => makeTrialResultsAggregate(body, spec),
      catch: (cause) => new TrialOrchestrationInvariantError([
        `aggregate construction failed: ${causeReason(cause)}`
      ])
    })
    const bytes = yield* Effect.try({
      try: () => canonicalJsonBytes(encodeTrialResultsAggregate(aggregate, spec)),
      catch: (cause) => new TrialOutputPersistenceError(
        TRIAL_RESULTS_AGGREGATE_PATH,
        `aggregate encoding failed: ${causeReason(cause)}`
      )
    })
    yield* persistCanonicalOutput(
      options.outputFileSystem,
      repositoryRoot,
      TRIAL_RESULTS_AGGREGATE_PATH,
      bytes
    )
    return aggregate
  })

  const run = Effect.fn("TrialOrchestration.run")(function* (repositoryRoot: string) {
    const machinePrepared = yield* runCandidates(
      repositoryRoot,
      V2_MACHINE_CANDIDATE_IDS,
      null
    )
    const machineAuthority = yield* assertSharedTrialSpec(machinePrepared)
    const machineResults = machinePrepared.map(({ completed }) => completed.result)
    const machineSelection = yield* selectTrialCandidates({
      scope: "machine",
      spec: machineAuthority.spec,
      results: machineResults
    })
    const machineBindings = yield* persistResults(
      repositoryRoot,
      machineAuthority.spec,
      machinePrepared
    )

    if (machineSelection._tag !== "UniqueSelection") {
      return yield* persistAggregate(repositoryRoot, machineAuthority.spec, {
        schemaVersion: "ts-release/architecture-trial-results/v2",
        programId: "ts-release-architecture-program",
        trialSpecSha256: machineAuthority.trialSpecSha256,
        machineResults: machineBindings,
        machineSelection,
        machineMaintainerDecision: null,
        topologyResults: [],
        topologySelection: null,
        topologyMaintainerDecision: null
      })
    }

    const selectedMachineCandidateId = V2_MACHINE_CANDIDATE_IDS.find(
      (candidateId) => candidateId === machineSelection.selectedCandidateId
    )
    if (selectedMachineCandidateId === undefined) {
      return yield* new TrialOrchestrationInvariantError([
        `machine selection returned non-machine candidate ${machineSelection.selectedCandidateId}`
      ])
    }
    const selectedMachineReceipt = new SelectedMachineReceiptBindingV2({
      selectedMachineCandidateId: V2MachineCandidateId.make(selectedMachineCandidateId),
      selectedMachineReceiptId: machineSelection.selectedReceiptId
    })
    const topologyPrepared = yield* runCandidates(
      repositoryRoot,
      V2_TOPOLOGY_CANDIDATE_IDS,
      selectedMachineReceipt
    )
    yield* assertSharedTrialSpec(topologyPrepared, machineAuthority.trialSpecSha256)
    const topologyResults = topologyPrepared.map(({ completed }) => completed.result)
    const topologySelection = yield* selectTrialCandidates({
      scope: "topology",
      spec: machineAuthority.spec,
      results: topologyResults
    })
    const topologyBindings = yield* persistResults(
      repositoryRoot,
      machineAuthority.spec,
      topologyPrepared
    )
    return yield* persistAggregate(repositoryRoot, machineAuthority.spec, {
      schemaVersion: "ts-release/architecture-trial-results/v2",
      programId: "ts-release-architecture-program",
      trialSpecSha256: machineAuthority.trialSpecSha256,
      machineResults: machineBindings,
      machineSelection,
      machineMaintainerDecision: null,
      topologyResults: topologyBindings,
      topologySelection,
      topologyMaintainerDecision: null
    })
  })

  return { run }
}

export class TrialOrchestration extends Context.Service<
  TrialOrchestration,
  TrialOrchestrationService
>()("@ts-release/architecture-program/TrialOrchestration") {
  static readonly layer = Layer.effect(
    TrialOrchestration,
    Effect.gen(function* () {
      const runner = yield* TrialRunner
      const outputFileSystem = yield* TrialOutputFileSystem
      return makeTrialOrchestration({ runner, outputFileSystem })
    })
  )
}

export const TrialOrchestrationLive = TrialOrchestration.layer.pipe(
  Layer.provide(Layer.merge(TrialRunnerLive, TrialOutputFileSystemLive))
)

export const runTrialOrchestration = Effect.fn("TrialOrchestration.runFromService")(
  function* (repositoryRoot: string) {
    const orchestration = yield* TrialOrchestration
    return yield* orchestration.run(repositoryRoot)
  }
)

/** Ready for a thin Bun CLI without adding a package-script authority. */
export const runTrialOrchestrationLive = (repositoryRoot: string) =>
  runTrialOrchestration(repositoryRoot).pipe(Effect.provide(TrialOrchestrationLive))
