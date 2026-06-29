import * as Schema from "effect/Schema"

export type * from "../types/effect-internal.js"

export const ArtifactId = Schema.NonEmptyString
export type ArtifactId = typeof ArtifactId.Type

export const ArtifactFormat = Schema.Literals(["tarball", "zip", "file", "directory", "oci-image"])
export type ArtifactFormat = typeof ArtifactFormat.Type

export const ChecksumAlgorithm = Schema.Literals(["sha256", "sha512"])
export type ChecksumAlgorithm = typeof ChecksumAlgorithm.Type

export const ArtifactRecipeId = Schema.NonEmptyString
export type ArtifactRecipeId = typeof ArtifactRecipeId.Type

export const BunExecutableCompileTarget = Schema.Literals([
  "bun-linux-x64",
  "bun-linux-x64-baseline",
  "bun-linux-x64-modern",
  "bun-linux-arm64",
  "bun-windows-x64",
  "bun-windows-x64-baseline",
  "bun-windows-x64-modern",
  "bun-windows-arm64",
  "bun-darwin-x64",
  "bun-darwin-x64-baseline",
  "bun-darwin-x64-modern",
  "bun-darwin-arm64",
  "bun-linux-x64-musl",
  "bun-linux-x64-baseline-musl",
  "bun-linux-x64-modern-musl",
  "bun-linux-arm64-musl"
])
export type BunExecutableCompileTarget = typeof BunExecutableCompileTarget.Type

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

export class BunExecutableArtifactOutput extends Schema.Class<BunExecutableArtifactOutput>(
  "BunExecutableArtifactOutput"
)({
  id: ArtifactId,
  target: BunExecutableCompileTarget,
  path: Schema.String,
  consumers: Schema.Array(Schema.String)
}) {}

export class BunExecutableArtifactRecipe extends Schema.TaggedClass<BunExecutableArtifactRecipe>()(
  "BunExecutableArtifactRecipe",
  {
    id: ArtifactRecipeId,
    entrypoint: Schema.String,
    outputs: Schema.Array(BunExecutableArtifactOutput),
    minify: Schema.optionalKey(Schema.Boolean)
  }
) {}

export const ArtifactRecipe = Schema.Union([BunExecutableArtifactRecipe])
export type ArtifactRecipe = typeof ArtifactRecipe.Type

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
