import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "../src/canonical-document.js"
import { ArtifactId, Sha256Hex } from "../src/schema/primitives.js"
import type { UpstreamMachineReceiptBindingV2 } from "../src/schema/run-context.js"
import type {
  ArchitectureTrialResultV2,
  TrialResultValidationAuthority
} from "../src/schema/trial-result.js"
import { decodeTrialResultsAggregate } from "../src/schema/trial-results-aggregate.js"
import { decodeArchitectureTrialSpec } from "../src/schema/trial-spec.js"
import {
  V2_CANDIDATE_DEFINITIONS,
  V2_MACHINE_CANDIDATE_IDS,
  V2_PROBE_IDS,
  V2_TOPOLOGY_CANDIDATE_IDS,
  type V2CandidateId
} from "../src/schema/v2-ids.js"
import { hashCanonicalDocumentBytes, sha256Bytes } from "../src/trial-hash.js"
import {
  TRIAL_RESULTS_AGGREGATE_PATH,
  TrialOutputFileSystemError,
  TrialOutputPersistenceError,
  makeTrialOrchestration,
  type EncodeCompletedTrialRun,
  type TrialOutputEntry,
  type TrialOutputFileSystemService
} from "../src/trial-orchestration.js"
import type {
  CompletedTrialRun,
  TrialRunnerService
} from "../src/trial-runner.js"

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(moduleDirectory, "../../..")
const rawTrialSpecBytes = new Uint8Array(readFileSync(resolve(
  repositoryRoot,
  "docs/refactor/architecture-program/inputs/trial-spec.json"
)))
const spec = Effect.runSync(decodeArchitectureTrialSpec(
  parseCanonicalJsonBytes(rawTrialSpecBytes)
))
const trialSpecSha256 = hashCanonicalDocumentBytes(rawTrialSpecBytes)
const hash = (character: string) => Sha256Hex.make(character.repeat(64))

const RECEIPT_CHARACTERS: Readonly<Record<V2CandidateId, string>> = {
  "M1-extracted-fold": "1",
  "M2-total-transition": "2",
  "T1-root": "3",
  "T2-kernel-provider-bundle": "4",
  "T3-provider-verticals": "5"
}

const resultPath = (candidateId: V2CandidateId): string => {
  const scope = V2_CANDIDATE_DEFINITIONS[candidateId].scope
  return `docs/refactor/architecture-program/results/${scope}/${candidateId}.json`
}

interface CandidateOutcome {
  readonly values: ReadonlyArray<number>
  readonly qualification?: "Passed" | "Rejected"
}

const completedRun = (
  candidateId: V2CandidateId,
  outcome: CandidateOutcome,
  upstreamMachineReceipt: UpstreamMachineReceiptBindingV2
): CompletedTrialRun => {
  const definition = V2_CANDIDATE_DEFINITIONS[candidateId]
  const policy = definition.scope === "machine"
    ? spec.machineSelectionPolicy
    : spec.topologySelectionPolicy
  const receiptId = hash(RECEIPT_CHARACTERS[candidateId])
  const candidateManifestSha256 = hash("a")
  const candidateTreeSha256 = hash("b")
  const runnerSourceSha256 = hash("c")
  const runnerNodeModulesSha256 = hash("d")
  const result = {
    schemaVersion: definition.scope === "machine"
      ? "machine-trial-result-v2"
      : "topology-trial-result-v2",
    receiptId,
    runContextSha256: hash("e"),
    runContext: {
      trialSpecSha256,
      candidateId,
      candidateScope: definition.scope,
      candidateManifestSha256,
      candidateTreeSha256,
      runnerSourceSha256,
      runnerNodeModulesSha256,
      upstreamMachineReceipt
    },
    qualification: outcome.qualification ?? "Passed",
    gateReceipts: policy.hardGateIds.map((gateId) => ({
      gateId,
      execution: { _tag: "Passed" }
    })),
    objectiveMetrics: policy.objectiveMetricIds.map((id, index) => ({
      _tag: "Measured",
      id,
      value: outcome.values[index] ?? 0
    }))
  } as unknown as ArchitectureTrialResultV2
  const validationAuthority = {
    trialSpec: spec,
    rawTrialSpecSha256: trialSpecSha256,
    candidateManifest: {},
    rawCandidateManifestSha256: candidateManifestSha256,
    candidateTreeSha256,
    runnerSourceSha256,
    runnerNodeModulesSha256,
    toolchain: {},
    expectedReceiptId: receiptId,
    evaluationAuthority: {
      probeEvaluations: V2_PROBE_IDS.map((probeId) => ({
        probeId,
        evaluatorId: null,
        recordSha256: null
      })),
      gateEvaluations: policy.hardGateIds.map((gateId) => ({
        gateId,
        evaluatorId: null,
        recordSha256: null
      })),
      objectiveDerivations: policy.objectiveMetricIds.map((metricId) => ({
        metricId,
        derivationId: ArtifactId.make("objective-derivation.orchestration-test-v1"),
        recordSha256: hash("f")
      }))
    }
  } as unknown as TrialResultValidationAuthority
  return { result, validationAuthority }
}

