import { constants, type Stats } from "node:fs"
import { lstat, open, type FileHandle } from "node:fs/promises"
import { join } from "node:path"
import { Context, Effect, Layer, Result, Schema, type Scope } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "./canonical-document.js"
import {
  type ArchitectureCandidateManifestV2,
  decodeCandidateManifest,
  encodeCandidateManifest
} from "./schema/candidate-manifest.js"
import {
  ArchitectureCaseInvocationV2,
  ArchitectureGateInvocationV2,
  ArchitectureProbeInvocationV2,
  caseInvocationCodec,
  decodeCaseObservationForInvocation,
  decodeGateObservationForInvocation,
  decodeProbeObservationForInvocation,
  gateInvocationCodec,
  probeInvocationCodec,
  type ArchitectureGateObservationV2,
  type ArchitectureProbeObservationV2
} from "./schema/harness-protocol.js"
import { ArtifactId, RoleId, Sha256Hex } from "./schema/primitives.js"
import {
  trialRunContextInvariantIssues,
  type TrialRunContextV2
} from "./schema/run-context.js"
import {
  AcceptedRunnerEvaluationDisposition,
  CaseReceipt,
  CaseTerminalOutputV2,
  CompleteProcessStreamEvidence,
  CountMeasurementValue,
  ExitedProcessAttempt,
  FailedCaseExecution,
  FailedGateExecution,
  FailedProbeExecution,
  GateEvaluationRecord,
  GateReceipt,
  GateTerminalOutputV2,
  HashMeasurementValue,
  IdentifierDeltaMeasurementValue,
  IoFailedProcessAttempt,
  MeasuredProbeMeasurement,
  NotStartedProcessAttempt,
  OutputLimitedProcessAttempt,
  PassedCaseExecution,
  PassedGateExecution,
  PassedProbeExecution,
  ProbeEvaluationRecord,
  ProbeReceipt,
  ProbeTerminalOutputV2,
  PrefixProcessStreamEvidence,
  SignaledProcessAttempt,
  TimedOutProcessAttempt,
  computeCaseTerminalResultSha256,
  computeGateCommandInputSha256,
  computeGateEvaluationRecordSha256,
  computeGateTerminalResultSha256,
  computeProbeMeasurementEvidenceSha256,
  computeProbeEvaluationRecordSha256,
  computeProbeTerminalResultSha256,
  makeGateCommandInput,
  RejectedRunnerEvaluationDisposition,
  type CaseExecutionDisposition,
  type GateExecutionDisposition,
  type ProbeExecutionDisposition,
  type ProbeMeasurementValue,
  ProcessAttemptEvidence,
  type ProcessStreamEvidence
} from "./schema/trial-result.js"
import {
  type ArchitectureTrialSpecV2,
  encodeArchitectureTrialSpec,
  gateDefinitionSha256,
  trialSpecInvariantIssues
} from "./schema/trial-spec.js"
import {
  EvidenceEntryV2,
  codePointCompare,
  evidenceEntriesInvariantIssues
} from "./schema/trial-evidence.js"
import {
  V2CaseId,
  V2GateId,
  V2ProbeId
} from "./schema/v2-ids.js"
import {
  TrialCandidateSandboxError,
  makeTrialCandidateSandbox,
  type TrialCandidateSandboxService
} from "./trial-candidate-sandbox.js"
import { sha256Bytes } from "./trial-hash.js"
import {
  TrialIsolationEstablishmentError,
  TrialIsolationPostcheckError,
  TrialIsolationUnavailableError,
  makeTrialIsolatedProcess,
  type TrialIsolatedProcessError,
  type TrialIsolatedProcessService
} from "./trial-isolated-process.js"
import {
  type CandidatePatchMeasurement,
  type CandidateTreeInventory,
  type TrialGitNumstatService,
  TrialInventoryError,
  inventoryCandidateTree,
  measureCandidatePatch
} from "./trial-inventory.js"
import {
  TrialProcessIoError,
  TrialProcessOutputLimitError,
  TrialProcessSignalError,
  TrialProcessTimeoutError,
  type TrialProcessResult,
  type TrialProcessStreamCapture
} from "./trial-process.js"
import {
  type GateCommandExecution,
  type GateCommandExecutionRequest,
  type GateCommandExecutor
} from "./trial-gate-command.js"
export type {
  GateCommandExecution,
  GateCommandExecutionRequest,
  GateCommandExecutor
} from "./trial-gate-command.js"

export interface PreparedTrialAdapterContext {
  readonly spec: ArchitectureTrialSpecV2
  readonly manifest: ArchitectureCandidateManifestV2
  readonly originalCandidateRoot: string
  readonly originalCandidateTree: CandidateTreeInventory
  readonly runContext: TrialRunContextV2
}

export interface GateReceiptPrerequisites {
  readonly caseReceipts: ReadonlyArray<CaseReceipt>
  readonly probeReceipts: ReadonlyArray<ProbeReceipt>
}

export interface GateEvaluationInput extends GateReceiptPrerequisites {
  readonly gate: ArchitectureTrialSpecV2["gateRequirements"][number]
  readonly observation: ArchitectureGateObservationV2
  readonly commandAttempt: ProcessAttemptEvidence
  /** Scope-owned, no-follow runner copy; never the raw candidate-writable execution root. */
  readonly inspectionRoot: string
}

export class AcceptedGateEvaluation extends Schema.TaggedClass<AcceptedGateEvaluation>()(
  "Accepted",
  { facts: Schema.NonEmptyArray(EvidenceEntryV2) }
) {}

export class RejectedGateEvaluation extends Schema.TaggedClass<RejectedGateEvaluation>()(
  "Rejected",
  { failureIds: Schema.NonEmptyArray(ArtifactId) }
) {}

export const GateEvaluation = Schema.Union([AcceptedGateEvaluation, RejectedGateEvaluation])
export type GateEvaluation = typeof GateEvaluation.Type

export class GateEvaluatorError extends Schema.TaggedError<GateEvaluatorError>()(
  "GateEvaluatorError",
  { reason: Schema.String, message: Schema.String }
) {
  constructor(reason: string) {
    super({ reason, message: `Runner-owned gate evaluation failed: ${reason}.` })
  }
}

export interface GateEvaluator {
  readonly evaluatorId: typeof ArtifactId.Type
  readonly evaluate: (
    input: GateEvaluationInput
  ) => Effect.Effect<GateEvaluation, GateEvaluatorError>
}

export interface ProbeEvaluationInput {
  readonly probe: ArchitectureTrialSpecV2["marginalProbes"][number]
  readonly observation: ArchitectureProbeObservationV2
  readonly patch: CandidatePatchMeasurement
  readonly afterManifest: ArchitectureCandidateManifestV2
  /** Scope-owned, no-follow runner copy; it exists only during this evaluation effect. */
  readonly inspectionRoot: string
}

export class AcceptedProbeEvaluation extends Schema.TaggedClass<AcceptedProbeEvaluation>()(
  "Accepted",
  { facts: Schema.NonEmptyArray(EvidenceEntryV2) }
) {}

export class RejectedProbeEvaluation extends Schema.TaggedClass<RejectedProbeEvaluation>()(
  "Rejected",
  { failureIds: Schema.NonEmptyArray(ArtifactId) }
) {}

export const ProbeEvaluation = Schema.Union([AcceptedProbeEvaluation, RejectedProbeEvaluation])
export type ProbeEvaluation = typeof ProbeEvaluation.Type

