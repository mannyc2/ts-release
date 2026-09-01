import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import type { ObjectiveMetricEvidenceContextEncoded } from "../src/schema/trial-result.js"
import {
  computeObjectiveMetricEvidenceSha256,
  computeProbeEvaluationRecordSha256,
  computeProbeTerminalResultSha256
} from "../src/schema/trial-result.js"
import {
  REQUIRED_MACHINE_METRIC_IDS,
  REQUIRED_TOPOLOGY_METRIC_IDS
} from "../src/schema/trial-spec.js"
import {
  V2_CANDIDATE_DEFINITIONS,
  V2_CASE_IDS,
  V2_MACHINE_GATE_IDS,
  V2_PROBE_IDS,
  V2_TOPOLOGY_GATE_IDS
} from "../src/schema/v2-ids.js"
import { REQUIRED_TRIAL_LANES } from "../src/schema/trial-contract.js"
import { ArtifactId } from "../src/schema/primitives.js"
import { hashCanonicalValue } from "../src/trial-hash.js"
import {
  type RunnerOwnedObjectiveEvaluator,
  type RunnerOwnedObjectiveMetricId,
  deriveTrialObjectives,
  objectiveMetricUnavailableFailureId
} from "../src/trial-objectives.js"

type Scope = "machine" | "topology"
type MutableDocument = Record<string, any>

const TEST_HASH_DOMAIN = "ts-release/architecture-trial-objectives-test/v2"
const sha256 = (value: unknown) => hashCanonicalValue(TEST_HASH_DOMAIN, value)
const exitedProcessAttempt = () => ({
  _tag: "Exited" as const,
  exitCode: 0,
  stdout: { _tag: "Complete" as const, byteLength: 0, sha256: sha256(["stdout", "empty"]) },
  stderr: { _tag: "Complete" as const, byteLength: 0, sha256: sha256(["stderr", "empty"]) }
})

const makeManifest = (scope: Scope): MutableDocument => {
  const candidateId = scope === "machine" ? "M1-extracted-fold" : "T1-root"
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
    publicSurfaceIds: ["public.declaration", "public.root", "public.runtime"],
    durableFormatIds: ["format.journal-v2"],
    dependencyEdges: [
      {
        id: "module.core->package.core:static",
        fromId: "module.core",
        toId: "package.core",
        kind: "static"
      },
      {
        id: "module.extra->package.core:type-only",
        fromId: "module.extra",
        toId: "package.core",
        kind: "type-only"
      }
    ]
  }
}

const makeTreeEntries = (): ReadonlyArray<MutableDocument> => [
  {
    path: "src/index.ts",
    mode: "100644",
    bytes: 31,
    sha256: sha256("src/index.ts")
  },
  {
    path: "trial-adapter.ts",
    mode: "100755",
    bytes: 47,
    sha256: sha256("trial-adapter.ts")
  },
  {
    path: "trial-candidate.json",
    mode: "100644",
    bytes: 59,
    sha256: sha256("trial-candidate.json")
  }
]

const makeCaseReceipts = (): ReadonlyArray<MutableDocument> => V2_CASE_IDS.map((caseId) => ({
  caseId,
  definitionSha256: sha256([caseId, "definition"]),
  fixtureSha256: sha256([caseId, "fixture"]),
  expectedEvidenceSha256: sha256([caseId, "expected-evidence"]),
  execution: {
    _tag: "NotRun",
    failureIds: ["case-prerequisite-unavailable"]
  }
}))

