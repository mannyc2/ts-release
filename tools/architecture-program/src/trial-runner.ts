import { Context, Effect, Layer, Schema } from "effect"
import { ArtifactId } from "./schema/primitives.js"
import {
  DEFAULT_DENY_GATE_EVALUATOR_ID,
  DEFAULT_DENY_PROBE_EVALUATOR_ID,
  DEFAULT_UNAVAILABLE_OBJECTIVE_DERIVATION_ID,
  type ArchitectureTrialResultV2,
  type CaseReceipt,
  type GateReceipt,
  type MachineTrialResultBodyEncoded,
  type ObjectiveMetric,
  type ProbeReceipt,
  type TrialResultEvaluationAuthority,
  type TrialResultValidationAuthority,
  type TopologyTrialResultBodyEncoded,
  computeMachineTrialResultReceiptId,
  computeTopologyTrialResultReceiptId,
  makeMachineTrialResult,
  makeTopologyTrialResult
} from "./schema/trial-result.js"
import type { V2CandidateId } from "./schema/v2-ids.js"
import {
  RejectedGateEvaluation,
  RejectedProbeEvaluation,
  makeTrialAdapterExecutor,
  type GateEvaluator,
  type PreparedTrialAdapterContext,
  type ProbeEvaluator,
  type TrialAdapterExecutorService
} from "./trial-adapter-executor.js"
import {
  RunnerUnavailableObjectiveValue,
  deriveTrialObjectives,
  type RunnerOwnedObjectiveEvaluator,
  type TrialObjectivesInvariantError
} from "./trial-objectives.js"
import { makeTrialGitNumstat } from "./trial-inventory.js"
import { makeTrialGateCommandExecutor } from "./trial-gate-command.js"
import { makeTrialIsolatedProcess } from "./trial-isolated-process.js"
import {
  TrialRunnerPreflightError,
  makeTrialRunnerPreflight,
  type PreparedTrialRun,
  type TrialRunnerPreflightService
} from "./trial-runner-preflight.js"

export interface TrialRunnerEvaluators {
  readonly gate: GateEvaluator
  readonly probe: ProbeEvaluator
  readonly objective: RunnerOwnedObjectiveEvaluator
}

export type TrialRunnerAdapterFactory = (
  prepared: PreparedTrialRun,
  evaluators: Pick<TrialRunnerEvaluators, "gate" | "probe">
) => TrialAdapterExecutorService

export interface MakeTrialRunnerOptions {
  readonly preflight?: TrialRunnerPreflightService
  readonly adapterFactory?: TrialRunnerAdapterFactory
  readonly evaluators?: Partial<TrialRunnerEvaluators>
}

export class TrialRunnerAssemblyError extends Schema.TaggedError<TrialRunnerAssemblyError>()(
  "TrialRunnerAssemblyError",
  {
    candidateId: Schema.String,
    phase: Schema.String,
    reason: Schema.String,
    message: Schema.String
  }
) {
  constructor(candidateId: string, phase: string, reason: string) {
    super({
      candidateId,
      phase,
      reason,
      message: `Architecture trial runner ${phase} failed for ${candidateId}: ${reason}`
    })
  }
}

export type TrialRunnerError =
  | TrialRunnerPreflightError
  | TrialObjectivesInvariantError
  | TrialRunnerAssemblyError

export interface TrialRunnerService {
  readonly run: (
    repositoryRoot: string,
    candidateId: V2CandidateId
  ) => Effect.Effect<CompletedTrialRun, TrialRunnerError, never>
}

/**
 * The validation authority is deliberately returned beside, not reconstructed
 * from, the receipt. Callers must retain it as the independent content-address
 * authority for any later durable decode.
 */
export interface CompletedTrialRun {
  readonly result: ArchitectureTrialResultV2
  readonly validationAuthority: TrialResultValidationAuthority
}

