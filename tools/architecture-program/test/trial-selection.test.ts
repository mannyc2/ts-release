import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { parseCanonicalJsonBytes } from "../src/canonical-document.js"
import {
  MaintainerDecisionRequired,
  NoQualifyingCandidate,
  TrialSelectionInvariantError,
  UniqueSelection,
  selectTrialCandidates
} from "../src/schema/trial-selection.js"
import type { ArchitectureTrialResultV2 } from "../src/schema/trial-result.js"
import { decodeArchitectureTrialSpec } from "../src/schema/trial-spec.js"
import type { V2CandidateId } from "../src/schema/v2-ids.js"

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(moduleDirectory, "../../..")
const spec = Effect.runSync(decodeArchitectureTrialSpec(parseCanonicalJsonBytes(
  new Uint8Array(readFileSync(resolve(
    repositoryRoot,
    "docs/refactor/architecture-program/inputs/trial-spec.json"
  )))
)))

const receiptIdFor = (candidateId: string) => candidateId.startsWith("M1")
  ? "1".repeat(64)
  : candidateId.startsWith("M2")
  ? "2".repeat(64)
  : candidateId.startsWith("T1")
  ? "3".repeat(64)
  : candidateId.startsWith("T2")
  ? "4".repeat(64)
  : "5".repeat(64)

const result = (
  candidateId: V2CandidateId,
  values: ReadonlyArray<number>,
  qualification: "Passed" | "Rejected" = "Passed"
): ArchitectureTrialResultV2 => {
  const scope = candidateId.startsWith("M") ? "machine" : "topology"
  const policy = scope === "machine" ? spec.machineSelectionPolicy : spec.topologySelectionPolicy
  return {
    schemaVersion: scope === "machine" ? "machine-trial-result-v2" : "topology-trial-result-v2",
    receiptId: receiptIdFor(candidateId),
    runContext: { candidateId, candidateScope: scope },
    qualification,
    gateReceipts: policy.hardGateIds.map((gateId) => ({
      gateId,
      execution: { _tag: "Passed" }
    })),
    objectiveMetrics: policy.objectiveMetricIds.map((id, index) => ({
      _tag: "Measured",
      id,
      value: values[index] ?? 0
    }))
  } as unknown as ArchitectureTrialResultV2
}

describe("strict Pareto trial selection", () => {
  it.effect("selects only a candidate that dominates every other qualifier", () =>
    Effect.gen(function* () {
      const outcome = yield* selectTrialCandidates({
        scope: "machine",
        spec,
        results: [
          result("M1-extracted-fold", [1, 1, 1, 1, 1, 1, 1]),
          result("M2-total-transition", [2, 2, 2, 2, 2, 2, 2])
        ]
      })
      expect(outcome).toBeInstanceOf(UniqueSelection)
      expect(outcome._tag).toBe("UniqueSelection")
      if (outcome._tag === "UniqueSelection") {
        expect(outcome.selectedCandidateId).toBe("M1-extracted-fold")
        expect(outcome.dominatedCandidateIds).toEqual(["M2-total-transition"])
      }
    }))

  it.effect("requires a maintainer decision for a real Pareto tradeoff", () =>
    Effect.gen(function* () {
      const outcome = yield* selectTrialCandidates({
        scope: "machine",
        spec,
        results: [
          result("M1-extracted-fold", [1, 2, 1, 1, 1, 1, 1]),
          result("M2-total-transition", [2, 1, 1, 1, 1, 1, 1])
        ]
      })
      expect(outcome).toBeInstanceOf(MaintainerDecisionRequired)
      expect(outcome._tag).toBe("MaintainerDecisionRequired")
      if (outcome._tag === "MaintainerDecisionRequired") {
        expect(outcome.nonDominatedCandidateIds).toEqual([
          "M1-extracted-fold",
          "M2-total-transition"
        ])
      }
    }))

  it.effect("does not let a rejected candidate participate in dominance", () =>
    Effect.gen(function* () {
      const outcome = yield* selectTrialCandidates({
        scope: "machine",
        spec,
        results: [
          result("M1-extracted-fold", [1, 1, 1, 1, 1, 1, 1], "Rejected"),
          result("M2-total-transition", [9, 9, 9, 9, 9, 9, 9])
        ]
      })
      expect(outcome._tag).toBe("UniqueSelection")
      if (outcome._tag === "UniqueSelection") {
        expect(outcome.selectedCandidateId).toBe("M2-total-transition")
        expect(outcome.rejectedCandidateIds).toEqual(["M1-extracted-fold"])
      }
    }))

  it.effect("emits NoQualifyingCandidate when every hard result is rejected", () =>
    Effect.gen(function* () {
      const outcome = yield* selectTrialCandidates({
        scope: "machine",
        spec,
        results: [
          result("M1-extracted-fold", [1, 1, 1, 1, 1, 1, 1], "Rejected"),
          result("M2-total-transition", [1, 1, 1, 1, 1, 1, 1], "Rejected")
        ]
      })
      expect(outcome).toBeInstanceOf(NoQualifyingCandidate)
      expect(outcome._tag).toBe("NoQualifyingCandidate")
    }))

  it.effect("enforces topology marginal budgets before Pareto selection", () =>
    Effect.gen(function* () {
      const acceptable = [0, 1, 1, 20, 10, 30, 1, 100]
      const overP90 = [0, 1, 1, 20, 10, 101, 1, 100]
      const outcome = yield* selectTrialCandidates({
        scope: "topology",
        spec,
        results: [
          result("T1-root", acceptable),
          result("T2-kernel-provider-bundle", overP90),
          result("T3-provider-verticals", overP90)
        ]
      })
      expect(outcome._tag).toBe("UniqueSelection")
      if (outcome._tag === "UniqueSelection") {
        expect(outcome.selectedCandidateId).toBe("T1-root")
        expect(outcome.rejectedCandidateIds).toEqual([
          "T2-kernel-provider-bundle",
          "T3-provider-verticals"
        ])
      }
    }))

  it.effect("rejects reordered or incomplete candidate evidence", () =>
    Effect.gen(function* () {
      const error = yield* selectTrialCandidates({
        scope: "machine",
        spec,
        results: [
          result("M2-total-transition", [1, 1, 1, 1, 1, 1, 1]),
          result("M1-extracted-fold", [1, 1, 1, 1, 1, 1, 1])
        ]
      }).pipe(Effect.flip)
      expect(error).toBeInstanceOf(TrialSelectionInvariantError)
    }))
})
