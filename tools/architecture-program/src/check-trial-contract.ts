import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { Effect, Schema } from "effect"
import {
  V2_EXPECTED_CASE_COMPONENT_HASHES,
  V2_EXPECTED_CASE_EXECUTIONS,
  V2_EXPECTED_CASE_IDS,
  V2_EXPECTED_BINARY_NON_PRODUCT_LINE_DELTA_POLICY,
  V2_EXPECTED_CONTRACT_HASHES,
  V2_EXPECTED_COUNTS,
  V2_EXPECTED_DIFF_ARGV,
  V2_EXPECTED_GATE_DEFINITION_HASHES,
  V2_EXPECTED_GIT_ENVIRONMENT,
  V2_EXPECTED_GIT_EXECUTABLE_POLICY,
  V2_EXPECTED_ISOLATION_POLICY,
  V2_EXPECTED_LAW_IDS,
  V2_EXPECTED_MACHINE_CANDIDATE_IDS,
  V2_EXPECTED_MACHINE_GATE_IDS,
  V2_EXPECTED_PROBE_ACTION_IDS,
  V2_EXPECTED_PROBE_COMPONENT_HASHES,
  V2_EXPECTED_PROBE_IDS,
  V2_EXPECTED_PROBE_MEASUREMENT_IDS,
  V2_EXPECTED_REQUIRED_TOOLCHAIN_BINDINGS,
  V2_EXPECTED_SCHEMA_IDS,
  V2_EXPECTED_TOPOLOGY_CANDIDATE_IDS,
  V2_EXPECTED_TOPOLOGY_FIXTURE_SHA256,
  V2_EXPECTED_TOPOLOGY_GATE_IDS,
  V2_EXPECTED_TOP_LEVEL_KEYS,
  V2_RESULT_SCHEMA_IDS
} from "./trial-contract-oracle.js"
import { hashCanonicalDocumentBytes } from "./trial-hash.js"
import {
  executionContractSha256,
  measurementContractSha256
} from "./schema/trial-contract.js"
import {
  expectedCaseEvidenceSha256V2,
  probeChangeDefinitionSha256V2
} from "./schema/trial-evidence.js"
import {
  type ArchitectureTrialSpecV2,
  gateDefinitionSha256,
  machineCaseDefinitionSha256,
  machineCaseFixtureSha256,
  marginalProbeDefinitionSha256,
  topologyFixtureSha256
} from "./schema/trial-spec.js"

