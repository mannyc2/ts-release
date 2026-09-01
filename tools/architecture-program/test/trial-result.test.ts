import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import {
  canonicalJsonBytes,
  parseCanonicalJsonBytes
} from "../src/canonical-document.js"
import {
  decodeCandidateManifest,
  encodeCandidateManifest
} from "../src/schema/candidate-manifest.js"
import {
  ArchitectureCaseInvocationV2,
  ArchitectureCaseObservationV2,
  ArchitectureGateInvocationV2,
  ArchitectureGateObservationV2,
  ArchitectureProbeInvocationV2,
  ArchitectureProbeObservationV2,
  caseInvocationStructureCodec,
  caseObservationStructureCodec,
  gateInvocationStructureCodec,
  gateObservationStructureCodec,
  probeInvocationStructureCodec,
  probeObservationStructureCodec
} from "../src/schema/harness-protocol.js"
import {
  computeTrialRunContextSha256,
  makeTrialRunContext
} from "../src/schema/run-context.js"
import {
  type TrialResultEvaluationAuthority,
  type TrialResultValidationAuthority,
  type MachineTrialResultBodyEncoded,
  type CaseTerminalOutputBodyEncoded,
  type GateTerminalOutputBodyEncoded,
  type GateEvaluationRecordBodyEncoded,
  type ObjectiveMetricEvidenceContextEncoded,
  type ObjectiveDerivationRecordBodyEncoded,
  type ProbeMeasurementEvidenceContextEncoded,
  type ProbeEvaluationRecordBodyEncoded,
  type ProbeMeasurementValueEncoded,
  type TopologyTrialResultBodyEncoded,
  DEFAULT_DENY_PROBE_EVALUATOR_ID,
  DEFAULT_UNAVAILABLE_OBJECTIVE_DERIVATION_ID,
  FROZEN_TRIAL_PROCESS_OUTPUT_LIMIT_BYTES,
  FROZEN_TRIAL_PROCESS_TIMEOUT_MILLISECONDS,
  TRIAL_RESULT_RECEIPT_HASH_DOMAIN,
  computeCaseTerminalResultSha256,
  computeGateCommandInputSha256,
  computeGateEvaluationRecordSha256,
  computeGateTerminalResultSha256,
  computeMachineTrialResultReceiptId,
  computeObjectiveDerivationRecordSha256,
  computeObjectiveMetricEvidenceSha256,
  computeProbeEvaluationRecordSha256,
  computeProbeMeasurementEvidenceSha256,
  computeProbeTerminalResultSha256,
  computeTopologyTrialResultReceiptId,
  decodeMachineTrialResult,
  decodeMachineTrialResultStructure,
  decodeTopologyTrialResult,
  encodeMachineTrialResult,
  encodeTopologyTrialResult,
  makeMachineTrialResult,
  makeGateCommandInput,
  makeTopologyTrialResult
} from "../src/schema/trial-result.js"
import { REQUIRED_TRIAL_LANES } from "../src/schema/trial-contract.js"
import {
  REQUIRED_MACHINE_METRIC_IDS,
  REQUIRED_PROBE_MEASUREMENT_IDS,
  REQUIRED_TOPOLOGY_METRIC_IDS,
  decodeArchitectureTrialSpec,
  gateDefinitionSha256
} from "../src/schema/trial-spec.js"
import {
  V2_CANDIDATE_DEFINITIONS
} from "../src/schema/v2-ids.js"
import {
  CanonicalPatchEntry,
  CanonicalTreeEntry,
  canonicalPatchSha256,
  canonicalTreeSha256
} from "../src/trial-inventory.js"
import {
  hashCanonicalDocumentBytes,
  hashCanonicalValue,
  sha256Bytes
} from "../src/trial-hash.js"
import { codePointCompare } from "../src/schema/trial-evidence.js"
import { ArtifactId, type PlannedRepositoryPath } from "../src/schema/primitives.js"

type MutableDocument = Record<string, any>
type Scope = "machine" | "topology"
type MutableTrialResultValidationAuthority = Omit<
  TrialResultValidationAuthority,
  "evaluationAuthority" | "expectedReceiptId"
> & {
  evaluationAuthority: TrialResultEvaluationAuthority
  expectedReceiptId: ReturnType<typeof exactSha256>
}

const fixturePath = resolve(
  typeof import.meta.dir === "string" ? import.meta.dir : dirname(fileURLToPath(import.meta.url)),
  "../../../docs/refactor/architecture-program/inputs/trial-spec.json"
)
const textEncoder = new TextEncoder()
const exactSha256 = (text: string) => sha256Bytes(textEncoder.encode(text))
const invocationSha256 = (value: unknown) => sha256Bytes(canonicalJsonBytes(value))
const streamEvidence = <Tag extends "Complete" | "Prefix">(
  _tag: Tag,
  text: string
) => ({
  _tag,
  byteLength: textEncoder.encode(text).byteLength,
  sha256: exactSha256(text)
})
const completeStreamEvidence = (bytes: Uint8Array) => ({
  _tag: "Complete" as const,
  byteLength: bytes.byteLength,
  sha256: sha256Bytes(bytes)
})
const exitedProcessAttempt = (
  stdout: Uint8Array<ArrayBufferLike> = new Uint8Array(),
  stderr: Uint8Array<ArrayBufferLike> = new Uint8Array()
) => ({
  _tag: "Exited" as const,
  exitCode: 0,
  stdout: completeStreamEvidence(stdout),
  stderr: completeStreamEvidence(stderr)
})
const sorted = <A extends string>(values: ReadonlyArray<A>): Array<A> =>
  [...values].sort(codePointCompare)

const makeManifestDocument = (scope: Scope): MutableDocument => {
  const candidateId = scope === "machine" ? "M1-extracted-fold" : "T1-root"
  const candidate = V2_CANDIDATE_DEFINITIONS[candidateId]
  return {
    schemaVersion: "ts-release/architecture-candidate-manifest/v2",
    candidateId,
    scope: candidate.scope,
    model: candidate.model,
    implementationRoot: candidate.implementationRoot,
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
    dependencyEdges: [
      {
        id: "module.core->package.core:static",
        fromId: "module.core",
        toId: "package.core",
        kind: "static"
      }
    ]
  }
}

const makeCandidateTree = (scope: Scope) => {
  const files = [
    ["src/index.ts", "export const candidate = true\n"],
    ["trial-adapter.ts", "export const adapter = true\n"],
    ["trial-candidate.json", `${scope}\n`]
  ] as const
  const entries = files.map(([path, content]) => new CanonicalTreeEntry({
    path: path as PlannedRepositoryPath,
    mode: "100644",
    bytes: textEncoder.encode(content).byteLength,
    sha256: exactSha256(content)
  }))
  return { entries, sha256: canonicalTreeSha256(entries) }
}

