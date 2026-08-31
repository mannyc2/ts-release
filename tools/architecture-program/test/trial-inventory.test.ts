import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"
import { Effect, Exit } from "effect"
import {
  type ArchitectureCandidateManifestV2,
  decodeCandidateManifest
} from "../src/schema/candidate-manifest.js"
import {
  CANONICAL_PATCH_HASH_DOMAIN,
  CANONICAL_TREE_HASH_DOMAIN,
  canonicalPatchSha256,
  canonicalTreeSha256,
  inventoryCanonicalTree,
  inventoryCandidateTree,
  measureCandidatePatch
} from "../src/trial-inventory.js"
import { hashCanonicalValue } from "../src/trial-hash.js"

type MutableDocument = Record<string, any>

const fileEntry = (
  path: string,
  laneId: "product-source" | "generated-product-input" | "tooling" =
    path.startsWith("src/") ? "product-source" : "tooling"
) => ({
  path,
  laneId,
  moduleId: path === "src/index.ts" ? "module.core" : path === "src/extra.ts" ? "module.extra" : null,
  packageId: path === "src/index.ts" ? "package.core" : path === "src/extra.ts" ? "package.extra" : null,
  ownerRoleIds: path.startsWith("src/") ? ["role.kernel"] : [],
  conceptIds: path === "src/index.ts" ? ["concept.machine"] : path === "src/extra.ts" ? ["concept.extra"] : [],
  centralBranchIds: path === "src/index.ts" ? ["branch.main"] : path === "src/extra.ts" ? ["branch.extra"] : []
})

const baseFiles = () => [
  fileEntry("src/index.ts"),
  fileEntry("trial-adapter.ts"),
  fileEntry("trial-candidate.json")
]

const makeManifestDocument = (files = baseFiles()): MutableDocument => ({
  schemaVersion: "ts-release/architecture-candidate-manifest/v2",
  candidateId: "M1-extracted-fold",
  scope: "machine",
  model: "extracted-fold",
  implementationRoot: "prototypes/research-complete-machine/M1-extracted-fold",
  files,
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
})

const decodeManifest = (document: MutableDocument): Promise<ArchitectureCandidateManifestV2> =>
  Effect.runPromise(decodeCandidateManifest(document))

interface FixtureFile {
  readonly path: string
  readonly content: string | Uint8Array
  readonly executable?: boolean
}

const materialize = async (root: string, files: ReadonlyArray<FixtureFile>): Promise<void> => {
  for (const file of files) {
    const target = join(root, file.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, file.content)
    await chmod(target, file.executable === true ? 0o755 : 0o644)
  }
}

const basePhysicalFiles = (): ReadonlyArray<FixtureFile> => [
  { path: "src/index.ts", content: "alpha\nbeta\ngamma\n", executable: true },
  { path: "trial-adapter.ts", content: "adapter\n" },
  { path: "trial-candidate.json", content: "manifest\n" }
]