const makeProbeTerminalBody = (
  probeId: string,
  grossProductAdditions: number,
  centralBranchCount: number
): MutableDocument => {
  const afterTreeSha256 = sha256([probeId, "after"])
  const evaluationBody = {
    evaluatorId: "probe-evaluator.objective-fixture-v1",
    probeId,
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
  return {
  beforeTreeSha256: sha256([probeId, "before"]),
  afterTreeSha256,
  patchSha256: sha256([probeId, "patch"]),
  // This is a hostile self-report. Objective derivation must ignore it and use laneDeltas.
  measurements: [{
    _tag: "Measured",
    id: "gross-product-additions",
    value: { _tag: "Count", value: 999_999 },
    evidenceSha256: sha256([probeId, "candidate-claimed-additions"])
  }],
  laneDeltas: REQUIRED_TRIAL_LANES.map(([laneId]) => ({
    laneId,
    additions: laneId === "product-source" ? grossProductAdditions : 0,
    deletions: 0
  })),
  touchedPathIds: ["src/index.ts"],
  touchedModuleIds: ["module.core"],
  touchedPackageIds: ["package.core"],
  touchedConceptIds: ["concept.machine"],
  touchedCentralBranchIds: Array.from(
    { length: centralBranchCount },
    (_, index) => `branch.${String(index + 1).padStart(2, "0")}`
  ),
  touchedOwnerRoleIds: ["role.kernel"],
  publicSurfaceDelta: { addedIds: [], removedIds: [] },
  durableFormatDelta: { addedIds: [], removedIds: [] },
  dependencyDagDelta: { addedIds: [], removedIds: [] },
  zeroTouchRoleIds: [],
  changeKinds: ["state"],
  facts: [{
    sequence: 1,
    name: "probe.observed-change",
    value: { _tag: "Text", value: probeId }
  }],
  evaluationRecord: {
    recordSha256: computeProbeEvaluationRecordSha256(evaluationBody as never),
    ...evaluationBody
  },
  observationCount: 1
  }
}

const makeProbeReceipts = (): ReadonlyArray<MutableDocument> => {
  const additions = [9, 1, 5, 3, 7, 2, 6, 4, 8]
  return V2_PROBE_IDS.map((probeId, index) => {
    const body = makeProbeTerminalBody(probeId, additions[index]!, (index % 4) + 1)
    return {
      probeId,
      definitionSha256: sha256([probeId, "definition"]),
      baseFixtureSha256: sha256([probeId, "base-fixture"]),
      changeDefinitionSha256: sha256([probeId, "change-definition"]),
      execution: {
        _tag: "Passed",
        processAttempt: exitedProcessAttempt(),
        invocationSha256: sha256([probeId, "invocation"]),
        terminalOutput: {
          resultSha256: computeProbeTerminalResultSha256(body as never),
          ...body
        }
      }
    }
  })
}

const makeGateReceipts = (scope: Scope): ReadonlyArray<MutableDocument> =>
  (scope === "machine" ? V2_MACHINE_GATE_IDS : V2_TOPOLOGY_GATE_IDS).map((gateId) => ({
    gateId,
    definitionSha256: sha256([gateId, "definition"]),
    command: ["bun", "test"],
    caseIds: [],
    probeIds: [],
    expectedExit: 0,
    execution: {
      _tag: "NotRun",
      failureIds: ["gate-prerequisite-unavailable"]
    }
  }))

const makeInput = (scope: Scope): MutableDocument => ({
  scope,
  runContextSha256: sha256([scope, "run-context"]),
  preflightFailures: [],
  candidateTreeEntries: makeTreeEntries(),
  candidateManifest: makeManifest(scope),
  caseReceipts: makeCaseReceipts(),
  probeReceipts: makeProbeReceipts(),
  gateReceipts: makeGateReceipts(scope)
})

const measuredValues = {
  "representable-invalid-state-count": 11,
  "machine-interpreter-product-lines": 101,
  "main-path-owner-hops": 2,
  "difficult-path-owner-hops": 4,
  "invalid-version-publication-state-count": 7,
  "product-source-lines": 211,
  "packed-byte-count": 4_096
} as const satisfies Readonly<Record<RunnerOwnedObjectiveMetricId, number>>

const makeEvaluator = (
  calls: Array<string>,
  unavailable: ReadonlySet<string> = new Set()
): RunnerOwnedObjectiveEvaluator => ({
  derivationId: ArtifactId.make("objective-derivation.test-evaluator-v1"),
  evaluate: (request) => {
    calls.push(request.metricId)
    return Effect.succeed(unavailable.has(request.metricId)
      ? { _tag: "Unavailable", id: request.metricId }
      : {
          _tag: "Measured",
          id: request.metricId,
          value: measuredValues[request.metricId],
          facts: [{
            sequence: 1,
            name: "objective.evaluator-value",
            value: { _tag: "Integer", value: measuredValues[request.metricId] }
          }]
        })
  }
})

const evidenceContext = (input: MutableDocument): ObjectiveMetricEvidenceContextEncoded => ({
  runContextSha256: input.runContextSha256,
  preflightFailures: input.preflightFailures,
  caseReceipts: input.caseReceipts,
  probeReceipts: input.probeReceipts,
  gateReceipts: input.gateReceipts
}) as ObjectiveMetricEvidenceContextEncoded

describe("runner-owned trial objective derivation", () => {
  it.effect("uses rank 5/rank 9 arithmetic and ignores candidate measurement claims", () =>
    Effect.gen(function* () {
      const input = makeInput("machine")
      const calls: Array<string> = []
      const metrics = yield* deriveTrialObjectives(input, makeEvaluator(calls))

      expect(metrics.map(({ id }) => id)).toEqual(REQUIRED_MACHINE_METRIC_IDS)
      expect(metrics.map((metric) => metric._tag === "Measured" ? metric.value : null)).toEqual([
        11,
        101,
        5,
        9,
        4,
        2,
        4
      ])
      expect(calls).toEqual([
        "representable-invalid-state-count",
        "machine-interpreter-product-lines",
        "main-path-owner-hops",
        "difficult-path-owner-hops"
      ])

      for (const metric of metrics) {
        expect(metric._tag).toBe("Measured")
        if (metric._tag === "Measured") {
          expect(metric.evidenceSha256).toBe(computeObjectiveMetricEvidenceSha256(
            evidenceContext(input),
            metric.id,
            metric.value,
            metric.derivationRecord
          ))
        }
      }
    }))

  it.effect("derives topology set counts and preserves exact topology objective order", () =>
    Effect.gen(function* () {
      const input = makeInput("topology")
      const calls: Array<string> = []
      const metrics = yield* deriveTrialObjectives(input, makeEvaluator(calls))

      expect(metrics.map(({ id }) => id)).toEqual(REQUIRED_TOPOLOGY_METRIC_IDS)
      expect(metrics.map((metric) => metric._tag === "Measured" ? metric.value : null)).toEqual([
        7,
        2,
        3,
        211,
        5,
        9,
        4,
        4_096
      ])
      expect(calls).toEqual([
        "invalid-version-publication-state-count",
        "product-source-lines",
        "packed-byte-count"
      ])
    }))

  it.effect("propagates unavailable prerequisites with stable runner-owned failure ids", () =>
    Effect.gen(function* () {
      const input = makeInput("machine")
      input.probeReceipts[3] = {
        ...input.probeReceipts[3],
        execution: { _tag: "NotRun", failureIds: ["probe-prerequisite-unavailable"] }
      }
      const metrics = yield* deriveTrialObjectives(
        input,
        makeEvaluator([], new Set(["representable-invalid-state-count"]))
      )

      const unavailableIds = metrics
        .filter((metric) => metric._tag === "Unavailable")
        .map(({ id }) => id)
      expect(unavailableIds).toEqual([
        "representable-invalid-state-count",
        "probe-median-gross-product-additions",
        "probe-p90-gross-product-additions",
        "probe-max-central-branches-touched"
      ])
      for (const metric of metrics) {
        if (metric._tag === "Unavailable") {
          expect(metric).not.toHaveProperty("value")
          expect(metric.failureId).toBe(objectiveMetricUnavailableFailureId(metric.id))
        }
      }
    }))

  it.effect("rejects candidate-authored objective fields, wrong scope, and incomplete receipts", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<(input: MutableDocument) => void> = [
        (input) => {
          input.candidateManifest.objectiveMetrics = [{ id: "packed-byte-count", value: 0 }]
        },
        (input) => {
          input.scope = "topology"
        },
        (input) => {
          input.probeReceipts = input.probeReceipts.slice(0, -1)
        },
        (input) => {
          input.candidateTreeEntries = [...input.candidateTreeEntries].reverse()
        }
      ]
      for (const mutate of mutations) {
        const input = makeInput("machine")
        mutate(input)
        const calls: Array<string> = []
        const exit = yield* deriveTrialObjectives(input, makeEvaluator(calls)).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
        expect(calls).toEqual([])
      }
    }))

  it.effect("strictly rejects evaluator id substitution and excess self-report fields", () =>
    Effect.gen(function* () {
      for (const result of [
        { _tag: "Measured", id: "packed-byte-count", value: 1 },
        {
          _tag: "Measured",
          id: "representable-invalid-state-count",
          value: 1,
          candidateClaim: 0
        }
      ]) {
        const evaluator: RunnerOwnedObjectiveEvaluator = {
          derivationId: ArtifactId.make("objective-derivation.test-hostile-v1"),
          evaluate: () => Effect.succeed(result)
        }
        const exit = yield* deriveTrialObjectives(makeInput("machine"), evaluator).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))
})
