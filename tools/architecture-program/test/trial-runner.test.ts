import type { Stats } from "node:fs"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "../src/canonical-document.js"
import {
  decodeCandidateManifest,
  encodeCandidateManifest
} from "../src/schema/candidate-manifest.js"
import { ArtifactId } from "../src/schema/primitives.js"
import {
  SelectedMachineReceiptBindingV2,
  TrialRunContextToolchain,
  makeTrialRunContext
} from "../src/schema/run-context.js"
import {
  CaseReceipt,
  GateReceipt,
  NotRunCaseExecution,
  NotRunGateExecution,
  NotRunProbeExecution,
  ProbeReceipt,
  decodeMachineTrialResult,
  decodeTopologyTrialResult
} from "../src/schema/trial-result.js"
import {
  decodeArchitectureTrialSpec,
  gateDefinitionSha256
} from "../src/schema/trial-spec.js"
import {
  V2_CANDIDATE_DEFINITIONS,
  V2_CANDIDATE_IDS,
  type V2CandidateId
} from "../src/schema/v2-ids.js"
import {
  CandidateTreeInventory,
  CanonicalTreeEntry,
  canonicalTreeSha256
} from "../src/trial-inventory.js"
import { hashCanonicalDocumentBytes, hashCanonicalValue, sha256Bytes } from "../src/trial-hash.js"
import { computeTrialRunnerSourceClosureSha256 } from "../src/trial-runner-source-closure.js"
import {
  RuntimeDependencyTreeInventory,
  runtimeDependencyTreeSha256
} from "../src/trial-runtime-dependency-tree.js"
import { LIVE_GATE_EVALUATOR_ID } from "../src/trial-gate-evaluator.js"
import { LIVE_PROBE_EVALUATOR_ID } from "../src/trial-probe-evaluator.js"
import type { PreparedTrialRun } from "../src/trial-runner-preflight.js"
import { TrialRunnerPreflightError } from "../src/trial-runner-preflight.js"
import {
  TrialRunnerAssemblyError,
  makeTrialRunner,
  trialQualification,
  type MakeTrialRunnerOptions,
  type TrialRunnerEvaluators
} from "../src/trial-runner.js"

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(moduleDirectory, "../../..")
const trialSpecPath = resolve(
  repositoryRoot,
  "docs/refactor/architecture-program/inputs/trial-spec.json"
)
const rawTrialSpecBytes = new Uint8Array(readFileSync(trialSpecPath))
const trialSpec = Effect.runSync(decodeArchitectureTrialSpec(
  parseCanonicalJsonBytes(rawTrialSpecBytes)
))
const testHashDomain = "ts-release/architecture-trial-runner-test/v2"
const sha256 = (value: unknown) => hashCanonicalValue(testHashDomain, value)
const textEncoder = new TextEncoder()
const selectedMachineReceipt = new SelectedMachineReceiptBindingV2({
  selectedMachineCandidateId: "M1-extracted-fold",
  selectedMachineReceiptId: sha256("selected machine result receipt")
})

const upstreamMachineReceiptFor = (candidateId: V2CandidateId) =>
  V2_CANDIDATE_DEFINITIONS[candidateId].scope === "machine"
    ? null
    : selectedMachineReceipt

const manifestDocument = (candidateId: V2CandidateId) => {
  const definition = V2_CANDIDATE_DEFINITIONS[candidateId]
  return {
    schemaVersion: "ts-release/architecture-candidate-manifest/v2",
    candidateId,
    scope: definition.scope,
    model: definition.model,
    implementationRoot: definition.implementationRoot,
    files: [
      {
        path: "src/index.ts",
        laneId: "product-source",
        moduleId: "module.core",
        packageId: "package.core",
        ownerRoleIds: ["role.kernel"],
        conceptIds: ["concept.machine"],
        centralBranchIds: ["branch.main"]
      },
      {
        path: "trial-adapter.ts",
        laneId: "tooling",
        moduleId: null,
        packageId: null,
        ownerRoleIds: [],
        conceptIds: [],
        centralBranchIds: []
      },
      {
        path: "trial-candidate.json",
        laneId: "tooling",
        moduleId: null,
        packageId: null,
        ownerRoleIds: [],
        conceptIds: [],
        centralBranchIds: []
      }
    ],
    publicSurfaceIds: ["public.main"],
    durableFormatIds: ["format.journal-v2"],
    dependencyEdges: []
  } as const
}

