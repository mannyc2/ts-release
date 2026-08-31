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
  computeTrialRunContextSha256,
  makeTrialRunContext
} from "../src/schema/run-context.js"
import {
  type MachineTrialResultBodyEncoded,
  type CaseTerminalOutputBodyEncoded,
  type GateTerminalOutputBodyEncoded,
  type ObjectiveMetricEvidenceContextEncoded,
  type ProbeMeasurementEvidenceContextEncoded,
  type ProbeMeasurementValueEncoded,
  type TopologyTrialResultBodyEncoded,
  TRIAL_RESULT_RECEIPT_HASH_DOMAIN,
  computeCaseTerminalResultSha256,
  computeGateTerminalResultSha256,
  computeMachineTrialResultReceiptId,
  computeObjectiveMetricEvidenceSha256,
  computeProbeMeasurementEvidenceSha256,
  computeProbeTerminalResultSha256,
  computeTopologyTrialResultReceiptId,
  decodeMachineTrialResult,
  decodeMachineTrialResultStructure,
  decodeTopologyTrialResult,
  encodeMachineTrialResult,
  encodeTopologyTrialResult,
  makeMachineTrialResult,
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
import type { PlannedRepositoryPath } from "../src/schema/primitives.js"

type MutableDocument = Record<string, any>
type Scope = "machine" | "topology"

const fixturePath = resolve(
  typeof import.meta.dir === "string" ? import.meta.dir : dirname(fileURLToPath(import.meta.url)),
  "../../../docs/refactor/architecture-program/inputs/trial-spec.json"
)
const textEncoder = new TextEncoder()
const testEvidenceDomain = "ts-release/architecture-trial-result-test-evidence/v2"

const exactSha256 = (text: string) => sha256Bytes(textEncoder.encode(text))
const evidenceSha256 = (value: unknown) => hashCanonicalValue(testEvidenceDomain, value)
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
    toolchain: {
      bun: "1.3.14",
      typescript: "6.0.3",
      effect: "4.0.0-rc.108",
      git: "2.51.0"
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
  const authority = {
    trialSpec,
    rawTrialSpecSha256,
    candidateManifest,
    rawCandidateManifestSha256,
    candidateTreeSha256: candidateTree.sha256,
    runnerSourceSha256,
    toolchain: runContext.toolchain
  }
  return { authority, runContext, candidateTree }
})

const delta = (prefix: string) => ({
  addedIds: [`${prefix}.added`],
  removedIds: []
})

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
    return {
      caseId: machineCase.id,
      definitionSha256: machineCase.execution.definitionSha256,
      fixtureSha256: machineCase.execution.fixtureSha256,
      expectedEvidenceSha256: machineCase.execution.expectedEvidenceSha256,
      execution: {
        _tag: "Passed",
        processOutcome: { _tag: "Exited", exitCode: 0 },
        invocationSha256: evidenceSha256({ kind: "case-invocation", caseId: machineCase.id }),
        terminalOutput: {
          resultSha256: computeCaseTerminalResultSha256(terminalBody),
          ...terminalBody
        }
      }
    }
  })
  const probeReceipts = spec.marginalProbes.map((probe, index) => ({
    probeId: probe.id,
    definitionSha256: probe.execution.definitionSha256,
    baseFixtureSha256: probe.execution.baseFixtureSha256,
    changeDefinitionSha256: probe.execution.changeDefinitionSha256,
    execution: {
      _tag: "Passed",
      processOutcome: { _tag: "Exited", exitCode: 0 },
      invocationSha256: evidenceSha256({ kind: "probe-invocation", probeId: probe.id }),
      terminalOutput: makeProbeOutput(fixture, index)
    }
  }))
  const gateReceipts = gates.map((gate) => {
    const terminalBody: GateTerminalOutputBodyEncoded = {
      facts: [{
        sequence: 1,
        name: "gate.passed",
        value: { _tag: "Boolean" as const, value: true }
      }]
    }
    return {
      gateId: gate.id,
      definitionSha256: gateDefinitionSha256(gate),
      command: [...gate.command],
      caseIds: [...gate.caseIds],
      probeIds: [...gate.probeIds],
      expectedExit: gate.expectedExit,
      execution: {
        _tag: "Passed",
        processOutcome: { _tag: "Exited", exitCode: 0 },
        invocationSha256: evidenceSha256({ kind: "gate-invocation", gateId: gate.id }),
        terminalOutput: {
          resultSha256: computeGateTerminalResultSha256(terminalBody),
          ...terminalBody
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
  body.objectiveMetrics = objectiveIds.map((id, value) => ({
    _tag: "Measured",
    id,
    value,
    evidenceSha256: computeObjectiveMetricEvidenceSha256(
      objectiveContext,
      id,
      value
    )
  }))
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
  body.objectiveMetrics = body.objectiveMetrics.map(({ id }: MutableDocument) => ({
    _tag: "Unavailable",
    id,
    failureId
  }))
  body.qualification = "Rejected"
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
      metric.evidenceSha256 = computeObjectiveMetricEvidenceSha256(context, metric.id, metric.value)
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

  it.effect("round-trips every factual process outcome on a failed execution", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const outcomes: ReadonlyArray<MutableDocument> = [
        { _tag: "Exited", exitCode: 0 },
        { _tag: "TimedOut", timeoutMilliseconds: 30_000 },
        { _tag: "Signaled", signal: "SIGKILL" },
        { _tag: "SpawnFailed", executable: "bun" },
        { _tag: "ProtocolRejected", outputSha256: null }
      ]
      for (const processOutcome of outcomes) {
        const body = makeEarlyFailureBody("machine", fixture)
        body.caseReceipts[0].execution = {
          _tag: "Failed",
          processOutcome,
          invocationSha256: null,
          terminalOutput: null,
          failureIds: ["failure.execution"]
        }
        const result = makeMachineTrialResult(body as MachineTrialResultBodyEncoded, fixture.authority)
        const decoded = yield* decodeMachineTrialResult(
          encodeMachineTrialResult(result, fixture.authority),
          fixture.authority
        )
        expect(decoded.caseReceipts[0]?.execution._tag).toBe("Failed")
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
          document.caseReceipts[0].execution.processOutcome.exitCode = 1
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

  it.effect("rejects a self-consistent receipt whose context mismatches exact external authority", () =>
    Effect.gen(function* () {
      const fixture = yield* loadAuthority("machine")
      const body = makePassedBody("machine", fixture)
      const result = makeMachineTrialResult(body as MachineTrialResultBodyEncoded, fixture.authority)
      const encoded = encodeMachineTrialResult(result, fixture.authority)
      const mismatchedAuthority = {
        ...fixture.authority,
        candidateTreeSha256: exactSha256("different runner-observed tree\n")
      }

      yield* decodeMachineTrialResultStructure(encoded)
      const exit = yield* decodeMachineTrialResult(encoded, mismatchedAuthority).pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
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
})
