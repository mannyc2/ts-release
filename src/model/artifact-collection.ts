import * as Schema from "effect/Schema"
import { encodeCanonicalJson } from "./canonical.js"
import { sha256Digest } from "./digest.js"
import { OperationId, OutputId, SafeRelativePath } from "./primitives.js"

export const ArtifactCollectionId = Schema.NonEmptyString.check(Schema.makeFilter((value: string) =>
  /^[A-Za-z0-9._-]+$/u.test(value)
    ? undefined
    : "Artifact collection id must be a portable ASCII identifier."
)).pipe(Schema.brand("ArtifactCollectionId"))
export type ArtifactCollectionId = typeof ArtifactCollectionId.Type

export const CollectionArtifactKind = Schema.Literals([
  "file",
  "executable",
  "archive",
  "digest"
])
export type CollectionArtifactKind = typeof CollectionArtifactKind.Type

export const ArtifactPathSuffix = Schema.NonEmptyString.check(Schema.makeFilter((value: string) =>
  /^\.[A-Za-z0-9._-]+$/u.test(value)
    ? undefined
    : "Artifact collection pathSuffix must be a canonical dot suffix without path separators."
)).pipe(Schema.brand("ArtifactPathSuffix"))
export type ArtifactPathSuffix = typeof ArtifactPathSuffix.Type

export const ArtifactCollectionRoot = SafeRelativePath.check(Schema.makeFilter((value: string) =>
  value !== "." && value.split("/").every((part) => /^[A-Za-z0-9._-]+$/u.test(part) && part !== "." && part !== "..")
    ? undefined
    : "Artifact collection root must be a canonical NFC POSIX subdirectory."
)).pipe(Schema.brand("ArtifactCollectionRoot"))
export type ArtifactCollectionRoot = typeof ArtifactCollectionRoot.Type

const nonNegativeInteger = Schema.Number.check(Schema.makeFilter((value: number) =>
  Number.isSafeInteger(value) && value >= 0
    ? undefined
    : "Collection cardinality bounds must be nonnegative safe integers."
))

export class OneArtifactCardinality
  extends Schema.Class<OneArtifactCardinality>("OneArtifactCardinality")({
    kind: Schema.Literal("one")
  }) {}

export class OneOrMoreArtifactCardinality
  extends Schema.Class<OneOrMoreArtifactCardinality>("OneOrMoreArtifactCardinality")({
    kind: Schema.Literal("one-or-more")
  }) {}

export class BoundedArtifactCardinality
  extends Schema.Class<BoundedArtifactCardinality>("BoundedArtifactCardinality")({
    kind: Schema.Literal("bounded"),
    minimum: nonNegativeInteger,
    maximum: nonNegativeInteger
  }) {}

const ArtifactCardinalityVariants = Schema.Union([
  OneArtifactCardinality,
  OneOrMoreArtifactCardinality,
  BoundedArtifactCardinality
])

export const ArtifactCardinality = ArtifactCardinalityVariants.pipe(Schema.check(
  Schema.makeFilter((value) => value.kind !== "bounded" || value.minimum <= value.maximum
    ? undefined
    : "Bounded collection cardinality minimum must not exceed maximum.")
))
export type ArtifactCardinality = typeof ArtifactCardinality.Type

/**
 * One command-owned dynamic output set. A collection intentionally permits one
 * artifact kind and one filename suffix: heterogeneous output sets must be
 * split into independently selectable contracts.
 */
export class ArtifactCollectionContract
  extends Schema.Class<ArtifactCollectionContract>("ArtifactCollectionContract")({
    id: ArtifactCollectionId,
    producer: OperationId,
    root: ArtifactCollectionRoot,
    artifactKind: CollectionArtifactKind,
    pathSuffix: ArtifactPathSuffix,
    mediaType: Schema.NonEmptyString,
    cardinality: ArtifactCardinality
  }) {}

/** A downstream requirement over a stable collection identity. */
export class ArtifactCollectionSelector
  extends Schema.Class<ArtifactCollectionSelector>("ArtifactCollectionSelector")({
    collection: ArtifactCollectionId,
    artifactKind: CollectionArtifactKind,
    pathSuffix: ArtifactPathSuffix,
    mediaType: Schema.NonEmptyString,
    cardinality: ArtifactCardinality
  }) {}

/** Exact runtime member identity persisted beside the prepared artifacts. */
export class ArtifactCollectionMember
  extends Schema.Class<ArtifactCollectionMember>("ArtifactCollectionMember")({
    key: SafeRelativePath,
    artifactId: OutputId
  }) {}

export interface CardinalityRange {
  readonly minimum: number
  readonly maximum?: number
}

export const cardinalityRange = (value: ArtifactCardinality): CardinalityRange => {
  switch (value.kind) {
    case "one": return { minimum: 1, maximum: 1 }
    case "one-or-more": return { minimum: 1 }
    case "bounded": return { minimum: value.minimum, maximum: value.maximum }
  }
}

