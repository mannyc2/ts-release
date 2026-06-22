import * as Schema from "effect/Schema"

export type * from "../types/effect-internal.js"

export const ArtifactId = Schema.NonEmptyString
export type ArtifactId = typeof ArtifactId.Type

export const ArtifactFormat = Schema.Literals(["tarball", "zip", "file", "directory", "oci-image"])
export type ArtifactFormat = typeof ArtifactFormat.Type

export const ChecksumAlgorithm = Schema.Literals(["sha256", "sha512"])
export type ChecksumAlgorithm = typeof ChecksumAlgorithm.Type

export class Checksum extends Schema.Class<Checksum>("Checksum")({
  algorithm: ChecksumAlgorithm,
  value: Schema.String
}) {}

export class ArtifactIntent extends Schema.Class<ArtifactIntent>("ArtifactIntent")({
  id: ArtifactId,
  path: Schema.String,
  format: ArtifactFormat,
  consumers: Schema.Array(Schema.String),
  checksum: Schema.optionalKey(Checksum)
}) {}

export class ArtifactInventoryItem extends Schema.Class<ArtifactInventoryItem>("ArtifactInventoryItem")({
  id: ArtifactId,
  path: Schema.String,
  format: ArtifactFormat,
  consumers: Schema.Array(Schema.String),
  sizeBytes: Schema.Number,
  checksum: Schema.optionalKey(Checksum)
}) {}

export const artifactIntentOrder = (left: ArtifactIntent, right: ArtifactIntent): number =>
  left.id.localeCompare(right.id)

export const artifactInventoryOrder = (
  left: ArtifactInventoryItem,
  right: ArtifactInventoryItem
): number => left.id.localeCompare(right.id)