export class ProbeEvaluatorError extends Schema.TaggedError<ProbeEvaluatorError>()(
  "ProbeEvaluatorError",
  { reason: Schema.String, message: Schema.String }
) {
  constructor(reason: string) {
    super({ reason, message: `Runner-owned probe evaluation failed: ${reason}.` })
  }
}

export interface ProbeEvaluator {
  readonly evaluatorId: typeof ArtifactId.Type
  readonly evaluate: (
    input: ProbeEvaluationInput
  ) => Effect.Effect<ProbeEvaluation, ProbeEvaluatorError>
}

export interface TrialAdapterExecutorService {
  readonly executeCase: (caseId: typeof V2CaseId.Type) => Effect.Effect<CaseReceipt>
  readonly executeProbe: (probeId: typeof V2ProbeId.Type) => Effect.Effect<ProbeReceipt>
  readonly executeGate: (
    gateId: typeof V2GateId.Type,
    prerequisites: GateReceiptPrerequisites
  ) => Effect.Effect<GateReceipt>
}

export interface MakeTrialAdapterExecutorOptions {
  readonly sandbox?: TrialCandidateSandboxService
  readonly isolatedProcess?: TrialIsolatedProcessService
  readonly gateEvaluator?: GateEvaluator
  readonly probeEvaluator?: ProbeEvaluator
  readonly gateCommandExecutor?: GateCommandExecutor
  /** Digest-bound Git numstat service retained by runner preflight. Omission fails every probe. */
  readonly gitNumstat?: TrialGitNumstatService
}

class TrialAdapterBoundaryError extends Schema.TaggedError<TrialAdapterBoundaryError>()(
  "TrialAdapterBoundaryError",
  { failureId: ArtifactId, reason: Schema.String, message: Schema.String }
) {
  constructor(failureId: string, reason: string) {
    super({
      failureId: ArtifactId.make(failureId),
      reason,
      message: `Architecture trial adapter boundary ${failureId}: ${reason}.`
    })
  }
}

type SessionError = TrialAdapterBoundaryError | TrialCandidateSandboxError | TrialInventoryError

interface AdapterSession {
  readonly root: string
  readonly rootStat: Stats
  readonly process: Result.Result<TrialProcessResult, TrialIsolatedProcessError>
  readonly originalIntegrityFailure: string | undefined
}

const TRIAL_AFTER_MANIFEST_LIMIT_BYTES = 1_048_576

const sameFileSnapshot = (left: Stats, right: Stats): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.mode === right.mode &&
  left.nlink === right.nlink &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.rdev === right.rdev &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs

const sameNodeIdentity = (left: Stats, right: Stats): boolean =>
  left.dev === right.dev && left.ino === right.ino

const denyAllGateEvaluator: GateEvaluator = {
  evaluatorId: ArtifactId.make("gate-evaluator.default-deny-v1"),
  evaluate: Effect.fn("GateEvaluator.denyAll")(function* () {
    return new RejectedGateEvaluation({
      failureIds: [ArtifactId.make("gate.runner-evaluator-missing")]
    })
  })
}

const denyAllProbeEvaluator: ProbeEvaluator = {
  evaluatorId: ArtifactId.make("probe-evaluator.default-deny-v1"),
  evaluate: Effect.fn("ProbeEvaluator.denyAll")(function* () {
    return new RejectedProbeEvaluation({
      failureIds: [ArtifactId.make("probe.runner-evaluator-missing")]
    })
  })
}