export const cardinalityIssue = (value: ArtifactCardinality): string | undefined => {
  const range = cardinalityRange(value)
  return !Number.isSafeInteger(range.minimum) || range.minimum < 0 ||
      (range.maximum !== undefined && (!Number.isSafeInteger(range.maximum) || range.maximum < range.minimum))
    ? "Collection cardinality must define a valid nonnegative integer range."
    : undefined
}

/** Reject kind/media/suffix combinations whose observable claims conflict. */
export const collectionContractIssue = (
  value: Pick<ArtifactCollectionContract, "artifactKind" | "pathSuffix" | "mediaType">
): string | undefined => {
  const suffix = value.pathSuffix.toString()
  switch (value.artifactKind) {
    case "archive":
      if (value.mediaType === "application/zip" && suffix === ".zip") return undefined
      if (value.mediaType === "application/gzip" && [".gz", ".tgz", ".tar.gz"].includes(suffix)) return undefined
      return "Archive collections support application/zip with .zip or application/gzip with .gz, .tgz, or .tar.gz."
    case "digest":
      return value.mediaType === "text/plain" && [".sha256", ".sha512"].includes(suffix)
        ? undefined
        : "Digest collections require text/plain with .sha256 or .sha512."
    case "executable":
      return value.mediaType === "application/octet-stream"
        ? undefined
        : "Executable collections require application/octet-stream; executable mode is observed at capture."
    case "file":
      return value.mediaType === "application/zip" || value.mediaType === "application/gzip"
        ? "Archive media types require the archive artifact kind."
        : undefined
  }
}

/** Byte-level checks for the formats whose kind is portable and observable. */
export const collectionMemberBytesIssue = (
  contract: ArtifactCollectionContract,
  bytes: Uint8Array
): string | undefined => {
  if (contract.artifactKind === "archive") {
    if (contract.mediaType === "application/zip") {
      return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
          ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
            (bytes[2] === 0x05 && bytes[3] === 0x06) ||
            (bytes[2] === 0x07 && bytes[3] === 0x08))
        ? undefined
        : "declared ZIP member does not have a ZIP file signature"
    }
    if (contract.mediaType === "application/gzip") {
      return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08
        ? undefined
        : "declared gzip member does not have a gzip file signature"
    }
  }
  if (contract.artifactKind === "digest") {
    let text: string
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes) } catch {
      return "declared digest member is not UTF-8 text"
    }
    const digits = contract.pathSuffix === ".sha256" ? 64 : 128
    const rows = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n")
    return rows.length > 0 && rows.every((row) => new RegExp(`^[a-f0-9]{${digits}}  [^\\s/](?:.*[^\\s/])?$`, "u").test(row))
      ? undefined
      : `declared digest member does not contain canonical ${digits}-hex checksum rows`
  }
  return undefined
}

export const cardinalityAccepts = (value: ArtifactCardinality, count: number): boolean => {
  const range = cardinalityRange(value)
  return Number.isSafeInteger(count) && count >= range.minimum &&
    (range.maximum === undefined || count <= range.maximum)
}

export const cardinalitiesOverlap = (
  left: ArtifactCardinality,
  right: ArtifactCardinality
): boolean => {
  const a = cardinalityRange(left)
  const b = cardinalityRange(right)
  const maximum = a.maximum === undefined
    ? b.maximum
    : b.maximum === undefined
    ? a.maximum
    : Math.min(a.maximum, b.maximum)
  return maximum === undefined || Math.max(a.minimum, b.minimum) <= maximum
}

/** Paths discovered from directory entries must already be portable canon. */
export const normalizeCollectionMemberKey = (value: string): SafeRelativePath => {
  if (value.split("/").some((part) => !/^[A-Za-z0-9._-]+$/u.test(part) || part === "." || part === "..")) {
    throw new Error(`Collection member path ${JSON.stringify(value)} is not portable ASCII POSIX form.`)
  }
  return SafeRelativePath.make(value)
}

/**
 * Stable output identity is a digest of the declared producer/contract and the
 * normalized member key. No guessed runtime filename becomes graph authority.
 */
export const collectionMemberId = (
  contract: ArtifactCollectionContract,
  key: SafeRelativePath
): OutputId => OutputId.make(`collection-sha256-${sha256Digest(new TextEncoder().encode(
  encodeCanonicalJson({
    producer: contract.producer.toString(),
    collection: contract.id.toString(),
    root: contract.root.toString(),
    artifactKind: contract.artifactKind,
    pathSuffix: contract.pathSuffix.toString(),
    mediaType: contract.mediaType,
    cardinality: contract.cardinality.kind === "bounded"
      ? { kind: contract.cardinality.kind, minimum: contract.cardinality.minimum, maximum: contract.cardinality.maximum }
      : { kind: contract.cardinality.kind },
    key: key.toString()
  })
)).hex}`)

export const collectionMemberPath = (
  contract: ArtifactCollectionContract,
  key: SafeRelativePath
): SafeRelativePath => SafeRelativePath.make(`${contract.root}/${key}`)
