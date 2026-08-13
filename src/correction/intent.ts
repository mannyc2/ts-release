import * as Schema from "effect/Schema"
import { encodeCanonicalJson, parseStrictJson } from "../model/canonical.js"
import {
  Sha256Digest,
  Sha256Hex,
  Sha512Digest,
  digestEquals,
  sha256Digest
} from "../model/digest.js"
import { NonEmptyName, Version } from "../model/primitives.js"
import { CatalogArchitecture, PreparedCatalogDownload } from "../model/catalog.js"

const optional = Schema.optionalKey
const boundedText = Schema.String.check(Schema.makeFilter((value: string) =>
  [...value].length <= 2048 && [...value].every((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint === 9 || codePoint === 10 || codePoint === 13 || codePoint >= 0x20
  }) ? undefined : "Correction text must be bounded and contain no control characters."))
const publicMessage = boundedText.pipe(Schema.check(Schema.makeFilter((value: string) =>
  value.length > 0 ? undefined : "Correction message must be nonempty.")))

export class ReplacementCoordinate extends Schema.Class<ReplacementCoordinate>("ReplacementCoordinate")({
  provider: Schema.Literals(["npm", "github"]), coordinate: publicMessage
}) {}

export class NpmDeprecationCorrection extends Schema.TaggedClass<NpmDeprecationCorrection>()("NpmDeprecationCorrection", {
  provider: Schema.Literal("npm"), publicationId: NonEmptyName, registryUrl: Schema.NonEmptyString,
  packageName: NonEmptyName, version: Version, baselineDigest: Sha256Digest, tarballIntegrity: Sha512Digest,
  message: publicMessage, replacement: optional(ReplacementCoordinate)
}) {}

export class GithubReleaseCorrection extends Schema.TaggedClass<GithubReleaseCorrection>()("GithubReleaseCorrection", {
  provider: Schema.Literal("github"), publicationId: NonEmptyName, repository: Schema.NonEmptyString,
  tag: NonEmptyName, baselineDigest: Sha256Digest, marker: publicMessage,
  replacement: optional(ReplacementCoordinate)
}) {}

export class CatalogForwardCorrection extends Schema.TaggedClass<CatalogForwardCorrection>()("CatalogForwardCorrection", {
  provider: Schema.Literal("catalog-git"),
  publicationId: NonEmptyName,
  baselineDigest: Sha256Digest,
  baselineTargetDigest: Sha256Digest,
  baselineStateDigest: Sha256Digest,
  replacementVersion: Version,
  replacementTag: NonEmptyName,
  downloads: Schema.NonEmptyArray(PreparedCatalogDownload),
  reason: publicMessage
}) {}

/** Human-authored correction request. Destination and immutable subject facts
 * are deliberately absent: they are derived from the loaded prepared bundle. */
export class AuthoredNpmDeprecation
  extends Schema.Class<AuthoredNpmDeprecation>("AuthoredNpmDeprecation")({
    provider: Schema.Literal("npm"),
    kind: Schema.Literal("deprecate"),
    publicationId: optional(NonEmptyName),
    message: publicMessage,
    replacement: optional(ReplacementCoordinate)
  }) {}

export class AuthoredGithubReleaseAmendment
  extends Schema.Class<AuthoredGithubReleaseAmendment>("AuthoredGithubReleaseAmendment")({
    provider: Schema.Literal("github"),
    kind: Schema.Literal("amend-release-metadata"),
    publicationId: optional(NonEmptyName),
    message: publicMessage,
    replacement: optional(ReplacementCoordinate)
  }) {}

export class AuthoredCatalogDownload extends Schema.Class<AuthoredCatalogDownload>("AuthoredCatalogDownload")({
  architecture: CatalogArchitecture,
  url: Schema.NonEmptyString,
  filename: NonEmptyName,
  sha256: Sha256Hex
}) {}