const makeDefaultTrialRunnerEvaluators = (): TrialRunnerEvaluators => Object.freeze({
  gate: Object.freeze({
    evaluatorId: DEFAULT_DENY_GATE_EVALUATOR_ID,
    evaluate: Effect.fn("TrialRunner.defaultGateEvaluator")(function* () {
      return new RejectedGateEvaluation({
        failureIds: [ArtifactId.make("gate.runner-evaluator-missing")]
      })
    })
  }),
  probe: Object.freeze({
    evaluatorId: DEFAULT_DENY_PROBE_EVALUATOR_ID,
    evaluate: Effect.fn("TrialRunner.defaultProbeEvaluator")(function* () {
      return new RejectedProbeEvaluation({
        failureIds: [ArtifactId.make("probe.runner-evaluator-missing")]
      })
    })
  }),
  objective: Object.freeze({
    derivationId: DEFAULT_UNAVAILABLE_OBJECTIVE_DERIVATION_ID,
    evaluate: Effect.fn("TrialRunner.defaultObjectiveEvaluator")(function* (request) {
      return new RunnerUnavailableObjectiveValue({ id: request.metricId })
    })
  })
})

const liveAdapterFactory: TrialRunnerAdapterFactory = (prepared, evaluators) =>
  makeTrialAdapterExecutor(adapterContext(prepared), {
    gateEvaluator: evaluators.gate,
    probeEvaluator: evaluators.probe,
    gateCommandExecutor: makeTrialGateCommandExecutor({
      repositoryRoot: prepared.repositoryRoot,
      runnerSourceRoot: prepared.runnerSourceRoot,
      expectedRunnerSourceTreeSha256: prepared.runnerSourceInventory.treeSha256,
      runnerPackageManifestPath: prepared.runnerPackageManifestPath,
      expectedRunnerPackageManifestSha256: prepared.runnerPackageManifestSha256,
      runnerTypeScriptConfigPath: prepared.runnerTypeScriptConfigPath,
      expectedRunnerTypeScriptConfigSha256: prepared.runnerTypeScriptConfigSha256,
      bunExecutablePath: prepared.resolvedToolchain.bunExecutablePath,
      expectedBunExecutableSha256: prepared.runContext.toolchain.bunExecutableSha256,
      inheritedPath: process.env.PATH ?? ""
    }),
    gitNumstat: makeTrialGitNumstat({
      gitExecutablePath: prepared.resolvedToolchain.gitExecutablePath,
      expectedGitExecutableSha256: prepared.runContext.toolchain.gitExecutableSha256,
      inheritedPath: process.env.PATH ?? ""
    }),
    isolatedProcess: makeTrialIsolatedProcess({
      preparedAuthority: {
        bubblewrapExecutable: prepared.resolvedToolchain.bubblewrapExecutablePath,
        bunExecutable: prepared.resolvedToolchain.bunExecutablePath,
        runnerNodeModules: prepared.runnerNodeModulesRoot,
        repositoryRoot: prepared.repositoryRoot,
        expectedToolchain: {
          bunVersion: prepared.runContext.toolchain.bun,
          bunExecutableSha256: prepared.runContext.toolchain.bunExecutableSha256,
          bubblewrapVersion: prepared.runContext.toolchain.bubblewrapVersion,
          bubblewrapExecutableSha256:
            prepared.runContext.toolchain.bubblewrapExecutableSha256,
          runnerNodeModulesSha256: prepared.runContext.runnerNodeModulesSha256
        }
      }
    })
  })

const adapterContext = (prepared: PreparedTrialRun): PreparedTrialAdapterContext => ({
  spec: prepared.trialSpec,
  manifest: prepared.candidateManifest,
  originalCandidateRoot: prepared.candidateRoot,
  originalCandidateTree: prepared.candidateTreeInventory,
  runContext: prepared.runContext
})

export const trialQualification = (input: {
  readonly preflightFailures: ReadonlyArray<string>
  readonly caseReceipts: ReadonlyArray<CaseReceipt>
  readonly probeReceipts: ReadonlyArray<ProbeReceipt>
  readonly gateReceipts: ReadonlyArray<GateReceipt>
  readonly objectiveMetrics: ReadonlyArray<ObjectiveMetric>
}): "Passed" | "Rejected" => input.preflightFailures.length === 0 &&
    [...input.caseReceipts, ...input.probeReceipts, ...input.gateReceipts]
      .every(({ execution }) => execution._tag === "Passed") &&
    input.objectiveMetrics.every(({ _tag }) => _tag === "Measured")
  ? "Passed"
  : "Rejected"

