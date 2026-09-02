import { readFileSync } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "../src/canonical-document.js"
import {
  decodeCandidateManifest,
  encodeCandidateManifest
} from "../src/schema/candidate-manifest.js"
import {
  ArchitectureGateInvocationV2,
  ArchitectureGateObservationV2,
  decodeGateObservationForInvocation
} from "../src/schema/harness-protocol.js"
import { ArtifactId } from "../src/schema/primitives.js"
import {
  EvidenceEntryV2,
  EvidenceName,
  IntegerEvidenceValueV2
} from "../src/schema/trial-evidence.js"
import {
  makeGateCommandInput,
  encodeGateCommandInput
} from "../src/schema/trial-result.js"
import {
  decodeArchitectureTrialSpec,
  gateDefinitionSha256
} from "../src/schema/trial-spec.js"
import type { V2CandidateId } from "../src/schema/v2-ids.js"
import { runTrialGateCli } from "../src/trial-gate-cli.js"
import { makeLiveGateEvaluator } from "../src/trial-gate-evaluator.js"
import { inventoryCandidateTree } from "../src/trial-inventory.js"
import { sha256Bytes } from "../src/trial-hash.js"

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(moduleDirectory, "../../..")
const spec = Effect.runSync(decodeArchitectureTrialSpec(parseCanonicalJsonBytes(
  new Uint8Array(readFileSync(resolve(
    repositoryRoot,
    "docs/refactor/architecture-program/inputs/trial-spec.json"
  )))
)))
const gt12 = spec.gateRequirements.find(({ id }) =>
  id === "GT12-version-skew-partial-publication")!
const gt14 = spec.gateRequirements.find(({ id }) =>
  id === "GT14-tree-shaking-and-packed-bytes")!
const gm02 = spec.gateRequirements.find(({ id }) =>
  id === "GM02-law-and-owner-invariants")!
const gm05 = spec.gateRequirements.find(({ id }) =>
  id === "GM05-machine-source-budget")!
const gm08 = spec.gateRequirements.find(({ id }) =>
  id === "GM08-metric-and-readability-completeness")!
const encoder = new TextEncoder()

