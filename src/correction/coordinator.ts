import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { encodeCanonicalJson } from "../model/canonical.js"
import { digestEquals, parseSha256Hex, sha256Digest, sha512Digest } from "../model/digest.js"
import {
  PreparedCatalogDownload,
  compareCatalogVersions,
  decodeCatalogManagedState
} from "../model/catalog.js"
import {
  correctionKindOf,
  type CorrectionServices,
  type ProviderAdapter
} from "../publication/provider.js"
import type { ReleaseReport } from "../publication/report.js"
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
  type CatalogForwardCorrection,
  type GithubReleaseCorrection,
  type NpmDeprecationCorrection
} from "../model/correction-intent.js"
import { describeFailure } from "../model/decode.js"

export class CorrectionValidationError
  extends Schema.TaggedError<CorrectionValidationError>()("CorrectionValidationError", {
    reason: Schema.String
  }) {}

export class CorrectionUnsupported extends Schema.TaggedClass<CorrectionUnsupported>()("CorrectionUnsupported", {
  provider: Schema.NonEmptyString, reason: Schema.String, evidence: Schema.NonEmptyString,
  proposal: Schema.optionalKey(Schema.String)
}) {}

export interface CorrectionExecuted {
  readonly _tag: "CorrectionExecuted"
  readonly provider: string
  readonly report: ReleaseReport
  readonly reason: string
  readonly evidence: string
  readonly proposal: string
}

export type CorrectionOutcome = typeof CorrectionUnsupported.Type | CorrectionExecuted

const preparedDigest = (bundle: PreparedBundle) => sha256Digest(encodePreparedRelease(bundle.manifest))
const publicationBaselineDigest = (publication: PreparedPublicationType) => sha256Digest(
  new TextEncoder().encode(encodeCanonicalJson(Schema.encodeSync(PreparedPublication)(publication)))
)
const findPublication = (bundle: PreparedBundle, id: string) => bundle.manifest.publications.find((publication) => publication.id.toString() === id)

