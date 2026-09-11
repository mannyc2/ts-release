import * as Schema from "effect/Schema"
import * as Artifact from "effect-build/Artifact"
import * as Layout from "effect-build/Layout"
import * as Target from "effect-build/Target"

const Bytes = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Sha256 = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/))
const Mode = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 0o7777 }))
/** A portable name inside a Bundle: a normalized relative path without controls. */
export const LogicalName = Schema.String.check(
  Schema.makeFilter((name) => {
    if (name !== name.normalize("NFC")) return "logical names must be NFC"
    if ([...name].length > 1024) return "logical names are at most 1024 characters"
    if (/[\u0000-\u001f\u007f]/u.test(name)) return "logical names contain no control characters"
    return Layout.pathIssue(name)
  }),
)
/** The producer that wrote an artifact, without the tool's borrowed executable path. */
export const Producer = Schema.Struct({
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
  sha256: Schema.optionalKey(Sha256),
})
export type Producer = typeof Producer.Type

export class AdoptionError extends Schema.TaggedError<AdoptionError>()("AdoptionError", {
  reason: Schema.String,
}) {
  override get message() {
    return this.reason
  }
}
/** The identity of owned bytes: exact size and SHA-256. */
export class Content extends Schema.Class<Content>("ts-release/Content")({
  bytes: Bytes,
  sha256: Sha256,
}) {}
export class OwnedFile extends Schema.TaggedClass<OwnedFile>()("OwnedFile", {
  logicalName: LogicalName,
  content: Content,
  deliveryMode: Mode,
  executable: Schema.NullOr(
    Schema.Struct({ target: Target.Target, format: Schema.Literals(["elf", "mach-o", "pe"]) }),
  ),
  producedBy: Producer,
}) {}
/**
 * A directory artifact minus its borrowed path. `entries` are the upstream
 * `Artifact.Entry` records, `bytes` totals the file entries and `sha256` is the
 * upstream entry-manifest digest, so the tree keeps the identity effect-build gave it.
 */
export class OwnedTree extends Schema.TaggedClass<OwnedTree>()("OwnedTree", {
  logicalName: LogicalName,
  bytes: Bytes,
  sha256: Sha256,
  rootMode: Mode,
  entries: Schema.Array(Artifact.Entry),
  producedBy: Producer,
}) {}
export const OwnedArtifact = Schema.Union([OwnedFile, OwnedTree])
export type OwnedArtifact = typeof OwnedArtifact.Type
/** Bundle format 1 recorded effect-build 0.6 identities and cannot be loaded. */
export const BUNDLE_FORMAT = "ts-release/bundle/2"
export class OwnedBundle extends Schema.Class<OwnedBundle>("ts-release/Bundle")({
  format: Schema.Literal(BUNDLE_FORMAT),
  artifacts: Schema.Array(OwnedArtifact),
}) {}

/** The size and digest an owned artifact is verified against. */
export const identityOf = (artifact: OwnedArtifact): Content =>
  artifact._tag === "OwnedFile"
    ? artifact.content
    : new Content({ bytes: artifact.bytes, sha256: artifact.sha256 })