const candidateDefinition = (candidateId: V2CandidateId) => {
  const definition = trialSpec.machineCandidates.find(({ id }) => id === candidateId) ??
    trialSpec.topologyCandidates.find(({ id }) => id === candidateId)
  if (definition === undefined) throw new Error(`missing candidate ${candidateId}`)
  return definition
}

const makePrepared = (candidateId: V2CandidateId): PreparedTrialRun => {
  const definition = candidateDefinition(candidateId)
  const identity = V2_CANDIDATE_DEFINITIONS[candidateId]
  const candidateManifest = Effect.runSync(decodeCandidateManifest(manifestDocument(candidateId)))
  const rawCandidateManifestBytes = canonicalJsonBytes(encodeCandidateManifest(candidateManifest))
  const rawCandidateManifestSha256 = hashCanonicalDocumentBytes(rawCandidateManifestBytes)
  const contentByPath = new Map([
    ["src/index.ts", textEncoder.encode("export const candidate = true\n")],
    ["trial-adapter.ts", textEncoder.encode("export const adapter = true\n")],
    ["trial-candidate.json", rawCandidateManifestBytes]
  ])
  const candidateEntries = candidateManifest.files.map(({ path }) => {
    const bytes = contentByPath.get(path)
    if (bytes === undefined) throw new Error(`missing fixture bytes for ${path}`)
    return new CanonicalTreeEntry({
      path,
      mode: "100644",
      bytes: bytes.byteLength,
      sha256: path === "trial-candidate.json"
        ? rawCandidateManifestSha256
        : sha256([candidateId, path])
    })
  })
  const candidateTreeInventory = new CandidateTreeInventory({
    entries: candidateEntries,
    treeSha256: canonicalTreeSha256(candidateEntries)
  })
  const runnerSourceInventory = new CandidateTreeInventory({
    entries: [],
    treeSha256: canonicalTreeSha256([])
  })
  const runnerPackageManifestPath = resolve(
    repositoryRoot,
    trialSpec.receiptContract.runnerPackageManifestPath
  )
  const rawRunnerPackageManifestBytes = new Uint8Array(readFileSync(runnerPackageManifestPath))
  const runnerPackageManifestSha256 = sha256Bytes(rawRunnerPackageManifestBytes)
  const runnerTypeScriptConfigPath = resolve(
    repositoryRoot,
    trialSpec.receiptContract.runnerTypeScriptConfigPath
  )
  const rawRunnerTypeScriptConfigBytes = new Uint8Array(readFileSync(runnerTypeScriptConfigPath))
  const runnerTypeScriptConfigSha256 = sha256Bytes(rawRunnerTypeScriptConfigBytes)
  const runnerSourceSha256 = computeTrialRunnerSourceClosureSha256(
    runnerSourceInventory.treeSha256,
    runnerPackageManifestSha256,
    runnerTypeScriptConfigSha256
  )
  const runtimeInventory = new RuntimeDependencyTreeInventory({
    entries: [],
    treeSha256: runtimeDependencyTreeSha256([])
  })
  const toolchain = new TrialRunContextToolchain({
    bun: "1.3.14",
    bunExecutableSha256: sha256("bun executable"),
    typescript: "6.0.3",
    effect: "4.0.0-rc.108",
    git: "2.51.0",
    gitExecutableSha256: sha256("git executable"),
    bubblewrapVersion: "0.11.0",
    bubblewrapExecutableSha256: sha256("bubblewrap executable")
  })
  const scopeGates = trialSpec.gateRequirements.filter(({ scope }) => scope === identity.scope)
  const runContext = makeTrialRunContext({
    schemaVersion: "ts-release/architecture-trial-run-context/v2",
    trialSpecSha256: hashCanonicalDocumentBytes(rawTrialSpecBytes),
    executionContractSha256: trialSpec.executionContract.contractSha256,
    measurementContractSha256: trialSpec.measurementContract.contractSha256,
    topologyFixtureSha256: trialSpec.topologyFixture.fixtureSha256,
    candidateId,
    candidateScope: identity.scope,
    candidateModel: identity.model,
    implementationRoot: identity.implementationRoot,
    candidateManifestSha256: rawCandidateManifestSha256,
    candidateTreeSha256: candidateTreeInventory.treeSha256,
    upstreamMachineReceipt: upstreamMachineReceiptFor(candidateId),
    runnerSourceSha256,
    runnerNodeModulesSha256: runtimeInventory.treeSha256,
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
    gateDefinitionBindings: scopeGates.map((gate) => ({
      gateId: gate.id,
      definitionSha256: gateDefinitionSha256(gate)
    }))
  })
  const candidateRoot = resolve(repositoryRoot, identity.implementationRoot)
  const runnerNodeModulesRoot = resolve(repositoryRoot, "tools/architecture-program/node_modules")
  const resolvedToolchain = {
    context: toolchain,
    bunExecutablePath: "/fixture/bin/bun",
    gitExecutablePath: "/fixture/bin/git",
    bubblewrapExecutablePath: "/usr/bin/bwrap",
    packageManifests: {
      typescript: {
        path: resolve(runnerNodeModulesRoot, "typescript/package.json"),
        sha256: sha256("typescript package manifest")
      },
      effect: {
        path: resolve(runnerNodeModulesRoot, "effect/package.json"),
        sha256: sha256("effect package manifest")
      }
    }
  }
  const validationAuthority = {
    trialSpec,
    rawTrialSpecSha256: hashCanonicalDocumentBytes(rawTrialSpecBytes),
    candidateManifest,
    rawCandidateManifestSha256,
    candidateTreeSha256: candidateTreeInventory.treeSha256,
    runnerSourceSha256,
    runnerNodeModulesSha256: runtimeInventory.treeSha256,
    toolchain
  }
  return {
    repositoryRoot,
    architectureProgramRoot: resolve(repositoryRoot, "tools/architecture-program"),
    trialSpecPath,
    rawTrialSpecBytes,
    rawTrialSpecSha256: hashCanonicalDocumentBytes(rawTrialSpecBytes),
    trialSpec,
    candidateDefinition: definition,
    candidateRoot,
    candidateManifestPath: resolve(candidateRoot, "trial-candidate.json"),
    rawCandidateManifestBytes,
    rawCandidateManifestSha256,
    candidateManifest,
    candidateTreeInventory,
    runnerSourceRoot: resolve(repositoryRoot, trialSpec.receiptContract.runnerSourceRoot),
    runnerSourceInventory,
    runnerPackageManifestPath,
    rawRunnerPackageManifestBytes,
    runnerPackageManifestSha256,
    runnerTypeScriptConfigPath,
    rawRunnerTypeScriptConfigBytes,
    runnerTypeScriptConfigSha256,
    runnerNodeModulesRoot,
    runnerNodeModulesTree: {
      root: {
        root: runnerNodeModulesRoot,
        realPath: runnerNodeModulesRoot,
        stat: {} as Stats
      },
      inventory: runtimeInventory
    },
    resolvedToolchain,
    toolchain,
    runContext,
    validationAuthority
  }
}