const loadAuthority = Effect.fn("trialResultTest.loadAuthority")(function* (scope: Scope) {
  const trialSpecBytes = yield* Effect.tryPromise(() => readFile(fixturePath))
  const trialSpec = yield* decodeArchitectureTrialSpec(parseCanonicalJsonBytes(trialSpecBytes))
  const candidateManifest = yield* decodeCandidateManifest(makeManifestDocument(scope))
  const candidateManifestBytes = canonicalJsonBytes(encodeCandidateManifest(candidateManifest))
  const candidateTree = makeCandidateTree(scope)
  const runnerSourceSha256 = exactSha256("candidate-neutral architecture runner source closure v2\n")
  const runnerNodeModulesSha256 = exactSha256("exact mounted runtime dependency tree v2\n")
  const rawTrialSpecSha256 = hashCanonicalDocumentBytes(trialSpecBytes)
  const rawCandidateManifestSha256 = hashCanonicalDocumentBytes(candidateManifestBytes)
  const gates = trialSpec.gateRequirements.filter(({ scope: gateScope }) => gateScope === scope)
  const runContext = makeTrialRunContext({
    schemaVersion: "ts-release/architecture-trial-run-context/v2",
    trialSpecSha256: rawTrialSpecSha256,
    executionContractSha256: trialSpec.executionContract.contractSha256,
    measurementContractSha256: trialSpec.measurementContract.contractSha256,
    topologyFixtureSha256: trialSpec.topologyFixture.fixtureSha256,
    candidateId: candidateManifest.candidateId,
    candidateScope: candidateManifest.scope,
    candidateModel: candidateManifest.model,
    implementationRoot: candidateManifest.implementationRoot,
    candidateManifestSha256: rawCandidateManifestSha256,
    candidateTreeSha256: candidateTree.sha256,
    runnerSourceSha256,
    runnerNodeModulesSha256,
    toolchain: {
      bun: "1.3.14",
      bunExecutableSha256: exactSha256("bun executable"),
      typescript: "6.0.3",
      effect: "4.0.0-rc.108",
      git: "2.51.0",
      gitExecutableSha256: exactSha256("git executable"),
      bubblewrapVersion: "0.11.0",
      bubblewrapExecutableSha256: exactSha256("bubblewrap executable")
    },
    caseDefinitionBindings: trialSpec.machineCases.map(({ id: caseId, execution }) => ({
      caseId,
      definitionSha256: execution.definitionSha256,
      fixtureSha256: execution.fixtureSha256,
      expectedEvidenceSha256: execution.expectedEvidenceSha256
    })),
    probeDefinitionBindings: trialSpec.marginalProbes.map(({ id: probeId, execution }) => ({
      probeId,
      definitionSha256: execution.definitionSha256,
      baseFixtureSha256: execution.baseFixtureSha256,
      changeDefinitionSha256: execution.changeDefinitionSha256
    })),
    gateDefinitionBindings: gates.map((gate) => ({
      gateId: gate.id,
      definitionSha256: gateDefinitionSha256(gate)
    }))
  })
  const authority: MutableTrialResultValidationAuthority = {
    trialSpec,
    rawTrialSpecSha256,
    candidateManifest,
    rawCandidateManifestSha256,
    candidateTreeSha256: candidateTree.sha256,
    runnerSourceSha256,
    runnerNodeModulesSha256,
    toolchain: runContext.toolchain,
    expectedReceiptId: exactSha256("unbound test receipt"),
    evaluationAuthority: {
      probeEvaluations: [],
      gateEvaluations: [],
      objectiveDerivations: []
    }
  }
  return { authority, runContext, candidateTree }
})

const delta = (prefix: string) => ({
  addedIds: [`${prefix}.added`],
  removedIds: []
})