const denyAllGateCommandExecutor: GateCommandExecutor = {
  execute: Effect.fn("GateCommandExecutor.denyAll")(function* (request) {
    return {
      processAttempt: new NotStartedProcessAttempt({
        executable: request.gate.command[0] ?? null
      }),
      failureIds: [ArtifactId.make("gate.command-executor-missing")]
    }
  })
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeGateEvaluation = Schema.decodeUnknownEffect(GateEvaluation, strictOptions)
const decodeProbeEvaluation = Schema.decodeUnknownEffect(ProbeEvaluation, strictOptions)
const decodeEvaluatorId = Schema.decodeUnknownEffect(ArtifactId, strictOptions)
const GateCommandExecutionSchema = Schema.Struct({
  processAttempt: ProcessAttemptEvidence,
  failureIds: Schema.Array(ArtifactId)
})
const decodeGateCommandExecution = Schema.decodeUnknownEffect(
  GateCommandExecutionSchema,
  strictOptions
)
const decodeGateCommandAttemptEnvelope = Schema.decodeUnknownEffect(
  Schema.Struct({ processAttempt: Schema.Unknown }),
  { errors: "all", onExcessProperty: "ignore" }
)
const decodeProcessAttemptEvidence = Schema.decodeUnknownEffect(
  ProcessAttemptEvidence,
  strictOptions
)

const failureIds = (ids: Iterable<string>): [typeof ArtifactId.Type, ...Array<typeof ArtifactId.Type>] => {
  const canonical = [...new Set(ids)].sort(codePointCompare).map((id) => ArtifactId.make(id))
  return (canonical.length === 0 ? [ArtifactId.make("adapter.unknown-failure")] : canonical) as [
    typeof ArtifactId.Type,
    ...Array<typeof ArtifactId.Type>
  ]
}

const bindEvaluatorId = Effect.fn("TrialAdapterExecutor.bindEvaluatorId")(function* (
  rawId: unknown,
  fallbackId: string,
  failureId: string
) {
  const decoded = yield* Effect.result(decodeEvaluatorId(rawId))
  return Result.isSuccess(decoded)
    ? { evaluatorId: decoded.success, failureIds: [] as ReadonlyArray<string> }
    : {
        evaluatorId: ArtifactId.make(fallbackId),
        failureIds: [failureId] as ReadonlyArray<string>
      }
})

const acceptedFactIssues = (
  label: string,
  evaluation: GateEvaluation | ProbeEvaluation
): ReadonlyArray<string> => evaluation._tag === "Accepted"
  ? evidenceEntriesInvariantIssues(label, evaluation.facts)
  : []

const makeProbeEvaluationRecord = Effect.fn(
  "TrialAdapterExecutor.makeProbeEvaluationRecord"
)(function* (
  evaluator: ProbeEvaluator,
  input: ProbeEvaluationInput,
  inspectedTreeSha256: typeof Sha256Hex.Type
) {
  const identity = yield* bindEvaluatorId(
    evaluator.evaluatorId,
    "probe-evaluator.invalid-id",
    "probe.runner-evaluator-id"
  )
  const raw = yield* Effect.result(evaluator.evaluate(input))
  let evaluation: ProbeEvaluation | undefined
  let schemaFailure = false
  if (Result.isSuccess(raw)) {
    const decoded = yield* Effect.result(decodeProbeEvaluation(raw.success))
    if (Result.isSuccess(decoded)) evaluation = decoded.success
    else schemaFailure = true
  }
  const rawFailures = [
    ...identity.failureIds,
    ...(Result.isFailure(raw) ? ["probe.runner-evaluator-error"] : []),
    ...(schemaFailure ? ["probe.runner-evaluator-schema"] : []),
    ...(evaluation?._tag === "Rejected" ? evaluation.failureIds : []),
    ...(evaluation?._tag === "Accepted" &&
      acceptedFactIssues("probe.runner-evaluator-facts", evaluation).length > 0
      ? ["probe.runner-evaluator-facts"]
      : [])
  ]
  const disposition = evaluation?._tag === "Accepted" && rawFailures.length === 0
    ? new AcceptedRunnerEvaluationDisposition({ facts: evaluation.facts })
    : new RejectedRunnerEvaluationDisposition({
        failureIds: failureIds(rawFailures)
      })
  const body = {
    evaluatorId: identity.evaluatorId,
    probeId: input.probe.id,
    inspectedTreeSha256,
    disposition
  }
  return new ProbeEvaluationRecord({
    recordSha256: computeProbeEvaluationRecordSha256(body),
    ...body
  })
})

const executeGateCommand = Effect.fn("TrialAdapterExecutor.executeGateCommand")(function* (
  executor: GateCommandExecutor,
  request: GateCommandExecutionRequest
) {
  const raw = yield* executor.execute(request)
  const decoded = yield* Effect.result(decodeGateCommandExecution(raw))
  if (Result.isSuccess(decoded)) return decoded.success
  const recoveredAttempt = yield* Effect.result(Effect.gen(function* () {
    const envelope = yield* decodeGateCommandAttemptEnvelope(raw)
    return yield* decodeProcessAttemptEvidence(envelope.processAttempt)
  }))
  if (Result.isSuccess(recoveredAttempt)) {
    return {
      processAttempt: recoveredAttempt.success,
      failureIds: [ArtifactId.make("gate.command-executor-schema")]
    }
  }
  return yield* Effect.die(new Error(
    "Gate command executor returned malformed output without valid process-attempt evidence"
  ))
})

const makeGateEvaluationRecord = Effect.fn(
  "TrialAdapterExecutor.makeGateEvaluationRecord"
)(function* (
  evaluator: GateEvaluator,
  input: Omit<GateEvaluationInput, "commandAttempt"> | null,
  command: GateCommandExecution,
  commandRequest: GateCommandExecutionRequest,
  inspectedTreeSha256: typeof Sha256Hex.Type,
  runnerFailureIds: ReadonlyArray<string>
) {
  const identity = yield* bindEvaluatorId(
    evaluator.evaluatorId,
    "gate-evaluator.invalid-id",
    "gate.runner-evaluator-id"
  )
  const raw = input === null
    ? null
    : yield* Effect.result(evaluator.evaluate({
        ...input,
        commandAttempt: command.processAttempt
      }))
  let evaluation: GateEvaluation | undefined
  let schemaFailure = false
  if (raw !== null && Result.isSuccess(raw)) {
    const decoded = yield* Effect.result(decodeGateEvaluation(raw.success))
    if (Result.isSuccess(decoded)) evaluation = decoded.success
    else schemaFailure = true
  }
  const commandAccepted = command.processAttempt._tag === "Exited" &&
    command.processAttempt.exitCode === commandRequest.gate.expectedExit
  const rawFailures = [
    ...identity.failureIds,
    ...runnerFailureIds,
    ...command.failureIds,
    ...(commandAccepted ? [] : ["gate.command-unexpected-exit"]),
    ...(raw !== null && Result.isFailure(raw) ? ["gate.runner-evaluator-error"] : []),
    ...(schemaFailure ? ["gate.runner-evaluator-schema"] : []),
    ...(evaluation?._tag === "Rejected" ? evaluation.failureIds : []),
    ...(evaluation?._tag === "Accepted" &&
      acceptedFactIssues("gate.runner-evaluator-facts", evaluation).length > 0
      ? ["gate.runner-evaluator-facts"]
      : [])
  ]
  const disposition = evaluation?._tag === "Accepted" && rawFailures.length === 0
    ? new AcceptedRunnerEvaluationDisposition({ facts: evaluation.facts })
    : new RejectedRunnerEvaluationDisposition({ failureIds: failureIds(rawFailures) })
  const body = {
    evaluatorId: identity.evaluatorId,
    gateId: commandRequest.gate.id,
    inspectedTreeSha256,
    declaredCommand: commandRequest.gate.command,
    commandInputSha256: computeGateCommandInputSha256(commandRequest.commandInput),
    commandAttempt: command.processAttempt,
    disposition
  }
  return new GateEvaluationRecord({
    recordSha256: computeGateEvaluationRecordSha256(body),
    ...body
  })
})

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((value, index) => value === right[index])

const canonicalComparable = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown

const canonicalEqual = (left: unknown, right: unknown): boolean =>
  bytesEqual(
    canonicalJsonBytes(canonicalComparable(left)),
    canonicalJsonBytes(canonicalComparable(right))
  )

const stderrIsEmpty = (result: TrialProcessResult): boolean => result.stderr.byteLength === 0

const completeStreamEvidence = (bytes: Uint8Array): CompleteProcessStreamEvidence =>
  new CompleteProcessStreamEvidence({
    byteLength: bytes.byteLength,
    sha256: sha256Bytes(bytes)
  })

const streamEvidenceFromCapture = (
  capture: TrialProcessStreamCapture
): ProcessStreamEvidence => capture.completeness === "Complete"
  ? new CompleteProcessStreamEvidence({
    byteLength: capture.byteLength,
    sha256: capture.sha256
  })
  : new PrefixProcessStreamEvidence({
    byteLength: capture.byteLength,
    sha256: capture.sha256
  })

const processAttemptFromResult = (result: TrialProcessResult): ExitedProcessAttempt =>
  new ExitedProcessAttempt({
    exitCode: result.exitCode,
    stdout: completeStreamEvidence(result.stdout),
    stderr: completeStreamEvidence(result.stderr)
  })

const processFailureId = (error: TrialIsolatedProcessError): string => {
  if (error instanceof TrialProcessIoError) return "adapter.process-io"
  if (error instanceof TrialProcessTimeoutError) return "adapter.timeout"
  if (error instanceof TrialProcessSignalError) return "adapter.signal"
  if (error instanceof TrialProcessOutputLimitError) return "adapter.output-limit"
  if (error instanceof TrialIsolationUnavailableError) return "adapter.isolation-unavailable"
  if (error instanceof TrialIsolationEstablishmentError) return "adapter.isolation-establishment"
  if (error instanceof TrialIsolationPostcheckError) return "adapter.isolation-postcheck"
  return "adapter.isolation-invalid-request"
}

const processAttemptFromError = (error: TrialIsolatedProcessError): ProcessAttemptEvidence => {
  if (error instanceof TrialIsolationEstablishmentError ||
    error instanceof TrialIsolationPostcheckError) return error.processAttempt
  if (error instanceof TrialProcessIoError) {
    return new IoFailedProcessAttempt({
      operation: error.operation,
      stdout: streamEvidenceFromCapture(error.stdout),
      stderr: streamEvidenceFromCapture(error.stderr)
    })
  }
  if (error instanceof TrialProcessTimeoutError) {
    return new TimedOutProcessAttempt({
      timeoutMilliseconds: error.timeoutMilliseconds,
      stdout: streamEvidenceFromCapture(error.stdout),
      stderr: streamEvidenceFromCapture(error.stderr)
    })
  }
  if (error instanceof TrialProcessSignalError) {
    return new SignaledProcessAttempt({
      signal: error.signal,
      stdout: streamEvidenceFromCapture(error.stdout),
      stderr: streamEvidenceFromCapture(error.stderr)
    })
  }
  if (error instanceof TrialProcessOutputLimitError) {
    return new OutputLimitedProcessAttempt({
      stream: error.stream,
      limitBytes: error.limitBytes,
      observedBytes: error.observedBytes,
      stdout: streamEvidenceFromCapture(error.stdout),
      stderr: streamEvidenceFromCapture(error.stderr)
    })
  }
  return new NotStartedProcessAttempt({
    executable: error instanceof TrialIsolationUnavailableError ? "/usr/bin/bwrap" : null
  })
}

const sessionFailureId = (error: SessionError): string => {
  if (error instanceof TrialAdapterBoundaryError) return error.failureId
  if (error instanceof TrialCandidateSandboxError) return "adapter.sandbox"
  return "adapter.inventory"
}

const decodeCanonicalOutput = (bytes: Uint8Array): unknown => parseCanonicalJsonBytes(bytes)

const resultFailureIds = (result: TrialProcessResult): Array<string> => [
  ...(result.exitCode === 0 ? [] : ["adapter.nonzero-exit"]),
  ...(stderrIsEmpty(result) ? [] : ["adapter.stderr-nonempty"])
]

const findCase = (
  context: PreparedTrialAdapterContext,
  caseId: typeof V2CaseId.Type
): ArchitectureTrialSpecV2["machineCases"][number] => context.spec.machineCases.find(
  (candidate) => candidate.id === caseId
) ?? (() => { throw new Error(`Prepared trial spec does not contain ${caseId}`) })()

const findProbe = (
  context: PreparedTrialAdapterContext,
  probeId: typeof V2ProbeId.Type
): ArchitectureTrialSpecV2["marginalProbes"][number] => context.spec.marginalProbes.find(
  (candidate) => candidate.id === probeId
) ?? (() => { throw new Error(`Prepared trial spec does not contain ${probeId}`) })()

const findGate = (
  context: PreparedTrialAdapterContext,
  gateId: typeof V2GateId.Type
): ArchitectureTrialSpecV2["gateRequirements"][number] => context.spec.gateRequirements.find(
  (candidate) => candidate.id === gateId
) ?? (() => { throw new Error(`Prepared trial spec does not contain ${gateId}`) })()

const expectedAdapterArgv = (
  context: PreparedTrialAdapterContext,
  mode: "case" | "probe" | "gate"
): readonly [string, ...Array<string>] => {
  const adapter = mode === "case"
    ? context.spec.executionContract.caseAdapter
    : mode === "probe"
    ? context.spec.executionContract.probeAdapter
    : context.spec.executionContract.gateAdapter
  const expected = ["bun", "run", "trial-adapter.ts", mode]
  if (!canonicalEqual(adapter.argv, expected) || adapter.timeoutMilliseconds !== 30_000 ||
    adapter.outputLimitBytes !== 1_048_576 || adapter.networkAccess || adapter.credentials ||
    adapter.mutatesExternalState) {
    throw new TrialAdapterBoundaryError(
      "adapter.execution-contract",
      `${mode} adapter does not preserve the frozen isolated execution boundary`
    )
  }
  return [...adapter.argv] as [string, ...Array<string>]
}

const ensurePreparedBindings = (context: PreparedTrialAdapterContext): void => {
  const expectedCaseBindings = context.spec.machineCases.map(({ id: caseId, execution }) => ({
    caseId,
    definitionSha256: execution.definitionSha256,
    fixtureSha256: execution.fixtureSha256,
    expectedEvidenceSha256: execution.expectedEvidenceSha256
  }))
  const expectedProbeBindings = context.spec.marginalProbes.map(({ id: probeId, execution }) => ({
    probeId,
    definitionSha256: execution.definitionSha256,
    baseFixtureSha256: execution.baseFixtureSha256,
    changeDefinitionSha256: execution.changeDefinitionSha256
  }))
  const expectedGateBindings = context.spec.gateRequirements
    .filter(({ scope }) => scope === context.runContext.candidateScope)
    .map((gate) => ({ gateId: gate.id, definitionSha256: gateDefinitionSha256(gate) }))
  if (context.manifest.candidateId !== context.runContext.candidateId ||
    context.manifest.scope !== context.runContext.candidateScope ||
    context.manifest.model !== context.runContext.candidateModel ||
    context.manifest.implementationRoot !== context.runContext.implementationRoot ||
    context.originalCandidateTree.treeSha256 !== context.runContext.candidateTreeSha256 ||
    sha256Bytes(canonicalJsonBytes(encodeCandidateManifest(context.manifest))) !==
      context.runContext.candidateManifestSha256 ||
    sha256Bytes(canonicalJsonBytes(encodeArchitectureTrialSpec(context.spec))) !==
      context.runContext.trialSpecSha256 ||
    context.spec.executionContract.contractSha256 !== context.runContext.executionContractSha256 ||
    context.spec.measurementContract.contractSha256 !== context.runContext.measurementContractSha256 ||
    context.spec.topologyFixture.fixtureSha256 !== context.runContext.topologyFixtureSha256 ||
    trialSpecInvariantIssues(context.spec).length > 0 ||
    trialRunContextInvariantIssues(context.runContext).length > 0 ||
    !canonicalEqual(context.runContext.caseDefinitionBindings, expectedCaseBindings) ||
    !canonicalEqual(context.runContext.probeDefinitionBindings, expectedProbeBindings) ||
    !canonicalEqual(context.runContext.gateDefinitionBindings, expectedGateBindings)) {
    throw new TrialAdapterBoundaryError(
      "adapter.prepared-context-mismatch",
      "manifest, tree, specification, and run context do not identify one immutable candidate run"
    )
  }
}

const makeSession = (
  context: PreparedTrialAdapterContext,
  sandbox: TrialCandidateSandboxService,
  isolatedProcess: TrialIsolatedProcessService,
  mode: "case" | "probe" | "gate",
  stdin: Uint8Array
): Effect.Effect<AdapterSession, SessionError, Scope.Scope> => Effect.gen(function* () {
  const argv = yield* Effect.try({
    try: () => {
      ensurePreparedBindings(context)
      return expectedAdapterArgv(context, mode)
    },
    catch: (cause) => cause instanceof TrialAdapterBoundaryError
      ? cause
      : new TrialAdapterBoundaryError(
        "adapter.prepared-context-invalid",
        cause instanceof Error ? cause.message : String(cause)
      )
  })
  const isolated = yield* sandbox.create({
    candidateRoot: context.originalCandidateRoot,
    manifest: context.manifest
  })
  const copiedTree = yield* inventoryCandidateTree(isolated.root, context.manifest)
  if (copiedTree.treeSha256 !== context.originalCandidateTree.treeSha256) {
    yield* new TrialAdapterBoundaryError(
      "adapter.sandbox-tree-mismatch",
      "fresh sandbox tree does not equal the prepared candidate tree"
    )
  }
  const rootStat = yield* Effect.tryPromise({
    try: () => lstat(isolated.root),
    catch: (cause) => new TrialAdapterBoundaryError(
      "adapter.sandbox-root",
      cause instanceof Error ? cause.message : String(cause)
    )
  })
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    yield* new TrialAdapterBoundaryError(
      "adapter.sandbox-root",
      "fresh sandbox root is not a real directory"
    )
  }
  const process = yield* Effect.result(isolatedProcess.run({
    candidateRoot: isolated.root,
    adapterArgv: argv,
    stdin,
    timeoutMilliseconds: 30_000,
    expectedToolchain: {
      bunVersion: context.runContext.toolchain.bun,
      bunExecutableSha256: context.runContext.toolchain.bunExecutableSha256,
      bubblewrapVersion: context.runContext.toolchain.bubblewrapVersion,
      bubblewrapExecutableSha256: context.runContext.toolchain.bubblewrapExecutableSha256,
      runnerNodeModulesSha256: context.runContext.runnerNodeModulesSha256
    }
  }))
  const originalIntegrity = yield* Effect.result(
    inventoryCandidateTree(context.originalCandidateRoot, context.manifest)
  )
  const originalIntegrityFailure = Result.isFailure(originalIntegrity)
    ? "adapter.original-candidate-integrity"
    : originalIntegrity.success.treeSha256 === context.originalCandidateTree.treeSha256
    ? undefined
    : "adapter.original-candidate-mutated"
  return { root: isolated.root, rootStat, process, originalIntegrityFailure }
})

