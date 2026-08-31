import { Effect, Schema } from "effect"
import { PlannedRepositoryPath } from "./primitives.js"
import {
  V2CandidateId,
  V2CandidateModel,
  V2CandidateScope,
  V2_CANDIDATE_DEFINITIONS
} from "./v2-ids.js"

const nfcText = Schema.makeFilter(
  (value: string) => value === value.normalize("NFC") ? undefined : "must be NFC-normalized"
)

const StableId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u)
).pipe(Schema.brand("CandidateManifestStableId"))

export const CandidateManifestLaneId = Schema.Literals([
  "product-source",
  "generated-product-input",
  "action-source",
  "test-oracle",
  "fixture",
  "tooling",
  "generated-output",
  "delivery-bundle"
])
export type CandidateManifestLaneId = typeof CandidateManifestLaneId.Type

const DependencyKind = Schema.Literals(["static", "type-only", "dynamic", "manifest"])

const DependencyEdgeId = Schema.NonEmptyString.check(
  nfcText,
  Schema.isPattern(
    /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*->[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*:(?:static|type-only|dynamic|manifest)$/u
  )
).pipe(Schema.brand("CandidateManifestDependencyEdgeId"))

export const CandidateManifestFileEntry = Schema.Struct({
  path: PlannedRepositoryPath,
  laneId: CandidateManifestLaneId,
  moduleId: Schema.Union([StableId, Schema.Null]),
  packageId: Schema.Union([StableId, Schema.Null]),
  ownerRoleIds: Schema.Array(StableId),
  conceptIds: Schema.Array(StableId),
  centralBranchIds: Schema.Array(StableId)
})
export type CandidateManifestFileEntry = typeof CandidateManifestFileEntry.Type

export const CandidateManifestDependencyEdge = Schema.Struct({
  id: DependencyEdgeId,
  fromId: StableId,
  toId: StableId,
  kind: DependencyKind
})
export type CandidateManifestDependencyEdge = typeof CandidateManifestDependencyEdge.Type

export class ArchitectureCandidateManifestV2 extends Schema.Class<ArchitectureCandidateManifestV2>(
  "ArchitectureCandidateManifestV2"
)({
  schemaVersion: Schema.Literal("ts-release/architecture-candidate-manifest/v2"),
  candidateId: V2CandidateId,
  scope: V2CandidateScope,
  model: V2CandidateModel,
  implementationRoot: PlannedRepositoryPath,
  files: Schema.Array(CandidateManifestFileEntry),
  publicSurfaceIds: Schema.Array(StableId),
  durableFormatIds: Schema.Array(StableId),
  dependencyEdges: Schema.Array(CandidateManifestDependencyEdge)
}) {}

const PRODUCT_COUNTING_LANES: ReadonlySet<string> = new Set([
  "product-source",
  "generated-product-input",
  "action-source"
])

const codePointCompare = (left: string, right: string): number => {
  const leftPoints = [...left]
  const rightPoints = [...right]
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    const leftPoint = leftPoints[index]!.codePointAt(0)!
    const rightPoint = rightPoints[index]!.codePointAt(0)!
    if (leftPoint !== rightPoint) return leftPoint - rightPoint
  }
  return leftPoints.length - rightPoints.length
}

