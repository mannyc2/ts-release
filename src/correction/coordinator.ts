import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { encodeCanonicalJson } from "../model/canonical.js"
import { digestEquals, sha256Digest, sha512Digest } from "../model/digest.js"
import {
  PreparedPublication,
  encodePreparedRelease,
  type PreparedPublication as PreparedPublicationType
} from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import {
  type AuthoredCorrection,
  CorrectionIntentV2,
  encodeCorrectionIntent,
  makeCorrectionIntent,
  type CorrectionIntent,
  type GithubReleaseCorrection,
  type NpmDeprecationCorrection
} from "./intent.js"

export class CorrectionValidationError
  extends Schema.TaggedErrorClass<CorrectionValidationError>()("CorrectionValidationError", {
    reason: Schema.String
  }) {}

export class CorrectionUnsupported extends Schema.TaggedClass<CorrectionUnsupported>()("CorrectionUnsupported", {
  provider: Schema.Literals(["npm", "github"]), reason: Schema.String, evidence: Schema.NonEmptyString,
  proposal: Schema.optionalKey(Schema.String)
}) {}

export type CorrectionOutcome = typeof CorrectionUnsupported.Type

const preparedDigest = (bundle: PreparedBundle) => sha256Digest(encodePreparedRelease(bundle.manifest))
const publicationBaselineDigest = (publication: PreparedPublicationType) => sha256Digest(
  new TextEncoder().encode(encodeCanonicalJson(Schema.encodeSync(PreparedPublication)(publication)))
)
const findPublication = (bundle: PreparedBundle, id: string) => bundle.manifest.publications.find((publication) => publication.id.toString() === id)

const choosePublication = <Tag extends "PreparedNpmPublication" | "PreparedGitHubPublication">(
  bundle: PreparedBundle,
  tag: Tag,
  publicationId?: { readonly toString: () => string }
): Extract<PreparedBundle["manifest"]["publications"][number], { readonly _tag: Tag }> => {
  const candidates = bundle.manifest.publications.filter((publication): publication is Extract<
    PreparedBundle["manifest"]["publications"][number],
    { readonly _tag: Tag }
  > => publication._tag === tag && (
    publicationId === undefined || publication.id.toString() === publicationId.toString()
  ))
  if (candidates.length !== 1) {
    throw new Error(publicationId === undefined
      ? `Authored correction requires exactly one ${tag === "PreparedNpmPublication" ? "npm" : "GitHub"} publication; specify publicationId when more than one exists.`
      : `Authored correction publicationId ${publicationId} does not identify exactly one prepared ${tag === "PreparedNpmPublication" ? "npm" : "GitHub"} publication.`)
  }
  return candidates[0]!
}

/** Resolve human intent only after the exact prepared bundle has been loaded. */
export const bindAuthoredCorrection = (
  bundle: PreparedBundle,
  authored: AuthoredCorrection
): CorrectionIntent => {
  const digest = preparedDigest(bundle)
  if (authored.provider === "npm") {
    const publication = choosePublication(bundle, "PreparedNpmPublication", authored.publicationId)
    const artifact = bundle.manifest.artifacts.find((candidate) => candidate.id === publication.artifactId)
    const bytes = artifact === undefined ? undefined : bundle.blobs.get(artifact.id.toString())
    if (bytes === undefined) throw new Error("Prepared npm correction subject has no verified tarball bytes.")
    return makeCorrectionIntent({
      schemaVersion: "correction-intent/v2",
      preparedDigest: digest,
      correction: {
        _tag: "NpmDeprecationCorrection",
        provider: "npm",
        publicationId: publication.id,
        registryUrl: publication.registryUrl,
        packageName: publication.packageName,
        version: publication.version,
        baselineDigest: publicationBaselineDigest(publication),
        tarballIntegrity: sha512Digest(bytes),
        message: authored.message,
        ...(authored.replacement === undefined ? {} : { replacement: authored.replacement })
      }
    })
  }
  const publication = choosePublication(bundle, "PreparedGitHubPublication", authored.publicationId)
  return makeCorrectionIntent({
    schemaVersion: "correction-intent/v2",
    preparedDigest: digest,
    correction: {
      _tag: "GithubReleaseCorrection",
      provider: "github",
      publicationId: publication.id,
      repository: publication.repository,
      tag: publication.tag,
      baselineDigest: publicationBaselineDigest(publication),
      marker: authored.message,
      ...(authored.replacement === undefined ? {} : { replacement: authored.replacement })
    }
  })
}