const makeCaseTerminalOutput = (
  machineCase: ArchitectureTrialSpecV2["machineCases"][number],
  observation: Effect.Success<ReturnType<typeof decodeCaseObservationForInvocation>>,
  exactEvidence: boolean
): CaseTerminalOutputV2 => {
  const body = {
    expectedOutcome: machineCase.requiredTerminalOutcome,
    actualOutcome: observation.terminalOutcome,
    requiredAssertionIds: machineCase.execution.assertionIds,
    observedAssertionIds: exactEvidence
      ? [...machineCase.execution.assertionIds].sort(codePointCompare)
      : [],
    executedAssertionIds: [...machineCase.execution.assertionIds].sort(codePointCompare),
    trace: observation.trace,
    facts: observation.facts
  }
  return new CaseTerminalOutputV2({
    resultSha256: computeCaseTerminalResultSha256(body),
    ...body
  })
}

const probeMeasurementValue = (
  measurement: CandidatePatchMeasurement["measurements"][number]
): ProbeMeasurementValue => {
  switch (measurement._tag) {
    case "Hash":
      return new HashMeasurementValue({ value: measurement.value })
    case "Count":
      return new CountMeasurementValue({ value: measurement.value })
    case "IdentifierDelta":
      return new IdentifierDeltaMeasurementValue({ value: measurement.value })
  }
}

