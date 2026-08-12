import * as Schema from "effect/Schema"
import { encodeCanonicalJson, parseStrictJson } from "../model/canonical.js"
import { Digest, NonEmptyName, OutputId, SafeRelativePath, Version } from "../model/primitives.js"
import {
  PublicationAuthorityIntent,
  githubPublicationAuthorityIssue,
  npmPublicationAuthorityIssue
} from "./graph.js"

const optional = Schema.optionalKey
const artifactKind = Schema.Literals([
  "file", "executable", "archive", "package", "wheel", "checksum-file", "catalog-file",
  "digest", "signature", "attestation", "sbom", "container-metadata", "notarized"
])

export class PreparedSource extends Schema.Class<PreparedSource>("PreparedSource")({
  commit: NonEmptyName, tree: NonEmptyName, clean: Schema.Literal(true),
  packageManifestPath: SafeRelativePath, packageManifestDigest: Digest
}) {}

export class PreparedProject extends Schema.Class<PreparedProject>("PreparedProject")({
  name: NonEmptyName, packageName: optional(NonEmptyName), version: Version, tag: NonEmptyName,
  repository: optional(Schema.NonEmptyString)
}) {}

export class PreparedArtifact extends Schema.Class<PreparedArtifact>("PreparedArtifact")({
  id: OutputId, path: SafeRelativePath, kind: artifactKind, size: Schema.Number.check(
    Schema.makeFilter((value: number) => Number.isSafeInteger(value) && value >= 0
      ? undefined : "Prepared artifact size must be a nonnegative safe integer.")
  ), digest: Digest, blob: Digest, mediaType: optional(Schema.NonEmptyString)
}) {}

export class PreparedNpmPublication extends Schema.TaggedClass<PreparedNpmPublication>()("PreparedNpmPublication", {
  id: NonEmptyName, packageName: NonEmptyName, version: Version, registryUrl: Schema.NonEmptyString,
  artifactId: OutputId, authority: PublicationAuthorityIntent
}) {}

export class PreparedGitHubAsset extends Schema.Class<PreparedGitHubAsset>("PreparedGitHubAsset")({
  artifactId: OutputId, name: Schema.NonEmptyString, mediaType: Schema.NonEmptyString
}) {}

export class PreparedGitHubPublication extends Schema.TaggedClass<PreparedGitHubPublication>()("PreparedGitHubPublication", {
  id: NonEmptyName, repository: Schema.NonEmptyString, tag: NonEmptyName, title: NonEmptyName,
  draft: Schema.Boolean, prerelease: Schema.Boolean, targetCommit: NonEmptyName, body: optional(Schema.String),
  assets: Schema.Array(PreparedGitHubAsset), authority: PublicationAuthorityIntent
}) {}

const PreparedPublicationVariants = Schema.Union([
  PreparedNpmPublication, PreparedGitHubPublication
])
export const PreparedPublication = PreparedPublicationVariants.pipe(Schema.check(
  Schema.makeFilter((publication) => publication._tag === "PreparedNpmPublication"
    ? npmPublicationAuthorityIssue(publication)
    : githubPublicationAuthorityIssue(publication))
))
export type PreparedPublication = typeof PreparedPublication.Type

export class PreparedReleaseV1 extends Schema.Class<PreparedReleaseV1>("PreparedReleaseV1")({
  schemaVersion: Schema.Literal("prepared-release/v1"), source: PreparedSource, project: PreparedProject,
  artifacts: Schema.Array(PreparedArtifact), publications: Schema.Array(PreparedPublication)
}) {}

export class PreparedManifestError
  extends Schema.TaggedErrorClass<PreparedManifestError>()("PreparedManifestError", {
    reason: Schema.String
  }) {}

export const encodePreparedRelease = (manifest: PreparedReleaseV1): Uint8Array =>
  new TextEncoder().encode(encodeCanonicalJson(Schema.encodeSync(PreparedReleaseV1)(manifest)))

export const decodePreparedRelease = (bytes: Uint8Array): PreparedReleaseV1 => {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const value = Schema.decodeUnknownSync(PreparedReleaseV1, { onExcessProperty: "error" })(parseStrictJson(text))
    const canonical = encodePreparedRelease(value)
    if (canonical.length !== bytes.length || canonical.some((byte, index) => byte !== bytes[index])) {
      throw new Error("manifest bytes are not canonical")
    }
    return value
  } catch (cause) {
    throw PreparedManifestError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
  }
}
