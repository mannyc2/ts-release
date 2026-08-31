import { Schema } from "effect"
import {
  ExistingRepositoryPath,
  GitRevision,
  ProgramId,
  Sha256Hex
} from "./primitives.js"

const PositiveLine = Schema.Int.check(Schema.isGreaterThan(0))

const CurrentCoordinateFields = {
  repositoryId: ProgramId,
  path: ExistingRepositoryPath,
  sha256: Sha256Hex
} as const

const GitCoordinateFields = {
  repositoryId: ProgramId,
  gitRevision: GitRevision,
  path: ExistingRepositoryPath,
  sha256: Sha256Hex
} as const

export class CurrentWholeFileSourceCoordinate extends Schema.TaggedClass<CurrentWholeFileSourceCoordinate>()(
  "CurrentWholeFileSourceCoordinate",
  CurrentCoordinateFields
) {}

export class CurrentLineRangeSourceCoordinate extends Schema.TaggedClass<CurrentLineRangeSourceCoordinate>()(
  "CurrentLineRangeSourceCoordinate",
  {
    ...CurrentCoordinateFields,
    startLine: PositiveLine,
    endLine: PositiveLine
  }
) {}

export class GitWholeFileSourceCoordinate extends Schema.TaggedClass<GitWholeFileSourceCoordinate>()(
  "GitWholeFileSourceCoordinate",
  GitCoordinateFields
) {}

export class GitLineRangeSourceCoordinate extends Schema.TaggedClass<GitLineRangeSourceCoordinate>()(
  "GitLineRangeSourceCoordinate",
  {
    ...GitCoordinateFields,
    startLine: PositiveLine,
    endLine: PositiveLine
  }
) {}

export const SourceCoordinate = Schema.Union([
  CurrentWholeFileSourceCoordinate,
  CurrentLineRangeSourceCoordinate,
  GitWholeFileSourceCoordinate,
  GitLineRangeSourceCoordinate
])
export type SourceCoordinate = typeof SourceCoordinate.Type

export const sourceCoordinateKey = (coordinate: SourceCoordinate): string => {
  const revision = "gitRevision" in coordinate ? coordinate.gitRevision : "WORKTREE"
  const range = "startLine" in coordinate
    ? `:${coordinate.startLine}-${coordinate.endLine}`
    : ""
  return `${coordinate.repositoryId}:${revision}:${coordinate.path}:${coordinate.sha256}${range}`
}