const changeKindFactName = (kind: string): string => `change-kind.${kind}.path`

/** A required change kind is accepted only when its convention fact names an observed touched path. */
export const probeChangeKindEvidenceIssues = (
  probe: ArchitectureTrialSpecV2["marginalProbes"][number],
  observation: ArchitectureProbeObservationV2,
  patch: CandidatePatchMeasurement
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const requiredNames = new Set(probe.requiredChangeKinds.map(changeKindFactName))
  for (const kind of probe.requiredChangeKinds) {
    const name = changeKindFactName(kind)
    const fact = observation.facts.find((candidate) => candidate.name === name)
    if (fact === undefined || fact.value._tag !== "Text" ||
      !patch.touchedPathIds.includes(fact.value.value as typeof patch.touchedPathIds[number])) {
      issues.push(`probe.change-kind.${kind}`)
    }
  }
  for (const fact of observation.facts) {
    if (fact.name.startsWith("change-kind.") && !requiredNames.has(fact.name)) {
      issues.push("probe.unexpected-change-kind-evidence")
    }
  }
  return issues
}

const makeProbeTerminalOutput = (
  probe: ArchitectureTrialSpecV2["marginalProbes"][number],
  patch: CandidatePatchMeasurement,
  observation: ArchitectureProbeObservationV2,
  evaluationRecord: ProbeEvaluationRecord | null
): ProbeTerminalOutputV2 => {
  const context = {
    beforeTreeSha256: patch.beforeTreeSha256,
    afterTreeSha256: patch.afterTreeSha256,
    patchSha256: patch.patchSha256,
    laneDeltas: patch.laneDeltas,
    touchedPathIds: patch.touchedPathIds,
    touchedModuleIds: patch.touchedModuleIds,
    touchedPackageIds: patch.touchedPackageIds,
    touchedConceptIds: patch.touchedConceptIds,
    touchedCentralBranchIds: patch.touchedCentralBranchIds,
    touchedOwnerRoleIds: patch.touchedOwnerRoleIds.map((id) => RoleId.make(id)),
    publicSurfaceDelta: patch.publicSurfaceDelta,
    durableFormatDelta: patch.durableFormatDelta,
    dependencyDagDelta: patch.dependencyDagDelta,
    zeroTouchRoleIds: probe.requiredZeroTouchRoleIds,
    changeKinds: probe.requiredChangeKinds,
    facts: observation.facts,
    evaluationRecord,
    observationCount: 1 as const
  }
  const measurements = patch.measurements.map((measurement) => {
    const value = probeMeasurementValue(measurement)
    return new MeasuredProbeMeasurement({
      id: measurement.id,
      value,
      evidenceSha256: computeProbeMeasurementEvidenceSha256(
        probe.id,
        measurement.id,
        value,
        context
      )
    })
  })
  const body = { ...context, measurements }
  return new ProbeTerminalOutputV2({
    resultSha256: computeProbeTerminalResultSha256(body),
    ...body
  })
}

const makeGateTerminalOutput = (
  observation: ArchitectureGateObservationV2
): GateTerminalOutputV2 => {
  const body = { facts: observation.facts }
  return new GateTerminalOutputV2({
    resultSha256: computeGateTerminalResultSha256(body),
    ...body
  })
}

const decodeAfterManifest = Effect.fn("TrialAdapterExecutor.decodeAfterManifest")(function* (
  context: PreparedTrialAdapterContext,
  root: string,
  expectedRoot: Stats
) {
  const path = join(root, context.spec.measurementContract.candidateManifestPath)
  const bytes = yield* Effect.tryPromise({
    try: async () => {
      const rootBefore = await lstat(root)
      if (rootBefore.isSymbolicLink() || !rootBefore.isDirectory() ||
        !sameNodeIdentity(expectedRoot, rootBefore)) {
        throw new Error("sandbox root identity changed before manifest observation")
      }
      const first = await lstat(path)
      if (first.isSymbolicLink() || !first.isFile() || first.nlink !== 1) {
        throw new Error("after manifest must be one unique regular file, never a link or device")
      }
      if (first.size < 0 || first.size > TRIAL_AFTER_MANIFEST_LIMIT_BYTES) {
        throw new Error(
          `after manifest exceeds the ${TRIAL_AFTER_MANIFEST_LIMIT_BYTES} byte safety bound`
        )
      }
      if (typeof constants.O_NOFOLLOW !== "number") throw new Error("O_NOFOLLOW is unavailable")
      let handle: FileHandle | undefined
      try {
        handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
        const opened = await handle.stat()
        if (!opened.isFile() || !sameFileSnapshot(first, opened)) {
          throw new Error("opened after manifest differs from its no-follow path snapshot")
        }
        const output = new Uint8Array(await handle.readFile())
        const afterRead = await handle.stat()
        if (!afterRead.isFile() || !sameFileSnapshot(opened, afterRead) ||
          output.byteLength !== afterRead.size) {
          throw new Error("after manifest changed while its bounded bytes were read")
        }
        const pathAfter = await lstat(path)
        const rootAfter = await lstat(root)
        if (pathAfter.isSymbolicLink() || !pathAfter.isFile() ||
          !sameFileSnapshot(afterRead, pathAfter) ||
          rootAfter.isSymbolicLink() || !rootAfter.isDirectory() ||
          !sameNodeIdentity(expectedRoot, rootAfter)) {
          throw new Error("after manifest or sandbox root changed during observation")
        }
        return output
      } finally {
        await handle?.close()
      }
    },
    catch: (cause) => new TrialAdapterBoundaryError(
      "probe.after-manifest-file",
      cause instanceof Error ? cause.message : String(cause)
    )
  })
  const value = yield* Effect.try({
    try: () => parseCanonicalJsonBytes(bytes),
    catch: (cause) => new TrialAdapterBoundaryError(
      "probe.after-manifest-canonical",
      cause instanceof Error ? cause.message : String(cause)
    )
  })
  return yield* decodeCandidateManifest(value).pipe(Effect.mapError((cause) =>
    new TrialAdapterBoundaryError("probe.after-manifest-schema", cause.message)))
})