export class TrialContractOracleError extends Schema.TaggedError<TrialContractOracleError>()(
  "TrialContractOracleError",
  {
    issues: Schema.NonEmptyArray(Schema.String),
    message: Schema.String
  }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture trial v2 independent-oracle failure: ${issues.join("; ")}`
    })
  }
}

const exact = (
  label: string,
  actual: ReadonlyArray<unknown>,
  expected: ReadonlyArray<unknown>,
  issues: Array<string>
): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    issues.push(`${label} differs from the independent v2 oracle`)
  }
}

const literal = (
  label: string,
  actual: unknown,
  expected: unknown,
  issues: Array<string>
): void => {
  if (actual !== expected) issues.push(`${label} differs from the independent v2 oracle`)
}

export const trialContractOracleIssues = (
  spec: ArchitectureTrialSpecV2,
  encoded: unknown
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  if (typeof encoded !== "object" || encoded === null || Array.isArray(encoded)) {
    return ["encoded trial specification is not an object"]
  }

  exact("top-level keys", Object.keys(encoded), V2_EXPECTED_TOP_LEVEL_KEYS, issues)
  literal("trial specification schema id", spec.schemaVersion, V2_EXPECTED_SCHEMA_IDS.trialSpec, issues)
  exact("law ids", spec.laws.map(({ id }) => id), V2_EXPECTED_LAW_IDS, issues)
  exact("case ids", spec.machineCases.map(({ id }) => id), V2_EXPECTED_CASE_IDS, issues)
  exact("probe ids", spec.marginalProbes.map(({ id }) => id), V2_EXPECTED_PROBE_IDS, issues)
  exact(
    "machine candidate ids",
    spec.machineCandidates.map(({ id }) => id),
    V2_EXPECTED_MACHINE_CANDIDATE_IDS,
    issues
  )
  exact(
    "topology candidate ids",
    spec.topologyCandidates.map(({ id }) => id),
    V2_EXPECTED_TOPOLOGY_CANDIDATE_IDS,
    issues
  )
  exact(
    "machine gate ids",
    spec.gateRequirements.filter(({ scope }) => scope === "machine").map(({ id }) => id),
    V2_EXPECTED_MACHINE_GATE_IDS,
    issues
  )
  exact(
    "topology gate ids",
    spec.gateRequirements.filter(({ scope }) => scope === "topology").map(({ id }) => id),
    V2_EXPECTED_TOPOLOGY_GATE_IDS,
    issues
  )
  exact(
    "probe measurement ids",
    spec.measurementContract.methods.map(({ id }) => id),
    V2_EXPECTED_PROBE_MEASUREMENT_IDS,
    issues
  )
  exact(
    "required toolchain bindings",
    spec.measurementContract.requiredToolchainBindings,
    V2_EXPECTED_REQUIRED_TOOLCHAIN_BINDINGS,
    issues
  )
  exact("measurement diff argv", spec.measurementContract.diffArgv, V2_EXPECTED_DIFF_ARGV, issues)
  exact(
    "measurement Git environment",
    [spec.measurementContract.gitEnvironment],
    [V2_EXPECTED_GIT_ENVIRONMENT],
    issues
  )
  exact(
    "measurement Git executable policy",
    [spec.measurementContract.gitExecutablePolicy],
    [V2_EXPECTED_GIT_EXECUTABLE_POLICY],
    issues
  )
  literal(
    "binary non-product line-delta policy",
    spec.measurementContract.binaryNonProductLineDeltaPolicy,
    V2_EXPECTED_BINARY_NON_PRODUCT_LINE_DELTA_POLICY,
    issues
  )

  literal(
    "stored execution contract hash",
    spec.executionContract.contractSha256,
    V2_EXPECTED_CONTRACT_HASHES.execution,
    issues
  )
  literal(
    "computed execution contract hash",
    executionContractSha256(spec.executionContract),
    V2_EXPECTED_CONTRACT_HASHES.execution,
    issues
  )
  exact(
    "execution isolation policy",
    [spec.executionContract.isolationPolicy],
    [V2_EXPECTED_ISOLATION_POLICY],
    issues
  )
  literal(
    "stored measurement contract hash",
    spec.measurementContract.contractSha256,
    V2_EXPECTED_CONTRACT_HASHES.measurement,
    issues
  )
  literal(
    "computed measurement contract hash",
    measurementContractSha256(spec.measurementContract),
    V2_EXPECTED_CONTRACT_HASHES.measurement,
    issues
  )
  literal(
    "stored topology fixture hash",
    spec.topologyFixture.fixtureSha256,
    V2_EXPECTED_TOPOLOGY_FIXTURE_SHA256,
    issues
  )
  literal(
    "computed topology fixture hash",
    topologyFixtureSha256(spec.topologyFixture),
    V2_EXPECTED_TOPOLOGY_FIXTURE_SHA256,
    issues
  )

  for (const machineCase of spec.machineCases) {
    const expected = V2_EXPECTED_CASE_EXECUTIONS[machineCase.id as keyof typeof V2_EXPECTED_CASE_EXECUTIONS]
    if (expected === undefined) {
      issues.push(`case ${machineCase.id} is absent from the independent execution oracle`)
      continue
    }
    exact(`case ${machineCase.id} actions`, machineCase.execution.actionIds, expected.actionIds, issues)
    exact(`case ${machineCase.id} faults`, machineCase.execution.faultIds, expected.faultIds, issues)
    const expectedHashes = V2_EXPECTED_CASE_COMPONENT_HASHES[
      machineCase.id as keyof typeof V2_EXPECTED_CASE_COMPONENT_HASHES
    ]
    if (expectedHashes === undefined) {
      issues.push(`case ${machineCase.id} is absent from the independent component-hash oracle`)
      continue
    }
    literal(
      `case ${machineCase.id} stored fixture hash`,
      machineCase.execution.fixtureSha256,
      expectedHashes.fixtureSha256,
      issues
    )
    literal(
      `case ${machineCase.id} computed fixture hash`,
      machineCaseFixtureSha256(machineCase),
      expectedHashes.fixtureSha256,
      issues
    )
    literal(
      `case ${machineCase.id} stored expected-evidence hash`,
      machineCase.execution.expectedEvidenceSha256,
      expectedHashes.expectedEvidenceSha256,
      issues
    )
    literal(
      `case ${machineCase.id} computed expected-evidence hash`,
      expectedCaseEvidenceSha256V2(machineCase.expectedEvidence),
      expectedHashes.expectedEvidenceSha256,
      issues
    )
    literal(
      `case ${machineCase.id} stored definition hash`,
      machineCase.execution.definitionSha256,
      expectedHashes.definitionSha256,
      issues
    )
    literal(
      `case ${machineCase.id} computed definition hash`,
      machineCaseDefinitionSha256(machineCase),
      expectedHashes.definitionSha256,
      issues
    )
    literal(
      `case ${machineCase.id} fixture schema id`,
      machineCase.fixture.schemaVersion,
      V2_EXPECTED_SCHEMA_IDS.caseFixture,
      issues
    )
    literal(
      `case ${machineCase.id} expected-evidence schema id`,
      machineCase.expectedEvidence.schemaVersion,
      V2_EXPECTED_SCHEMA_IDS.expectedCaseEvidence,
      issues
    )
    literal(
      `case ${machineCase.id} input schema id`,
      machineCase.execution.inputSchemaId,
      V2_EXPECTED_SCHEMA_IDS.caseInvocation,
      issues
    )
    literal(
      `case ${machineCase.id} output schema id`,
      machineCase.execution.outputSchemaId,
      V2_EXPECTED_SCHEMA_IDS.caseObservation,
      issues
    )
  }
  for (const probe of spec.marginalProbes) {
    const expected = V2_EXPECTED_PROBE_ACTION_IDS[probe.id as keyof typeof V2_EXPECTED_PROBE_ACTION_IDS]
    if (probe.execution.actionId !== expected) {
      issues.push(`probe ${probe.id} action differs from the independent v2 oracle`)
    }
    const expectedHashes = V2_EXPECTED_PROBE_COMPONENT_HASHES[
      probe.id as keyof typeof V2_EXPECTED_PROBE_COMPONENT_HASHES
    ]
    if (expectedHashes === undefined) {
      issues.push(`probe ${probe.id} is absent from the independent component-hash oracle`)
      continue
    }
    literal(
      `probe ${probe.id} stored change-definition hash`,
      probe.execution.changeDefinitionSha256,
      expectedHashes.changeDefinitionSha256,
      issues
    )
    literal(
      `probe ${probe.id} computed change-definition hash`,
      probeChangeDefinitionSha256V2(probe.changeDefinition),
      expectedHashes.changeDefinitionSha256,
      issues
    )
    literal(
      `probe ${probe.id} stored definition hash`,
      probe.execution.definitionSha256,
      expectedHashes.definitionSha256,
      issues
    )
    literal(
      `probe ${probe.id} computed definition hash`,
      marginalProbeDefinitionSha256(probe),
      expectedHashes.definitionSha256,
      issues
    )
    literal(
      `probe ${probe.id} change schema id`,
      probe.changeDefinition.schemaVersion,
      V2_EXPECTED_SCHEMA_IDS.probeChangeDefinition,
      issues
    )
    literal(
      `probe ${probe.id} input schema id`,
      probe.execution.inputSchemaId,
      V2_EXPECTED_SCHEMA_IDS.probeInvocation,
      issues
    )
    literal(
      `probe ${probe.id} output schema id`,
      probe.execution.outputSchemaId,
      V2_EXPECTED_SCHEMA_IDS.probeObservation,
      issues
    )
  }
  for (const gate of spec.gateRequirements) {
    const expectedHash = V2_EXPECTED_GATE_DEFINITION_HASHES[
      gate.id as keyof typeof V2_EXPECTED_GATE_DEFINITION_HASHES
    ]
    if (expectedHash === undefined) {
      issues.push(`gate ${gate.id} is absent from the independent definition-hash oracle`)
      continue
    }
    literal(
      `gate ${gate.id} definition hash`,
      gateDefinitionSha256(gate),
      expectedHash,
      issues
    )
    literal(
      `gate ${gate.id} result schema id`,
      gate.resultSchemaId,
      gate.scope === "machine"
        ? V2_EXPECTED_SCHEMA_IDS.machineResult
        : V2_EXPECTED_SCHEMA_IDS.topologyResult,
      issues
    )
  }

  const resultSchemaIds = [...new Set(spec.gateRequirements.map(({ resultSchemaId }) => resultSchemaId))]
  exact(
    "gate result schema ids",
    resultSchemaIds,
    [V2_RESULT_SCHEMA_IDS.machine, V2_RESULT_SCHEMA_IDS.topology],
    issues
  )
  const actualSchemaIds = [...new Set([
    spec.schemaVersion,
    spec.receiptContract.candidateManifestSchemaId,
    ...spec.machineCases.map(({ fixture }) => fixture.schemaVersion),
    ...spec.machineCases.map(({ expectedEvidence }) => expectedEvidence.schemaVersion),
    ...spec.marginalProbes.map(({ changeDefinition }) => changeDefinition.schemaVersion),
    spec.receiptContract.runContextSchemaId,
    ...spec.machineCases.map(({ execution }) => execution.inputSchemaId),
    ...spec.machineCases.map(({ execution }) => execution.outputSchemaId),
    ...spec.marginalProbes.map(({ execution }) => execution.inputSchemaId),
    ...spec.marginalProbes.map(({ execution }) => execution.outputSchemaId),
    spec.receiptContract.gateInvocationSchemaId,
    spec.receiptContract.gateObservationSchemaId,
    ...spec.gateRequirements.map(({ resultSchemaId }) => resultSchemaId)
  ])]
  exact("schema ids", actualSchemaIds, Object.values(V2_EXPECTED_SCHEMA_IDS), issues)
  const actualCounts = {
    topLevelKeys: Object.keys(encoded).length,
    laws: spec.laws.length,
    machineCases: spec.machineCases.length,
    marginalProbes: spec.marginalProbes.length,
    machineCandidates: spec.machineCandidates.length,
    topologyCandidates: spec.topologyCandidates.length,
    machineGates: spec.gateRequirements.filter(({ scope }) => scope === "machine").length,
    topologyGates: spec.gateRequirements.filter(({ scope }) => scope === "topology").length,
    gateRequirements: spec.gateRequirements.length,
    probeMeasurements: spec.measurementContract.methods.length,
    schemaIds: actualSchemaIds.length,
    resultSchemas: resultSchemaIds.length
  }
  if (JSON.stringify(actualCounts) !== JSON.stringify(V2_EXPECTED_COUNTS)) {
    issues.push("v2 contract counts differ from the independent oracle")
  }
  return issues
}

const readUtf8 = (path: string) => Effect.tryPromise({
  try: () => readFile(path, "utf8"),
  catch: (cause) => new TrialContractOracleError([
    `could not read ${path}: ${cause instanceof Error ? cause.message : String(cause)}`
  ])
})

export const checkTrialContractOracle = Effect.fn("ArchitectureTrialSpecV2.checkIndependentOracle")(
  function* (
    repositoryRoot: string,
    spec: ArchitectureTrialSpecV2,
    encoded: unknown,
    inputBytes: Uint8Array
  ) {
    const issues = [...trialContractOracleIssues(spec, encoded)]
    for (const sourcePath of [
      "tools/architecture-program/src/schema/trial-spec.ts",
      "tools/architecture-program/src/schema/trial-contract.ts"
    ]) {
      const source = yield* readUtf8(resolve(repositoryRoot, sourcePath))
      if (source.includes("trial-contract-oracle")) {
        issues.push(`${sourcePath} must not import or read the independent oracle`)
      }
    }
    if (issues.length > 0) {
      return yield* new TrialContractOracleError(issues as [string, ...Array<string>])
    }
    return {
      trialSpecSha256: hashCanonicalDocumentBytes(inputBytes),
      checkedCaseDefinitions: spec.machineCases.length,
      checkedProbeDefinitions: spec.marginalProbes.length,
      checkedGateDefinitions: spec.gateRequirements.length
    }
  }
)