const withTempRoot = async <A>(use: (root: string) => Promise<A>): Promise<A> => {
  const root = await mkdtemp(join(tmpdir(), "architecture-trial-inventory-"))
  try {
    return await use(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const canonicalTreeValue = (entries: ReadonlyArray<{
  readonly path: string
  readonly mode: string
  readonly bytes: number
  readonly sha256: string
}>) => entries.map(({ path, mode, bytes, sha256 }) => ({ path, mode, bytes, sha256 }))

const canonicalPatchValue = (entries: ReadonlyArray<{
  readonly path: string
  readonly laneId: string
  readonly beforeMode: string | null
  readonly beforeSha256: string | null
  readonly afterMode: string | null
  readonly afterSha256: string | null
  readonly additions: number
  readonly deletions: number
}>) => entries.map(({
  path,
  laneId,
  beforeMode,
  beforeSha256,
  afterMode,
  afterSha256,
  additions,
  deletions
}) => ({
  path,
  laneId,
  beforeMode,
  beforeSha256,
  afterMode,
  afterSha256,
  additions,
  deletions
}))

describe("candidate-neutral trial inventory", () => {
  it("binds an unclassified runner source tree without candidate-owned metadata", async () =>
    withTempRoot(async (root) => {
      await materialize(root, [
        { path: "runner.ts", content: "runner\n", executable: true },
        { path: "schema/result.ts", content: "result\n" }
      ])
      const inventory = await Effect.runPromise(inventoryCanonicalTree(root))

      expect(inventory.entries.map(({ path, mode }) => [path, mode])).toEqual([
        ["runner.ts", "100755"],
        ["schema/result.ts", "100644"]
      ])
      expect(inventory.treeSha256).toBe(canonicalTreeSha256(inventory.entries))
    }))

  it("inventories exact sorted regular files with canonical Git modes and a domain hash", async () =>
    withTempRoot(async (root) => {
      await materialize(root, [...basePhysicalFiles()].reverse())
      const manifest = await decodeManifest(makeManifestDocument())
      const inventory = await Effect.runPromise(inventoryCandidateTree(root, manifest))

      expect(inventory.entries.map(({ path }) => path)).toEqual([
        "src/index.ts",
        "trial-adapter.ts",
        "trial-candidate.json"
      ])
      expect(inventory.entries.map(({ mode }) => mode)).toEqual(["100755", "100644", "100644"])
      expect(inventory.entries[0]?.bytes).toBe(new TextEncoder().encode("alpha\nbeta\ngamma\n").byteLength)
      expect(inventory.treeSha256).toBe(canonicalTreeSha256(inventory.entries))
      expect(inventory.treeSha256).toBe(hashCanonicalValue(
        CANONICAL_TREE_HASH_DOMAIN,
        canonicalTreeValue(inventory.entries)
      ))
    }))

  it("rejects missing, extra, non-NFC, symlink, and root-symlink paths", async () =>
    withTempRoot(async (root) => {
      const manifest = await decodeManifest(makeManifestDocument())
      const scenarios: ReadonlyArray<(candidateRoot: string) => Promise<void>> = [
        async (candidateRoot) => {
          await materialize(candidateRoot, basePhysicalFiles().slice(0, -1))
        },
        async (candidateRoot) => {
          await materialize(candidateRoot, [...basePhysicalFiles(), { path: "rogue.ts", content: "rogue\n" }])
        },
        async (candidateRoot) => {
          await materialize(candidateRoot, [...basePhysicalFiles(), { path: "cafe\u0301.ts", content: "rogue\n" }])
        },
        async (candidateRoot) => {
          await materialize(candidateRoot, basePhysicalFiles())
          await symlink("src/index.ts", join(candidateRoot, "linked.ts"))
        }
      ]
      for (const [index, setup] of scenarios.entries()) {
        const candidateRoot = join(root, `scenario-${index}`)
        await mkdir(candidateRoot)
        await setup(candidateRoot)
        const exit = await Effect.runPromiseExit(inventoryCandidateTree(candidateRoot, manifest))
        expect(Exit.isFailure(exit)).toBe(true)
      }

      const realRoot = join(root, "real-root")
      await mkdir(realRoot)
      await materialize(realRoot, basePhysicalFiles())
      const linkedRoot = join(root, "linked-root")
      await symlink(realRoot, linkedRoot)
      const rootExit = await Effect.runPromiseExit(inventoryCandidateTree(linkedRoot, manifest))
      expect(Exit.isFailure(rootExit)).toBe(true)
    }))

  it("derives the closed measurements, lane arithmetic, touched ids, and set deltas", async () =>
    withTempRoot(async (root) => {
      const beforeRoot = join(root, "before")
      const afterRoot = join(root, "after")
      await mkdir(beforeRoot)
      await mkdir(afterRoot)
      await materialize(beforeRoot, basePhysicalFiles())
      await materialize(afterRoot, [
        { path: "src/extra.ts", content: "fresh\n" },
        { path: "src/index.ts", content: "alpha\nchanged\ngamma\ntail", executable: true },
        { path: "trial-adapter.ts", content: "adapter\n" },
        { path: "trial-candidate.json", content: "manifest\n" }
      ])

      const beforeDocument = makeManifestDocument()
      const afterDocument = makeManifestDocument([
        fileEntry("src/extra.ts"),
        fileEntry("src/index.ts"),
        fileEntry("trial-adapter.ts"),
        fileEntry("trial-candidate.json")
      ])
      afterDocument.publicSurfaceIds = ["public.extra", "public.main"]
      afterDocument.durableFormatIds = ["format.event-v2", "format.journal-v2"]
      afterDocument.dependencyEdges = [
        beforeDocument.dependencyEdges[0],
        {
          id: "module.extra->package.extra:static",
          fromId: "module.extra",
          toId: "package.extra",
          kind: "static"
        }
      ]
      const beforeManifest = await decodeManifest(beforeDocument)
      const afterManifest = await decodeManifest(afterDocument)
      const measured = await Effect.runPromise(
        measureCandidatePatch(beforeRoot, beforeManifest, afterRoot, afterManifest)
      )

      expect(measured.patchEntries.map(({ path }) => path)).toEqual(["src/extra.ts", "src/index.ts"])
      expect(measured.patchEntries.map(({ additions, deletions }) => [additions, deletions])).toEqual([
        [1, 0],
        [2, 1]
      ])
      expect(measured.patchSha256).toBe(canonicalPatchSha256(measured.patchEntries))
      expect(measured.patchSha256).toBe(hashCanonicalValue(
        CANONICAL_PATCH_HASH_DOMAIN,
        canonicalPatchValue(measured.patchEntries)
      ))
      expect(measured.measurements.map(({ id, _tag }) => [id, _tag])).toEqual([
        ["before-tree-sha256", "Hash"],
        ["after-tree-sha256", "Hash"],
        ["patch-sha256", "Hash"],
        ["gross-product-additions", "Count"],
        ["gross-product-deletions", "Count"],
        ["files-touched", "Count"],
        ["modules-touched", "Count"],
        ["packages-touched", "Count"],
        ["concepts-touched", "Count"],
        ["central-branches-touched", "Count"],
        ["public-surface-delta", "IdentifierDelta"],
        ["durable-format-delta", "IdentifierDelta"],
        ["dependency-dag-delta", "IdentifierDelta"]
      ])
      expect(measured.measurements.slice(3, 10).map(({ value }) => value)).toEqual([3, 1, 2, 2, 2, 2, 2])
      expect(measured.laneDeltas).toHaveLength(8)
      expect(measured.laneDeltas[0]).toMatchObject({
        laneId: "product-source",
        additions: 3,
        deletions: 1
      })
      expect(measured.touchedModuleIds).toEqual(["module.core", "module.extra"])
      expect(measured.touchedPackageIds).toEqual(["package.core", "package.extra"])
      expect(measured.touchedOwnerRoleIds).toEqual(["role.kernel"])
      expect(measured.touchedConceptIds).toEqual(["concept.extra", "concept.machine"])
      expect(measured.touchedCentralBranchIds).toEqual(["branch.extra", "branch.main"])
      expect(measured.publicSurfaceDelta).toMatchObject({ addedIds: ["public.extra"], removedIds: [] })
      expect(measured.durableFormatDelta).toMatchObject({ addedIds: ["format.event-v2"], removedIds: [] })
      expect(measured.dependencyDagDelta).toMatchObject({
        addedIds: ["module.extra->package.extra:static"],
        removedIds: []
      })
    }))

  it("rejects binary product changes but records binary non-product changes as zero-line deltas", async () =>
    withTempRoot(async (root) => {
      const beforeRoot = join(root, "before")
      const productAfterRoot = join(root, "product-after")
      const toolingAfterRoot = join(root, "tooling-after")
      await mkdir(beforeRoot)
      await mkdir(productAfterRoot)
      await mkdir(toolingAfterRoot)
      await materialize(beforeRoot, basePhysicalFiles())
      await materialize(productAfterRoot, [
        { path: "src/index.ts", content: new Uint8Array([0, 1, 2]), executable: true },
        ...basePhysicalFiles().slice(1)
      ])
      await materialize(toolingAfterRoot, [
        basePhysicalFiles()[0]!,
        { path: "trial-adapter.ts", content: new Uint8Array([0, 1, 2]) },
        basePhysicalFiles()[2]!
      ])
      const manifest = await decodeManifest(makeManifestDocument())

      const productExit = await Effect.runPromiseExit(
        measureCandidatePatch(beforeRoot, manifest, productAfterRoot, manifest)
      )
      expect(Exit.isFailure(productExit)).toBe(true)
      if (Exit.isFailure(productExit)) {
        expect(String(productExit.cause)).toContain("binary or invalid UTF-8")
      }

      const tooling = await Effect.runPromise(
        measureCandidatePatch(beforeRoot, manifest, toolingAfterRoot, manifest)
      )
      expect(tooling.patchEntries).toHaveLength(1)
      expect(tooling.patchEntries[0]).toMatchObject({
        path: "trial-adapter.ts",
        laneId: "tooling",
        additions: 0,
        deletions: 0
      })
    }))

  it("counts final-LF changes like a Git text diff and records executable-bit-only changes", async () =>
    withTempRoot(async (root) => {
      const beforeRoot = join(root, "before")
      const newlineAfterRoot = join(root, "newline-after")
      const modeAfterRoot = join(root, "mode-after")
      await mkdir(beforeRoot)
      await mkdir(newlineAfterRoot)
      await mkdir(modeAfterRoot)
      const commonTail = basePhysicalFiles().slice(1)
      await materialize(beforeRoot, [
        { path: "src/index.ts", content: "alpha\n", executable: true },
        ...commonTail
      ])
      await materialize(newlineAfterRoot, [
        { path: "src/index.ts", content: "alpha", executable: true },
        ...commonTail
      ])
      await materialize(modeAfterRoot, [
        { path: "src/index.ts", content: "alpha\n" },
        ...commonTail
      ])
      const manifest = await decodeManifest(makeManifestDocument())

      const newline = await Effect.runPromise(
        measureCandidatePatch(beforeRoot, manifest, newlineAfterRoot, manifest)
      )
      expect(newline.patchEntries[0]).toMatchObject({ additions: 1, deletions: 1 })

      const mode = await Effect.runPromise(
        measureCandidatePatch(beforeRoot, manifest, modeAfterRoot, manifest)
      )
      expect(mode.beforeTreeSha256).not.toBe(mode.afterTreeSha256)
      expect(mode.patchEntries[0]).toMatchObject({
        path: "src/index.ts",
        beforeMode: "100755",
        afterMode: "100644",
        beforeSha256: mode.patchEntries[0]?.afterSha256,
        additions: 0,
        deletions: 0
      })
    }))

  it("rejects lane and semantic-metadata reclassification of existing paths", async () =>
    withTempRoot(async (root) => {
      const beforeRoot = join(root, "before")
      const afterRoot = join(root, "after")
      await mkdir(beforeRoot)
      await mkdir(afterRoot)
      await materialize(beforeRoot, basePhysicalFiles())
      await materialize(afterRoot, basePhysicalFiles())
      const beforeManifest = await decodeManifest(makeManifestDocument())
      const mutations: ReadonlyArray<(entry: MutableDocument) => void> = [
        (entry) => { entry.laneId = "generated-product-input" },
        (entry) => { entry.moduleId = "module.reclassified" },
        (entry) => { entry.ownerRoleIds = ["role.reclassified"] },
        (entry) => { entry.conceptIds = ["concept.reclassified"] },
        (entry) => { entry.centralBranchIds = ["branch.reclassified"] }
      ]
      for (const mutate of mutations) {
        const document = makeManifestDocument()
        mutate(document.files[0])
        const afterManifest = await decodeManifest(document)
        const exit = await Effect.runPromiseExit(
          measureCandidatePatch(beforeRoot, beforeManifest, afterRoot, afterManifest)
        )
        expect(Exit.isFailure(exit)).toBe(true)
      }
    }))

  it("reports filesystem failures through the typed inventory error", async () => {
    const manifest = await decodeManifest(makeManifestDocument())
    const exit = await Effect.runPromiseExit(
      inventoryCandidateTree(join(tmpdir(), "definitely-missing-architecture-candidate"), manifest)
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(String(exit.cause)).toContain("TrialInventoryError")
  })
})