const bindEvaluationAuthority = (
  fixture: Effect.Success<ReturnType<typeof loadAuthority>>,
  body: MutableDocument
): void => {
  fixture.authority.evaluationAuthority = {
    probeEvaluations: body.probeReceipts.map((receipt: MutableDocument) => {
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
    gateEvaluations: body.gateReceipts.map((receipt: MutableDocument) => {
      const record = receipt.execution._tag === "NotRun"
        ? null
        : receipt.execution.evaluationRecord
      return {
        gateId: receipt.gateId,
        evaluatorId: record?.evaluatorId ?? null,
        recordSha256: record?.recordSha256 ?? null
      }
    }),
    objectiveDerivations: body.objectiveMetrics.map((metric: MutableDocument) => ({
      metricId: metric.id,
      derivationId: metric.derivationRecord.derivationId,
      recordSha256: metric.derivationRecord.recordSha256
    }))
  }
  fixture.authority.expectedReceiptId = body.schemaVersion === "machine-trial-result-v2"
    ? computeMachineTrialResultReceiptId(body as MachineTrialResultBodyEncoded)
    : computeTopologyTrialResultReceiptId(body as TopologyTrialResultBodyEncoded)
}

const makeProbeOutput = (
  fixture: Effect.Success<ReturnType<typeof loadAuthority>>,
  probeIndex: number
): MutableDocument => {
  const probe = fixture.authority.trialSpec.marginalProbes[probeIndex]!
  const changedContent = `export const ${probe.id.replaceAll("-", "_")} = true\n`
  const changedPath = `src/probes/${probe.id}.ts`
  const changedEntry = new CanonicalTreeEntry({
    path: changedPath as PlannedRepositoryPath,
    mode: "100644",
    bytes: textEncoder.encode(changedContent).byteLength,
    sha256: exactSha256(changedContent)
  })
  const afterEntries = [...fixture.candidateTree.entries, changedEntry]
    .sort((left, right) => codePointCompare(left.path, right.path))
  const afterTreeSha256 = canonicalTreeSha256(afterEntries)
  const patchSha256 = canonicalPatchSha256([
    new CanonicalPatchEntry({
      path: changedPath as PlannedRepositoryPath,
      laneId: "product-source",
      beforeMode: null,
      beforeSha256: null,
      afterMode: "100644",
      afterSha256: changedEntry.sha256,
      additions: 1,
      deletions: 0
    })
  ])
  const publicSurfaceDelta = delta(`public.${probe.id.toLowerCase()}`)
  const durableFormatDelta = delta(`format.${probe.id.toLowerCase()}`)
  const dependencyDagDelta = delta(`dependency.${probe.id.toLowerCase()}`)
  const evaluationBody: ProbeEvaluationRecordBodyEncoded = {
    evaluatorId: "probe-evaluator.test-v1",
    probeId: probe.id,
    inspectedTreeSha256: afterTreeSha256,
    disposition: {
      _tag: "Accepted" as const,
      facts: [{
        sequence: 1,
        name: "runner.evaluation.accepted",
        value: { _tag: "Boolean" as const, value: true }
      }]
    }
  }
  const evaluationRecord = {
    recordSha256: computeProbeEvaluationRecordSha256(evaluationBody),
    ...evaluationBody
  }
  const measurementContext: ProbeMeasurementEvidenceContextEncoded = {
    beforeTreeSha256: fixture.candidateTree.sha256,
    afterTreeSha256,
    patchSha256,
    laneDeltas: REQUIRED_TRIAL_LANES.map(([laneId], index) => ({
      laneId,
      additions: index === 0 ? 1 : 0,
      deletions: 0
    })),
    touchedPathIds: [changedPath],
    touchedModuleIds: [`module.${probe.id.toLowerCase()}`],
    touchedPackageIds: [`package.${probe.id.toLowerCase()}`],
    touchedConceptIds: [`concept.${probe.id.toLowerCase()}`],
    touchedCentralBranchIds: [`branch.${probe.id.toLowerCase()}`],
    touchedOwnerRoleIds: ["role.changed-owner"],
    publicSurfaceDelta,
    durableFormatDelta,
    dependencyDagDelta,
    zeroTouchRoleIds: [...probe.requiredZeroTouchRoleIds],
    changeKinds: [...probe.requiredChangeKinds],
    facts: [
      ...probe.requiredChangeKinds.map((kind) => ({
        name: `change-kind.${kind}.path`,
        value: { _tag: "Text" as const, value: changedPath }
      })),
      {
        name: "probe.observed-change",
        value: { _tag: "Text" as const, value: probe.id }
      }
    ].sort((left, right) => codePointCompare(left.name, right.name))
      .map((fact, index) => ({ sequence: index + 1, ...fact })) as unknown as
        ProbeMeasurementEvidenceContextEncoded["facts"],
    evaluationRecord,
    observationCount: 1 as const
  }
  const values = new Map<string, ProbeMeasurementValueEncoded>([
    ["before-tree-sha256", { _tag: "Hash", value: fixture.candidateTree.sha256 }],
    ["after-tree-sha256", { _tag: "Hash", value: afterTreeSha256 }],
    ["patch-sha256", { _tag: "Hash", value: patchSha256 }],
    ["gross-product-additions", { _tag: "Count", value: 1 }],
    ["gross-product-deletions", { _tag: "Count", value: 0 }],
    ["files-touched", { _tag: "Count", value: 1 }],
    ["modules-touched", { _tag: "Count", value: 1 }],
    ["packages-touched", { _tag: "Count", value: 1 }],
    ["concepts-touched", { _tag: "Count", value: 1 }],
    ["central-branches-touched", { _tag: "Count", value: 1 }],
    ["public-surface-delta", { _tag: "IdentifierDelta", value: publicSurfaceDelta }],
    ["durable-format-delta", { _tag: "IdentifierDelta", value: durableFormatDelta }],
    ["dependency-dag-delta", { _tag: "IdentifierDelta", value: dependencyDagDelta }]
  ])
  const measurements = REQUIRED_PROBE_MEASUREMENT_IDS.map((id) => {
    const value = values.get(id)!
    return {
      _tag: "Measured" as const,
      id,
      value,
      evidenceSha256: computeProbeMeasurementEvidenceSha256(
        probe.id,
        id,
        value as ProbeMeasurementValueEncoded,
        measurementContext
      )
    }
  })
  const body = {
    ...measurementContext,
    measurements,
  }
  return {
    resultSha256: computeProbeTerminalResultSha256(body),
    ...body
  }
}

const makePassedBody = (
  scope: Scope,
  fixture: Effect.Success<ReturnType<typeof loadAuthority>>
): MutableDocument => {
  const spec = fixture.authority.trialSpec
  const gates = spec.gateRequirements.filter(({ scope: gateScope }) => gateScope === scope)
  const objectiveIds = scope === "machine"
    ? REQUIRED_MACHINE_METRIC_IDS
    : REQUIRED_TOPOLOGY_METRIC_IDS
  const caseReceipts = spec.machineCases.map((machineCase) => {
    const terminalBody: CaseTerminalOutputBodyEncoded = {
      expectedOutcome: machineCase.requiredTerminalOutcome,
      actualOutcome: machineCase.expectedEvidence.terminalOutcome,
      requiredAssertionIds: machineCase.requiredObservationIds,
      observedAssertionIds: sorted(machineCase.requiredObservationIds),
      executedAssertionIds: sorted(machineCase.requiredObservationIds),
      trace: machineCase.expectedEvidence.trace,
      facts: machineCase.expectedEvidence.facts
    }
    const observation = new ArchitectureCaseObservationV2({
      schemaVersion: "architecture-case-observation-v2",
      runContextSha256: fixture.runContext.runContextSha256,
      candidateId: fixture.runContext.candidateId,
      candidateTreeSha256: fixture.runContext.candidateTreeSha256,
      definitionSha256: machineCase.execution.definitionSha256,
      caseId: machineCase.id,
      fixtureSha256: machineCase.execution.fixtureSha256,
      trace: terminalBody.trace as ArchitectureCaseObservationV2["trace"],
      facts: terminalBody.facts as ArchitectureCaseObservationV2["facts"],
      terminalOutcome: terminalBody.actualOutcome
    })
    return {
      caseId: machineCase.id,
      definitionSha256: machineCase.execution.definitionSha256,
      fixtureSha256: machineCase.execution.fixtureSha256,
      expectedEvidenceSha256: machineCase.execution.expectedEvidenceSha256,
      execution: {
        _tag: "Passed",
        processAttempt: exitedProcessAttempt(canonicalJsonBytes(
          caseObservationStructureCodec.encode(observation)
        )),
        invocationSha256: invocationSha256(caseInvocationStructureCodec.encode(
          new ArchitectureCaseInvocationV2({
          schemaVersion: "architecture-case-invocation-v2",
          runContextSha256: fixture.runContext.runContextSha256,
          candidateId: fixture.runContext.candidateId,
          candidateTreeSha256: fixture.runContext.candidateTreeSha256,
          definitionSha256: machineCase.execution.definitionSha256,
          caseId: machineCase.id,
          fixtureSha256: machineCase.execution.fixtureSha256,
          fixture: machineCase.fixture
          })
        )),
        terminalOutput: {
          resultSha256: computeCaseTerminalResultSha256(terminalBody),
          ...terminalBody
        }
      }
    }
  })
  const probeReceipts = spec.marginalProbes.map((probe, index) => {
    const terminalOutput = makeProbeOutput(fixture, index)
    const observation = new ArchitectureProbeObservationV2({
      schemaVersion: "architecture-probe-observation-v2",
      runContextSha256: fixture.runContext.runContextSha256,
      candidateId: fixture.runContext.candidateId,
      candidateTreeSha256: fixture.runContext.candidateTreeSha256,
      definitionSha256: probe.execution.definitionSha256,
      probeId: probe.id,
      baseFixtureSha256: probe.execution.baseFixtureSha256,
      changeDefinitionSha256: probe.execution.changeDefinitionSha256,
      changeId: probe.changeDefinition.changeId,
      facts: terminalOutput.facts as ArchitectureProbeObservationV2["facts"]
    })
    return {
      probeId: probe.id,
      definitionSha256: probe.execution.definitionSha256,
      baseFixtureSha256: probe.execution.baseFixtureSha256,
      changeDefinitionSha256: probe.execution.changeDefinitionSha256,
      execution: {
        _tag: "Passed",
        processAttempt: exitedProcessAttempt(canonicalJsonBytes(
          probeObservationStructureCodec.encode(observation)
        )),
        invocationSha256: invocationSha256(probeInvocationStructureCodec.encode(
          new ArchitectureProbeInvocationV2({
            schemaVersion: "architecture-probe-invocation-v2",
            runContextSha256: fixture.runContext.runContextSha256,
            candidateId: fixture.runContext.candidateId,
            candidateTreeSha256: fixture.runContext.candidateTreeSha256,
            definitionSha256: probe.execution.definitionSha256,
            probeId: probe.id,
            baseFixtureSha256: probe.execution.baseFixtureSha256,
            changeDefinitionSha256: probe.execution.changeDefinitionSha256,
            changeDefinition: probe.changeDefinition
          })
        )),
        terminalOutput
      }
    }
  })
  const gateReceipts = gates.map((gate) => {
    const invocation = new ArchitectureGateInvocationV2({
      schemaVersion: "architecture-gate-invocation-v2",
      runContextSha256: fixture.runContext.runContextSha256,
      candidateId: fixture.runContext.candidateId,
      candidateTreeSha256: fixture.runContext.candidateTreeSha256,
      definitionSha256: gateDefinitionSha256(gate),
      gateId: gate.id,
      lawIds: gate.lawIds.map((id) => ArtifactId.make(id)),
      caseIds: gate.caseIds,
      probeIds: gate.probeIds
    })
    const commandInput = makeGateCommandInput(invocation, fixture.candidateTree.sha256)
    const commandAttempt = {
      _tag: "Exited" as const,
      exitCode: gate.expectedExit,
      stdout: streamEvidence("Complete", `gate-command:${gate.id}\n`),
      stderr: streamEvidence("Complete", "")
    }
    const evaluationBody: GateEvaluationRecordBodyEncoded = {
      evaluatorId: "gate-evaluator.test-v1",
      gateId: gate.id,
      inspectedTreeSha256: fixture.candidateTree.sha256,
      declaredCommand: gate.command,
      commandInputSha256: computeGateCommandInputSha256(commandInput),
      commandAttempt,
      disposition: {
        _tag: "Accepted" as const,
        facts: [{
          sequence: 1,
          name: "runner.evaluation.accepted",
          value: { _tag: "Boolean" as const, value: true }
        }]
      }
    }
    const terminalBody: GateTerminalOutputBodyEncoded = {
      facts: [{
        sequence: 1,
        name: "gate.passed",
        value: { _tag: "Boolean" as const, value: true }
      }]
    }
    const observation = new ArchitectureGateObservationV2({
      schemaVersion: "architecture-gate-observation-v2",
      runContextSha256: fixture.runContext.runContextSha256,
      candidateId: fixture.runContext.candidateId,
      candidateTreeSha256: fixture.runContext.candidateTreeSha256,
      definitionSha256: gateDefinitionSha256(gate),
      gateId: gate.id,
      facts: terminalBody.facts as ArchitectureGateObservationV2["facts"]
    })
    return {
      gateId: gate.id,
      definitionSha256: gateDefinitionSha256(gate),
      command: [...gate.command],
      caseIds: [...gate.caseIds],
      probeIds: [...gate.probeIds],
      expectedExit: gate.expectedExit,
      execution: {
        _tag: "Passed",
        processAttempt: exitedProcessAttempt(canonicalJsonBytes(
          gateObservationStructureCodec.encode(observation)
        )),
        invocationSha256: invocationSha256(gateInvocationStructureCodec.encode(invocation)),
        terminalOutput: {
          resultSha256: computeGateTerminalResultSha256(terminalBody),
          ...terminalBody
        },
        evaluationRecord: {
          recordSha256: computeGateEvaluationRecordSha256(evaluationBody),
          ...evaluationBody
        }
      }
    }
  })
  const body: MutableDocument = {
    schemaVersion: scope === "machine" ? "machine-trial-result-v2" : "topology-trial-result-v2",
    programId: "ts-release-architecture-program",
    runContextSha256: fixture.runContext.runContextSha256,
    runContext: fixture.runContext,
    preflightFailures: [],
    caseReceipts,
    probeReceipts,
    gateReceipts,
    objectiveMetrics: [],
    qualification: "Passed"
  }
  const objectiveContext: ObjectiveMetricEvidenceContextEncoded = {
    runContextSha256: body.runContextSha256,
    preflightFailures: body.preflightFailures,
    caseReceipts: body.caseReceipts,
    probeReceipts: body.probeReceipts,
    gateReceipts: body.gateReceipts
  }
  body.objectiveMetrics = objectiveIds.map((id, value) => {
    const derivationBody: ObjectiveDerivationRecordBodyEncoded = {
      derivationId: "objective-derivation.test-v1",
      metricId: id,
      value,
      inspectedTreeSha256: fixture.candidateTree.sha256,
      disposition: {
        _tag: "Accepted" as const,
        facts: [{
          sequence: 1,
          name: "objective.value",
          value: { _tag: "Integer" as const, value }
        }]
      }
    }
    const derivationRecord = {
      recordSha256: computeObjectiveDerivationRecordSha256(derivationBody),
      ...derivationBody
    }
    return {
      _tag: "Measured",
      id,
      value,
      derivationRecord,
      evidenceSha256: computeObjectiveMetricEvidenceSha256(
        objectiveContext,
        id,
        value,
        derivationRecord
      )
    }
  })
  bindEvaluationAuthority(fixture, body)
  return body
}

const makeEarlyFailureBody = (
  scope: Scope,
  fixture: Effect.Success<ReturnType<typeof loadAuthority>>
): MutableDocument => {
  const body = makePassedBody(scope, fixture)
  const failureId = "failure.preflight"
  body.preflightFailures = [failureId]
  body.caseReceipts.forEach((receipt: MutableDocument) => {
    receipt.execution = { _tag: "NotRun", failureIds: [failureId] }
  })
  body.probeReceipts.forEach((receipt: MutableDocument) => {
    receipt.execution = { _tag: "NotRun", failureIds: [failureId] }
  })
  body.gateReceipts.forEach((receipt: MutableDocument) => {
    receipt.execution = { _tag: "NotRun", failureIds: [failureId] }
  })
  body.objectiveMetrics = body.objectiveMetrics.map(({ id }: MutableDocument) => {
    const derivationBody: ObjectiveDerivationRecordBodyEncoded = {
      derivationId: "objective-derivation.test-v1",
      metricId: id,
      value: null,
      inspectedTreeSha256: fixture.candidateTree.sha256,
      disposition: {
        _tag: "Rejected" as const,
        failureIds: [failureId]
      }
    }
    return {
      _tag: "Unavailable",
      id,
      failureId,
      derivationRecord: {
        recordSha256: computeObjectiveDerivationRecordSha256(derivationBody),
        ...derivationBody
      }
    }
  })
  body.qualification = "Rejected"
  bindEvaluationAuthority(fixture, body)
  return body
}

const rehashResult = (document: MutableDocument): void => {
  const { receiptId: _receiptId, ...body } = document
  document.receiptId = hashCanonicalValue(TRIAL_RESULT_RECEIPT_HASH_DOMAIN, body)
}

const rehashEmbeddedContext = (document: MutableDocument): void => {
  const { runContextSha256: _runContextSha256, ...body } = document.runContext
  document.runContext.runContextSha256 = computeTrialRunContextSha256(body)
  document.runContextSha256 = document.runContext.runContextSha256
}

const rebindObjectiveEvidence = (document: MutableDocument): void => {
  const context: ObjectiveMetricEvidenceContextEncoded = {
    runContextSha256: document.runContextSha256,
    preflightFailures: document.preflightFailures,
    caseReceipts: document.caseReceipts,
    probeReceipts: document.probeReceipts,
    gateReceipts: document.gateReceipts
  }
  document.objectiveMetrics.forEach((metric: MutableDocument) => {
    if (metric._tag === "Measured") {
      metric.evidenceSha256 = computeObjectiveMetricEvidenceSha256(
        context,
        metric.id,
        metric.value,
        metric.derivationRecord
      )
    }
  })
}

const rebindProbeEvidence = (receipt: MutableDocument): void => {
  const output = receipt.execution.terminalOutput
  const {
    resultSha256: _resultSha256,
    measurements,
    ...measurementContext
  } = output
  measurements.forEach((measurement: MutableDocument) => {
    if (measurement._tag === "Measured") {
      measurement.evidenceSha256 = computeProbeMeasurementEvidenceSha256(
        receipt.probeId,
        measurement.id,
        measurement.value,
        measurementContext
      )
    }
  })
  const { resultSha256: _oldResultSha256, ...terminalBody } = output
  output.resultSha256 = computeProbeTerminalResultSha256(terminalBody)
}

const expectMachineStructureFailure = Effect.fn("trialResultTest.expectMachineStructureFailure")(
  function* (document: MutableDocument) {
    const exit = yield* decodeMachineTrialResultStructure(document).pipe(Effect.exit)
    expect(Exit.isFailure(exit)).toBe(true)
  }
)

describe("architecture trial result v2", () => {
  it.effect("round-trips deterministic context-bound machine and topology receipts", () =>
    Effect.gen(function* () {
      const machineFixture = yield* loadAuthority("machine")
      const topologyFixture = yield* loadAuthority("topology")
      const machineBody = makePassedBody("machine", machineFixture)
      const topologyBody = makePassedBody("topology", topologyFixture)
      const machine = makeMachineTrialResult(
        machineBody as MachineTrialResultBodyEncoded,
        machineFixture.authority
      )
      const topology = makeTopologyTrialResult(
        topologyBody as TopologyTrialResultBodyEncoded,
        topologyFixture.authority
      )
      const machineEncoded = encodeMachineTrialResult(machine, machineFixture.authority)
      const topologyEncoded = encodeTopologyTrialResult(topology, topologyFixture.authority)
      const decodedMachine = yield* decodeMachineTrialResult(machineEncoded, machineFixture.authority)
      const decodedTopology = yield* decodeTopologyTrialResult(topologyEncoded, topologyFixture.authority)

      expect(encodeMachineTrialResult(decodedMachine, machineFixture.authority)).toEqual(machineEncoded)
      expect(encodeTopologyTrialResult(decodedTopology, topologyFixture.authority)).toEqual(topologyEncoded)
      expect(machine.receiptId).toBe(computeMachineTrialResultReceiptId(
        machineBody as MachineTrialResultBodyEncoded
      ))
      expect(topology.receiptId).toBe(computeTopologyTrialResultReceiptId(
        topologyBody as TopologyTrialResultBodyEncoded
      ))
      expect(machine.runContextSha256).toBe(machine.runContext.runContextSha256)
      expect(canonicalJsonBytes(machineEncoded)).toEqual(canonicalJsonBytes(
        encodeMachineTrialResult(
          makeMachineTrialResult(machineBody as MachineTrialResultBodyEncoded, machineFixture.authority),
          machineFixture.authority
        )
      ))
    }))

  it.effect("round-trips an early preflight failure without fabricated execution facts", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const body = makeEarlyFailureBody("machine", fixture)
      const result = makeMachineTrialResult(body as MachineTrialResultBodyEncoded, fixture.authority)
      const encoded = encodeMachineTrialResult(result, fixture.authority) as MutableDocument
      const decoded = yield* decodeMachineTrialResult(encoded, fixture.authority)

      expect(decoded.qualification).toBe("Rejected")
      expect(decoded.caseReceipts.every(({ execution }) => execution._tag === "NotRun")).toBe(true)
      expect(decoded.probeReceipts.every(({ execution }) => execution._tag === "NotRun")).toBe(true)
      expect(encoded.caseReceipts[0].execution).toEqual({
        _tag: "NotRun",
        failureIds: ["failure.preflight"]
      })
      expect(encoded.caseReceipts[0].execution).not.toHaveProperty("terminalOutput")
      expect(decoded.objectiveMetrics.every(({ _tag }) => _tag === "Unavailable")).toBe(true)
    }))

  it.effect("round-trips every factual process attempt on a failed execution", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const attempts: ReadonlyArray<MutableDocument> = [
        exitedProcessAttempt(),
        {
          _tag: "TimedOut",
          timeoutMilliseconds: FROZEN_TRIAL_PROCESS_TIMEOUT_MILLISECONDS,
          stdout: streamEvidence("Prefix", "partial stdout"),
          stderr: streamEvidence("Complete", "")
        },
        {
          _tag: "Signaled",
          signal: "SIGKILL",
          stdout: streamEvidence("Prefix", "signal stdout"),
          stderr: streamEvidence("Complete", "signal stderr")
        },
        { _tag: "NotStarted", executable: "bun" },
        {
          _tag: "OutputLimited",
          stream: "stdout",
          limitBytes: FROZEN_TRIAL_PROCESS_OUTPUT_LIMIT_BYTES,
          observedBytes: FROZEN_TRIAL_PROCESS_OUTPUT_LIMIT_BYTES + 1,
          stdout: {
            _tag: "Prefix",
            byteLength: FROZEN_TRIAL_PROCESS_OUTPUT_LIMIT_BYTES + 1,
            sha256: exactSha256("oversized stdout prefix")
          },
          stderr: streamEvidence("Prefix", "")
        },
        {
          _tag: "IoFailed",
          operation: "stdout",
          stdout: streamEvidence("Prefix", "partial stdout"),
          stderr: streamEvidence("Complete", "complete stderr")
        }
      ]
      for (const processAttempt of attempts) {
        const exactInvocationSha256 = makePassedBody("machine", fixture)
          .caseReceipts[0].execution.invocationSha256
        const body = makeEarlyFailureBody("machine", fixture)
        body.caseReceipts[0].execution = {
          _tag: "Failed",
          processAttempt,
          invocationSha256: exactInvocationSha256,
          terminalOutput: null,
          failureIds: ["failure.execution"]
        }
        bindEvaluationAuthority(fixture, body)
        const result = makeMachineTrialResult(body as MachineTrialResultBodyEncoded, fixture.authority)
        const decoded = yield* decodeMachineTrialResult(
          encodeMachineTrialResult(result, fixture.authority),
          fixture.authority
        )
        expect(decoded.caseReceipts[0]?.execution._tag).toBe("Failed")
      }
    }))

  it.effect("rejects rehashed non-frozen timeout and output-limit evidence", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const original = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument
      const attempts = [
        {
          _tag: "TimedOut",
          timeoutMilliseconds: FROZEN_TRIAL_PROCESS_TIMEOUT_MILLISECONDS - 1,
          stdout: streamEvidence("Prefix", "partial timeout stdout"),
          stderr: streamEvidence("Complete", "")
        },
        {
          _tag: "OutputLimited",
          stream: "stdout",
          limitBytes: FROZEN_TRIAL_PROCESS_OUTPUT_LIMIT_BYTES - 1,
          observedBytes: FROZEN_TRIAL_PROCESS_OUTPUT_LIMIT_BYTES,
          stdout: {
            _tag: "Prefix",
            byteLength: FROZEN_TRIAL_PROCESS_OUTPUT_LIMIT_BYTES,
            sha256: exactSha256("hostile output-limit prefix")
          },
          stderr: streamEvidence("Prefix", "")
        }
      ]
      for (const processAttempt of attempts) {
        const changed = structuredClone(original)
        const execution = changed.caseReceipts[0].execution
        changed.caseReceipts[0].execution = {
          _tag: "Failed",
          processAttempt,
          invocationSha256: execution.invocationSha256,
          terminalOutput: null,
          failureIds: ["failure.execution"]
        }
        changed.qualification = "Rejected"
        rebindObjectiveEvidence(changed)
        rehashResult(changed)
        yield* expectMachineStructureFailure(changed)
      }
    }))

  it.effect("rejects fully rehashed candidate-adapter transcript substitutions", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const original = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument
      const mutations = [
        (document: MutableDocument) => document.caseReceipts[0].execution.processAttempt.stdout =
          completeStreamEvidence(textEncoder.encode("hostile case observation")),
        (document: MutableDocument) => document.probeReceipts[0].execution.processAttempt.stdout =
          completeStreamEvidence(textEncoder.encode("hostile probe observation")),
        (document: MutableDocument) => document.gateReceipts[0].execution.processAttempt.stdout =
          completeStreamEvidence(textEncoder.encode("hostile gate observation")),
        (document: MutableDocument) => document.caseReceipts[0].execution.processAttempt.stderr =
          completeStreamEvidence(textEncoder.encode("hostile case stderr")),
        (document: MutableDocument) => document.probeReceipts[0].execution.processAttempt.stderr =
          completeStreamEvidence(textEncoder.encode("hostile probe stderr")),
        (document: MutableDocument) => document.gateReceipts[0].execution.processAttempt.stderr =
          completeStreamEvidence(textEncoder.encode("hostile gate stderr"))
      ]
      for (const mutate of mutations) {
        const changed = structuredClone(original)
        mutate(changed)
        rebindObjectiveEvidence(changed)
        rehashResult(changed)

        yield* decodeMachineTrialResultStructure(changed)
        const exit = yield* decodeMachineTrialResult(changed, fixture.authority).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it.effect("hard-cuts v1, the opposite scope, timestamps, and unknown nested fields", () =>
    Effect.gen(function* () {
      const machineFixture = yield* loadAuthority("machine")
      const topologyFixture = yield* loadAuthority("topology")
      const machine = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", machineFixture) as MachineTrialResultBodyEncoded,
          machineFixture.authority
        ),
        machineFixture.authority
      ) as MutableDocument
      const topology = encodeTopologyTrialResult(
        makeTopologyTrialResult(
          makePassedBody("topology", topologyFixture) as TopologyTrialResultBodyEncoded,
          topologyFixture.authority
        ),
        topologyFixture.authority
      )

      for (const mutate of [
        (document: MutableDocument) => { document.schemaVersion = "machine-trial-result-v1" },
        (document: MutableDocument) => { document.timestamp = "2026-08-31T00:00:00Z" },
        (document: MutableDocument) => { document.caseReceipts[0].execution.timestamp = "now" }
      ]) {
        const changed = structuredClone(machine)
        mutate(changed)
        rehashResult(changed)
        yield* expectMachineStructureFailure(changed)
      }
      const oppositeExit = yield* decodeMachineTrialResultStructure(topology).pipe(Effect.exit)
      expect(Exit.isFailure(oppositeExit)).toBe(true)
    }))

  it.effect("rejects body hash mutation, exact-row substitution, and sorted-set drift", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const original = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument

      const hashMutation = structuredClone(original)
      hashMutation.preflightFailures = ["failure.hash-mutation"]
      yield* expectMachineStructureFailure(hashMutation)

      const idSubstitution = structuredClone(original)
      idSubstitution.caseReceipts[7].caseId = "C99-substituted-case"
      rehashResult(idSubstitution)
      yield* expectMachineStructureFailure(idSubstitution)

      const wrongRows = structuredClone(original)
      wrongRows.probeReceipts.reverse()
      rehashResult(wrongRows)
      yield* expectMachineStructureFailure(wrongRows)

      const unsortedEvidence = structuredClone(original)
      unsortedEvidence.caseReceipts[0].execution.terminalOutput.observedAssertionIds.reverse()
      rehashResult(unsortedEvidence)
      yield* expectMachineStructureFailure(unsortedEvidence)
    }))

  it.effect("rejects disposition, availability, and qualification contradictions", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const original = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument
      const mutations = [
        (document: MutableDocument) => {
          document.caseReceipts[0].execution.processAttempt.exitCode = 1
        },
        (document: MutableDocument) => {
          const measurement = document.probeReceipts[0].execution.terminalOutput.measurements[0]
          document.probeReceipts[0].execution.terminalOutput.measurements[0] = {
            _tag: "Unavailable",
            id: measurement.id,
            failureId: "failure.measurement"
          }
          document.qualification = "Rejected"
        },
        (document: MutableDocument) => {
          document.objectiveMetrics[0] = {
            _tag: "Unavailable",
            id: document.objectiveMetrics[0].id,
            failureId: "failure.objective"
          }
        },
        (document: MutableDocument) => {
          document.qualification = "Rejected"
        }
      ]
      for (const mutate of mutations) {
        const changed = structuredClone(original)
        mutate(changed)
        rehashResult(changed)
        yield* expectMachineStructureFailure(changed)
      }
    }))

  it.effect("rejects rehashed terminal, measurement, objective, and gate evidence mutations", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const original = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument
      const mutations = [
        (document: MutableDocument) => {
          document.caseReceipts[0].execution.terminalOutput.facts[0].value.value = 999
        },
        (document: MutableDocument) => {
          document.probeReceipts[0].execution.terminalOutput.resultSha256 = "0".repeat(64)
        },
        (document: MutableDocument) => {
          const output = document.probeReceipts[0].execution.terminalOutput
          output.facts[0].value.value = "hostile-observation-substitution"
          const { resultSha256: _oldResultSha256, ...terminalBody } = output
          output.resultSha256 = computeProbeTerminalResultSha256(terminalBody)
        },
        (document: MutableDocument) => {
          document.probeReceipts[0].execution.terminalOutput.measurements[0].evidenceSha256 =
            "0".repeat(64)
        },
        (document: MutableDocument) => {
          document.gateReceipts[0].execution.terminalOutput.facts[0].value.value = false
        },
        (document: MutableDocument) => {
          document.objectiveMetrics[0].evidenceSha256 = "0".repeat(64)
        },
        (document: MutableDocument) => {
          document.probeReceipts[0].execution.terminalOutput.evaluationRecord.recordSha256 =
            "0".repeat(64)
        },
        (document: MutableDocument) => {
          document.gateReceipts[0].execution.evaluationRecord.recordSha256 =
            "0".repeat(64)
        },
        (document: MutableDocument) => {
          document.objectiveMetrics[0].derivationRecord.recordSha256 = "0".repeat(64)
        },
        (document: MutableDocument) => {
          document.probeReceipts[0].execution.terminalOutput.observationCount = 2
        }
      ]
      for (const mutate of mutations) {
        const changed = structuredClone(original)
        mutate(changed)
        rehashResult(changed)
        yield* expectMachineStructureFailure(changed)
      }
    }))

  it.effect("rejects a fully rehashed zero-touch owner contradiction", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const changed = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument
      changed.probeReceipts[0].execution.terminalOutput.touchedOwnerRoleIds = ["role-kernel"]
      rebindProbeEvidence(changed.probeReceipts[0])
      rebindObjectiveEvidence(changed)
      rehashResult(changed)

      yield* expectMachineStructureFailure(changed)
    }))

  it.effect("rejects fully rehashed evaluator and derivation record substitutions", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const original = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument

      const rejectedProbe = structuredClone(original)
      const probeOutput = rejectedProbe.probeReceipts[0].execution.terminalOutput
      probeOutput.evaluationRecord.disposition = {
        _tag: "Rejected",
        failureIds: ["probe.hostile-substitution"]
      }
      const {
        recordSha256: _probeRecordSha256,
        ...probeEvaluationBody
      } = probeOutput.evaluationRecord
      probeOutput.evaluationRecord.recordSha256 = computeProbeEvaluationRecordSha256(
        probeEvaluationBody
      )
      rebindProbeEvidence(rejectedProbe.probeReceipts[0])
      rebindObjectiveEvidence(rejectedProbe)
      rehashResult(rejectedProbe)
      yield* expectMachineStructureFailure(rejectedProbe)

      const wrongGateExit = structuredClone(original)
      const gateExecution = wrongGateExit.gateReceipts[0].execution
      gateExecution.evaluationRecord.commandAttempt.exitCode = 9
      const {
        recordSha256: _gateRecordSha256,
        ...gateEvaluationBody
      } = gateExecution.evaluationRecord
      gateExecution.evaluationRecord.recordSha256 = computeGateEvaluationRecordSha256(
        gateEvaluationBody
      )
      rebindObjectiveEvidence(wrongGateExit)
      rehashResult(wrongGateExit)
      yield* expectMachineStructureFailure(wrongGateExit)

      const wrongObjectiveValue = structuredClone(original)
      const metric = wrongObjectiveValue.objectiveMetrics[0]
      metric.derivationRecord.value = metric.value + 1
      const {
        recordSha256: _derivationRecordSha256,
        ...derivationBody
      } = metric.derivationRecord
      metric.derivationRecord.recordSha256 = computeObjectiveDerivationRecordSha256(
        derivationBody
      )
      rebindObjectiveEvidence(wrongObjectiveValue)
      rehashResult(wrongObjectiveValue)
      yield* expectMachineStructureFailure(wrongObjectiveValue)
    }))

  it.effect("rejects externally unbound aligned evaluation and objective rewrites", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const original = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument

      const alignedObjective = structuredClone(original)
      const metric = alignedObjective.objectiveMetrics[0]
      metric.value += 7
      metric.derivationRecord.value = metric.value
      metric.derivationRecord.disposition.facts[0].value.value = metric.value
      const {
        recordSha256: _objectiveRecordSha256,
        ...objectiveRecordBody
      } = metric.derivationRecord
      metric.derivationRecord.recordSha256 = computeObjectiveDerivationRecordSha256(
        objectiveRecordBody
      )
      rebindObjectiveEvidence(alignedObjective)
      rehashResult(alignedObjective)
      yield* decodeMachineTrialResultStructure(alignedObjective)
      expect(Exit.isFailure(yield* decodeMachineTrialResult(
        alignedObjective,
        fixture.authority
      ).pipe(Effect.exit))).toBe(true)

      const substitutedProbeIdentity = structuredClone(original)
      const probeOutput = substitutedProbeIdentity.probeReceipts[0].execution.terminalOutput
      probeOutput.evaluationRecord.evaluatorId = "probe-evaluator.hostile-v1"
      const {
        recordSha256: _probeRecordSha256,
        ...probeRecordBody
      } = probeOutput.evaluationRecord
      probeOutput.evaluationRecord.recordSha256 = computeProbeEvaluationRecordSha256(
        probeRecordBody
      )
      rebindProbeEvidence(substitutedProbeIdentity.probeReceipts[0])
      rebindObjectiveEvidence(substitutedProbeIdentity)
      rehashResult(substitutedProbeIdentity)
      yield* decodeMachineTrialResultStructure(substitutedProbeIdentity)
      expect(Exit.isFailure(yield* decodeMachineTrialResult(
        substitutedProbeIdentity,
        fixture.authority
      ).pipe(Effect.exit))).toBe(true)

      const impossibleDefaults = structuredClone(original)
      const impossibleProbe = impossibleDefaults.probeReceipts[0].execution.terminalOutput
        .evaluationRecord
      impossibleProbe.evaluatorId = DEFAULT_DENY_PROBE_EVALUATOR_ID
      const {
        recordSha256: _impossibleProbeSha256,
        ...impossibleProbeBody
      } = impossibleProbe
      impossibleProbe.recordSha256 = computeProbeEvaluationRecordSha256(impossibleProbeBody)
      const impossibleObjective = impossibleDefaults.objectiveMetrics[0].derivationRecord
      impossibleObjective.derivationId = DEFAULT_UNAVAILABLE_OBJECTIVE_DERIVATION_ID
      const {
        recordSha256: _impossibleObjectiveSha256,
        ...impossibleObjectiveBody
      } = impossibleObjective
      impossibleObjective.recordSha256 = computeObjectiveDerivationRecordSha256(
        impossibleObjectiveBody
      )
      rebindProbeEvidence(impossibleDefaults.probeReceipts[0])
      rebindObjectiveEvidence(impossibleDefaults)
      rehashResult(impossibleDefaults)
      const impossibleAuthority: TrialResultValidationAuthority = {
        ...fixture.authority,
        expectedReceiptId: impossibleDefaults.receiptId,
        evaluationAuthority: {
          ...fixture.authority.evaluationAuthority,
          probeEvaluations: fixture.authority.evaluationAuthority.probeEvaluations.map(
            (binding, index) => index === 0
              ? {
                probeId: impossibleDefaults.probeReceipts[0].probeId,
                evaluatorId: impossibleProbe.evaluatorId,
                recordSha256: impossibleProbe.recordSha256
              }
              : binding
          ),
          objectiveDerivations: fixture.authority.evaluationAuthority.objectiveDerivations.map(
            (binding, index) => index === 0
              ? {
                metricId: impossibleDefaults.objectiveMetrics[0].id,
                derivationId: impossibleObjective.derivationId,
                recordSha256: impossibleObjective.recordSha256
              }
              : binding
          )
        }
      }
      yield* decodeMachineTrialResultStructure(impossibleDefaults)
      expect(Exit.isFailure(yield* decodeMachineTrialResult(
        impossibleDefaults,
        impossibleAuthority
      ).pipe(Effect.exit))).toBe(true)
    }))

  it.effect("rejects fully rehashed evaluator-input evidence under the retained receipt address", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const original = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument
      const changed = structuredClone(original)
      const gateReceipt = changed.gateReceipts[0]
      const terminalOutput = gateReceipt.execution.terminalOutput
      terminalOutput.facts[0].value.value = false
      const { resultSha256: _terminalSha256, ...terminalBody } = terminalOutput
      terminalOutput.resultSha256 = computeGateTerminalResultSha256(terminalBody)
      const observation = new ArchitectureGateObservationV2({
        schemaVersion: "architecture-gate-observation-v2",
        runContextSha256: changed.runContext.runContextSha256,
        candidateId: changed.runContext.candidateId,
        candidateTreeSha256: changed.runContext.candidateTreeSha256,
        definitionSha256: gateReceipt.definitionSha256,
        gateId: gateReceipt.gateId,
        facts: terminalOutput.facts
      })
      gateReceipt.execution.processAttempt.stdout = completeStreamEvidence(
        canonicalJsonBytes(gateObservationStructureCodec.encode(observation))
      )
      rebindObjectiveEvidence(changed)
      rehashResult(changed)

      yield* decodeMachineTrialResultStructure(changed)
      expect(changed.receiptId).not.toBe(fixture.authority.expectedReceiptId)
      expect(Exit.isFailure(yield* decodeMachineTrialResult(
        changed,
        fixture.authority
      ).pipe(Effect.exit))).toBe(true)
    }))

  it.effect("rejects a self-consistent receipt whose context mismatches exact external authority", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const body = makePassedBody("machine", fixture)
      const result = makeMachineTrialResult(body as MachineTrialResultBodyEncoded, fixture.authority)
      const encoded = encodeMachineTrialResult(result, fixture.authority)
      yield* decodeMachineTrialResultStructure(encoded)
      for (const mismatchedAuthority of [
        {
          ...fixture.authority,
          candidateTreeSha256: exactSha256("different runner-observed tree\n")
        },
        {
          ...fixture.authority,
          runnerNodeModulesSha256: exactSha256("different mounted dependency tree\n")
        }
      ]) {
        const exit = yield* decodeMachineTrialResult(encoded, mismatchedAuthority).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it.effect("rejects a self-hashed toolchain claim that differs from external observation", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const changed = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument
      changed.runContext.toolchain.bun = "1.3.15"
      rehashEmbeddedContext(changed)
      rebindObjectiveEvidence(changed)
      rehashResult(changed)

      yield* decodeMachineTrialResultStructure(changed)
      const exit = yield* decodeMachineTrialResult(changed, fixture.authority).pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("rejects rehashed definition and fixture substitutions against the decoded spec", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const encoded = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument
      const changed = structuredClone(encoded)
      const substitutedHash = exactSha256("substituted case fixture\n")
      changed.runContext.caseDefinitionBindings[0].fixtureSha256 = substitutedHash
      rehashEmbeddedContext(changed)
      changed.caseReceipts[0].fixtureSha256 = substitutedHash
      rebindObjectiveEvidence(changed)
      rehashResult(changed)

      yield* decodeMachineTrialResultStructure(changed)
      const exit = yield* decodeMachineTrialResult(changed, fixture.authority).pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("rejects rehashed or null invocation, change-kind path, and gate-prerequisite claims", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const original = encodeMachineTrialResult(
        makeMachineTrialResult(
          makePassedBody("machine", fixture) as MachineTrialResultBodyEncoded,
          fixture.authority
        ),
        fixture.authority
      ) as MutableDocument

      for (const mutate of [
        (document: MutableDocument) => {
          document.caseReceipts[0].execution.invocationSha256 = exactSha256("hostile case invocation")
        },
        (document: MutableDocument) => {
          document.probeReceipts[0].execution.invocationSha256 = exactSha256("hostile probe invocation")
        },
        (document: MutableDocument) => {
          document.gateReceipts[0].execution.invocationSha256 = exactSha256("hostile gate invocation")
        },
        (document: MutableDocument) => {
          const evaluation = document.gateReceipts[0].execution.evaluationRecord
          evaluation.commandInputSha256 = exactSha256("hostile command input")
          const { recordSha256: _recordSha256, ...body } = evaluation
          evaluation.recordSha256 = computeGateEvaluationRecordSha256(body)
        },
        (document: MutableDocument) => {
          document.caseReceipts[0].execution = {
            ...document.caseReceipts[0].execution,
            _tag: "Failed",
            invocationSha256: null,
            failureIds: ["failure.null-invocation"]
          }
          document.qualification = "Rejected"
        },
        (document: MutableDocument) => {
          document.probeReceipts[0].execution = {
            ...document.probeReceipts[0].execution,
            _tag: "Failed",
            invocationSha256: null,
            failureIds: ["failure.null-invocation"]
          }
          document.qualification = "Rejected"
        },
        (document: MutableDocument) => {
          document.gateReceipts[0].execution = {
            ...document.gateReceipts[0].execution,
            _tag: "Failed",
            invocationSha256: null,
            failureIds: ["failure.null-invocation"]
          }
          document.qualification = "Rejected"
        }
      ]) {
        const changed = structuredClone(original)
        mutate(changed)
        rebindObjectiveEvidence(changed)
        rehashResult(changed)
        yield* decodeMachineTrialResultStructure(changed)
        const exit = yield* decodeMachineTrialResult(changed, fixture.authority).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }

      const hostilePathFact = structuredClone(original)
      const output = hostilePathFact.probeReceipts[1].execution.terminalOutput
      output.facts.find((fact: MutableDocument) => fact.name.startsWith("change-kind."))
        .value.value = "src/index.ts"
      rebindProbeEvidence(hostilePathFact.probeReceipts[1])
      rebindObjectiveEvidence(hostilePathFact)
      rehashResult(hostilePathFact)
      yield* decodeMachineTrialResultStructure(hostilePathFact)
      expect(Exit.isFailure(yield* decodeMachineTrialResult(
        hostilePathFact,
        fixture.authority
      ).pipe(Effect.exit))).toBe(true)

      const hostileGatePrerequisite = structuredClone(original)
      hostileGatePrerequisite.caseReceipts[0].execution = {
        ...hostileGatePrerequisite.caseReceipts[0].execution,
        _tag: "Failed",
        failureIds: ["failure.hostile-prerequisite"]
      }
      hostileGatePrerequisite.qualification = "Rejected"
      rebindObjectiveEvidence(hostileGatePrerequisite)
      rehashResult(hostileGatePrerequisite)
      yield* decodeMachineTrialResultStructure(hostileGatePrerequisite)
      expect(Exit.isFailure(yield* decodeMachineTrialResult(
        hostileGatePrerequisite,
        fixture.authority
      ).pipe(Effect.exit))).toBe(true)
    }))
})