const choosePublication = <Tag extends "PreparedNpmPublication" | "PreparedGitHubPublication" | "PreparedCatalogPublication">(
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
      ? `Authored correction requires exactly one ${tag === "PreparedNpmPublication" ? "npm" : tag === "PreparedGitHubPublication" ? "GitHub" : "catalog Git"} publication; specify publicationId when more than one exists.`
      : `Authored correction publicationId ${publicationId} does not identify exactly one prepared ${tag === "PreparedNpmPublication" ? "npm" : tag === "PreparedGitHubPublication" ? "GitHub" : "catalog Git"} publication.`)
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
  if (authored.provider === "catalog-git") {
    const publication = choosePublication(bundle, "PreparedCatalogPublication", authored.publicationId)
    if (compareCatalogVersions(publication.version.toString(), authored.replacementVersion.toString()) >= 0) {
      throw new Error("Catalog correction replacementVersion must be SemVer-greater than the prepared generation.")
    }
    const expectedArchitectures = publication.renderer.downloads.map((download) => download.architecture).sort()
    const observedArchitectures = authored.downloads.map((download) => download.architecture).sort()
    if (new Set(observedArchitectures).size !== observedArchitectures.length ||
        expectedArchitectures.join("\n") !== observedArchitectures.join("\n")) {
      throw new Error("Catalog correction downloads must replace the exact prepared architecture set.")
    }
    const downloads = authored.downloads.map((download) => {
      const expectedUrl = `https://github.com/${publication.sourceRepository}/releases/download/${encodeURIComponent(authored.replacementTag)}/${encodeURIComponent(download.filename)}`
      if (download.url !== expectedUrl) {
        throw new Error("Catalog correction download URL must be the exact replacement GitHub release asset coordinate.")
      }
      return PreparedCatalogDownload.make({
        architecture: download.architecture,
        url: download.url,
        filename: download.filename,
        sha256: parseSha256Hex(download.sha256)
      })
    }) as [PreparedCatalogDownload, ...Array<PreparedCatalogDownload>]
    const target = bundle.blobs.get(publication.targetArtifactId.toString())
    const state = bundle.blobs.get(publication.stateArtifactId.toString())
    if (target === undefined || state === undefined ||
        !digestEquals(sha256Digest(target), publication.targetDigest) ||
        !digestEquals(sha256Digest(state), publication.stateDigest)) {
      throw new Error("Prepared catalog correction subject has no exact target/state baseline bytes.")
    }
    const managed = decodeCatalogManagedState(state)
    if (managed === undefined || managed.status !== "active" || managed.generation !== publication.version ||
        !digestEquals(managed.targetDigest, publication.targetDigest)) {
      throw new Error("Prepared catalog correction baseline is not one canonical active managed pair.")
    }
    return makeCorrectionIntent({
      schemaVersion: "correction-intent/v2",
      preparedDigest: digest,
      correction: {
        _tag: "CatalogForwardCorrection",
        provider: "catalog-git",
        publicationId: publication.id,
        baselineDigest: publicationBaselineDigest(publication),
        baselineTargetDigest: publication.targetDigest,
        baselineStateDigest: publication.stateDigest,
        replacementVersion: authored.replacementVersion,
        replacementTag: authored.replacementTag,
        downloads,
        reason: authored.reason
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

const verifyCatalog = (bundle: PreparedBundle, correction: CatalogForwardCorrection): void => {
  const publication = findPublication(bundle, correction.publicationId.toString())
  if (publication?._tag !== "PreparedCatalogPublication") {
    throw new Error("Catalog correction subject is not the exact catalog publication in the prepared manifest.")
  }
  if (!digestEquals(publicationBaselineDigest(publication), correction.baselineDigest) ||
      !digestEquals(publication.targetDigest, correction.baselineTargetDigest) ||
      !digestEquals(publication.stateDigest, correction.baselineStateDigest)) {
    throw new Error("Catalog correction baseline digest is not the exact prepared target/state publication.")
  }
  if (compareCatalogVersions(publication.version.toString(), correction.replacementVersion.toString()) >= 0) {
    throw new Error("Catalog correction is not a SemVer-forward replacement.")
  }
  const expectedArchitectures = publication.renderer.downloads.map((download) => download.architecture).sort().join("\n")
  const replacementArchitectures = correction.downloads.map((download) => download.architecture).sort().join("\n")
  if (expectedArchitectures !== replacementArchitectures) {
    throw new Error("Catalog correction replacement architecture set differs from the prepared renderer.")
  }
  for (const download of correction.downloads) {
    const expected = `https://github.com/${publication.sourceRepository}/releases/download/${encodeURIComponent(correction.replacementTag)}/${encodeURIComponent(download.filename)}`
    if (download.url !== expected) throw new Error("Catalog correction carries a foreign replacement download coordinate.")
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
    case "CatalogForwardCorrection": return verifyCatalog(bundle, intent.correction)
  }
}

/**
 * The only correction entry point, dispatched through the same composed
 * provider adapters as publication. A validated intent executes only through
 * an actually installed conditional correction on the registered adapter;
 * otherwise the adapter's registered evidence explains the refusal and the
 * intent becomes an exact external proposal, never a read-then-unconditional
 * mutation.
 */
export const correctPreparedRelease = Effect.fn("correctPreparedRelease")(function*(input: {
  readonly bundle: PreparedBundle
  readonly intent: CorrectionIntent
  readonly adapters: ReadonlyArray<ProviderAdapter>
  readonly services?: CorrectionServices
}) {
  try {
    verifyCorrectionIntent(input.bundle, input.intent)
  } catch (cause) {
    return yield* Effect.fail(new CorrectionValidationError({ reason: describeFailure(cause) }))
  }
  const provider = input.intent.correction.provider
  const adapter = input.adapters.find((candidate) => candidate.profile.provider === provider)
  if (adapter === undefined) {
    throw new Error(`No composed provider adapter is registered for correction provider ${provider}.`)
  }
  const evidence = adapter.profile.evidence.correctionSources[0]!
  const proposal = new TextDecoder().decode(encodeCorrectionIntent(input.intent))
  const kind = correctionKindOf(input.intent.correction)
  const installed = adapter.corrections.find((correction) => correction.kind === kind)
  if (installed === undefined) {
    return CorrectionUnsupported.make({
      provider,
      reason: adapter.profile.evidence.correctionFinding,
      evidence,
      proposal
    })
  }
  if (input.services === undefined) {
    return CorrectionUnsupported.make({
      provider,
      reason: `An installed ${kind} correction requires the host-owned credential and provider HTTP authority boundary.`,
      evidence,
      proposal
    })
  }
  const report = yield* installed.execute({
    bundle: input.bundle,
    correction: input.intent.correction,
    correctionId: input.intent.correctionId,
    services: input.services
  })
  return {
    _tag: "CorrectionExecuted",
    provider,
    report,
    reason: adapter.profile.evidence.correctionFinding,
    evidence,
    proposal: ""
  } as const
})

export const correctionEvidenceProjection = (intent: CorrectionIntent): string => {
  const encoded = Schema.encodeSync(CorrectionIntentV2)(intent)
  return encodeCanonicalJson({
    correctionId: encoded.correctionId,
    preparedDigest: encoded.preparedDigest,
    provider: intent.correction.provider
  })
}