interface RunnerCall {
  readonly candidateId: V2CandidateId
  readonly upstreamMachineReceipt: UpstreamMachineReceiptBindingV2
}

const makeRunner = (
  outcomes: Readonly<Record<V2CandidateId, CandidateOutcome>>
): { readonly runner: TrialRunnerService; readonly calls: Array<RunnerCall> } => {
  const calls: Array<RunnerCall> = []
  return {
    calls,
    runner: {
      run: (_root, candidateId, upstreamMachineReceipt) => Effect.sync(() => {
        calls.push({ candidateId, upstreamMachineReceipt })
        return completedRun(candidateId, outcomes[candidateId], upstreamMachineReceipt)
      })
    }
  }
}

interface MemoryOutputFileSystem {
  readonly service: TrialOutputFileSystemService
  readonly entries: Map<string, TrialOutputEntry>
  readonly writes: Array<{
    readonly path: string
    readonly expectedExistingSha256: typeof Sha256Hex.Type | null
  }>
}

const copyEntry = (entry: TrialOutputEntry): TrialOutputEntry => entry._tag === "RegularFile"
  ? { _tag: "RegularFile", bytes: entry.bytes.slice() }
  : entry

const makeMemoryOutputFileSystem = (
  initial: ReadonlyArray<readonly [string, TrialOutputEntry]> = []
): MemoryOutputFileSystem => {
  const entries = new Map(initial.map(([path, entry]) => [path, copyEntry(entry)]))
  const writes: MemoryOutputFileSystem["writes"] = []
  return {
    entries,
    writes,
    service: {
      inspect: (_root, path) => Effect.sync(() => copyEntry(
        entries.get(path) ?? { _tag: "Missing" }
      )),
      writeAtomically: (_root, path, bytes, expectedExistingSha256) => Effect.gen(function* () {
        const existing = entries.get(path) ?? { _tag: "Missing" }
        const actualExistingSha256 = existing._tag === "RegularFile"
          ? sha256Bytes(existing.bytes)
          : null
        if (actualExistingSha256 !== expectedExistingSha256) {
          return yield* new TrialOutputFileSystemError(
            "atomic write",
            path,
            "test compare-and-swap mismatch"
          )
        }
        writes.push({ path, expectedExistingSha256 })
        entries.set(path, { _tag: "RegularFile", bytes: bytes.slice() })
      })
    }
  }
}

const encodeFixtureReceipt: EncodeCompletedTrialRun = (completed) => Effect.succeed(
  canonicalJsonBytes({
    candidateId: completed.result.runContext.candidateId,
    receiptId: completed.result.receiptId,
    schemaVersion: completed.result.schemaVersion
  })
)

const passingOutcomes = (): Record<V2CandidateId, CandidateOutcome> => ({
  "M1-extracted-fold": { values: [1, 1, 1, 1, 1, 1, 1] },
  "M2-total-transition": { values: [2, 2, 2, 2, 2, 2, 2] },
  "T1-root": { values: [1, 1, 1, 1, 1, 1, 1, 1] },
  "T2-kernel-provider-bundle": { values: [2, 2, 2, 2, 2, 2, 2, 2] },
  "T3-provider-verticals": { values: [3, 3, 3, 3, 3, 3, 3, 3] }
})

