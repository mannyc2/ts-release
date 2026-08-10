import * as Schema from "effect/Schema"
import { createHash } from "node:crypto"
import { encodeCanonicalJson, parseStrictJson } from "../model/canonical.js"
import { Digest, NonEmptyName, OutputId, SafeRelativePath, Version } from "../model/primitives.js"

const optional = Schema.optionalKey
const boundedText = Schema.String.check(Schema.makeFilter((value: string) =>
  [...value].length <= 2048 && [...value].every((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint === 9 || codePoint === 10 || codePoint === 13 || codePoint >= 0x20
  }) ? undefined : "Correction text must be bounded and contain no control characters."))
const publicMessage = boundedText.pipe(Schema.check(Schema.makeFilter((value: string) =>
  value.length > 0 ? undefined : "Correction message must be nonempty.")))
const sha256Hex = /^[a-f0-9]{64}$/u

export class ReplacementCoordinate extends Schema.Class<ReplacementCoordinate>("ReplacementCoordinate")({
  provider: Schema.Literals(["npm", "github", "catalog-git", "pypi"]), coordinate: publicMessage
}) {}

export class NpmDeprecationCorrection extends Schema.TaggedClass<NpmDeprecationCorrection>()("NpmDeprecationCorrection", {
  provider: Schema.Literal("npm"), publicationId: NonEmptyName, registryUrl: Schema.NonEmptyString,
  packageName: NonEmptyName, version: Version, tarballIntegrity: Schema.NonEmptyString,
  message: publicMessage, replacement: optional(ReplacementCoordinate)
}) {}

export class GithubReleaseCorrection extends Schema.TaggedClass<GithubReleaseCorrection>()("GithubReleaseCorrection", {
  provider: Schema.Literal("github"), publicationId: NonEmptyName, repository: Schema.NonEmptyString,
  tag: NonEmptyName, marker: publicMessage, replacement: optional(ReplacementCoordinate)
}) {}

export class CatalogCorrection extends Schema.TaggedClass<CatalogCorrection>()("CatalogCorrection", {
  provider: Schema.Literal("catalog-git"), publicationId: NonEmptyName, repository: Schema.NonEmptyString,
  branch: NonEmptyName, targetPath: SafeRelativePath, statePath: SafeRelativePath,
  artifactId: OutputId, stateArtifactId: OutputId, version: Version,
  status: Schema.Literals(["corrected", "withdrawn", "superseded"]), reason: publicMessage,
  replacement: optional(ReplacementCoordinate)
}) {}

export class PypiFileYankCorrection extends Schema.TaggedClass<PypiFileYankCorrection>()("PypiFileYankCorrection", {
  provider: Schema.Literal("pypi"), publicationId: NonEmptyName, indexUrl: Schema.NonEmptyString,
  project: NonEmptyName, version: Version, filename: NonEmptyName, fileDigest: Digest,
  reason: publicMessage, replacement: optional(ReplacementCoordinate)
}) {}

export const CorrectionVariant = Schema.Union([
  NpmDeprecationCorrection, GithubReleaseCorrection, CatalogCorrection, PypiFileYankCorrection
])
export type CorrectionVariant = typeof CorrectionVariant.Type

export class CorrectionIntentV1 extends Schema.Class<CorrectionIntentV1>("CorrectionIntentV1")({
  schemaVersion: Schema.Literal("correction-intent/v1"), preparedDigest: Digest,
  correction: CorrectionVariant, correctionId: Digest
}) {}
export type CorrectionIntent = typeof CorrectionIntentV1.Type
export type CorrectionIntentInput = Omit<CorrectionIntent, "correctionId">

export class CorrectionIntentError
  extends Schema.TaggedErrorClass<CorrectionIntentError>()("CorrectionIntentError", {
    reason: Schema.String
  }) {}

const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")
const normalizeCorrection = (value: unknown): CorrectionVariant => Schema.decodeUnknownSync(CorrectionVariant)(value)
const encodedCorrection = (value: CorrectionVariant): unknown => Schema.encodeSync(CorrectionVariant)(normalizeCorrection(value))
const unsignedValue = (value: CorrectionIntentInput): Record<string, unknown> => ({
  schemaVersion: value.schemaVersion,
  preparedDigest: value.preparedDigest,
  correction: encodedCorrection(value.correction)
})

export const correctionIdFor = (value: CorrectionIntentInput): Digest =>
  Digest.make(digest(new TextEncoder().encode(encodeCanonicalJson(unsignedValue(value)))))

export const makeCorrectionIntent = (value: CorrectionIntentInput): CorrectionIntent => {
  const correction = normalizeCorrection(value.correction)
  const normalized = { ...value, correction }
  const correctionId = correctionIdFor(normalized)
  return CorrectionIntentV1.make({ ...normalized, correctionId })
}

const equal = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

export const encodeCorrectionIntent = (value: CorrectionIntent): Uint8Array => {
  try {
    if (!sha256Hex.test(value.preparedDigest) || !sha256Hex.test(value.correctionId)) {
      throw new Error("Correction intent digests must be lowercase SHA-256 values.")
    }
    const expected = correctionIdFor(value)
    if (expected !== value.correctionId) throw new Error("Correction id does not match canonical intent bytes.")
    return new TextEncoder().encode(encodeCanonicalJson(Schema.encodeSync(CorrectionIntentV1)(value)))
  } catch (cause) {
    throw CorrectionIntentError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
  }
}

export const decodeCorrectionIntent = (bytes: Uint8Array): CorrectionIntent => {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const value = Schema.decodeUnknownSync(CorrectionIntentV1, { onExcessProperty: "error" })(parseStrictJson(text))
    const canonical = encodeCorrectionIntent(value)
    if (!equal(canonical, bytes)) throw new Error("Correction intent bytes are not canonical.")
    return value
  } catch (cause) {
    if (cause instanceof CorrectionIntentError) throw cause
    throw CorrectionIntentError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
  }
}
