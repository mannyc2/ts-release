import * as Schema from "effect/Schema"
import {
  Checksum,
  InstallableArtifactVariant
} from "../domain/artifact.js"

export type * from "../types/effect-internal.js"
export { Checksum, InstallableArtifactVariant }

export const ArtifactId = Schema.NonEmptyString
export type ArtifactId = typeof ArtifactId.Type

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

export const ArtifactExtra = Schema.Union([
  ExecutableExtra,
  ArchiveExtra,
  ChecksumFileExtra,
  CatalogFileExtra,
  PackageExtra,
  WheelExtra
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
