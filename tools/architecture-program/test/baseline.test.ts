import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { encodeCanonicalJson, parseCanonicalJsonBytes } from "../src/canonical-document.js"
import {
  BaselineInvariantError,
  decodeArchitectureBaseline,
  encodeArchitectureBaseline
} from "../src/schema/baseline.js"

type MutableDocument = Record<string, any>
type Mutation = (document: MutableDocument) => void

const fixturePath = resolve(
  typeof import.meta.dir === "string" ? import.meta.dir : dirname(fileURLToPath(import.meta.url)),
  "../../../docs/refactor/architecture-program/inputs/baseline.json"
)

const loadFixtureBytes = Effect.fn("baselineTest.loadFixtureBytes")(
  () => Effect.tryPromise(() => readFile(fixturePath))
)

const loadValidDocument = Effect.fn("baselineTest.loadValidDocument")(function* () {
  const bytes = yield* loadFixtureBytes()
  return structuredClone(parseCanonicalJsonBytes(bytes)) as MutableDocument
})

const expectDecodeFailure = Effect.fn("baselineTest.expectDecodeFailure")(
  function* (mutate: Mutation) {
    const document = yield* loadValidDocument()
    mutate(document)
    const exit = yield* decodeArchitectureBaseline(document).pipe(Effect.exit)
    expect(Exit.isFailure(exit)).toBe(true)
  }
)

const baselineById = (document: MutableDocument, id: string): MutableDocument =>
  document.baselines.find((baseline: MutableDocument) => baseline.id === id)