const parseCaseObservation = (
  invocation: ArchitectureCaseInvocationV2,
  stdout: Uint8Array
) => Effect.result(Effect.gen(function* () {
  const value = yield* Effect.try({
    try: () => decodeCanonicalOutput(stdout),
    catch: (cause) => new TrialAdapterBoundaryError(
      "adapter.protocol",
      cause instanceof Error ? cause.message : String(cause)
    )
  })
  return yield* decodeCaseObservationForInvocation(invocation, value)
}))

const parseProbeObservation = (
  invocation: ArchitectureProbeInvocationV2,
  stdout: Uint8Array
) => Effect.result(Effect.gen(function* () {
  const value = yield* Effect.try({
    try: () => decodeCanonicalOutput(stdout),
    catch: (cause) => new TrialAdapterBoundaryError(
      "adapter.protocol",
      cause instanceof Error ? cause.message : String(cause)
    )
  })
  return yield* decodeProbeObservationForInvocation(invocation, value)
}))

const parseGateObservation = (
  invocation: ArchitectureGateInvocationV2,
  stdout: Uint8Array
) => Effect.result(Effect.gen(function* () {
  const value = yield* Effect.try({
    try: () => decodeCanonicalOutput(stdout),
    catch: (cause) => new TrialAdapterBoundaryError(
      "adapter.protocol",
      cause instanceof Error ? cause.message : String(cause)
    )
  })
  return yield* decodeGateObservationForInvocation(invocation, value)
}))

const prerequisiteIssues = (
  gate: ArchitectureTrialSpecV2["gateRequirements"][number],
  prerequisites: GateReceiptPrerequisites
): ReadonlyArray<string> => {
  const caseIds = prerequisites.caseReceipts.map(({ caseId }) => caseId)
  const probeIds = prerequisites.probeReceipts.map(({ probeId }) => probeId)
  return [
    ...(canonicalEqual(caseIds, gate.caseIds) ? [] : ["gate.case-prerequisite-mismatch"]),
    ...(canonicalEqual(probeIds, gate.probeIds) ? [] : ["gate.probe-prerequisite-mismatch"]),
    ...(prerequisites.caseReceipts.every(({ execution }) => execution._tag === "Passed")
      ? []
      : ["gate.case-prerequisite-failed"]),
    ...(prerequisites.probeReceipts.every(({ execution }) => execution._tag === "Passed")
      ? []
      : ["gate.probe-prerequisite-failed"])
  ]
}