interface GatePrerequisiteCall {
  readonly gateId: string
  readonly caseIds: ReadonlyArray<string>
  readonly probeIds: ReadonlyArray<string>
}

const makeNotRunAdapter = (
  prepared: PreparedTrialRun,
  operationLog: Array<string>,
  prerequisiteLog: Array<GatePrerequisiteCall>
) => ({
  executeCase: (caseId: (typeof prepared.trialSpec.machineCases)[number]["id"]) => {
    operationLog.push(`case:${caseId}`)
    const definition = prepared.trialSpec.machineCases.find(({ id }) => id === caseId)!
    return Effect.succeed(new CaseReceipt({
      caseId,
      definitionSha256: definition.execution.definitionSha256,
      fixtureSha256: definition.execution.fixtureSha256,
      expectedEvidenceSha256: definition.execution.expectedEvidenceSha256,
      execution: new NotRunCaseExecution({
        failureIds: [ArtifactId.make("case.runner-fail-closed")]
      })
    }))
  },
  executeProbe: (probeId: (typeof prepared.trialSpec.marginalProbes)[number]["id"]) => {
    operationLog.push(`probe:${probeId}`)
    const definition = prepared.trialSpec.marginalProbes.find(({ id }) => id === probeId)!
    return Effect.succeed(new ProbeReceipt({
      probeId,
      definitionSha256: definition.execution.definitionSha256,
      baseFixtureSha256: definition.execution.baseFixtureSha256,
      changeDefinitionSha256: definition.execution.changeDefinitionSha256,
      execution: new NotRunProbeExecution({
        failureIds: [ArtifactId.make("probe.runner-fail-closed")]
      })
    }))
  },
  executeGate: (
    gateId: (typeof prepared.trialSpec.gateRequirements)[number]["id"],
    prerequisites: {
      readonly caseReceipts: ReadonlyArray<CaseReceipt>
      readonly probeReceipts: ReadonlyArray<ProbeReceipt>
    }
  ) => {
    operationLog.push(`gate:${gateId}`)
    prerequisiteLog.push({
      gateId,
      caseIds: prerequisites.caseReceipts.map(({ caseId }) => caseId),
      probeIds: prerequisites.probeReceipts.map(({ probeId }) => probeId)
    })
    const definition = prepared.trialSpec.gateRequirements.find(({ id }) => id === gateId)!
    return Effect.succeed(new GateReceipt({
      gateId,
      definitionSha256: gateDefinitionSha256(definition),
      command: definition.command,
      caseIds: definition.caseIds,
      probeIds: definition.probeIds,
      expectedExit: definition.expectedExit,
      execution: new NotRunGateExecution({
        failureIds: [ArtifactId.make("gate.runner-fail-closed")]
      })
    }))
  }
})