const verifyNpm = (bundle: PreparedBundle, correction: NpmDeprecationCorrection): void => {
  const publication = findPublication(bundle, correction.publicationId.toString())
  if (publication?._tag !== "PreparedNpmPublication" || publication.registryUrl !== correction.registryUrl ||
    publication.packageName !== correction.packageName || publication.version !== correction.version) {
    throw new Error("npm correction subject is not the exact npm publication in the prepared manifest.")
  }
  if (!digestEquals(publicationBaselineDigest(publication), correction.baselineDigest)) {
    throw new Error("npm correction baseline digest is not the exact prepared publication digest.")
  }
  const artifact = bundle.manifest.artifacts.find((candidate) => candidate.id === publication.artifactId)
  const bytes = artifact === undefined ? undefined : bundle.blobs.get(artifact.id.toString())
  if (bytes === undefined) throw new Error("npm correction subject has no verified prepared tarball.")
  const integrity = sha512Digest(bytes)
  if (!digestEquals(integrity, correction.tarballIntegrity)) {
    throw new Error("npm correction tarball integrity is not the prepared artifact integrity.")
  }
}

const verifyGithub = (bundle: PreparedBundle, correction: GithubReleaseCorrection): void => {
  const publication = findPublication(bundle, correction.publicationId.toString())
  if (publication?._tag !== "PreparedGitHubPublication" || publication.repository !== correction.repository || publication.tag !== correction.tag) {
    throw new Error("GitHub correction subject is not the exact GitHub publication in the prepared manifest.")
  }
  if (!digestEquals(publicationBaselineDigest(publication), correction.baselineDigest)) {
    throw new Error("GitHub correction baseline digest is not the exact prepared publication digest.")
  }
}

export const verifyCorrectionIntent = (bundle: PreparedBundle, intent: CorrectionIntent): void => {
  encodeCorrectionIntent(intent)
  if (!digestEquals(preparedDigest(bundle), intent.preparedDigest)) {
    throw new Error("Correction intent is bound to a different prepared release.")
  }
  switch (intent.correction._tag) {
    case "NpmDeprecationCorrection": return verifyNpm(bundle, intent.correction)
    case "GithubReleaseCorrection": return verifyGithub(bundle, intent.correction)
  }
}

const providerOf = (intent: CorrectionIntent): "npm" | "github" => intent.correction.provider

/**
 * The only correction entry point. Provider adapters are built at the host
 * boundary. Neither admitted provider currently exposes a conditional write
 * that protects the exact observed generation, so a validated intent becomes
 * an external proposal and never a read-then-unconditional mutation.
 */
export const correctPreparedRelease = Effect.fn("correctPreparedRelease")(function*(input: {
  readonly bundle: PreparedBundle
  readonly intent: CorrectionIntent
}) {
  try {
    verifyCorrectionIntent(input.bundle, input.intent)
  } catch (cause) {
    return yield* Effect.fail(new CorrectionValidationError({ reason: cause instanceof Error ? cause.message : String(cause) }))
  }
  const provider = providerOf(input.intent)
  return CorrectionUnsupported.make({
    provider,
    reason: provider === "npm"
      ? "npm exposes no proved conditional deprecation write for the observed package generation; use the exact external proposal instead."
      : "GitHub exposes no proved conditional release-metadata write for the observed release generation.",
    evidence: "docs/release-program/remediation/229-provider-recovery.md",
    proposal: new TextDecoder().decode(encodeCorrectionIntent(input.intent))
  })
})

export const correctionEvidenceProjection = (intent: CorrectionIntent): string => {
  const encoded = Schema.encodeSync(CorrectionIntentV2)(intent)
  return encodeCanonicalJson({
    correctionId: encoded.correctionId,
    preparedDigest: encoded.preparedDigest,
    provider: providerOf(intent)
  })
}
