import { lstat, readFile, readdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import { Effect, Schema } from "effect"
import {
  type ArchitectureCandidateManifestV2,
  type CandidateManifestFileEntry,
  CandidateManifestLaneId,
  candidateManifestInvariantIssues
} from "./schema/candidate-manifest.js"
import { MetricId, PlannedRepositoryPath, Sha256Hex } from "./schema/primitives.js"
import {
  CountMeasurement,
  HashMeasurement,
  IdentifierDeltaMeasurement,
  IdentifierSetDelta,
  ProbeMeasurement,
  SourceLaneDelta
} from "./schema/trial-result.js"
import { REQUIRED_TRIAL_LANES } from "./schema/trial-contract.js"
import { REQUIRED_PROBE_MEASUREMENT_IDS } from "./schema/trial-spec.js"
import { hashCanonicalValue, sha256Bytes } from "./trial-hash.js"

const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const FileMode = Schema.Literals(["100644", "100755"])
const OptionalFileMode = Schema.Union([FileMode, Schema.Null])
const OptionalSha256 = Schema.Union([Sha256Hex, Schema.Null])

export const CANONICAL_TREE_HASH_DOMAIN = "ts-release/architecture-canonical-tree/v2"
export const CANONICAL_PATCH_HASH_DOMAIN = "ts-release/architecture-canonical-patch/v2"

const productLaneIds: ReadonlySet<string> = new Set(
  REQUIRED_TRIAL_LANES.filter(([, countsTowardProductSource]) => countsTowardProductSource)
    .map(([id]) => id)
)

const codePointCompare = (left: string, right: string): number => {
  const leftPoints = [...left]
  const rightPoints = [...right]
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]!.codePointAt(0)! - rightPoints[index]!.codePointAt(0)!
    if (difference !== 0) return difference
  }
  return leftPoints.length - rightPoints.length
}

export class CanonicalTreeEntry extends Schema.Class<CanonicalTreeEntry>(
  "CanonicalTreeEntry"
)({
  path: PlannedRepositoryPath,
  mode: FileMode,
  bytes: NonNegativeInt,
  sha256: Sha256Hex
}) {}

export class CandidateTreeInventory extends Schema.Class<CandidateTreeInventory>(
  "CandidateTreeInventory"
)({
  entries: Schema.Array(CanonicalTreeEntry),
  treeSha256: Sha256Hex
}) {}

export class CanonicalPatchEntry extends Schema.Class<CanonicalPatchEntry>(
  "CanonicalPatchEntry"
)({
  path: PlannedRepositoryPath,
  laneId: CandidateManifestLaneId,
  beforeMode: OptionalFileMode,
  beforeSha256: OptionalSha256,
  afterMode: OptionalFileMode,
  afterSha256: OptionalSha256,
  additions: NonNegativeInt,
  deletions: NonNegativeInt
}) {}

export class CandidatePatchMeasurement extends Schema.Class<CandidatePatchMeasurement>(
  "CandidatePatchMeasurement"
)({
  beforeTreeSha256: Sha256Hex,
  afterTreeSha256: Sha256Hex,
  patchSha256: Sha256Hex,
  beforeTreeEntries: Schema.Array(CanonicalTreeEntry),
  afterTreeEntries: Schema.Array(CanonicalTreeEntry),
  patchEntries: Schema.Array(CanonicalPatchEntry),
  measurements: Schema.Array(ProbeMeasurement),
  laneDeltas: Schema.Array(SourceLaneDelta),
  touchedPathIds: Schema.Array(PlannedRepositoryPath),
  touchedModuleIds: Schema.Array(Schema.String),
  touchedPackageIds: Schema.Array(Schema.String),
  touchedOwnerRoleIds: Schema.Array(Schema.String),
  touchedConceptIds: Schema.Array(Schema.String),
  touchedCentralBranchIds: Schema.Array(Schema.String),
  publicSurfaceDelta: IdentifierSetDelta,
  durableFormatDelta: IdentifierSetDelta,
  dependencyDagDelta: IdentifierSetDelta
}) {}