describe("trial orchestration and durable result persistence", () => {
  it.effect("persists machine results before running topology with the exact selected receipt", () =>
    Effect.gen(function* () {
      const runner = makeRunner(passingOutcomes())
      const output = makeMemoryOutputFileSystem()
      const orchestration = makeTrialOrchestration({
        runner: runner.runner,
        outputFileSystem: output.service,
        encodeCompleted: encodeFixtureReceipt
      })

      const aggregate = yield* orchestration.run(repositoryRoot)

      expect(aggregate.machineSelection._tag).toBe("UniqueSelection")
      expect(aggregate.topologySelection?._tag).toBe("UniqueSelection")
      expect(aggregate.topologyResults).toHaveLength(3)
      expect(runner.calls.slice(0, 2)).toEqual(V2_MACHINE_CANDIDATE_IDS.map(
        (candidateId) => ({ candidateId, upstreamMachineReceipt: null })
      ))
      const selectedMachineReceipt = {
        selectedMachineCandidateId: "M1-extracted-fold",
        selectedMachineReceiptId: hash("1")
      }
      expect(runner.calls.slice(2)).toEqual(V2_TOPOLOGY_CANDIDATE_IDS.map(
        (candidateId) => ({ candidateId, upstreamMachineReceipt: selectedMachineReceipt })
      ))
      expect(output.writes.map(({ path }) => path)).toEqual([
        ...V2_MACHINE_CANDIDATE_IDS.map(resultPath),
        ...V2_TOPOLOGY_CANDIDATE_IDS.map(resultPath),
        TRIAL_RESULTS_AGGREGATE_PATH
      ])
      expect(output.writes.every(({ expectedExistingSha256 }) =>
        expectedExistingSha256 === null)).toBe(true)

      const persistedAggregate = output.entries.get(TRIAL_RESULTS_AGGREGATE_PATH)
      expect(persistedAggregate?._tag).toBe("RegularFile")
      if (persistedAggregate?._tag === "RegularFile") {
        const decoded = yield* decodeTrialResultsAggregate(
          parseCanonicalJsonBytes(persistedAggregate.bytes),
          spec
        )
        expect(decoded.aggregateId).toBe(aggregate.aggregateId)
        expect(decoded.machineResults[0]?.evaluationAuthority)
          .toEqual(completedRun("M1-extracted-fold", passingOutcomes()["M1-extracted-fold"], null)
            .validationAuthority.evaluationAuthority)
      }
    }))

  it.effect("writes a machine-only aggregate and stops for a Pareto tradeoff", () =>
    Effect.gen(function* () {
      const outcomes = passingOutcomes()
      outcomes["M1-extracted-fold"] = { values: [1, 2, 1, 1, 1, 1, 1] }
      outcomes["M2-total-transition"] = { values: [2, 1, 1, 1, 1, 1, 1] }
      const runner = makeRunner(outcomes)
      const output = makeMemoryOutputFileSystem()
      const orchestration = makeTrialOrchestration({
        runner: runner.runner,
        outputFileSystem: output.service,
        encodeCompleted: encodeFixtureReceipt
      })

      const aggregate = yield* orchestration.run(repositoryRoot)

      expect(aggregate.machineSelection._tag).toBe("MaintainerDecisionRequired")
      expect(aggregate.topologyResults).toEqual([])
      expect(aggregate.topologySelection).toBeNull()
      expect(runner.calls).toHaveLength(2)
      expect(output.entries.size).toBe(3)
      expect(output.entries.has(TRIAL_RESULTS_AGGREGATE_PATH)).toBe(true)
    }))

  it.effect("writes a machine-only aggregate and stops when no machine qualifies", () =>
    Effect.gen(function* () {
      const outcomes = passingOutcomes()
      outcomes["M1-extracted-fold"] = {
        values: outcomes["M1-extracted-fold"].values,
        qualification: "Rejected"
      }
      outcomes["M2-total-transition"] = {
        values: outcomes["M2-total-transition"].values,
        qualification: "Rejected"
      }
      const runner = makeRunner(outcomes)
      const output = makeMemoryOutputFileSystem()
      const orchestration = makeTrialOrchestration({
        runner: runner.runner,
        outputFileSystem: output.service,
        encodeCompleted: encodeFixtureReceipt
      })

      const aggregate = yield* orchestration.run(repositoryRoot)

      expect(aggregate.machineSelection._tag).toBe("NoQualifyingCandidate")
      expect(aggregate.topologyResults).toEqual([])
      expect(aggregate.topologySelection).toBeNull()
      expect(runner.calls).toHaveLength(2)
      expect(output.entries.size).toBe(3)
    }))

  it.effect("fails closed on an existing result symlink", () =>
    Effect.gen(function* () {
      const runner = makeRunner(passingOutcomes())
      const output = makeMemoryOutputFileSystem([[
        resultPath("M1-extracted-fold"),
        { _tag: "SymbolicLink" }
      ]])
      const orchestration = makeTrialOrchestration({
        runner: runner.runner,
        outputFileSystem: output.service,
        encodeCompleted: encodeFixtureReceipt
      })

      const error = yield* orchestration.run(repositoryRoot).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialOutputPersistenceError)
      expect(output.writes).toEqual([])
      expect(runner.calls).toHaveLength(2)
    }))

  it.effect("fails closed on existing noncanonical result bytes", () =>
    Effect.gen(function* () {
      const runner = makeRunner(passingOutcomes())
      const output = makeMemoryOutputFileSystem([[
        resultPath("M1-extracted-fold"),
        { _tag: "RegularFile", bytes: new TextEncoder().encode("{ }\n") }
      ]])
      const orchestration = makeTrialOrchestration({
        runner: runner.runner,
        outputFileSystem: output.service,
        encodeCompleted: encodeFixtureReceipt
      })

      const error = yield* orchestration.run(repositoryRoot).pipe(Effect.flip)

      expect(error).toBeInstanceOf(TrialOutputPersistenceError)
      expect(output.writes).toEqual([])
      expect(runner.calls).toHaveLength(2)
    }))
})
