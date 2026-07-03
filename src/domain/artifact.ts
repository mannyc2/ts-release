import * as Schema from "effect/Schema"

export type * from "../types/effect-internal.js"

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

export class ArtifactIntent extends Schema.Class<ArtifactIntent>("ArtifactIntent")({
  id: ArtifactId,
  path: Schema.String,
  downloadUrl: Schema.optionalKey(Schema.String),
  format: ArtifactFormat,
  consumers: Schema.Array(Schema.String),
  checksum: Schema.optionalKey(Checksum),
  variant: Schema.optionalKey(InstallableArtifactVariant)
}) {}

export class PyPiWheelBinaryArtifact extends Schema.Class<PyPiWheelBinaryArtifact>("PyPiWheelBinaryArtifact")({
  os: ArtifactOperatingSystem,
  arch: ArtifactArchitecture,
  sourcePath: Schema.String,
  wheelPath: Schema.String
}) {}

export class ArtifactInventoryItem extends Schema.Class<ArtifactInventoryItem>("ArtifactInventoryItem")({
  id: ArtifactId,
  path: Schema.String,
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