const evaluationAuthorityForTrustedRunnerOutputs = (input: {
  readonly probeReceipts: ReadonlyArray<ProbeReceipt>
  readonly gateReceipts: ReadonlyArray<GateReceipt>
  readonly objectiveMetrics: ReadonlyArray<ObjectiveMetric>
}): TrialResultEvaluationAuthority => ({
  probeEvaluations: input.probeReceipts.map((receipt) => {
    const execution = receipt.execution
    const record = execution._tag === "NotRun" || execution.terminalOutput === null
      ? null
      : execution.terminalOutput.evaluationRecord
    return {
      probeId: receipt.probeId,
      evaluatorId: record?.evaluatorId ?? null,
      recordSha256: record?.recordSha256 ?? null
    }
  }),
  gateEvaluations: input.gateReceipts.map((receipt) => {
    const record = receipt.execution._tag === "NotRun"
      ? null
      : receipt.execution.evaluationRecord
    return {
      gateId: receipt.gateId,
      evaluatorId: record?.evaluatorId ?? null,
      recordSha256: record?.recordSha256 ?? null
    }
  }),
  objectiveDerivations: input.objectiveMetrics.map((metric) => ({
    metricId: metric.id,
    derivationId: metric.derivationRecord.derivationId,
    recordSha256: metric.derivationRecord.recordSha256
  }))
})

const assembleTrialResult = Effect.fn("TrialRunner.assembleTrialResult")(function* (
  prepared: PreparedTrialRun,
  adapter: TrialAdapterExecutorService,
  objectiveEvaluator: RunnerOwnedObjectiveEvaluator,
  runnerAuthorityFailures: ReadonlyArray<typeof ArtifactId.Type>
) {
  const caseReceipts: Array<CaseReceipt> = []
  for (const machineCase of prepared.trialSpec.machineCases) {
    caseReceipts.push(yield* adapter.executeCase(machineCase.id))
  }

  const probeReceipts: Array<ProbeReceipt> = []
  for (const probe of prepared.trialSpec.marginalProbes) {
    probeReceipts.push(yield* adapter.executeProbe(probe.id))
  }

  const casesById = new Map(caseReceipts.map((receipt) => [receipt.caseId, receipt] as const))
  const probesById = new Map(probeReceipts.map((receipt) => [receipt.probeId, receipt] as const))
  const gateDefinitions = prepared.trialSpec.gateRequirements.filter(
    ({ scope }) => scope === prepared.runContext.candidateScope
  )
  const gateReceipts: Array<GateReceipt> = []
  for (const gate of gateDefinitions) {
    gateReceipts.push(yield* adapter.executeGate(gate.id, {
      caseReceipts: gate.caseIds.flatMap((caseId) => {
        const receipt = casesById.get(caseId)
        return receipt === undefined ? [] : [receipt]
      }),
      probeReceipts: gate.probeIds.flatMap((probeId) => {
        const receipt = probesById.get(probeId)
        return receipt === undefined ? [] : [receipt]
      })
    }))
  }

  const preflightFailures = [...runnerAuthorityFailures]
  const objectiveMetrics = yield* deriveTrialObjectives({
    scope: prepared.runContext.candidateScope,
    runContextSha256: prepared.runContext.runContextSha256,
    preflightFailures,
    candidateTreeEntries: prepared.candidateTreeInventory.entries,
    candidateManifest: prepared.candidateManifest,
    caseReceipts,
    probeReceipts,
    gateReceipts
  }, objectiveEvaluator)
  const qualification = trialQualification({
    preflightFailures,
    caseReceipts,
    probeReceipts,
    gateReceipts,
    objectiveMetrics
  })
  const shared = {
    programId: "ts-release-architecture-program" as const,
    runContextSha256: prepared.runContext.runContextSha256,
    runContext: prepared.runContext,
    preflightFailures,
    caseReceipts,
    probeReceipts,
    gateReceipts,
    objectiveMetrics,
    qualification
  }
  return yield* Effect.try({
    try: (): CompletedTrialRun => {
      const validationAuthority = {
        ...prepared.validationAuthority,
        expectedReceiptId: prepared.runContext.candidateScope === "machine"
          ? computeMachineTrialResultReceiptId({
            schemaVersion: "machine-trial-result-v2",
            ...shared
          } satisfies MachineTrialResultBodyEncoded)
          : computeTopologyTrialResultReceiptId({
            schemaVersion: "topology-trial-result-v2",
            ...shared
          } satisfies TopologyTrialResultBodyEncoded),
        evaluationAuthority: evaluationAuthorityForTrustedRunnerOutputs({
          probeReceipts,
          gateReceipts,
          objectiveMetrics
        })
      }

      return {
        result: prepared.runContext.candidateScope === "machine"
          ? makeMachineTrialResult({
            schemaVersion: "machine-trial-result-v2",
            ...shared
          } satisfies MachineTrialResultBodyEncoded, validationAuthority)
          : makeTopologyTrialResult({
            schemaVersion: "topology-trial-result-v2",
            ...shared
          } satisfies TopologyTrialResultBodyEncoded, validationAuthority),
        validationAuthority
      }
    },
    catch: (cause) => new TrialRunnerAssemblyError(
      prepared.runContext.candidateId,
      "result assembly",
      cause instanceof Error ? cause.message : String(cause)
    )
  })
})

