import { access, constants, cp, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { canonicalJsonBytes, parseCanonicalJsonBytes } from "../src/canonical-document.js"
import {
  decodeCandidateManifest,
  encodeCandidateManifest
} from "../src/schema/candidate-manifest.js"
import { decodeArchitectureTrialSpec, gateDefinitionSha256 } from "../src/schema/trial-spec.js"
import { ArtifactId } from "../src/schema/primitives.js"
import {
  ArchitectureGateInvocationV2,
  ArchitectureGateObservationV2
} from "../src/schema/harness-protocol.js"
import {
  EvidenceEntryV2,
  EvidenceName,
  IntegerEvidenceValueV2
} from "../src/schema/trial-evidence.js"
import {
  encodeGateCommandInput,
  makeGateCommandInput
} from "../src/schema/trial-result.js"
import { inventoryCandidateTree } from "../src/trial-inventory.js"
import { sha256Bytes } from "../src/trial-hash.js"
import { makeLiveGateEvaluator } from "../src/trial-gate-evaluator.js"
import { runTrialGateCli } from "../src/trial-gate-cli.js"
import {
  TrialTopologyGateError,
  executeTopologyGate,
  inspectTopologyGateStatic,
  isRunnerOwnedTopologyGate,
  type TopologyGateExecutables
} from "../src/trial-topology-gate.js"

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(moduleDirectory, "../../..")
const topologyRoot = resolve(repositoryRoot, "prototypes/research-complete-topology")
const encoder = new TextEncoder()

const spec = Effect.runSync(decodeArchitectureTrialSpec(parseCanonicalJsonBytes(
  new Uint8Array(await readFile(resolve(
    repositoryRoot,
    "docs/refactor/architecture-program/inputs/trial-spec.json"
  )))
)))

const gateById = (id: string) => spec.gateRequirements.find((gate) => gate.id === id)!

const resolveOnPath = async (name: string): Promise<string> => {
  for (const directory of (process.env.PATH ?? "").split(":")) {
    if (directory.length === 0) continue
    const candidate = join(directory, name)
    try {
      await access(candidate, constants.X_OK)
      return await realpath(candidate)
    } catch {
      continue
    }
  }
  throw new Error(`topology gate tests require a ${name} executable on PATH`)
}

// Vitest workers run under Node, so the worker's own executable is the exact
// Node runtime and Bun must be resolved as an external executable.
const nodeExecutable = await realpath(process.execPath)
const bunExecutable = await resolveOnPath("bun")
if (nodeExecutable === bunExecutable) {
  throw new Error("resolved node executable is the Bun binary; a genuine Node.js is required")
}

const executables: TopologyGateExecutables = {
  bun: bunExecutable,
  node: nodeExecutable,
  tar: "/usr/bin/tar"
}

const loadCandidate = async (root: string) => {
  const manifest = await Effect.runPromise(decodeCandidateManifest(
    parseCanonicalJsonBytes(new Uint8Array(await readFile(join(root, "trial-candidate.json"))))
  ))
  const inventory = await Effect.runPromise(inventoryCandidateTree(root, manifest))
  return { root, manifest, inventory }
}

const staticInspection = async (candidate: Awaited<ReturnType<typeof loadCandidate>>) =>
  await Effect.runPromise(Effect.result(inspectTopologyGateStatic({
    root: candidate.root,
    manifest: candidate.manifest,
    inventory: candidate.inventory
  })))

const staticFailureIds = (
  result: Awaited<ReturnType<typeof staticInspection>>
): ReadonlyArray<string> => {
  expect(result._tag).toBe("Failure")
  if (result._tag !== "Failure") return []
  expect(result.failure).toBeInstanceOf(TrialTopologyGateError)
  return (result.failure as TrialTopologyGateError).failureIds
}

const withHostileCopy = async <A>(
  source: string,
  mutate: (root: string) => Promise<void>,
  use: (candidate: Awaited<ReturnType<typeof loadCandidate>>) => Promise<A>
): Promise<A> => {
  const root = await mkdtemp("/tmp/architecture-topology-hostile-")
  try {
    await cp(source, root, { recursive: true })
    await mutate(root)
    return await use(await loadCandidate(root))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const rewriteCanonicalJson = async (
  path: string,
  edit: (document: any) => void
): Promise<void> => {
  const document = parseCanonicalJsonBytes(new Uint8Array(await readFile(path))) as any
  edit(document)
  await writeFile(path, canonicalJsonBytes(document))
}

const t1Root = join(topologyRoot, "T1-root")
const t2Root = join(topologyRoot, "T2-kernel-provider-bundle")
const t3Root = join(topologyRoot, "T3-provider-verticals")

describe("runner-owned topology gate", () => {
  it("classifies exactly GT02-GT14 as runner-owned", () => {
    const expected = new Set([
      "GT02-packed-library-node", "GT03-packed-library-bun", "GT04-packed-cli",
      "GT05-packed-github-action", "GT06-packed-external-provider-two-instances",
      "GT07-lossless-effect-build-file-tree-adoption", "GT08-exact-runtime-declaration-surface",
      "GT09-exact-emitted-packed-inventory", "GT10-exact-static-type-dynamic-manifest-graph",
      "GT11-no-cycle-sibling-reversal-or-host-edge", "GT12-version-skew-partial-publication",
      "GT13-dry-run-build-publication-self-release", "GT14-tree-shaking-and-packed-bytes"
    ])
    for (const gate of spec.gateRequirements) {
      expect(isRunnerOwnedTopologyGate(gate.id)).toBe(expected.has(gate.id))
    }
  })

  it("accepts every real topology candidate from its exact bytes", async () => {
    for (const root of [t1Root, t2Root, t3Root]) {
      const candidate = await loadCandidate(root)
      const result = await staticInspection(candidate)
      expect(result._tag).toBe("Success")
    }
    const t3 = await loadCandidate(t3Root)
    const inspection = await Effect.runPromise(inspectTopologyGateStatic({
      root: t3.root,
      manifest: t3.manifest,
      inventory: t3.inventory
    }))
    expect(inspection.packages).toHaveLength(5)
    expect(inspection.runtimePlusDeclarationExportCount).toBeGreaterThan(0)
    expect(inspection.declarationSurfaceSha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it("rejects a generated surface that overstates a runtime export", async () =>
    withHostileCopy(t3Root, async (root) => {
      await rewriteCanonicalJson(join(root, "generated/SURFACE.json"), (document) => {
        const kernel = document.packages.find((entry: any) => entry.name === "@trial/kernel")
        kernel.runtimeExports = [...kernel.runtimeExports, "smuggledExport"].sort()
      })
    }, async (candidate) => {
      expect(staticFailureIds(await staticInspection(candidate)))
        .toContain("gate.runner-topology-generated-surface-mismatch")
    }))

  it("rejects a source import edge the manifest never declared", async () =>
    withHostileCopy(t3Root, async (root) => {
      const path = join(root, "packages/provider-a/src/index.ts")
      const source = await readFile(path, "utf8")
      await writeFile(path, `${source}import "../../provider-b/src/index.js"\n`)
    }, async (candidate) => {
      const failureIds = staticFailureIds(await staticInspection(candidate))
      expect(failureIds).toContain("gate.runner-topology-dependency-graph-mismatch")
      expect(failureIds).toContain("gate.runner-topology-provider-sibling-edge")
    }))

  it("rejects a package whose version drifts from the declared coordinate", async () =>
    withHostileCopy(t3Root, async (root) => {
      await rewriteCanonicalJson(join(root, "packages/kernel/package.json"), (document) => {
        document.version = "9.9.9-hostile"
      })
    }, async (candidate) => {
      const failureIds = staticFailureIds(await staticInspection(candidate))
      expect(failureIds).toContain("gate.runner-topology-package-coordinate")
      expect(failureIds).toContain("gate.runner-topology-publication-order-or-version")
    }))

  it("rejects a fixture surface path that is not inventoried", async () =>
    withHostileCopy(t3Root, async (root) => {
      await rm(join(root, "packages/provider-b/dist/index.d.ts"))
      await rewriteCanonicalJson(join(root, "trial-candidate.json"), (document) => {
        document.files = document.files.filter(
          (entry: any) => entry.path !== "packages/provider-b/dist/index.d.ts"
        )
      })
    }, async (candidate) => {
      expect(staticFailureIds(await staticInspection(candidate)))
        .toContain("gate.runner-topology-generated-path-uninventoried")
    }))

  it("executes every packed dynamic gate for the richest real candidate", async () => {
    const t3 = await loadCandidate(t3Root)
    const inspection = await Effect.runPromise(inspectTopologyGateStatic({
      root: t3.root,
      manifest: t3.manifest,
      inventory: t3.inventory
    }))
    for (const gateId of [
      "GT02-packed-library-node",
      "GT03-packed-library-bun",
      "GT04-packed-cli",
      "GT09-exact-emitted-packed-inventory",
      "GT12-version-skew-partial-publication",
      "GT13-dry-run-build-publication-self-release",
      "GT14-tree-shaking-and-packed-bytes"
    ]) {
      const execution = await Effect.runPromise(executeTopologyGate({
        gateId,
        root: t3.root,
        repositoryRoot,
        executables,
        inventory: t3.inventory,
        inspection
      }))
      expect(execution.checkCount).toBeGreaterThan(0)
      if (gateId === "GT14-tree-shaking-and-packed-bytes") {
        expect(execution.packedByteCount).toBeGreaterThan(0)
      } else {
        expect(execution.packedByteCount).toBeNull()
      }
    }
  }, 120_000)

  it("rejects packed bytes that exceed the inventoried expectation", async () =>
    withHostileCopy(t3Root, async (root) => {
      await writeFile(join(root, "packages/kernel/README.md"), "# smuggled\n")
      const manifest = await Effect.runPromise(decodeCandidateManifest(
        parseCanonicalJsonBytes(new Uint8Array(await readFile(join(root, "trial-candidate.json"))))
      ))
      const files = [...manifest.files.map((entry) => ({
        path: entry.path as string,
        laneId: entry.laneId,
        moduleId: entry.moduleId,
        packageId: entry.packageId,
        ownerRoleIds: [...entry.ownerRoleIds],
        conceptIds: [...entry.conceptIds],
        centralBranchIds: [...entry.centralBranchIds]
      })), {
        path: "packages/kernel/README.md",
        laneId: "fixture" as const,
        moduleId: null,
        packageId: null,
        ownerRoleIds: [],
        conceptIds: [],
        centralBranchIds: []
      }].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
      const mutated = await Effect.runPromise(decodeCandidateManifest({
        schemaVersion: manifest.schemaVersion,
        candidateId: manifest.candidateId,
        scope: manifest.scope,
        model: manifest.model,
        implementationRoot: manifest.implementationRoot,
        files,
        publicSurfaceIds: [...manifest.publicSurfaceIds],
        durableFormatIds: [...manifest.durableFormatIds],
        dependencyEdges: manifest.dependencyEdges.map((edge) => ({
          id: edge.id,
          fromId: edge.fromId,
          toId: edge.toId,
          kind: edge.kind
        }))
      }))
      await writeFile(
        join(root, "trial-candidate.json"),
        canonicalJsonBytes(encodeCandidateManifest(mutated))
      )
    }, async (candidate) => {
      const inspected = await Effect.runPromise(Effect.result(inspectTopologyGateStatic({
        root: candidate.root,
        manifest: candidate.manifest,
        inventory: candidate.inventory
      })))
      expect(inspected._tag).toBe("Success")
      if (inspected._tag !== "Success") return
      const executed = await Effect.runPromise(Effect.result(executeTopologyGate({
        gateId: "GT09-exact-emitted-packed-inventory",
        root: candidate.root,
        repositoryRoot,
        executables,
        inventory: candidate.inventory,
        inspection: inspected.success
      })))
      expect(executed._tag).toBe("Failure")
      if (executed._tag !== "Failure") return
      expect((executed.failure as TrialTopologyGateError).failureIds)
        .toContain("gate.runner-topology-pack-inventory-mismatch")
    }), 120_000)

  it("accepts a real candidate through the evaluator while ignoring its fabricated claims", async () => {
    const t3 = await loadCandidate(t3Root)
    const gate = gateById("GT10-exact-static-type-dynamic-manifest-graph")
    const gateInvocation = new ArchitectureGateInvocationV2({
      schemaVersion: "architecture-gate-invocation-v2",
      runContextSha256: sha256Bytes(encoder.encode("run-context")),
      candidateId: "T3-provider-verticals",
      candidateTreeSha256: t3.inventory.treeSha256,
      definitionSha256: gateDefinitionSha256(gate),
      gateId: gate.id,
      lawIds: gate.lawIds.map((id) => ArtifactId.make(id)),
      caseIds: gate.caseIds,
      probeIds: gate.probeIds
    })
    const fabricated = new ArchitectureGateObservationV2({
      schemaVersion: "architecture-gate-observation-v2",
      runContextSha256: gateInvocation.runContextSha256,
      candidateId: gateInvocation.candidateId,
      candidateTreeSha256: gateInvocation.candidateTreeSha256,
      definitionSha256: gateInvocation.definitionSha256,
      gateId: gateInvocation.gateId,
      facts: [new EvidenceEntryV2({
        sequence: 1,
        name: EvidenceName.make("gate.candidate-self-award"),
        value: new IntegerEvidenceValueV2({ value: 999 })
      })]
    })
    const evaluator = makeLiveGateEvaluator({ repositoryRoot, trialSpec: spec })
    const evaluated = await Effect.runPromise(evaluator.evaluate({
      gate,
      observation: fabricated,
      commandAttempt: {
        _tag: "Exited",
        exitCode: 0,
        stdout: { _tag: "Complete", byteLength: 0, sha256: sha256Bytes(new Uint8Array()) },
        stderr: { _tag: "Complete", byteLength: 0, sha256: sha256Bytes(new Uint8Array()) }
      },
      inspectionRoot: t3.root,
      caseReceipts: [],
      probeReceipts: []
    }))
    expect(evaluated._tag).toBe("Accepted")
    if (evaluated._tag !== "Accepted") return
    const facts = new Map(evaluated.facts.map(({ name, value }) => [name as string, value]))
    expect(facts.get("runner.topology-package-count")).toEqual({ _tag: "Integer", value: 5 })
    expect(facts.has("runner.topology-declaration-surface-sha256")).toBe(true)
    expect(facts.has("gate.candidate-self-award")).toBe(false)
  })

  it("emits merged execution facts from the gate CLI for a real candidate", async () => {
    const t3 = await loadCandidate(t3Root)
    const gate = gateById("GT14-tree-shaking-and-packed-bytes")
    const gateInvocation = new ArchitectureGateInvocationV2({
      schemaVersion: "architecture-gate-invocation-v2",
      runContextSha256: sha256Bytes(encoder.encode("run-context")),
      candidateId: "T3-provider-verticals",
      candidateTreeSha256: t3.inventory.treeSha256,
      definitionSha256: gateDefinitionSha256(gate),
      gateId: gate.id,
      lawIds: gate.lawIds.map((id) => ArtifactId.make(id)),
      caseIds: gate.caseIds,
      probeIds: gate.probeIds
    })
    const commandInput = makeGateCommandInput(gateInvocation, t3.inventory.treeSha256)
    const result = await Effect.runPromise(runTrialGateCli({
      argv: ["--gate", gate.id],
      stdin: canonicalJsonBytes({
        commandInput: encodeGateCommandInput(commandInput),
        executionLocal: { inspectionRoot: "/candidate" }
      }),
      repositoryRoot,
      inspectionRoot: t3.root,
      executables
    }))
    expect(new TextDecoder().decode(result.stderr)).toBe("")
    expect(result.exitCode).toBe(0)
    const output = parseCanonicalJsonBytes(result.stdout) as {
      readonly facts: ReadonlyArray<{ readonly name: string; readonly value: unknown }>
    }
    const facts = new Map(output.facts.map(({ name, value }) => [name, value] as const))
    expect(facts.get("runner.topology-execution-check-count")).toEqual({ _tag: "Integer", value: 2 })
    const tarballBytes = facts.get("runner.topology-tarball-byte-count") as {
      readonly value: number
    }
    expect(tarballBytes.value).toBeGreaterThan(0)
    const sequences = output.facts.map((entry: any) => entry.sequence)
    expect(sequences).toEqual(sequences.map((_, index) => index + 1))
  }, 120_000)
})