export class AuthoredCatalogForwardCorrection
  extends Schema.Class<AuthoredCatalogForwardCorrection>("AuthoredCatalogForwardCorrection")({
    provider: Schema.Literal("catalog-git"),
    kind: Schema.Literal("forward-catalog-state"),
    publicationId: optional(NonEmptyName),
    replacementVersion: Version,
    replacementTag: NonEmptyName,
    downloads: Schema.NonEmptyArray(AuthoredCatalogDownload),
    reason: publicMessage
  }) {}

export const AuthoredCorrection = Schema.Union([
  AuthoredNpmDeprecation,
  AuthoredGithubReleaseAmendment,
  AuthoredCatalogForwardCorrection
])
export type AuthoredCorrection = typeof AuthoredCorrection.Type

export const decodeAuthoredCorrection = Schema.decodeUnknownSync(AuthoredCorrection, {
  onExcessProperty: "error"
})

export const CorrectionVariant = Schema.Union([
  NpmDeprecationCorrection, GithubReleaseCorrection, CatalogForwardCorrection
])
export type CorrectionVariant = typeof CorrectionVariant.Type

const CorrectionIntentUnsignedV2 = Schema.Struct({
  schemaVersion: Schema.Literal("correction-intent/v2"),
  preparedDigest: Sha256Digest,
  correction: CorrectionVariant
})

export class CorrectionIntentV2 extends Schema.Class<CorrectionIntentV2>("CorrectionIntentV2")({
  schemaVersion: Schema.Literal("correction-intent/v2"), preparedDigest: Sha256Digest,
  correction: CorrectionVariant, correctionId: Sha256Digest
}) {}
export type CorrectionIntent = typeof CorrectionIntentV2.Type
export type CorrectionIntentInput = Omit<CorrectionIntent, "correctionId">

export class CorrectionIntentError
  extends Schema.TaggedErrorClass<CorrectionIntentError>()("CorrectionIntentError", {
    reason: Schema.String
  }) {}

const normalizeCorrection = (value: unknown): CorrectionVariant => Schema.decodeUnknownSync(CorrectionVariant)(value)
const normalizeUnsigned = (value: CorrectionIntentInput): CorrectionIntentInput =>
  Schema.decodeUnknownSync(CorrectionIntentUnsignedV2, { onExcessProperty: "error" })({
    schemaVersion: value.schemaVersion,
    preparedDigest: value.preparedDigest,
    correction: normalizeCorrection(value.correction)
  })

const unsignedBytes = (value: CorrectionIntentInput): Uint8Array => {
  const normalized = normalizeUnsigned(value)
  const encoded = Schema.encodeSync(CorrectionIntentUnsignedV2)(normalized)
  return new TextEncoder().encode(encodeCanonicalJson(encoded))
}

export const correctionIdFor = (value: CorrectionIntentInput): Sha256Digest =>
  sha256Digest(unsignedBytes(value))

export const makeCorrectionIntent = (value: CorrectionIntentInput): CorrectionIntent => {
  const normalized = normalizeUnsigned(value)
  const correctionId = correctionIdFor(normalized)
  return CorrectionIntentV2.make({ ...normalized, correctionId })
}

const equal = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

export const encodeCorrectionIntent = (value: CorrectionIntent): Uint8Array => {
  try {
    const normalized = Schema.decodeUnknownSync(CorrectionIntentV2, { onExcessProperty: "error" })(value)
    const expected = correctionIdFor(normalized)
    if (!digestEquals(expected, normalized.correctionId)) {
      throw new Error("Correction id does not match canonical unsigned V2 intent bytes.")
    }
    return new TextEncoder().encode(encodeCanonicalJson(Schema.encodeSync(CorrectionIntentV2)(normalized)))
  } catch (cause) {
    throw CorrectionIntentError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
  }
}

export const decodeCorrectionIntent = (bytes: Uint8Array): CorrectionIntent => {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const value = Schema.decodeUnknownSync(CorrectionIntentV2, { onExcessProperty: "error" })(parseStrictJson(text))
    const canonical = encodeCorrectionIntent(value)
    if (!equal(canonical, bytes)) throw new Error("Correction intent bytes are not canonical.")
    return value
  } catch (cause) {
    if (cause instanceof CorrectionIntentError) throw cause
    throw CorrectionIntentError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
  }
}
