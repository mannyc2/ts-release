import * as Schema from "effect/Schema"
import * as Artifact from "effect-build/Artifact"
import { SystemTarget } from "effect-build/SystemTarget"

const Decimal = Schema.String.check(Schema.isPattern(/^(0|[1-9][0-9]*)$/))
const Sha256 = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/))
export class AdoptionError extends Schema.TaggedError<AdoptionError>()("AdoptionError", {
  reason: Schema.String,
}) {
  override get message() {
    return this.reason
  }
}
export class Content extends Schema.Class<Content>("ts-release/Content")({
  bytes: Decimal,
  sha256: Sha256,
}) {}
export class OwnedFile extends Schema.TaggedClass<OwnedFile>()("OwnedFile", {
  logicalName: Artifact.PortableRelativePath,
  content: Content,
  deliveryMode: Artifact.FileModeSchema,
  executable: Schema.NullOr(
    Schema.Struct({
      nativeFormat: Schema.Literals(["elf", "mach-o", "pe"]),
      runtime: Schema.Struct({ name: Schema.NonEmptyString, version: Schema.NonEmptyString }),
      target: SystemTarget,
    }),
  ),
  provenance: Artifact.ProvenanceSchema,
}) {}
export class TreeFile extends Schema.TaggedClass<TreeFile>()("TreeFile", {
  relativePath: Artifact.PortableRelativePath,
  mode: Artifact.FileModeSchema,
  content: Content,
}) {}
export class TreeDirectory extends Schema.TaggedClass<TreeDirectory>()("TreeDirectory", {
  relativePath: Artifact.PortableRelativePath,
  mode: Artifact.FileModeSchema,
}) {}
export class TreeLink extends Schema.TaggedClass<TreeLink>()("TreeLink", {
  relativePath: Artifact.PortableRelativePath,
  target: Schema.String,
}) {}
export const MAX_BUFFERED_TREE_BYTES = 512n * 1024n * 1024n
export const MAX_TREE_ENTRIES = 100_000
export class OwnedTree extends Schema.TaggedClass<OwnedTree>()("OwnedTree", {
  logicalName: Artifact.PortableRelativePath,
  rootMode: Artifact.FileModeSchema,
  totalBytes: Decimal,
  upstreamManifestSha256: Sha256,
  entries: Schema.Array(Schema.Union([TreeFile, TreeDirectory, TreeLink])),
  provenance: Artifact.ProvenanceSchema,
}) {}
export const OwnedArtifact = Schema.Union([OwnedFile, OwnedTree])
export type OwnedArtifact = typeof OwnedArtifact.Type
export class OwnedBundle extends Schema.Class<OwnedBundle>("ts-release/Bundle")({
  format: Schema.Literal("ts-release/bundle/1"),
  artifacts: Schema.Array(OwnedArtifact),
}) {}