export class TrialInventoryError extends Schema.TaggedError<TrialInventoryError>()(
  "TrialInventoryError",
  {
    operation: Schema.String,
    path: Schema.String,
    reason: Schema.String,
    message: Schema.String
  }
) {
  constructor(operation: string, path: string, reason: string) {
    super({
      operation,
      path,
      reason,
      message: `Architecture trial inventory ${operation} failed for ${path}: ${reason}`
    })
  }
}

interface ObservedFile {
  readonly entry: CanonicalTreeEntry
  readonly content: Uint8Array
  readonly metadata: CandidateManifestFileEntry
}

interface ObservedTree {
  readonly inventory: CandidateTreeInventory
  readonly files: ReadonlyMap<string, ObservedFile>
}

interface ScannedFile {
  readonly path: string
  readonly mode: "100644" | "100755"
  readonly content: Uint8Array
}

const causeMessage = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

const fail = (operation: string, path: string, reason: string): never => {
  throw new TrialInventoryError(operation, path, reason)
}

const sameStat = (
  left: Awaited<ReturnType<typeof lstat>>,
  right: Awaited<ReturnType<typeof lstat>>
): boolean => left.dev === right.dev &&
  left.ino === right.ino &&
  left.mode === right.mode &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs

const assertCanonicalRelativePath = (path: string): void => {
  if (!path.isWellFormed()) fail("scan", path, "path contains an unpaired UTF-16 surrogate")
  if (path !== path.normalize("NFC")) fail("scan", path, "path is not NFC-normalized")
  if (path.includes("\\") || path.startsWith("/") || path.split("/").some((part) => part === "")) {
    fail("scan", path, "path is not a canonical relative POSIX path")
  }
}

const scanRegularFiles = async (root: string): Promise<ReadonlyArray<ScannedFile>> => {
  const absoluteRoot = resolve(root)
  const output: Array<ScannedFile> = []

  const visit = async (absolutePath: string, segments: ReadonlyArray<string>): Promise<void> => {
    const first = await lstat(absolutePath)
    const displayPath = segments.length === 0 ? root : segments.join("/")
    if (first.isSymbolicLink()) fail("scan", displayPath, "symbolic links are forbidden")
    if (first.isDirectory()) {
      const names = await readdir(absolutePath)
      names.sort(codePointCompare)
      for (const name of names) {
        await visit(join(absolutePath, name), [...segments, name])
      }
      return
    }
    if (!first.isFile()) fail("scan", displayPath, "only directories and regular files are permitted")
    const relativePath = segments.join("/")
    assertCanonicalRelativePath(relativePath)
    const content = new Uint8Array(await readFile(absolutePath))
    const second = await lstat(absolutePath)
    if (!second.isFile() || second.isSymbolicLink() || !sameStat(first, second) || second.size !== content.byteLength) {
      fail("scan", relativePath, "file changed while its bytes were observed")
    }
    output.push({
      path: relativePath,
      mode: (first.mode & 0o111) === 0 ? "100644" : "100755",
      content
    })
  }

  await visit(absoluteRoot, [])
  output.sort((left, right) => codePointCompare(left.path, right.path))
  return output
}

const canonicalTreeValue = (entries: ReadonlyArray<CanonicalTreeEntry>) => entries.map((entry) => ({
  path: entry.path,
  mode: entry.mode,
  bytes: entry.bytes,
  sha256: entry.sha256
}))

export const canonicalTreeSha256 = (entries: ReadonlyArray<CanonicalTreeEntry>) =>
  hashCanonicalValue(CANONICAL_TREE_HASH_DOMAIN, canonicalTreeValue(entries))

/**
 * Inventories an unclassified regular-file tree with the same canonical algorithm used for
 * candidate trees. The runner uses this to bind its complete source root without asking a
 * candidate manifest to classify runner-owned code.
 */
export const inventoryCanonicalTree = Effect.fn("trialInventory.inventoryCanonicalTree")(
  function* (root: string) {
    const scanned = yield* Effect.tryPromise({
      try: () => scanRegularFiles(root),
      catch: (cause) => cause instanceof TrialInventoryError
        ? cause
        : new TrialInventoryError("scan", root, causeMessage(cause))
    })
    const entries = scanned.map((file) => new CanonicalTreeEntry({
      path: PlannedRepositoryPath.make(file.path),
      mode: file.mode,
      bytes: file.content.byteLength,
      sha256: sha256Bytes(file.content)
    }))
    return new CandidateTreeInventory({ entries, treeSha256: canonicalTreeSha256(entries) })
  }
)