const expectedOperationOrder = (prepared: PreparedTrialRun): ReadonlyArray<string> => [
  ...prepared.trialSpec.machineCases.map(({ id }) => `case:${id}`),
  ...prepared.trialSpec.marginalProbes.map(({ id }) => `probe:${id}`),
  ...prepared.trialSpec.gateRequirements
    .filter(({ scope }) => scope === prepared.runContext.candidateScope)
    .map(({ id }) => `gate:${id}`)
]

describe("candidate-neutral trial runner", () => {
  it.effect("fails before context with the typed preflight error and creates no receipt boundary", () =>
    Effect.gen(function* () {
      const failure = new TrialRunnerPreflightError(
        "resolve candidate implementation root",
        "/missing",
        "candidate is absent"
      )
      let adapterConstructions = 0
      const runner = makeTrialRunner({
        preflight: { prepare: () => Effect.fail(failure) },
        adapterFactory: () => {
          adapterConstructions += 1
          throw new Error("must not construct")
        }
      })

      const error = yield* runner.run(repositoryRoot, "M1-extracted-fold", null).pipe(Effect.flip)

      expect(error).toBe(failure)
      expect(error).toBeInstanceOf(TrialRunnerPreflightError)
      expect(adapterConstructions).toBe(0)
      expect(error).not.toHaveProperty("receiptId")
    }))

  it.effect("uses one path for all five candidates and exhausts frozen work in exact order", () =>
    Effect.gen(function* () {
      const preparedById = new Map(V2_CANDIDATE_IDS.map((id) => [id, makePrepared(id)] as const))
      const operations = new Map<V2CandidateId, Array<string>>()
      const prerequisites = new Map<V2CandidateId, Array<GatePrerequisiteCall>>()
      const evaluatorIdentities = new Set<TrialRunnerEvaluators["gate"]>()
      const probeEvaluatorIdentities = new Set<TrialRunnerEvaluators["probe"]>()
      let capturedEvaluators: Pick<TrialRunnerEvaluators, "gate" | "probe"> | undefined
      const runner = makeTrialRunner({
        preflight: {
          prepare: (_root, candidateId, upstreamMachineReceipt) => {
            expect(upstreamMachineReceipt).toEqual(
              preparedById.get(candidateId)!.runContext.upstreamMachineReceipt
            )
            return Effect.succeed(preparedById.get(candidateId)!)
          }
        },
        adapterFactory: (prepared, evaluators) => {
          expect(Object.isFrozen(evaluators.gate)).toBe(true)
          expect(Object.isFrozen(evaluators.probe)).toBe(true)
          expect(Reflect.set(evaluators.gate, "evaluate", () => Effect.die("mutated"))).toBe(false)
          expect(Reflect.set(evaluators.probe, "evaluate", () => Effect.die("mutated"))).toBe(false)
          capturedEvaluators ??= evaluators
          evaluatorIdentities.add(evaluators.gate)
          probeEvaluatorIdentities.add(evaluators.probe)
          const candidateOperations: Array<string> = []
          const candidatePrerequisites: Array<GatePrerequisiteCall> = []
          operations.set(prepared.runContext.candidateId, candidateOperations)
          prerequisites.set(prepared.runContext.candidateId, candidatePrerequisites)
          return makeNotRunAdapter(prepared, candidateOperations, candidatePrerequisites)
        }
      })

      for (const candidateId of V2_CANDIDATE_IDS) {
        const prepared = preparedById.get(candidateId)!
        const completed = yield* runner.run(
          repositoryRoot,
          candidateId,
          upstreamMachineReceiptFor(candidateId)
        )
        const result = completed.result
        expect(result.runContext.candidateId).toBe(candidateId)
        expect(result.qualification).toBe("Rejected")
        expect(result.preflightFailures).toEqual([
          "runner.nonlive-adapter-factory",
          "runner.nonlive-preflight"
        ])
        expect(result.caseReceipts).toHaveLength(16)
        expect(result.probeReceipts).toHaveLength(9)
        expect(operations.get(candidateId)).toEqual(expectedOperationOrder(prepared))
        expect(result.caseReceipts.every(({ execution }) => execution._tag === "NotRun")).toBe(true)
        expect(result.probeReceipts.every(({ execution }) => execution._tag === "NotRun")).toBe(true)
        expect(result.gateReceipts.every(({ execution }) => execution._tag === "NotRun")).toBe(true)
        expect(result.objectiveMetrics.some(({ _tag }) => _tag === "Unavailable")).toBe(true)

        const definitions = prepared.trialSpec.gateRequirements.filter(
          ({ scope }) => scope === prepared.runContext.candidateScope
        )
        expect(prerequisites.get(candidateId)).toEqual(definitions.map((gate) => ({
          gateId: gate.id,
          caseIds: gate.caseIds,
          probeIds: gate.probeIds
        })))
        if (result.schemaVersion === "machine-trial-result-v2") {
          yield* decodeMachineTrialResult(result, completed.validationAuthority)
        } else {
          yield* decodeTopologyTrialResult(result, completed.validationAuthority)
        }
      }

      // Gate and probe authority close over preflight-bound repository/input or
      // candidate inventory, so every prepared candidate receives a distinct
      // immutable evaluator.
      expect(evaluatorIdentities.size).toBe(V2_CANDIDATE_IDS.length)
      expect(probeEvaluatorIdentities.size).toBe(V2_CANDIDATE_IDS.length)
      if (capturedEvaluators === undefined) throw new Error("adapter was never constructed")
      expect(capturedEvaluators.gate.evaluatorId).toBe(LIVE_GATE_EVALUATOR_ID)
      expect(capturedEvaluators.probe.evaluatorId).toBe(LIVE_PROBE_EVALUATOR_ID)
      const gateDenial = yield* capturedEvaluators.gate.evaluate({} as never)
      expect(gateDenial._tag).toBe("Rejected")
    }))

  it("qualifies exactly clean, fully passed, fully measured evidence", () => {
    const passedReceipt = { execution: { _tag: "Passed" } } as unknown as CaseReceipt
    const failedReceipt = { execution: { _tag: "Failed" } } as unknown as CaseReceipt
    const measured = { _tag: "Measured" } as unknown as Parameters<typeof trialQualification>[0][
      "objectiveMetrics"
    ][number]
    const unavailable = { _tag: "Unavailable" } as unknown as Parameters<
      typeof trialQualification
    >[0]["objectiveMetrics"][number]
    const clean = {
      preflightFailures: [],
      caseReceipts: [passedReceipt],
      probeReceipts: [passedReceipt as unknown as ProbeReceipt],
      gateReceipts: [passedReceipt as unknown as GateReceipt],
      objectiveMetrics: [measured]
    }

    expect(trialQualification(clean)).toBe("Passed")
    expect(trialQualification({ ...clean, preflightFailures: ["preflight.failed"] })).toBe("Rejected")
    expect(trialQualification({ ...clean, caseReceipts: [failedReceipt] })).toBe("Rejected")
    expect(trialQualification({ ...clean, objectiveMetrics: [unavailable] })).toBe("Rejected")
  })

  it.effect("marks every runtime override as nonqualifying authority", () =>
    Effect.gen(function* () {
      const prepared = makePrepared("M1-extracted-fold")
      const unavailable = {
        derivationId: ArtifactId.make("objective-derivation.test-unavailable-v1"),
        evaluate: (request: { readonly metricId: any }) => Effect.succeed({
          _tag: "Unavailable" as const,
          id: request.metricId
        })
      }
      const runner = makeTrialRunner({
        preflight: { prepare: () => Effect.succeed(prepared) },
        adapterFactory: (value) => makeNotRunAdapter(value, [], []),
        evaluators: {
          gate: {
            evaluatorId: ArtifactId.make("gate-evaluator.test-rejected-v1"),
            evaluate: () => Effect.succeed({
            _tag: "Rejected" as const,
            failureIds: [ArtifactId.make("gate.test-rejection")]
          }) },
          probe: {
            evaluatorId: ArtifactId.make("probe-evaluator.test-rejected-v1"),
            evaluate: () => Effect.succeed({
            _tag: "Rejected" as const,
            failureIds: [ArtifactId.make("probe.test-rejection")]
          }) },
          objective: unavailable
        }
      })

      const { result } = yield* runner.run(repositoryRoot, "M1-extracted-fold", null)

      expect(result.preflightFailures).toEqual([
        "runner.nonlive-adapter-factory",
        "runner.nonlive-gate-evaluator",
        "runner.nonlive-objective-evaluator",
        "runner.nonlive-preflight",
        "runner.nonlive-probe-evaluator"
      ])
      expect(result.qualification).toBe("Rejected")
    }))

  it.effect("snapshots accessor-backed overrides once before marking their authority", () =>
    Effect.gen(function* () {
      const prepared = makePrepared("M1-extracted-fold")
      const reads = {
        adapterFactory: 0,
        evaluators: 0,
        gate: 0,
        objective: 0,
        preflight: 0,
        probe: 0
      }
      const evaluatorOverrides = Object.defineProperties({}, {
        gate: {
          get: () => {
            reads.gate += 1
            return reads.gate === 1
              ? {
                  evaluatorId: ArtifactId.make("gate-evaluator.accessor-v1"),
                  evaluate: () => Effect.succeed({
                    _tag: "Rejected" as const,
                    failureIds: [ArtifactId.make("gate.accessor-rejection")]
                  })
                }
              : undefined
          }
        },
        objective: {
          get: () => {
            reads.objective += 1
            return reads.objective === 1
              ? {
                  derivationId: ArtifactId.make("objective-derivation.accessor-v1"),
                  evaluate: (request: { readonly metricId: any }) => Effect.succeed({
                    _tag: "Unavailable" as const,
                    id: request.metricId
                  })
                }
              : undefined
          }
        },
        probe: {
          get: () => {
            reads.probe += 1
            return reads.probe === 1
              ? {
                  evaluatorId: ArtifactId.make("probe-evaluator.accessor-v1"),
                  evaluate: () => Effect.succeed({
                    _tag: "Rejected" as const,
                    failureIds: [ArtifactId.make("probe.accessor-rejection")]
                  })
                }
              : undefined
          }
        }
      })
      const options = Object.defineProperties({}, {
        adapterFactory: {
          get: () => {
            reads.adapterFactory += 1
            return reads.adapterFactory === 1
              ? (value: PreparedTrialRun) => makeNotRunAdapter(value, [], [])
              : undefined
          }
        },
        evaluators: {
          get: () => {
            reads.evaluators += 1
            return reads.evaluators === 1 ? evaluatorOverrides : undefined
          }
        },
        preflight: {
          get: () => {
            reads.preflight += 1
            return reads.preflight === 1
              ? { prepare: () => Effect.succeed(prepared) }
              : undefined
          }
        }
      }) as MakeTrialRunnerOptions

      const { result } = yield* makeTrialRunner(options).run(
        repositoryRoot,
        "M1-extracted-fold",
        null
      )

      expect(reads).toEqual({
        adapterFactory: 1,
        evaluators: 1,
        gate: 1,
        objective: 1,
        preflight: 1,
        probe: 1
      })
      expect(result.preflightFailures).toEqual([
        "runner.nonlive-adapter-factory",
        "runner.nonlive-gate-evaluator",
        "runner.nonlive-objective-evaluator",
        "runner.nonlive-preflight",
        "runner.nonlive-probe-evaluator"
      ])
      expect(result.qualification).toBe("Rejected")
    }))

  it.effect("executes the complete receipt set before contextual authority rejects tampering", () =>
    Effect.gen(function* () {
      const prepared = makePrepared("M2-total-transition")
      const operationLog: Array<string> = []
      const runner = makeTrialRunner({
        preflight: {
          prepare: () => Effect.succeed({
            ...prepared,
            validationAuthority: {
              ...prepared.validationAuthority,
              candidateTreeSha256: sha256("hostile authority substitution")
            }
          })
        },
        adapterFactory: (value) => makeNotRunAdapter(value, operationLog, [])
      })

      const error = yield* runner.run(
        repositoryRoot,
        "M2-total-transition",
        null
      ).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialRunnerAssemblyError)
      if (!(error instanceof TrialRunnerAssemblyError)) throw error
      expect(error.phase).toBe("result assembly")
      expect(error.reason).toContain("candidateTreeSha256")
      expect(operationLog).toEqual(expectedOperationOrder(prepared))
    }))

  it.effect("maps malformed injected receipt sets into the typed assembly error channel", () =>
    Effect.gen(function* () {
      const prepared = makePrepared("M1-extracted-fold")
      const runner = makeTrialRunner({
        preflight: { prepare: () => Effect.succeed(prepared) },
        adapterFactory: (value) => {
          const adapter = makeNotRunAdapter(value, [], [])
          return {
            ...adapter,
            executeCase: (caseId) => adapter.executeCase(caseId).pipe(Effect.map((receipt) =>
              new CaseReceipt({
                ...receipt,
                definitionSha256: sha256(`hostile definition ${caseId}`)
              })))
          }
        }
      })

      const error = yield* runner.run(
        repositoryRoot,
        "M1-extracted-fold",
        null
      ).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialRunnerAssemblyError)
      if (!(error instanceof TrialRunnerAssemblyError)) throw error
      expect(error.phase).toBe("result assembly")
      expect(error.reason).toContain("exact run-context definition")
    }))
})