const withTopologyCandidate = async <A>(use: (fixture: {
  readonly root: string
  readonly manifest: Awaited<ReturnType<typeof makeManifest>>
  readonly treeSha256: ReturnType<typeof sha256Bytes>
  readonly packedBytes: number
}) => Promise<A>): Promise<A> => {
  const root = await mkdtemp("/tmp/architecture-live-gate-test-")
  const source = 'export const INVALID_VERSION_STATES = ["kernel-only", "provider-only"] as const\n'
  const packed = encoder.encode("deterministic packed artifact\n")
  try {
    await mkdir(join(root, "dist"))
    await mkdir(join(root, "src"))
    await writeFile(join(root, "dist/package.tgz"), packed)
    await writeFile(join(root, "src/topology.ts"), source)
    await writeFile(join(root, "trial-adapter.ts"), "export {}\n")
    const manifest = await makeManifest(root)
    await writeFile(
      join(root, "trial-candidate.json"),
      canonicalJsonBytes(encodeCandidateManifest(manifest))
    )
    const inventory = await Effect.runPromise(inventoryCandidateTree(root, manifest))
    return await use({
      root,
      manifest,
      treeSha256: inventory.treeSha256,
      packedBytes: packed.byteLength
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const makeManifest = async (_root: string) => await Effect.runPromise(decodeCandidateManifest({
  schemaVersion: "ts-release/architecture-candidate-manifest/v2",
  candidateId: "T1-root",
  scope: "topology",
  model: "root",
  implementationRoot: "prototypes/research-complete-topology/T1-root",
  files: [
    {
      path: "dist/package.tgz",
      laneId: "delivery-bundle",
      moduleId: null,
      packageId: null,
      ownerRoleIds: [],
      conceptIds: [],
      centralBranchIds: []
    },
    {
      path: "src/topology.ts",
      laneId: "product-source",
      moduleId: "topology",
      packageId: "root",
      ownerRoleIds: ["role-kernel"],
      conceptIds: ["concept.main-path"],
      centralBranchIds: []
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
  publicSurfaceIds: ["surface.root"],
  durableFormatIds: [],
  dependencyEdges: []
}))

interface MachineFixtureOptions {
  readonly machineSource: string
  readonly machineConceptIds?: ReadonlyArray<string>
  readonly machineToProviderEdge?: boolean
}

const withMachineCandidate = async <A>(
  options: MachineFixtureOptions,
  use: (fixture: {
    readonly root: string
    readonly treeSha256: ReturnType<typeof sha256Bytes>
  }) => Promise<A>
): Promise<A> => {
  const root = await mkdtemp("/tmp/architecture-machine-gate-test-")
  try {
    await mkdir(join(root, "src"))
    await writeFile(join(root, "src/machine.ts"), options.machineSource)
    if (options.machineToProviderEdge === true) {
      await writeFile(join(root, "src/provider.ts"), "export const provider = true\n")
    }
    await writeFile(join(root, "trial-adapter.ts"), "export {}\n")
    const manifest = await Effect.runPromise(decodeCandidateManifest({
      schemaVersion: "ts-release/architecture-candidate-manifest/v2",
      candidateId: "M1-extracted-fold",
      scope: "machine",
      model: "extracted-fold",
      implementationRoot: "prototypes/research-complete-machine/M1-extracted-fold",
      files: [
        {
          path: "src/machine.ts",
          laneId: "product-source",
          moduleId: "module.machine",
          packageId: "package.machine",
          ownerRoleIds: ["role-machine"],
          conceptIds: options.machineConceptIds ?? [
            "concept.difficult-path",
            "concept.main-path"
          ],
          centralBranchIds: ["branch.transition"]
        },
        ...(options.machineToProviderEdge === true ? [{
          path: "src/provider.ts",
          laneId: "product-source" as const,
          moduleId: "module.provider-a",
          packageId: "package.provider-a",
          ownerRoleIds: ["role-first-party-provider-a"],
          conceptIds: ["concept.main-path"],
          centralBranchIds: []
        }] : []),
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
      publicSurfaceIds: ["public.machine-run-case"],
      durableFormatIds: ["format.journal-event-v1"],
      dependencyEdges: options.machineToProviderEdge === true ? [{
        id: "module.machine->module.provider-a:static",
        fromId: "module.machine",
        toId: "module.provider-a",
        kind: "static"
      }] : []
    }))
    await writeFile(
      join(root, "trial-candidate.json"),
      canonicalJsonBytes(encodeCandidateManifest(manifest))
    )
    const inventory = await Effect.runPromise(inventoryCandidateTree(root, manifest))
    return await use({ root, treeSha256: inventory.treeSha256 })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const runCli = async (
  gate: typeof gt12,
  candidateId: V2CandidateId,
  treeSha256: ReturnType<typeof sha256Bytes>,
  inspectionRoot: string
) => {
  const gateInvocation = invocation(gate, treeSha256, candidateId)
  const commandInput = makeGateCommandInput(gateInvocation, treeSha256)
  return await Effect.runPromise(runTrialGateCli({
    argv: ["--gate", gate.id],
    stdin: canonicalJsonBytes({
      commandInput: encodeGateCommandInput(commandInput),
      executionLocal: { inspectionRoot: "/candidate" }
    }),
    repositoryRoot,
    inspectionRoot
  }))
}

const invocation = (
  gate: typeof gt12,
  treeSha256: ReturnType<typeof sha256Bytes>,
  candidateId: V2CandidateId = "T1-root"
) => new ArchitectureGateInvocationV2({
  schemaVersion: "architecture-gate-invocation-v2",
  runContextSha256: sha256Bytes(encoder.encode("run-context")),
  candidateId,
  candidateTreeSha256: treeSha256,
  definitionSha256: gateDefinitionSha256(gate),
  gateId: gate.id,
  lawIds: gate.lawIds.map((id) => ArtifactId.make(id)),
  caseIds: gate.caseIds,
  probeIds: gate.probeIds
})

const candidateObservation = (
  gateInvocation: ArchitectureGateInvocationV2
) => new ArchitectureGateObservationV2({
  schemaVersion: "architecture-gate-observation-v2",
  runContextSha256: gateInvocation.runContextSha256,
  candidateId: gateInvocation.candidateId,
  candidateTreeSha256: gateInvocation.candidateTreeSha256,
  definitionSha256: gateInvocation.definitionSha256,
  gateId: gateInvocation.gateId,
  facts: [new EvidenceEntryV2({
    sequence: 1,
    name: EvidenceName.make("runner.invalid-version-state-count"),
    value: new IntegerEvidenceValueV2({ value: 999 })
  })]
})

describe("runner-owned live gate", () => {
  it("checks GM05 against the exact 2,114-line overlay slice and 3/5 ratio", async () => {
    const smallSource = [
      'export const FORBIDDEN_TRANSITIONS = ["invalid"] as const',
      "export const transition = true"
    ].join("\n") + "\n"
    await withMachineCandidate({ machineSource: smallSource }, async (fixture) => {
      const result = await runCli(
        gm05,
        "M1-extracted-fold",
        fixture.treeSha256,
        fixture.root
      )
      expect(result.exitCode).toBe(0)
      const output = parseCanonicalJsonBytes(result.stdout) as {
        readonly facts: ReadonlyArray<{ readonly name: string; readonly value: unknown }>
      }
      const facts = new Map(output.facts.map(({ name, value }) => [name, value] as const))
      expect(facts.get("runner.machine-interpreter-product-lines")).toEqual({
        _tag: "Integer",
        value: 2
      })
      expect(facts.get("runner.source-budget-reference-lines")).toEqual({
        _tag: "Integer",
        value: 2_114
      })
      expect(facts.get("runner.source-budget-numerator")).toEqual({
        _tag: "Integer",
        value: 3
      })
      expect(facts.get("runner.source-budget-denominator")).toEqual({
        _tag: "Integer",
        value: 5
      })
    })

    const overBudgetSource = `${Array.from(
      { length: 1_269 },
      (_, index) => `// measured product line ${String(index)}`
    ).join("\n")}\n`
    await withMachineCandidate({ machineSource: overBudgetSource }, async (fixture) => {
      const result = await runCli(
        gm05,
        "M1-extracted-fold",
        fixture.treeSha256,
        fixture.root
      )
      expect(result.exitCode).toBe(1)
      expect(parseCanonicalJsonBytes(result.stderr)).toMatchObject({
        failureIds: ["gate.runner-machine-source-budget-exceeded"]
      })
    })
  })

  it("rejects GM08 when readability metrics are not independently enumerable", async () => {
    await withMachineCandidate({
      machineSource: 'export const FORBIDDEN_TRANSITIONS = ["invalid"].filter(Boolean)\n'
    }, async (fixture) => {
      const result = await runCli(
        gm08,
        "M1-extracted-fold",
        fixture.treeSha256,
        fixture.root
      )
      expect(result.exitCode).toBe(1)
      expect(parseCanonicalJsonBytes(result.stderr)).toMatchObject({
        failureIds: ["gate.runner-representable-invalid-states-unavailable"]
      })
    })

    await withMachineCandidate({
      machineSource: 'export const FORBIDDEN_TRANSITIONS = ["invalid"] as const\n',
      machineConceptIds: ["concept.main-path"]
    }, async (fixture) => {
      const result = await runCli(
        gm08,
        "M1-extracted-fold",
        fixture.treeSha256,
        fixture.root
      )
      expect(result.exitCode).toBe(1)
      expect(parseCanonicalJsonBytes(result.stderr)).toMatchObject({
        failureIds: ["gate.runner-difficult-path-owner-hops-unavailable"]
      })
    })
  })

  it("emits complete GM08 readability facts and rejects a machine-to-provider edge", async () => {
    await withMachineCandidate({
      machineSource: 'export const FORBIDDEN_TRANSITIONS = ["a", "b"] as const\n'
    }, async (fixture) => {
      const result = await runCli(
        gm08,
        "M1-extracted-fold",
        fixture.treeSha256,
        fixture.root
      )
      expect(result.exitCode).toBe(0)
      const output = parseCanonicalJsonBytes(result.stdout) as {
        readonly facts: ReadonlyArray<{ readonly name: string; readonly value: unknown }>
      }
      const facts = new Map(output.facts.map(({ name, value }) => [name, value] as const))
      expect(facts.get("runner.representable-invalid-state-count"))
        .toEqual({ _tag: "Integer", value: 2 })
      expect(facts.get("runner.main-path-owner-hops"))
        .toEqual({ _tag: "Integer", value: 0 })
      expect(facts.get("runner.difficult-path-owner-hops"))
        .toEqual({ _tag: "Integer", value: 0 })
    })

    await withMachineCandidate({
      machineSource: 'export const FORBIDDEN_TRANSITIONS = ["invalid"] as const\n',
      machineToProviderEdge: true
    }, async (fixture) => {
      const result = await runCli(
        gm02,
        "M1-extracted-fold",
        fixture.treeSha256,
        fixture.root
      )
      expect(result.exitCode).toBe(1)
      expect(parseCanonicalJsonBytes(result.stderr)).toMatchObject({
        failureIds: ["gate.runner-machine-provider-dependency"]
      })
    })
  })

  it("runs the gate CLI from the canonical envelope and rejects tree drift", async () =>
    withTopologyCandidate(async (fixture) => {
      const gateInvocation = invocation(gt12, fixture.treeSha256)
      const commandInput = makeGateCommandInput(gateInvocation, fixture.treeSha256)
      const stdin = canonicalJsonBytes({
        commandInput: encodeGateCommandInput(commandInput),
        executionLocal: { inspectionRoot: "/candidate" }
      })
      const passed = await Effect.runPromise(runTrialGateCli({
        argv: ["--gate", gt12.id],
        stdin,
        repositoryRoot,
        inspectionRoot: fixture.root
      }))
      expect(passed.exitCode).toBe(0)
      expect(passed.stderr).toHaveLength(0)
      const output = await Effect.runPromise(decodeGateObservationForInvocation(
        gateInvocation,
        parseCanonicalJsonBytes(passed.stdout)
      ))
      expect(output.facts.find(({ name }) =>
        name === "runner.invalid-version-state-count")?.value).toEqual({
        _tag: "Integer",
        value: 2
      })

      await writeFile(join(fixture.root, "unmanifested"), "hostile drift\n")
      const rejected = await Effect.runPromise(runTrialGateCli({
        argv: ["--gate", gt12.id],
        stdin,
        repositoryRoot,
        inspectionRoot: fixture.root
      }))
      expect(rejected.exitCode).toBe(1)
      expect(rejected.stdout).toHaveLength(0)
      expect(parseCanonicalJsonBytes(rejected.stderr)).toMatchObject({
        failureIds: ["gate.runner-inspection-failed"]
      })
    }))

  it("ignores candidate metric claims and emits runner-inventoried GT12/GT14 facts", async () =>
    withTopologyCandidate(async (fixture) => {
      const evaluator = makeLiveGateEvaluator({ repositoryRoot, trialSpec: spec })
      const evaluate = async (gate: typeof gt12) => {
        const gateInvocation = invocation(gate, fixture.treeSha256)
        return await Effect.runPromise(evaluator.evaluate({
          gate,
          observation: candidateObservation(gateInvocation),
          commandAttempt: {
            _tag: "Exited",
            exitCode: 0,
            stdout: { _tag: "Complete", byteLength: 0, sha256: sha256Bytes(new Uint8Array()) },
            stderr: { _tag: "Complete", byteLength: 0, sha256: sha256Bytes(new Uint8Array()) }
          },
          inspectionRoot: fixture.root,
          caseReceipts: [],
          probeReceipts: []
        }))
      }

      const version = await evaluate(gt12)
      expect(version._tag).toBe("Accepted")
      if (version._tag === "Accepted") {
        expect(version.facts.find(({ name }) =>
          name === "runner.invalid-version-state-count")?.value).toEqual({
          _tag: "Integer",
          value: 2
        })
      }

      const packed = await evaluate(gt14)
      expect(packed._tag).toBe("Accepted")
      if (packed._tag === "Accepted") {
        expect(packed.facts.find(({ name }) => name === "runner.packed-byte-count")?.value)
          .toEqual({ _tag: "Integer", value: fixture.packedBytes })
      }
    }))
})