const canonicalPatchValue = (entries: ReadonlyArray<CanonicalPatchEntry>) => entries.map((entry) => ({
  path: entry.path,
  laneId: entry.laneId,
  beforeMode: entry.beforeMode,
  beforeSha256: entry.beforeSha256,
  afterMode: entry.afterMode,
  afterSha256: entry.afterSha256,
  additions: entry.additions,
  deletions: entry.deletions
}))

export const canonicalPatchSha256 = (entries: ReadonlyArray<CanonicalPatchEntry>) =>
  hashCanonicalValue(CANONICAL_PATCH_HASH_DOMAIN, canonicalPatchValue(entries))

const manifestMetadata = (entry: CandidateManifestFileEntry) => ({
  laneId: entry.laneId,
  moduleId: entry.moduleId,
  packageId: entry.packageId,
  ownerRoleIds: entry.ownerRoleIds,
  conceptIds: entry.conceptIds,
  centralBranchIds: entry.centralBranchIds
})

const observeTreePromise = async (
  root: string,
  manifest: ArchitectureCandidateManifestV2
): Promise<ObservedTree> => {
  const manifestIssues = candidateManifestInvariantIssues(manifest)
  if (manifestIssues.length > 0) fail("manifest", root, manifestIssues.join("; "))
  const scanned = await scanRegularFiles(root)
  const scannedPaths = scanned.map(({ path }) => path)
  const manifestPaths = manifest.files.map(({ path }) => path)
  if (scannedPaths.length !== manifestPaths.length ||
    scannedPaths.some((path, index) => path !== manifestPaths[index])) {
    fail(
      "manifest",
      root,
      `filesystem paths [${scannedPaths.join(", ")}] do not exactly equal manifest paths ` +
        `[${manifestPaths.join(", ")}]`
    )
  }

  const entries = scanned.map((file) => new CanonicalTreeEntry({
    path: PlannedRepositoryPath.make(file.path),
    mode: file.mode,
    bytes: file.content.byteLength,
    sha256: sha256Bytes(file.content)
  }))
  const treeSha256 = canonicalTreeSha256(entries)
  const files = new Map<string, ObservedFile>()
  for (const [index, file] of scanned.entries()) {
    const entry = entries[index]
    const metadata = manifest.files[index]
    if (entry === undefined || metadata === undefined) {
      fail("manifest", root, "filesystem and manifest indexing diverged")
      continue
    }
    files.set(file.path, { entry, content: file.content, metadata })
  }
  return {
    inventory: new CandidateTreeInventory({ entries, treeSha256 }),
    files
  }
}

const observeTree = Effect.fn("trialInventory.observeTree")(function* (
  root: string,
  manifest: ArchitectureCandidateManifestV2
) {
  return yield* Effect.tryPromise({
    try: () => observeTreePromise(root, manifest),
    catch: (cause) => cause instanceof TrialInventoryError
      ? cause
      : new TrialInventoryError("scan", root, causeMessage(cause))
  })
})

export const inventoryCandidateTree = Effect.fn("trialInventory.inventoryCandidateTree")(
  function* (root: string, manifest: ArchitectureCandidateManifestV2) {
    return (yield* observeTree(root, manifest)).inventory
  }
)

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const textLines = (bytes: Uint8Array): ReadonlyArray<string> | undefined => {
  if (bytes.includes(0)) return undefined
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
  if (text.length === 0) return []
  const lines: Array<string> = []
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\n") continue
    lines.push(text.slice(start, index + 1))
    start = index + 1
  }
  if (start < text.length) lines.push(text.slice(start))
  return lines
}

const shortestEditLength = (before: ReadonlyArray<string>, after: ReadonlyArray<string>): number => {
  const maximum = before.length + after.length
  const furthest = new Map<number, number>([[1, 0]])
  for (let distance = 0; distance <= maximum; distance += 1) {
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const down = furthest.get(diagonal + 1) ?? 0
      const right = (furthest.get(diagonal - 1) ?? 0) + 1
      let x = diagonal === -distance || (diagonal !== distance && right <= down) ? down : right
      let y = x - diagonal
      while (x < before.length && y < after.length && before[x] === after[y]) {
        x += 1
        y += 1
      }
      furthest.set(diagonal, x)
      if (x >= before.length && y >= after.length) return distance
    }
  }
  return maximum
}