export const makeTrialRunner = (
  options: MakeTrialRunnerOptions = {}
): TrialRunnerService => {
  // Snapshot every override exactly once. Accessor/Proxy-backed options must not
  // supply a custom authority and later hide it from the non-live marker.
  const preflightOverride = options.preflight
  const adapterFactoryOverride = options.adapterFactory
  const evaluatorOverrides = options.evaluators
  const gateEvaluatorOverride = evaluatorOverrides?.gate
  const probeEvaluatorOverride = evaluatorOverrides?.probe
  const objectiveEvaluatorOverride = evaluatorOverrides?.objective
  const preflight = preflightOverride ?? makeTrialRunnerPreflight()
  const adapterFactory = adapterFactoryOverride ?? liveAdapterFactory
  const defaults = makeDefaultTrialRunnerEvaluators()
  const evaluators: TrialRunnerEvaluators = {
    gate: gateEvaluatorOverride ?? defaults.gate,
    probe: probeEvaluatorOverride ?? defaults.probe,
    objective: objectiveEvaluatorOverride ?? defaults.objective
  }
  const runnerAuthorityFailures = [
    ...(adapterFactoryOverride === undefined ? [] : ["runner.nonlive-adapter-factory"]),
    ...(gateEvaluatorOverride === undefined ? [] : ["runner.nonlive-gate-evaluator"]),
    ...(objectiveEvaluatorOverride === undefined ? [] : ["runner.nonlive-objective-evaluator"]),
    ...(preflightOverride === undefined ? [] : ["runner.nonlive-preflight"]),
    ...(probeEvaluatorOverride === undefined ? [] : ["runner.nonlive-probe-evaluator"])
  ].map((id) => ArtifactId.make(id))

  const run = Effect.fn("TrialRunner.run")(function* (
    repositoryRoot: string,
    candidateId: V2CandidateId
  ) {
    // No receipt exists until preflight has produced its hash-bound context and authority.
    const prepared = yield* preflight.prepare(repositoryRoot, candidateId)
    const adapter = yield* Effect.try({
      try: () => adapterFactory(prepared, evaluators),
      catch: (cause) => new TrialRunnerAssemblyError(
        candidateId,
        "adapter construction",
        cause instanceof Error ? cause.message : String(cause)
      )
    })
    return yield* assembleTrialResult(
      prepared,
      adapter,
      evaluators.objective,
      runnerAuthorityFailures
    )
  })

  return { run }
}

export class TrialRunner extends Context.Service<TrialRunner, TrialRunnerService>()(
  "@ts-release/architecture-program/TrialRunner"
) {
  static readonly layer = Layer.sync(TrialRunner, () => makeTrialRunner())
}

export const makeTrialRunnerLayer = (options: MakeTrialRunnerOptions) =>
  Layer.sync(TrialRunner, () => makeTrialRunner(options))

export const TrialRunnerLive = TrialRunner.layer
