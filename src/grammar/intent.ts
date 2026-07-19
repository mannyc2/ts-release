// Invariant: stage intents are the durable vocabulary a builder emits for one artifact-producing step.
import * as Schema from "effect/Schema"
import { PyPiWheelBinaryArtifact } from "./artifact.js"
import { PlatformTarget } from "./platform.js"
import { ArtifactId } from "./artifact.js"
import bunCompileTargets from "../assets/bun-compile-targets.json" with { type: "json" }

type BunCpu = "baseline" | "modern"
export type BunCompileTarget = `bun-${PlatformTarget}`
  | `bun-linux-${"x64" | "arm64"}-${BunCpu}${"" | "-musl"}`
  | `bun-darwin-${"x64" | "arm64"}-${BunCpu}` | `bun-windows-x64-${BunCpu}`
export const BunCompileTarget = Schema.Literals(bunCompileTargets as ReadonlyArray<BunCompileTarget>)

export class BunCompileIntent extends Schema.TaggedClass<BunCompileIntent>()("bun-compile", {
  entry: Schema.String,
  target: PlatformTarget,
  compileTarget: BunCompileTarget,
  outfile: Schema.String,
  minify: Schema.optional(Schema.Boolean)
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

export const ArchiveFormat = Schema.Literals(["tar.gz", "zip"])
export type ArchiveFormat = typeof ArchiveFormat.Type

export class ArchiveArtifactEntry extends Schema.Class<ArchiveArtifactEntry>("ArchiveArtifactEntry")({
  artifactId: ArtifactId,
  sourcePath: Schema.String,
  archivePath: Schema.String
}) {}

export class ArchiveIntent extends Schema.TaggedClass<ArchiveIntent>()("archive", {
  outfile: Schema.String,
  format: ArchiveFormat,
  wrapDirectory: Schema.optional(Schema.String),
  artifacts: Schema.Array(ArchiveArtifactEntry),
  files: Schema.Array(Schema.String)
}) {}

export const StageArtifactIntent = Schema.Union([BunCompileIntent, PyPiWheelIntent, ArchiveIntent])
export type StageArtifactIntent = typeof StageArtifactIntent.Type