const physicalDiff = (
  path: string,
  laneId: string,
  before: Uint8Array | undefined,
  after: Uint8Array | undefined
): { readonly additions: number; readonly deletions: number } => {
  const beforeLines = textLines(before ?? new Uint8Array())
  const afterLines = textLines(after ?? new Uint8Array())
  if (beforeLines === undefined || afterLines === undefined) {
    if (productLaneIds.has(laneId)) {
      fail("diff", path, `binary or invalid UTF-8 change is forbidden in ${laneId}`)
    }
    return { additions: 0, deletions: 0 }
  }
  const distance = shortestEditLength(beforeLines, afterLines)
  return {
    additions: (distance + afterLines.length - beforeLines.length) / 2,
    deletions: (distance - afterLines.length + beforeLines.length) / 2
  }
}

const sortedUnique = (values: Iterable<string>): ReadonlyArray<string> =>
  [...new Set(values)].sort(codePointCompare)

const setDelta = (
  before: ReadonlyArray<string>,
  after: ReadonlyArray<string>
): IdentifierSetDelta => {
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  return new IdentifierSetDelta({
    addedIds: after.filter((id) => !beforeSet.has(id)),
    removedIds: before.filter((id) => !afterSet.has(id))
  })
}

const measurementId = (id: (typeof REQUIRED_PROBE_MEASUREMENT_IDS)[number]) => MetricId.make(id)

const sameCandidate = (
  before: ArchitectureCandidateManifestV2,
  after: ArchitectureCandidateManifestV2
): boolean => before.candidateId === after.candidateId &&
  before.scope === after.scope &&
  before.model === after.model &&
  before.implementationRoot === after.implementationRoot

