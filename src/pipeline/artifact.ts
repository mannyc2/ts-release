import * as Schema from "effect/Schema"

export const SafeRelativePath = Schema.NonEmptyString
export type SafeRelativePath = typeof SafeRelativePath.Type

export const WorkflowFileName = Schema.NonEmptyString
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

export class InstallableArtifactVariantOverride extends Schema.Class<InstallableArtifactVariantOverride>(
  "InstallableArtifactVariantOverride"
)({
  os: Schema.optionalKey(ArtifactOperatingSystem),
  arch: Schema.optionalKey(ArtifactArchitecture),
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

export class ArtifactIntent extends Schema.Class<ArtifactIntent>("ArtifactIntent")({
  id: ArtifactId,
  path: SafeRelativePath,
  downloadUrl: Schema.optionalKey(Schema.String),
  format: ArtifactFormat,
  consumers: Schema.Array(Schema.String),
  checksum: Schema.optionalKey(Checksum),
  variant: Schema.optionalKey(InstallableArtifactVariant)
}) {}

export class ArtifactInventoryItem extends Schema.Class<ArtifactInventoryItem>("ArtifactInventoryItem")({
  id: ArtifactId,
  path: SafeRelativePath,
  downloadUrl: Schema.optionalKey(Schema.String),
  format: ArtifactFormat,
  consumers: Schema.Array(Schema.String),
  sizeBytes: Schema.Number,
  checksum: Schema.optionalKey(Checksum),
  variant: Schema.optionalKey(InstallableArtifactVariant)
}) {}

export const artifactIntentOrder = (left: ArtifactIntent, right: ArtifactIntent): number =>
  left.id.localeCompare(right.id)

export const artifactInventoryOrder = (
  left: ArtifactInventoryItem,
  right: ArtifactInventoryItem
): number => left.id.localeCompare(right.id)

export const ArtifactKind = Schema.Literals([
  "executable",
  "archive",
  "package",
  "wheel",
  "checksum-file",
  "catalog-file",
  "sbom",
  "signature",
  "file"
])
export type ArtifactKind = typeof ArtifactKind.Type

export class ExecutableExtra extends Schema.TaggedClass<ExecutableExtra>()("executable", {
  binary: Schema.String,
  extension: Schema.String,
  builderId: Schema.String,
  dynamicallyLinked: Schema.optionalKey(Schema.Boolean)
}) {}

export class ArchiveExtra extends Schema.TaggedClass<ArchiveExtra>()("archive", {
  format: Schema.String,
  wrappedIn: Schema.optionalKey(Schema.String),
  binaries: Schema.Array(Schema.String),
  files: Schema.Array(Schema.String)
}) {}

export class ChecksumFileExtra extends Schema.TaggedClass<ChecksumFileExtra>()("checksum-file", {
  algorithm: Schema.Literals(["sha256", "sha512"]),
  coversArtifactIds: Schema.Array(Schema.String)
}) {}

export class CatalogFileExtra extends Schema.TaggedClass<CatalogFileExtra>()("catalog-file", {
  catalog: Schema.Literals(["homebrew", "scoop"]),
  repository: Schema.String
}) {}

export class PackageExtra extends Schema.TaggedClass<PackageExtra>()("package", {
  packageManager: Schema.Literal("npm"),
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
  path: Schema.String,
  producedBy: Schema.String,
  platform: Schema.optionalKey(InstallableArtifactVariant),
  checksum: Schema.optionalKey(Checksum),
  extra: Schema.optionalKey(ArtifactExtra)
}) {}

export const artifactPathBaseName = (pathName: string): string => {
  const parts = pathName.replaceAll("\\", "/").split("/")
  return parts[parts.length - 1] ?? pathName
}