export const makeTrialAdapterExecutor = (
  context: PreparedTrialAdapterContext,
  options: MakeTrialAdapterExecutorOptions = {}
): TrialAdapterExecutorService => {
  const sandbox = options.sandbox ?? makeTrialCandidateSandbox()
  const isolatedProcess = options.isolatedProcess ?? makeTrialIsolatedProcess()
  const gateEvaluator = options.gateEvaluator ?? denyAllGateEvaluator
  const probeEvaluator = options.probeEvaluator ?? denyAllProbeEvaluator
  const gateCommandExecutor = options.gateCommandExecutor ?? denyAllGateCommandExecutor
  const gitNumstat = options.gitNumstat

  const executeCaseScoped = Effect.fn("TrialAdapterExecutor.executeCase.scoped")(function* (
    caseId: typeof V2CaseId.Type
  ) {
    const machineCase = findCase(context, caseId)
    const invocation = new ArchitectureCaseInvocationV2({
      schemaVersion: "architecture-case-invocation-v2",
      runContextSha256: context.runContext.runContextSha256,
      candidateId: context.manifest.candidateId,
      candidateTreeSha256: context.originalCandidateTree.treeSha256,
      definitionSha256: machineCase.execution.definitionSha256,
      caseId,
      fixtureSha256: machineCase.execution.fixtureSha256,
      fixture: machineCase.fixture
    })
    const stdin = canonicalJsonBytes(caseInvocationCodec.encode(invocation))
    const invocationSha256 = sha256Bytes(stdin)
    const session = yield* Effect.result(makeSession(
      context,
      sandbox,
      isolatedProcess,
      "case",
      stdin
    ))
    let execution: CaseExecutionDisposition
    if (Result.isFailure(session)) {
      execution = new FailedCaseExecution({
        processAttempt: new NotStartedProcessAttempt({ executable: null }),
        invocationSha256,
        terminalOutput: null,
        failureIds: failureIds([sessionFailureId(session.failure)])
      })
    } else if (Result.isFailure(session.success.process)) {
      const error = session.success.process.failure
      execution = new FailedCaseExecution({
        processAttempt: processAttemptFromError(error),
        invocationSha256,
        terminalOutput: null,
        failureIds: failureIds([
          processFailureId(error),
          ...(session.success.originalIntegrityFailure === undefined
            ? []
            : [session.success.originalIntegrityFailure])
        ])
      })
    } else {
      const result = session.success.process.success
      const decoded = yield* parseCaseObservation(invocation, result.stdout)
      if (Result.isFailure(decoded)) {
        execution = new FailedCaseExecution({
          processAttempt: processAttemptFromResult(result),
          invocationSha256,
          terminalOutput: null,
          failureIds: failureIds([
            ...resultFailureIds(result),
            "adapter.protocol",
            ...(session.success.originalIntegrityFailure === undefined
              ? []
              : [session.success.originalIntegrityFailure])
          ])
        })
      } else {
        const observation = decoded.success
        const exactEvidence = observation.terminalOutcome === machineCase.requiredTerminalOutcome &&
          canonicalEqual(observation.trace, machineCase.expectedEvidence.trace) &&
          canonicalEqual(observation.facts, machineCase.expectedEvidence.facts)
        const terminalOutput = makeCaseTerminalOutput(machineCase, observation, exactEvidence)
        const failures = [
          ...resultFailureIds(result),
          ...(exactEvidence ? [] : ["case.evidence-mismatch"]),
          ...(session.success.originalIntegrityFailure === undefined
            ? []
            : [session.success.originalIntegrityFailure])
        ]
        execution = failures.length === 0
          ? new PassedCaseExecution({
            processAttempt: processAttemptFromResult(result),
            invocationSha256,
            terminalOutput
          })
          : new FailedCaseExecution({
            processAttempt: processAttemptFromResult(result),
            invocationSha256,
            terminalOutput,
            failureIds: failureIds(failures)
          })
      }
    }
    return new CaseReceipt({
      caseId,
      definitionSha256: machineCase.execution.definitionSha256,
      fixtureSha256: machineCase.execution.fixtureSha256,
      expectedEvidenceSha256: machineCase.execution.expectedEvidenceSha256,
      execution
    })
  })

  const executeProbeScoped = Effect.fn("TrialAdapterExecutor.executeProbe.scoped")(function* (
    probeId: typeof V2ProbeId.Type
  ) {
    const probe = findProbe(context, probeId)
    const invocation = new ArchitectureProbeInvocationV2({
      schemaVersion: "architecture-probe-invocation-v2",
      runContextSha256: context.runContext.runContextSha256,
      candidateId: context.manifest.candidateId,
      candidateTreeSha256: context.originalCandidateTree.treeSha256,
      definitionSha256: probe.execution.definitionSha256,
      probeId,
      baseFixtureSha256: probe.execution.baseFixtureSha256,
      changeDefinitionSha256: probe.execution.changeDefinitionSha256,
      changeDefinition: probe.changeDefinition
    })
    const stdin = canonicalJsonBytes(probeInvocationCodec.encode(invocation))
    const invocationSha256 = sha256Bytes(stdin)
    const session = yield* Effect.result(makeSession(
      context,
      sandbox,
      isolatedProcess,
      "probe",
      stdin
    ))
    let execution: ProbeExecutionDisposition
    if (Result.isFailure(session)) {
      execution = new FailedProbeExecution({
        processAttempt: new NotStartedProcessAttempt({ executable: null }),
        invocationSha256,
        terminalOutput: null,
        failureIds: failureIds([sessionFailureId(session.failure)])
      })
    } else if (Result.isFailure(session.success.process)) {
      const error = session.success.process.failure
      execution = new FailedProbeExecution({
        processAttempt: processAttemptFromError(error),
        invocationSha256,
        terminalOutput: null,
        failureIds: failureIds([
          processFailureId(error),
          ...(session.success.originalIntegrityFailure === undefined
            ? []
            : [session.success.originalIntegrityFailure])
        ])
      })
    } else {
      const result = session.success.process.success
      const decoded = yield* parseProbeObservation(invocation, result.stdout)
      if (Result.isFailure(decoded)) {
        execution = new FailedProbeExecution({
          processAttempt: processAttemptFromResult(result),
          invocationSha256,
          terminalOutput: null,
          failureIds: failureIds([
            ...resultFailureIds(result),
            "adapter.protocol",
            ...(session.success.originalIntegrityFailure === undefined
              ? []
              : [session.success.originalIntegrityFailure])
          ])
        })
      } else {
        const measured = yield* Effect.result(Effect.gen(function* () {
          if (gitNumstat === undefined) {
            return yield* new TrialAdapterBoundaryError(
              "probe.git-measurement-unavailable",
              "runner preflight did not inject its digest-bound Git numstat service"
            )
          }
          const afterManifest = yield* decodeAfterManifest(
            context,
            session.success.root,
            session.success.rootStat
          )
          const patch = yield* measureCandidatePatch(
            context.originalCandidateRoot,
            context.manifest,
            session.success.root,
            afterManifest,
            gitNumstat
          )
          return { afterManifest, patch }
        }))
        if (Result.isFailure(measured)) {
          execution = new FailedProbeExecution({
            processAttempt: processAttemptFromResult(result),
            invocationSha256,
            terminalOutput: null,
            failureIds: failureIds([
              ...resultFailureIds(result),
              measured.failure instanceof TrialAdapterBoundaryError
                ? measured.failure.failureId
                : "probe.measurement",
              ...(session.success.originalIntegrityFailure === undefined
                ? []
                : [session.success.originalIntegrityFailure])
            ])
          })
        } else {
          const { afterManifest, patch } = measured.success
          const inspection = yield* Effect.result(Effect.gen(function* () {
            const copied = yield* sandbox.create({
              candidateRoot: session.success.root,
              manifest: afterManifest
            })
            const copiedTree = yield* inventoryCandidateTree(copied.root, afterManifest)
            if (copiedTree.treeSha256 !== patch.afterTreeSha256) {
              return yield* new TrialAdapterBoundaryError(
                "probe.inspection-snapshot-mismatch",
                "runner inspection snapshot does not equal the measured after tree"
              )
            }
            return yield* makeProbeEvaluationRecord(probeEvaluator, {
              probe,
              observation: decoded.success,
              patch,
              afterManifest,
              inspectionRoot: copied.root
            }, copiedTree.treeSha256)
          }))
          const evaluatorFailures = Result.isFailure(inspection)
            ? [inspection.failure instanceof TrialAdapterBoundaryError
              ? inspection.failure.failureId
              : inspection.failure instanceof TrialCandidateSandboxError ||
                  inspection.failure instanceof TrialInventoryError
              ? "probe.inspection-snapshot"
              : "probe.runner-evaluator-error"]
            : inspection.success.disposition._tag === "Accepted"
            ? []
            : inspection.success.disposition.failureIds
          const semanticFailures = [
            ...resultFailureIds(result),
            ...(patch.beforeTreeSha256 === context.originalCandidateTree.treeSha256
              ? []
              : ["probe.before-tree-mismatch"]),
            ...(patch.beforeTreeSha256 !== patch.afterTreeSha256 && patch.patchEntries.length > 0
              ? []
              : ["probe.zero-change"]),
            ...(patch.measurements.some((measurement) =>
              measurement._tag === "Count" &&
              (measurement.id === "gross-product-additions" ||
                measurement.id === "gross-product-deletions") &&
              measurement.value > 0
            ) ? [] : ["probe.zero-product-change"]),
            ...(patch.measurements.length === 13 ? [] : ["probe.measurement-count"]),
            ...(patch.touchedOwnerRoleIds.some((id) => probe.requiredZeroTouchRoleIds.includes(
              id as typeof probe.requiredZeroTouchRoleIds[number]
            )) ? ["probe.zero-touch-violation"] : []),
            ...probeChangeKindEvidenceIssues(probe, decoded.success, patch),
            ...evaluatorFailures,
            ...(session.success.originalIntegrityFailure === undefined
              ? []
              : [session.success.originalIntegrityFailure])
          ]
          const terminalOutput = makeProbeTerminalOutput(
            probe,
            patch,
            decoded.success,
            Result.isSuccess(inspection) ? inspection.success : null
          )
          execution = semanticFailures.length === 0
            ? new PassedProbeExecution({
              processAttempt: processAttemptFromResult(result),
              invocationSha256,
              terminalOutput
            })
            : new FailedProbeExecution({
              processAttempt: processAttemptFromResult(result),
              invocationSha256,
              terminalOutput,
              failureIds: failureIds(semanticFailures)
            })
        }
      }
    }
    return new ProbeReceipt({
      probeId,
      definitionSha256: probe.execution.definitionSha256,
      baseFixtureSha256: probe.execution.baseFixtureSha256,
      changeDefinitionSha256: probe.execution.changeDefinitionSha256,
      execution
    })
  })

  const executeGateScoped = Effect.fn("TrialAdapterExecutor.executeGate.scoped")(function* (
    gateId: typeof V2GateId.Type,
    prerequisites: GateReceiptPrerequisites
  ) {
    const gate = findGate(context, gateId)
    const definitionSha256 = gateDefinitionSha256(gate)
    const invocation = new ArchitectureGateInvocationV2({
      schemaVersion: "architecture-gate-invocation-v2",
      runContextSha256: context.runContext.runContextSha256,
      candidateId: context.manifest.candidateId,
      candidateTreeSha256: context.originalCandidateTree.treeSha256,
      definitionSha256,
      gateId,
      lawIds: gate.lawIds.map((id) => ArtifactId.make(id)),
      caseIds: gate.caseIds,
      probeIds: gate.probeIds
    })
    const stdin = canonicalJsonBytes(gateInvocationCodec.encode(invocation))
    const invocationSha256 = sha256Bytes(stdin)
    const commandInput = makeGateCommandInput(
      invocation,
      context.originalCandidateTree.treeSha256
    )
    const preparedContext = yield* Effect.result(Effect.try({
      try: () => ensurePreparedBindings(context),
      catch: (cause) => cause instanceof TrialAdapterBoundaryError
        ? cause
        : new TrialAdapterBoundaryError(
            "adapter.prepared-context-invalid",
            cause instanceof Error ? cause.message : String(cause)
          )
    }))
    const commandInspection = yield* Effect.result(Effect.gen(function* () {
      if (Result.isFailure(preparedContext)) return yield* preparedContext.failure
      const copied = yield* sandbox.create({
        candidateRoot: context.originalCandidateRoot,
        manifest: context.manifest
      })
      const copiedTree = yield* inventoryCandidateTree(copied.root, context.manifest)
      if (copiedTree.treeSha256 !== context.originalCandidateTree.treeSha256) {
        return yield* new TrialAdapterBoundaryError(
          "gate.command-inspection-snapshot-mismatch",
          "runner-owned gate command snapshot does not equal the prepared candidate tree"
        )
      }
      return { root: copied.root }
    }))
    const commandRequest: GateCommandExecutionRequest = {
      gate,
      commandInput,
      inspectionRoot: Result.isSuccess(commandInspection) ? commandInspection.success.root : null
    }
    const command = yield* executeGateCommand(gateCommandExecutor, commandRequest)
    const verifiedCommandInspection = Result.isFailure(commandInspection)
      ? commandInspection
      : yield* Effect.result(Effect.gen(function* () {
          const copiedTree = yield* inventoryCandidateTree(
            commandInspection.success.root,
            context.manifest
          )
          if (copiedTree.treeSha256 !== context.originalCandidateTree.treeSha256) {
            return yield* new TrialAdapterBoundaryError(
              "gate.command-inspection-snapshot-mutated",
              "runner-owned gate command changed its trusted candidate snapshot"
            )
          }
          return commandInspection.success
        }))

    const session = yield* Effect.result(makeSession(
      context,
      sandbox,
      isolatedProcess,
      "gate",
      stdin
    ))
    let adapterAttempt: ProcessAttemptEvidence
    let observation: ArchitectureGateObservationV2 | null = null
    const adapterFailures: Array<string> = []
    const adapterInspection = Result.isFailure(session)
      ? null
      : yield* Effect.result(Effect.gen(function* () {
          const tree = yield* inventoryCandidateTree(session.success.root, context.manifest)
          if (tree.treeSha256 !== context.originalCandidateTree.treeSha256) {
            return yield* new TrialAdapterBoundaryError(
              "gate.inspection-snapshot-mismatch",
              "candidate gate adapter changed its isolated candidate tree"
            )
          }
          return tree
        }))
    const adapterInspectionFailures = adapterInspection !== null && Result.isFailure(adapterInspection)
      ? [adapterInspection.failure instanceof TrialAdapterBoundaryError
        ? adapterInspection.failure.failureId
        : "gate.inspection-snapshot"]
      : []
    adapterFailures.push(...adapterInspectionFailures)
    if (Result.isFailure(session)) {
      adapterAttempt = new NotStartedProcessAttempt({ executable: null })
      adapterFailures.push(sessionFailureId(session.failure))
    } else if (Result.isFailure(session.success.process)) {
      const error = session.success.process.failure
      adapterAttempt = processAttemptFromError(error)
      adapterFailures.push(processFailureId(error))
      if (session.success.originalIntegrityFailure !== undefined) {
        adapterFailures.push(session.success.originalIntegrityFailure)
      }
    } else {
      const result = session.success.process.success
      adapterAttempt = processAttemptFromResult(result)
      adapterFailures.push(...resultFailureIds(result))
      if (session.success.originalIntegrityFailure !== undefined) {
        adapterFailures.push(session.success.originalIntegrityFailure)
      }
      const decoded = yield* parseGateObservation(invocation, result.stdout)
      if (Result.isFailure(decoded)) {
        adapterFailures.push("adapter.protocol")
      } else {
        observation = decoded.success
      }
    }

    const commandInspectionFailures = Result.isFailure(verifiedCommandInspection)
      ? [verifiedCommandInspection.failure instanceof TrialAdapterBoundaryError
        ? verifiedCommandInspection.failure.failureId
        : verifiedCommandInspection.failure instanceof TrialCandidateSandboxError ||
          verifiedCommandInspection.failure instanceof TrialInventoryError
        ? "gate.command-inspection-snapshot"
        : "gate.command-inspection-error"]
      : []
    const evaluationInput: Omit<GateEvaluationInput, "commandAttempt"> | null =
      observation !== null && Result.isSuccess(verifiedCommandInspection) &&
        adapterInspection !== null && Result.isSuccess(adapterInspection)
        ? {
            gate,
            observation,
            inspectionRoot: verifiedCommandInspection.success.root,
            caseReceipts: prerequisites.caseReceipts,
            probeReceipts: prerequisites.probeReceipts
          }
        : null
    const evaluationRecord = yield* makeGateEvaluationRecord(
      gateEvaluator,
      evaluationInput,
      command,
      commandRequest,
      context.originalCandidateTree.treeSha256,
      [
        ...commandInspectionFailures,
        ...adapterInspectionFailures,
        ...(observation === null ? ["gate.candidate-observation-unavailable"] : [])
      ]
    )
    const evaluatorFailures = evaluationRecord.disposition._tag === "Accepted"
      ? []
      : evaluationRecord.disposition.failureIds
    const failures = [
      ...adapterFailures,
      ...(adapterAttempt._tag === "Exited" ? [] : ["adapter.process-incomplete"]),
      ...(gate.scope === context.runContext.candidateScope ? [] : ["gate.scope-mismatch"]),
      ...prerequisiteIssues(gate, prerequisites),
      ...evaluatorFailures
    ]
    const terminalOutput = observation === null ? null : makeGateTerminalOutput(observation)
    const execution: GateExecutionDisposition = failures.length === 0 &&
        adapterAttempt._tag === "Exited" && terminalOutput !== null
      ? new PassedGateExecution({
          processAttempt: adapterAttempt,
          invocationSha256,
          terminalOutput,
          evaluationRecord
        })
      : new FailedGateExecution({
          processAttempt: adapterAttempt,
          invocationSha256,
          terminalOutput,
          evaluationRecord,
          failureIds: failureIds(failures)
        })
    return new GateReceipt({
      gateId,
      definitionSha256,
      command: gate.command,
      caseIds: gate.caseIds,
      probeIds: gate.probeIds,
      expectedExit: gate.expectedExit,
      execution
    })
  })

  const executeCase = Effect.fn("TrialAdapterExecutor.executeCase")(
    (caseId: typeof V2CaseId.Type) => Effect.scoped(executeCaseScoped(caseId))
  )
  const executeProbe = Effect.fn("TrialAdapterExecutor.executeProbe")(
    (probeId: typeof V2ProbeId.Type) => Effect.scoped(executeProbeScoped(probeId))
  )
  const executeGate = Effect.fn("TrialAdapterExecutor.executeGate")((
    gateId: typeof V2GateId.Type,
    prerequisites: GateReceiptPrerequisites
  ) => Effect.scoped(executeGateScoped(gateId, prerequisites)))

  return { executeCase, executeProbe, executeGate }
}

export class TrialAdapterExecutor extends Context.Service<
  TrialAdapterExecutor,
  TrialAdapterExecutorService
>()("@ts-release/architecture-program/TrialAdapterExecutor") {}

export const makeTrialAdapterExecutorLayer = (
  context: PreparedTrialAdapterContext,
  options: MakeTrialAdapterExecutorOptions = {}
) => Layer.succeed(TrialAdapterExecutor, makeTrialAdapterExecutor(context, options))
