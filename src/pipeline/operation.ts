import * as Schema from "effect/Schema"
import { PyPiWheelBinaryArtifact } from "../domain/artifact.js"
import {
  CommandSpec,
  Operation as DomainOperation,
  OperationId,
  OperationRisk,
  ValidateCommandOperation,
  ValidationNoteOperation
} from "../domain/operation.js"
import { ArtifactId } from "./artifact.js"
import { PlatformTarget } from "../builders/targets.js"

export type * from "../types/effect-internal.js"
export {
  CommandSpec,
  OperationId,
  OperationRisk,
  ValidateCommandOperation,
  ValidationNoteOperation
}

export const BunCompileTarget = Schema.Literals([
  "bun-linux-x64",
  "bun-linux-x64-baseline",
  "bun-linux-x64-modern",
  "bun-linux-x64-musl",
  "bun-linux-x64-baseline-musl",
  "bun-linux-x64-modern-musl",
  "bun-linux-arm64",
  "bun-linux-arm64-baseline",
  "bun-linux-arm64-modern",
  "bun-linux-arm64-musl",
  "bun-linux-arm64-baseline-musl",
  "bun-linux-arm64-modern-musl",
  "bun-darwin-x64",
  "bun-darwin-x64-baseline",
  "bun-darwin-x64-modern",
  "bun-darwin-arm64",
  "bun-darwin-arm64-baseline",
  "bun-darwin-arm64-modern",
  "bun-windows-x64",
  "bun-windows-x64-baseline",
  "bun-windows-x64-modern",
  "bun-windows-arm64"
])
export type BunCompileTarget = typeof BunCompileTarget.Type

export class BunCompileIntent extends Schema.TaggedClass<BunCompileIntent>()("bun-compile", {
  entry: Schema.String,
  target: PlatformTarget,
  compileTarget: BunCompileTarget,
  outfile: Schema.String,
  minify: Schema.optionalKey(Schema.Boolean)
}) {}

export class PyPiWheelIntent extends Schema.TaggedClass<PyPiWheelIntent>()("pypi-wheel", {
  outfile: Schema.String,
  wheelTag: Schema.String,
  packageName: Schema.String,
  moduleName: Schema.String,
  consoleScript: Schema.String,
  summary: Schema.String,
  homepage: Schema.String,
  license: Schema.String,
  requiresPython: Schema.String,
  binaries: Schema.Array(PyPiWheelBinaryArtifact)
}) {}

export const StageArtifactIntent = Schema.Union([BunCompileIntent, PyPiWheelIntent])
export type StageArtifactIntent = typeof StageArtifactIntent.Type

export class StageArtifactOperation extends Schema.TaggedClass<StageArtifactOperation>()(
  "StageArtifactOperation",
  {
    id: OperationId,
    description: Schema.String,
    risk: Schema.Literal("writes-local"),
    intent: StageArtifactIntent,
    producesArtifactIds: Schema.Array(ArtifactId)
  }
) {}

export const PipelineOperation = Schema.Union([DomainOperation, StageArtifactOperation])
export type PipelineOperation = typeof PipelineOperation.Type