export const measureCandidatePatch = Effect.fn("trialInventory.measureCandidatePatch")(
  function* (
    beforeRoot: string,
    beforeManifest: ArchitectureCandidateManifestV2,
    afterRoot: string,
    afterManifest: ArchitectureCandidateManifestV2
  ) {
    if (!sameCandidate(beforeManifest, afterManifest)) {
      yield* new TrialInventoryError(
        "manifest",
        afterManifest.implementationRoot,
        "before and after manifests identify different candidates"
      )
    }
    const before = yield* observeTree(beforeRoot, beforeManifest)
    const after = yield* observeTree(afterRoot, afterManifest)
    const paths = sortedUnique([...before.files.keys(), ...after.files.keys()])
    const patchEntries: Array<CanonicalPatchEntry> = []
    const touchedMetadata: Array<CandidateManifestFileEntry> = []

    for (const path of paths) {
      const beforeFile = before.files.get(path)
      const afterFile = after.files.get(path)
      if (beforeFile !== undefined && afterFile !== undefined &&
        JSON.stringify(manifestMetadata(beforeFile.metadata)) !==
          JSON.stringify(manifestMetadata(afterFile.metadata))) {
        yield* new TrialInventoryError(
          "manifest",
          path,
          "existing paths may not be reclassified across lanes or semantic metadata"
        )
      }
      const changed = beforeFile === undefined || afterFile === undefined ||
        beforeFile.entry.mode !== afterFile.entry.mode ||
        !bytesEqual(beforeFile.content, afterFile.content)
      if (!changed) continue

      const metadata = afterFile?.metadata ?? beforeFile!.metadata
      const arithmetic = yield* Effect.try({
        try: () => physicalDiff(
          path,
          metadata.laneId,
          beforeFile?.content,
          afterFile?.content
        ),
        catch: (cause) => cause instanceof TrialInventoryError
          ? cause
          : new TrialInventoryError("diff", path, causeMessage(cause))
      })
      patchEntries.push(new CanonicalPatchEntry({
        path: PlannedRepositoryPath.make(path),
        laneId: metadata.laneId,
        beforeMode: beforeFile?.entry.mode ?? null,
        beforeSha256: beforeFile?.entry.sha256 ?? null,
        afterMode: afterFile?.entry.mode ?? null,
        afterSha256: afterFile?.entry.sha256 ?? null,
        additions: arithmetic.additions,
        deletions: arithmetic.deletions
      }))
      if (beforeFile !== undefined) touchedMetadata.push(beforeFile.metadata)
      if (afterFile !== undefined) touchedMetadata.push(afterFile.metadata)
    }

    const patchSha256 = canonicalPatchSha256(patchEntries)
    const laneDeltas = REQUIRED_TRIAL_LANES.map(([laneId]) => {
      const entries = patchEntries.filter((entry) => entry.laneId === laneId)
      return new SourceLaneDelta({
        laneId: MetricId.make(laneId),
        additions: entries.reduce((total, entry) => total + entry.additions, 0),
        deletions: entries.reduce((total, entry) => total + entry.deletions, 0)
      })
    })
    const productLanes = laneDeltas.filter(({ laneId }) => productLaneIds.has(laneId))
    const touchedPathIds = patchEntries.map(({ path }) => path)
    const touchedModuleIds = sortedUnique(touchedMetadata.flatMap(({ moduleId }) =>
      moduleId === null ? [] : [moduleId]))
    const touchedPackageIds = sortedUnique(touchedMetadata.flatMap(({ packageId }) =>
      packageId === null ? [] : [packageId]))
    const touchedOwnerRoleIds = sortedUnique(touchedMetadata.flatMap(({ ownerRoleIds }) => ownerRoleIds))
    const touchedConceptIds = sortedUnique(touchedMetadata.flatMap(({ conceptIds }) => conceptIds))
    const touchedCentralBranchIds = sortedUnique(
      touchedMetadata.flatMap(({ centralBranchIds }) => centralBranchIds)
    )
    const publicSurfaceDelta = setDelta(beforeManifest.publicSurfaceIds, afterManifest.publicSurfaceIds)
    const durableFormatDelta = setDelta(beforeManifest.durableFormatIds, afterManifest.durableFormatIds)
    const dependencyDagDelta = setDelta(
      beforeManifest.dependencyEdges.map(({ id }) => id),
      afterManifest.dependencyEdges.map(({ id }) => id)
    )

    const measurements = [
      new HashMeasurement({
        id: measurementId("before-tree-sha256"),
        value: before.inventory.treeSha256
      }),
      new HashMeasurement({
        id: measurementId("after-tree-sha256"),
        value: after.inventory.treeSha256
      }),
      new HashMeasurement({ id: measurementId("patch-sha256"), value: patchSha256 }),
      new CountMeasurement({
        id: measurementId("gross-product-additions"),
        value: productLanes.reduce((total, lane) => total + lane.additions, 0)
      }),
      new CountMeasurement({
        id: measurementId("gross-product-deletions"),
        value: productLanes.reduce((total, lane) => total + lane.deletions, 0)
      }),
      new CountMeasurement({ id: measurementId("files-touched"), value: touchedPathIds.length }),
      new CountMeasurement({ id: measurementId("modules-touched"), value: touchedModuleIds.length }),
      new CountMeasurement({ id: measurementId("packages-touched"), value: touchedPackageIds.length }),
      new CountMeasurement({ id: measurementId("concepts-touched"), value: touchedConceptIds.length }),
      new CountMeasurement({
        id: measurementId("central-branches-touched"),
        value: touchedCentralBranchIds.length
      }),
      new IdentifierDeltaMeasurement({
        id: measurementId("public-surface-delta"),
        value: publicSurfaceDelta
      }),
      new IdentifierDeltaMeasurement({
        id: measurementId("durable-format-delta"),
        value: durableFormatDelta
      }),
      new IdentifierDeltaMeasurement({
        id: measurementId("dependency-dag-delta"),
        value: dependencyDagDelta
      })
    ]

    return new CandidatePatchMeasurement({
      beforeTreeSha256: before.inventory.treeSha256,
      afterTreeSha256: after.inventory.treeSha256,
      patchSha256,
      beforeTreeEntries: before.inventory.entries,
      afterTreeEntries: after.inventory.entries,
      patchEntries,
      measurements,
      laneDeltas,
      touchedPathIds,
      touchedModuleIds,
      touchedPackageIds,
      touchedOwnerRoleIds,
      touchedConceptIds,
      touchedCentralBranchIds,
      publicSurfaceDelta,
      durableFormatDelta,
      dependencyDagDelta
    })
  }
)