const orderedUniqueIssues = (
  label: string,
  values: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const duplicates = [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
  if (duplicates.length > 0) {
    issues.push(`${label} contains duplicate values: ${duplicates.join(", ")}`)
  }
  for (let index = 1; index < values.length; index += 1) {
    if (codePointCompare(values[index - 1]!, values[index]!) >= 0) {
      issues.push(`${label} must be strictly sorted by Unicode code point`)
      break
    }
  }
  return issues
}

const hasForbiddenPathSegment = (path: string): boolean => path
  .split("/")
  .some((segment) => {
    const normalized = segment.toLowerCase()
    return normalized === ".git" || normalized === "node_modules"
  })

export const candidateManifestInvariantIssues = (
  manifest: ArchitectureCandidateManifestV2
): ReadonlyArray<string> => {
  const issues: Array<string> = []
  const requiredCandidate = V2_CANDIDATE_DEFINITIONS[manifest.candidateId]

  if (manifest.scope !== requiredCandidate.scope ||
    manifest.model !== requiredCandidate.model ||
    manifest.implementationRoot !== requiredCandidate.implementationRoot) {
    issues.push(
      `candidate ${manifest.candidateId} must use scope ${requiredCandidate.scope}, model ` +
      `${requiredCandidate.model}, and implementation root ${requiredCandidate.implementationRoot}`
    )
  }

  const filePaths = manifest.files.map(({ path }) => path)
  issues.push(...orderedUniqueIssues("files", filePaths))
  for (const file of manifest.files) {
    issues.push(...orderedUniqueIssues(`file ${file.path} ownerRoleIds`, file.ownerRoleIds))
    issues.push(...orderedUniqueIssues(`file ${file.path} conceptIds`, file.conceptIds))
    issues.push(...orderedUniqueIssues(`file ${file.path} centralBranchIds`, file.centralBranchIds))
    if (hasForbiddenPathSegment(file.path)) {
      issues.push(`file ${file.path} contains a forbidden .git or node_modules path segment`)
    }
    if (PRODUCT_COUNTING_LANES.has(file.laneId)) {
      if (file.moduleId === null) {
        issues.push(`product-counting file ${file.path} must declare a moduleId`)
      }
      if (file.packageId === null) {
        issues.push(`product-counting file ${file.path} must declare a packageId`)
      }
      if (file.ownerRoleIds.length === 0) {
        issues.push(`product-counting file ${file.path} must declare at least one ownerRoleId`)
      }
      if (file.conceptIds.length === 0) {
        issues.push(`product-counting file ${file.path} must declare at least one conceptId`)
      }
    }
  }

  for (const requiredHarnessPath of ["trial-adapter.ts", "trial-candidate.json"] as const) {
    const file = manifest.files.find(({ path }) => path === requiredHarnessPath)
    if (file === undefined || file.laneId !== "tooling") {
      issues.push(`${requiredHarnessPath} must be present exactly once in the tooling lane`)
    }
  }
  if (!manifest.files.some(({ laneId }) => PRODUCT_COUNTING_LANES.has(laneId))) {
    issues.push("files must contain at least one product-counting lane entry")
  }

  issues.push(...orderedUniqueIssues("publicSurfaceIds", manifest.publicSurfaceIds))
  issues.push(...orderedUniqueIssues("durableFormatIds", manifest.durableFormatIds))

  const dependencyEdgeIds = manifest.dependencyEdges.map(({ id }) => id)
  issues.push(...orderedUniqueIssues("dependencyEdges", dependencyEdgeIds))
  for (const edge of manifest.dependencyEdges) {
    const canonicalId = `${edge.fromId}->${edge.toId}:${edge.kind}`
    if (edge.id !== canonicalId) {
      issues.push(`dependency edge ${edge.id} must use canonical id ${canonicalId}`)
    }
    if (edge.fromId === edge.toId) {
      issues.push(`dependency edge ${edge.id} must not be a self edge`)
    }
  }

  return issues
}

export class CandidateManifestInvariantError extends Schema.TaggedError<CandidateManifestInvariantError>()(
  "CandidateManifestInvariantError",
  {
    issues: Schema.NonEmptyArray(Schema.String),
    message: Schema.String
  }
) {
  constructor(issues: readonly [string, ...Array<string>]) {
    super({
      issues,
      message: `Architecture candidate manifest invariant failure: ${issues.join("; ")}`
    })
  }
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeManifestStructure = Schema.decodeUnknownEffect(ArchitectureCandidateManifestV2, strictOptions)
const encodeManifestStructure = Schema.encodeUnknownSync(ArchitectureCandidateManifestV2, strictOptions)

export const decodeCandidateManifest = Effect.fn("ArchitectureCandidateManifestV2.decode")(
  function* (input: unknown) {
    const manifest = yield* decodeManifestStructure(input)
    const issues = candidateManifestInvariantIssues(manifest)
    if (issues.length > 0) {
      yield* new CandidateManifestInvariantError(issues as [string, ...Array<string>])
    }
    return manifest
  }
)

export const encodeCandidateManifest = (manifest: ArchitectureCandidateManifestV2): unknown => {
  const issues = candidateManifestInvariantIssues(manifest)
  if (issues.length > 0) {
    throw new CandidateManifestInvariantError(issues as [string, ...Array<string>])
  }
  return encodeManifestStructure(manifest)
}
