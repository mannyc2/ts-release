// Invariant: Artifact is the only artifact representation and every stored path is a validated safe relative path.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { PlanError } from "./errors.js"

export const safeRelativePathReason = "Path must be non-empty, relative, and must not contain parent traversal."

export const isSafeRelativePath = (value: string): boolean =>
  value.trim().length > 0 &&
  !value.startsWith("/") &&
  !value.startsWith("\\") &&
  !/^[A-Za-z]:[\\/]/.test(value) &&
  !value.split(/[\\/]+/).includes("..")

export const SafeRelativePath = Schema.String.check(
  Schema.makeFilter((value: string) => isSafeRelativePath(value) ? undefined : safeRelativePathReason)
)
export type SafeRelativePath = typeof SafeRelativePath.Type

export const validateSafeRelativePathEffect = (
  value: string,
  source: { readonly pipeId: string; readonly field: string }
): Effect.Effect<SafeRelativePath, PlanError> =>
  isSafeRelativePath(value)
    ? Effect.succeed(value)
    : Effect.fail(PlanError.make({
      pipeId: source.pipeId,
      field: source.field,
      reason: safeRelativePathReason
    }))

export const WorkflowFileName = Schema.String.check(
  Schema.makeFilter((value: string) => {
    const hasPathSeparator = value.includes("/") || value.includes("\\")
    const hasWorkflowExtension = value.endsWith(".yml") || value.endsWith(".yaml")
    return hasPathSeparator || !hasWorkflowExtension
      ? "Workflow must be a .yml or .yaml filename without path separators."
      : undefined
  })
)
export type WorkflowFileName = typeof WorkflowFileName.Type

export const ArtifactId = Schema.NonEmptyString
export type ArtifactId = typeof ArtifactId.Type

export const ArtifactFormat = Schema.Literals(["tarball", "zip", "file", "directory", "oci-image", "executable"])
export type ArtifactFormat = typeof ArtifactFormat.Type

export const ChecksumAlgorithm = Schema.Literals(["sha256", "sha512"])
export type ChecksumAlgorithm = typeof ChecksumAlgorithm.Type

export const ArtifactOperatingSystem = Schema.Literals(["linux", "darwin", "windows"])
export type ArtifactOperatingSystem = typeof ArtifactOperatingSystem.Type

export const ArtifactArchitecture = Schema.Literals(["x64", "arm64"])
export type ArtifactArchitecture = typeof ArtifactArchitecture.Type

export const ArtifactLibc = Schema.Literals(["glibc", "musl"])
export type ArtifactLibc = typeof ArtifactLibc.Type

export class Checksum extends Schema.Class<Checksum>("Checksum")({
  algorithm: ChecksumAlgorithm,
  value: Schema.String
}) {}

export class InstallableArtifactVariant extends Schema.Class<InstallableArtifactVariant>(
  "InstallableArtifactVariant"
)({
  os: ArtifactOperatingSystem,
  arch: ArtifactArchitecture,
  libc: Schema.optionalKey(ArtifactLibc),
  binaryName: Schema.optionalKey(Schema.NonEmptyString),
  executableExtension: Schema.optionalKey(Schema.NonEmptyString),
  installPath: Schema.optionalKey(Schema.NonEmptyString),
  targetTriple: Schema.optionalKey(Schema.NonEmptyString)
}) {}

export class PyPiWheelBinaryArtifact extends Schema.Class<PyPiWheelBinaryArtifact>("PyPiWheelBinaryArtifact")({
  os: ArtifactOperatingSystem,
  arch: ArtifactArchitecture,
  sourcePath: SafeRelativePath,
  wheelPath: Schema.String
}) {}

export const ArtifactKind = Schema.Literals([
  "executable",
  "archive",
  "package",
  "wheel",
  "checksum-file",
  "catalog-file",
  "file"
])
export type ArtifactKind = typeof ArtifactKind.Type

export class ExecutableExtra extends Schema.TaggedClass<ExecutableExtra>()("executable", {
  binary: Schema.String,
  extension: Schema.String,
  builderId: Schema.String,
  dynamicallyLinked: Schema.optional(Schema.Boolean)
}) {}

export class ArchiveExtra extends Schema.TaggedClass<ArchiveExtra>()("archive", {
  format: Schema.String,
  wrappedIn: Schema.optional(Schema.String),
  binaries: Schema.Array(Schema.String),
  files: Schema.Array(Schema.String)
}) {}

export class ChecksumFileExtra extends Schema.TaggedClass<ChecksumFileExtra>()("checksum-file", {
  algorithm: Schema.Literals(["sha256", "sha512"]),
  coversArtifactIds: Schema.Array(Schema.String)
}) {}

export class CatalogFileExtra extends Schema.TaggedClass<CatalogFileExtra>()("catalog-file", {
  catalog: Schema.NonEmptyString,
  repository: Schema.String
}) {}

export class PackageExtra extends Schema.TaggedClass<PackageExtra>()("package", {
  packageManager: Schema.NonEmptyString,
  packageName: Schema.String
}) {}

export class WheelExtra extends Schema.TaggedClass<WheelExtra>()("wheel", {
  packageName: Schema.String,
  wheelTag: Schema.String,
  binaries: Schema.Array(Schema.String)
}) {}

export class ImportedFileExtra extends Schema.TaggedClass<ImportedFileExtra>()("file", {
  format: ArtifactFormat
}) {}

export const ArtifactExtra = Schema.Union([
  ExecutableExtra,
  ArchiveExtra,
  ChecksumFileExtra,
  CatalogFileExtra,
  PackageExtra,
  WheelExtra,
  ImportedFileExtra
])
export type ArtifactExtra = typeof ArtifactExtra.Type

export class Artifact extends Schema.Class<Artifact>("Artifact")({
  id: ArtifactId,
  kind: ArtifactKind,
  path: SafeRelativePath,
  producedBy: Schema.String,
  platform: Schema.optionalKey(InstallableArtifactVariant),
  checksum: Schema.optionalKey(Checksum),
  extra: Schema.optionalKey(ArtifactExtra)
}) {}

export const artifactPathBaseName = (pathName: string): string => {
  const parts = pathName.replaceAll("\\", "/").split("/")
  return parts[parts.length - 1] ?? pathName
}
