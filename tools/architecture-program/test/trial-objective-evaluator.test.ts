import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import type { ArchitectureCandidateManifestV2 } from "../src/schema/candidate-manifest.js"
import { PlannedRepositoryPath } from "../src/schema/primitives.js"
import { IntegerEvidenceValueV2 } from "../src/schema/trial-evidence.js"
import type { GateReceipt } from "../src/schema/trial-result.js"
import {
  RunnerOwnedObjectiveValue,
  type RunnerOwnedObjectiveEvaluationRequest
} from "../src/trial-objectives.js"
import {
  CandidateTreeInventory,
  CanonicalTreeEntry,
  canonicalTreeSha256
} from "../src/trial-inventory.js"
import { sha256Bytes } from "../src/trial-hash.js"
import { makeLiveObjectiveEvaluator } from "../src/trial-objective-evaluator.js"

const encoder = new TextEncoder()

const withCandidate = <A>(
  files: Readonly<Record<string, string>>,
  use: (root: string, inventory: CandidateTreeInventory) => Effect.Effect<A>
) => Effect.acquireUseRelease(
  Effect.tryPromise(async () => {
    const root = await mkdtemp("/tmp/architecture-objective-test-")
    for (const [path, contents] of Object.entries(files)) {
      const segments = path.split("/")
      if (segments.length > 1) {
        await mkdir(join(root, ...segments.slice(0, -1)), { recursive: true })
      }
      await writeFile(join(root, path), contents)
    }
    const entries = Object.entries(files).sort(([left], [right]) => left.localeCompare(right)).map(
      ([path, contents]) => {
        const bytes = encoder.encode(contents)
        return new CanonicalTreeEntry({
          path: PlannedRepositoryPath.make(path),
          mode: "100644",
          bytes: bytes.byteLength,
          sha256: sha256Bytes(bytes)
        })
      }
    )
    return {
      root,
      inventory: new CandidateTreeInventory({ entries, treeSha256: canonicalTreeSha256(entries) })
    }
  }),
  ({ root, inventory }) => use(root, inventory),
  ({ root }) => Effect.promise(() => rm(root, { recursive: true, force: true }))
)

const machineFiles = {
  "src/machine.ts": [
    "export const FORBIDDEN_TRANSITIONS = [",
    "  \"Ready->complete\",",
    "  \"Planned->complete\"",
    "] as const",
    "export const run = true",
    ""
  ].join("\n"),
  "trial-adapter.ts": "export const adapter = true\n",
  "trial-candidate.json": "{}\n"
} as const

const manifest = (scope: "machine" | "topology"): ArchitectureCandidateManifestV2 => ({
  schemaVersion: "ts-release/architecture-candidate-manifest/v2",
  candidateId: scope === "machine" ? "M1-extracted-fold" : "T1-root",
  scope,
  model: scope === "machine" ? "extracted-fold" : "root",
  implementationRoot: scope === "machine"
    ? "prototypes/research-complete-machine/M1-extracted-fold"
    : "prototypes/research-complete-topology/T1-root",
  files: [
    {
      path: "src/machine.ts",
      laneId: "product-source",
      moduleId: "module.machine",
      packageId: "package.root",
      ownerRoleIds: ["role-kernel-workflow", "role-machine"],
      conceptIds: ["concept.difficult-path", "concept.main-path"],
      centralBranchIds: ["branch.transition"]
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
  publicSurfaceIds: ["public.machine"],
  durableFormatIds: ["format.journal"],
  dependencyEdges: []
} as unknown as ArchitectureCandidateManifestV2)

const decodeObjectiveValue = Schema.decodeUnknownSync(RunnerOwnedObjectiveValue, {
  errors: "all",
  onExcessProperty: "error"
})

const request = (
  candidateManifest: ArchitectureCandidateManifestV2,
  inventory: CandidateTreeInventory,
  metricId: RunnerOwnedObjectiveEvaluationRequest["metricId"],
  gateReceipts: ReadonlyArray<GateReceipt> = []
): RunnerOwnedObjectiveEvaluationRequest => ({
  metricId,
  scope: candidateManifest.scope,
  candidateTreeEntries: inventory.entries,
  candidateManifest,
  caseReceipts: [],
  probeReceipts: [],
  gateReceipts
})

describe("runner-owned objective evaluator", () => {
  it.effect("derives machine structure and physical lines from bound source bytes", () =>
    withCandidate(machineFiles, (root, inventory) => Effect.gen(function* () {
      const evaluator = makeLiveObjectiveEvaluator({ candidateRoot: root, candidateTreeInventory: inventory })
      const candidateManifest = manifest("machine")

      const invalid = decodeObjectiveValue(yield* evaluator.evaluate(request(
        candidateManifest,
        inventory,
        "representable-invalid-state-count"
      )))
      const lines = decodeObjectiveValue(yield* evaluator.evaluate(request(
        candidateManifest,
        inventory,
        "machine-interpreter-product-lines"
      )))
      const hops = decodeObjectiveValue(yield* evaluator.evaluate(request(
        candidateManifest,
        inventory,
        "main-path-owner-hops"
      )))

      expect(invalid._tag).toBe("Measured")
      expect(invalid._tag === "Measured" ? invalid.value : null).toBe(2)
      expect(lines._tag === "Measured" ? lines.value : null).toBe(5)
      expect(hops._tag === "Measured" ? hops.value : null).toBe(1)
    })))

  it.effect("fails closed when source bytes no longer match preflight", () =>
    withCandidate(machineFiles, (root, inventory) => Effect.gen(function* () {
      yield* Effect.promise(() => writeFile(join(root, "src/machine.ts"), "export const changed = true\n"))
      const value = decodeObjectiveValue(yield* makeLiveObjectiveEvaluator({
        candidateRoot: root,
        candidateTreeInventory: inventory
      }).evaluate(request(manifest("machine"), inventory, "representable-invalid-state-count")))
      expect(value._tag).toBe("Unavailable")
    })))

  it("recognizes only runner-owned integer gate facts", () => {
    const value = new IntegerEvidenceValueV2({ value: 7 })
    expect(value._tag).toBe("Integer")
    expect(value.value).toBe(7)
  })
})