describe("ArchitectureBaselineV1", () => {
  it.effect("decodes the canonical multi-coordinate baseline with exact admitted identities", () =>
    Effect.gen(function* () {
      const document = yield* loadValidDocument()
      const baseline = yield* decodeArchitectureBaseline(document)

      expect(baseline.baselines.map(({ id }) => id)).toEqual([
        "pr21-research",
        "pr22-native-npm",
        "overlay-v1",
        "historical-plan184",
        "effect-build-dd39"
      ])
      expect(baseline.baselines[2]?.tree).toBe("4e71a43c14f2dc980fadae024020d294270e6565")
      expect(baseline.baselines[4]?.tree).toBe("29cdac9bf9621aa3df12757e2720c093b17d742e")
      expect(baseline.candidateBaselines).toHaveLength(5)
    }))

  it.effect("round-trips through the strict encoder to the committed canonical bytes", () =>
    Effect.gen(function* () {
      const bytes = yield* loadFixtureBytes()
      const document = parseCanonicalJsonBytes(bytes)
      const baseline = yield* decodeArchitectureBaseline(document)
      expect(encodeCanonicalJson(encodeArchitectureBaseline(baseline))).toBe(
        new TextDecoder().decode(bytes)
      )
    }))

  it.effect("rejects unknown selection, topology, and nested measurement fields", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => { document.selectedCandidateId = "T1-root" },
        (document) => { document.baselines[0].targetPackages = ["@mannyc1/ts-release"] },
        (document) => { document.baselines[0].sourceInventory.lanes[0].fileCount.confidence = "high" },
        (document) => { document.candidateBaselines[0].measurement = 0 }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("binds every baseline to its exact commit, tree, repository, and evidence role", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => { baselineById(document, "pr21-research").commit = "0".repeat(40) },
        (document) => { baselineById(document, "pr22-native-npm").tree = "0".repeat(40) },
        (document) => { baselineById(document, "overlay-v1").classification = "prototype" },
        (document) => { baselineById(document, "effect-build-dd39").repositoryId = "ts-release" }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("keeps physical, semantic, pending, and blocked metrics non-interchangeable", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => {
          const lane = baselineById(document, "pr21-research").sourceInventory.lanes[0]
          lane.fileCount._tag = "AttestedMetric"
          lane.fileCount.attestation = "Not a direct measurement."
          delete lane.fileCount.methodId
        },
        (document) => {
          const lane = baselineById(document, "effect-build-dd39").sourceInventory.lanes.at(-1)
          lane.fileCount = {
            _tag: "MeasuredMetric",
            methodId: "git-tree-path-count",
            sourceIds: ["evidence.effect-build-dd39-tree"],
            unit: "files",
            value: 0
          }
        },
        (document) => {
          baselineById(document, "pr21-research").publicSurface.packedBytes.value = 0
        },
        (document) => {
          const summary = baselineById(document, "historical-plan184").sourceInventory.summary
          summary.semanticProductLines._tag = "MeasuredMetric"
          summary.semanticProductLines.methodId = "git-blob-newline-count"
          delete summary.semanticProductLines.attestation
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("enforces the lane classifier, precedence, and fatal-condition set", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => { document.classifier.laneRules[1].id = document.classifier.laneRules[0].id },
        (document) => { document.classifier.laneRules[4].precedence = 1 },
        (document) => { document.classifier.fatalConditions.pop() },
        (document) => { document.classifier.fatalConditions[0] = "unclassified-shipped-source" }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("requires exact lane arithmetic, subsystem totals, top-25 order, and bundle separation", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => { baselineById(document, "pr22-native-npm").sourceInventory.lanes[0].physicalLineCount.value += 1 },
        (document) => { baselineById(document, "overlay-v1").sourceInventory.subsystems[0].physicalLineCount.value += 1 },
        (document) => { baselineById(document, "historical-plan184").sourceInventory.topModules.pop() },
        (document) => {
          const modules = baselineById(document, "effect-build-dd39").sourceInventory.topModules
          ;[modules[0], modules[1]] = [modules[1], modules[0]]
        },
        (document) => { baselineById(document, "pr21-research").bundles[0].physicalLines += 1 }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("binds measured and attested metrics to unique evidence sources", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => { document.evidenceSources.pop() },
        (document) => { document.evidenceSources[1].id = document.evidenceSources[0].id },
        (document) => {
          baselineById(document, "overlay-v1").publicSurface.runtimeExportEntryCount.sourceIds = ["evidence.missing"]
        },
        (document) => {
          baselineById(document, "effect-build-dd39").publicSurface.publicPackageCount.sourceIds.push(
            "evidence.effect-build-public-api"
          )
        }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("requires every immutable evidence source even when no metric cites it", () =>
    Effect.gen(function* () {
      yield* expectDecodeFailure((document) => {
        document.evidenceSources = document.evidenceSources.filter(
          ({ id }: MutableDocument) => id !== "evidence.plan184-source-budget"
        )
      })
    }))

  it.effect("keeps the nine authoritative probes separate from seven historical families", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => { document.comparisonPolicy.authoritativeProbeIds.pop() },
        (document) => { document.comparisonPolicy.historicalFamilyIds.push("new-provider") },
        (document) => { document.historicalMaintenanceFamilies[0].role = "trial-population" },
        (document) => { document.historicalMaintenanceFamilies[2].grossDeletions -= 1 },
        (document) => { document.historicalMaintenanceFamilies[3].p90Additions = 114 }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("preserves the exact PR21 to PR22 gross additions and deletions", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => { document.pr21ToPr22GrossChange[2].additions = 3_200 },
        (document) => { document.pr21ToPr22GrossChange[2].deletions = 0 },
        (document) => { document.pr21ToPr22GrossChange.pop() }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("keeps candidates and terminal effect-build readiness explicitly pending", () =>
    Effect.gen(function* () {
      const mutations: ReadonlyArray<Mutation> = [
        (document) => { document.candidateBaselines.pop() },
        (document) => { document.candidateBaselines[0].candidateId = "T1-root" },
        (document) => { document.candidateBaselines[2]._tag = "MeasuredCandidateBaseline" },
        (document) => { document.terminalEffectBuildCoordinateStatus._tag = "MeasuredMetric" }
      ]
      for (const mutate of mutations) yield* expectDecodeFailure(mutate)
    }))

  it.effect("refuses to encode a decoded baseline after semantic mutation", () =>
    Effect.gen(function* () {
      const document = yield* loadValidDocument()
      const baseline = yield* decodeArchitectureBaseline(document)
      ;(baseline.baselines[0] as unknown as MutableDocument).tree = "0".repeat(40)

      expect(() => encodeArchitectureBaseline(baseline)).toThrow(BaselineInvariantError)
      expect(() => encodeArchitectureBaseline(baseline)).toThrow(/immutable coordinate/u)
    }))
})
