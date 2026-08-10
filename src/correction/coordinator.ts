import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { createHash } from "node:crypto"
import { encodeCanonicalJson } from "../model/canonical.js"
import { Digest } from "../model/primitives.js"
import { encodePreparedRelease } from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import { publishSubject, type PublicationOutcome, type PublicationSubject } from "../publication/observation.js"
import { encodeCorrectionIntent, type CatalogCorrection, type CorrectionIntent, type GithubReleaseCorrection, type NpmDeprecationCorrection, type PypiFileYankCorrection } from "./intent.js"

export class CorrectionValidationError
  extends Schema.TaggedErrorClass<CorrectionValidationError>()("CorrectionValidationError", {
    reason: Schema.String
  }) {}

export class CorrectionUnsupported extends Schema.TaggedClass<CorrectionUnsupported>()("CorrectionUnsupported", {
  provider: Schema.Literals(["github", "pypi"]), reason: Schema.String, evidence: Schema.NonEmptyString
}) {}

export type CorrectionOutcome = PublicationOutcome | CorrectionUnsupported

const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")
const preparedDigest = (bundle: PreparedBundle): Digest => Digest.make(digest(encodePreparedRelease(bundle.manifest)))
const findPublication = (bundle: PreparedBundle, id: string) => bundle.manifest.publications.find((publication) => publication.id.toString() === id)
const hasArtifact = (bundle: PreparedBundle, id: string): boolean => bundle.manifest.artifacts.some((artifact) => artifact.id.toString() === id)

const verifyNpm = (bundle: PreparedBundle, correction: NpmDeprecationCorrection): void => {
  const publication = findPublication(bundle, correction.publicationId.toString())
  if (publication?._tag !== "PreparedNpmPublication" || publication.registryUrl !== correction.registryUrl ||
    publication.packageName !== correction.packageName || publication.version !== correction.version) {
    throw new Error("npm correction subject is not the exact npm publication in the prepared manifest.")
  }
  const artifact = bundle.manifest.artifacts.find((candidate) => candidate.id === publication.artifactId)
  const bytes = artifact === undefined ? undefined : bundle.blobs.get(artifact.id.toString())
  if (bytes === undefined) throw new Error("npm correction subject has no verified prepared tarball.")
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`
  if (integrity !== correction.tarballIntegrity) throw new Error("npm correction tarball integrity is not the prepared artifact integrity.")
}

const verifyGithub = (bundle: PreparedBundle, correction: GithubReleaseCorrection): void => {
  const publication = findPublication(bundle, correction.publicationId.toString())
  if (publication?._tag !== "PreparedGitHubPublication" || publication.repository !== correction.repository || publication.tag !== correction.tag) {
    throw new Error("GitHub correction subject is not the exact GitHub publication in the prepared manifest.")
  }
}

const verifyCatalog = (bundle: PreparedBundle, correction: CatalogCorrection): void => {
  if (!hasArtifact(bundle, correction.artifactId.toString()) || !hasArtifact(bundle, correction.stateArtifactId.toString())) {
    throw new Error("Catalog correction subject does not reference two verified prepared artifacts.")
  }
}

const verifyPypi = (_bundle: PreparedBundle, _correction: PypiFileYankCorrection): void => {
  // The variant is retained as explicit policy evidence. No PyPI publication
  // shape exists in PreparedRelease, so the coordinator returns a typed
  // unsupported result after validating the canonical intent.
}

export const verifyCorrectionIntent = (bundle: PreparedBundle, intent: CorrectionIntent): void => {
  encodeCorrectionIntent(intent)
  if (preparedDigest(bundle) !== intent.preparedDigest) throw new Error("Correction intent is bound to a different prepared release.")
  switch (intent.correction._tag) {
    case "NpmDeprecationCorrection": return verifyNpm(bundle, intent.correction)
    case "GithubReleaseCorrection": return verifyGithub(bundle, intent.correction)
    case "CatalogCorrection": return verifyCatalog(bundle, intent.correction)
    case "PypiFileYankCorrection": return verifyPypi(bundle, intent.correction)
  }
}

const providerOf = (intent: CorrectionIntent): "npm" | "github" | "catalog-git" | "pypi" => intent.correction.provider

/**
 * The only correction entry point. Provider adapters are built at the host
 * boundary and must be passed as one already-bound subject. This keeps
 * credentials and transports out of the durable correction document.
 */
export const correctPreparedRelease = Effect.fn("correctPreparedRelease")(function*(input: {
  readonly bundle: PreparedBundle
  readonly intent: CorrectionIntent
  readonly subject?: PublicationSubject
}) {
  try {
    verifyCorrectionIntent(input.bundle, input.intent)
  } catch (cause) {
    return yield* Effect.fail(new CorrectionValidationError({ reason: cause instanceof Error ? cause.message : String(cause) }))
  }
  if (input.intent.correction._tag === "GithubReleaseCorrection") {
    return CorrectionUnsupported.make({ provider: "github", reason: "No durable, machine-readable GitHub withdrawal marker with a proven conditional update contract was admitted.", evidence: "docs/release-program/decisions/216-provider-correction.md" })
  }
  if (input.intent.correction._tag === "PypiFileYankCorrection") {
    return CorrectionUnsupported.make({ provider: "pypi", reason: "Per-file yank observation and mutation are not proven for arbitrary configured indexes.", evidence: "docs/release-program/decisions/216-provider-correction.md" })
  }
  if (input.subject === undefined) {
    return yield* Effect.fail(new CorrectionValidationError({ reason: `No provider-bound correction subject was supplied for ${providerOf(input.intent)}.` }))
  }
  return yield* publishSubject(input.subject)
})

export const correctionEvidenceProjection = (intent: CorrectionIntent): string =>
  encodeCanonicalJson({ correctionId: intent.correctionId, preparedDigest: intent.preparedDigest, provider: providerOf(intent) })
