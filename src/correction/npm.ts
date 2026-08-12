import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { PreparedBundle } from "../release/prepared-store.js"
import type { PreparedNpmPublication } from "../release/prepared.js"
import {
  type Sha1Digest,
  type Sha512Digest,
  digestEquals,
  formatNpmSha1Shasum,
  formatNpmSha512Sri,
  parseNpmSha1Shasum,
  parseNpmSha512Sri,
  sha1Digest
} from "../model/digest.js"
import { NonEmptyName } from "../model/primitives.js"
import { authHeaders, bodyJson, type PublicationHttp } from "../publication/http.js"
import {
  Applied, Conflict, Equivalent, Inconclusive, NeedsMutation, ObservationDifference,
  OutcomeUnknown, PublicationError, Rejected, type MutationResult, type Observation,
  type PublicationCredentials, type PublicationSubject
} from "../publication/observation.js"
import type { NpmDeprecationCorrection } from "./intent.js"

export type NpmDeprecationRequest = {
  readonly registryUrl: string, readonly packageName: string, readonly version: string,
  readonly message: string, readonly credential: string
}
export type NpmDeprecationProcess = {
  readonly deprecate: (request: NpmDeprecationRequest) => Effect.Effect<{ readonly started: boolean, readonly exitCode: number }, PublicationError>
}

export class NpmCorrectionError
  extends Schema.TaggedErrorClass<NpmCorrectionError>()("NpmCorrectionError", { reason: Schema.String }) {}

type RegistryFacts = {
  readonly integrity?: Sha512Digest
  readonly shasum?: Sha1Digest
  readonly deprecated?: string
}
const registryFacts = (value: unknown): RegistryFacts | undefined => {
  if (typeof value !== "object" || value === null) return undefined
  const record = value as { readonly dist?: unknown, readonly deprecated?: unknown }
  if (record.deprecated !== undefined && typeof record.deprecated !== "string") return undefined
  if (typeof record.dist !== "object" || record.dist === null) return undefined
  const dist = record.dist as { readonly integrity?: unknown, readonly shasum?: unknown }
  if (dist.integrity !== undefined && typeof dist.integrity !== "string") return undefined
  if (dist.shasum !== undefined && typeof dist.shasum !== "string") return undefined
  if (dist.integrity === undefined && dist.shasum === undefined) return undefined
  try {
    return {
      ...(dist.integrity === undefined ? {} : { integrity: parseNpmSha512Sri(dist.integrity) }),
      ...(dist.shasum === undefined ? {} : { shasum: parseNpmSha1Shasum(dist.shasum) }),
      ...(record.deprecated === undefined ? {} : { deprecated: record.deprecated })
    }
  } catch {
    return undefined
  }
}
const versionUrl = (correction: NpmDeprecationCorrection): string =>
  `${correction.registryUrl.replace(/\/$/u, "")}/${encodeURIComponent(correction.packageName)}/${encodeURIComponent(correction.version)}`

export const makeNpmDeprecationSubject = (
  bundle: PreparedBundle, correction: NpmDeprecationCorrection, http: PublicationHttp,
  credentials: PublicationCredentials, process: NpmDeprecationProcess
): PublicationSubject => {
  const publication = bundle.manifest.publications.find((candidate): candidate is PreparedNpmPublication =>
    candidate._tag === "PreparedNpmPublication" && candidate.id === correction.publicationId &&
    candidate.registryUrl === correction.registryUrl && candidate.packageName === correction.packageName && candidate.version === correction.version)
  const artifact = publication === undefined ? undefined : bundle.manifest.artifacts.find((candidate) => candidate.id === publication.artifactId)
  const bytes = artifact === undefined ? undefined : bundle.blobs.get(artifact.id.toString())
  const subject = NonEmptyName.make(`npm:deprecate:${correction.registryUrl}:${correction.packageName}@${correction.version}`)
  const observe = (): Effect.Effect<Observation, PublicationError> => Effect.gen(function*() {
    if (publication === undefined || bytes === undefined) return yield* Effect.fail(new PublicationError({ phase: "observe", commitment: "before-dispatch", reason: "npm correction subject is not available in the prepared bundle." }))
    const response = yield* http.request({ method: "GET", url: versionUrl(correction), headers: authHeaders(credentials.read) })
    if (response.status === 404) return Inconclusive.make({ subject, reason: "npm correction target is absent; absence is not a durable correction state." })
    if (response.status < 200 || response.status >= 300) return Inconclusive.make({ subject, reason: `Registry correction observation returned HTTP ${response.status}.` })
    let facts: RegistryFacts | undefined
    try { facts = registryFacts(bodyJson(response)) } catch (cause) {
      return Inconclusive.make({ subject, reason: cause instanceof Error ? cause.message : String(cause) })
    }
    if (facts === undefined) return Inconclusive.make({ subject, reason: "Registry correction metadata was malformed or omitted integrity facts." })
    const differences: ObservationDifference[] = []
    const expectedShasum = sha1Digest(bytes)
    if (facts.integrity !== undefined && !digestEquals(facts.integrity, correction.tarballIntegrity)) {
      differences.push(ObservationDifference.make({
        field: NonEmptyName.make("integrity"),
        expected: formatNpmSha512Sri(correction.tarballIntegrity),
        observed: formatNpmSha512Sri(facts.integrity)
      }))
    }
    if (facts.shasum !== undefined && !digestEquals(facts.shasum, expectedShasum)) {
      differences.push(ObservationDifference.make({
        field: NonEmptyName.make("shasum"),
        expected: formatNpmSha1Shasum(expectedShasum),
        observed: formatNpmSha1Shasum(facts.shasum)
      }))
    }
    if (differences.length > 0) return Conflict.make({ subject, differences })
    if (facts.deprecated === correction.message) return Equivalent.make({ subject })
    if (facts.deprecated === undefined || facts.deprecated.length === 0) return NeedsMutation.make({ subject, precondition: NonEmptyName.make("deprecation-absent") })
    return Conflict.make({ subject, differences: [ObservationDifference.make({ field: NonEmptyName.make("deprecated"), expected: correction.message, observed: facts.deprecated })] })
  }).pipe(Effect.catchTag("PublicationError", (cause) => Effect.succeed(Inconclusive.make({ subject, reason: cause.reason }))))
  const mutate = (needs: import("../publication/observation.js").NeedsMutation): Effect.Effect<MutationResult, PublicationError> => Effect.gen(function*() {
    if (needs.precondition !== "deprecation-absent" || publication === undefined) return yield* new PublicationError({ phase: "mutate", commitment: "before-dispatch", reason: "npm correction lacks the exact empty-deprecation precondition." })
    const result = yield* process.deprecate({ registryUrl: correction.registryUrl, packageName: correction.packageName.toString(), version: correction.version.toString(), message: correction.message, credential: credentials.publish })
    if (!result.started) return Rejected.make({ subject, phase: "before-dispatch", reason: "npm deprecation process did not start." })
    return result.exitCode === 0 ? Applied.make({ subject, detail: "npm deprecation exited successfully." }) : Rejected.make({ subject, phase: "provider", reason: `npm deprecation exited ${result.exitCode}.` })
  }).pipe(Effect.catchTag("PublicationError", (cause) => cause.commitment === "before-dispatch"
    ? Effect.succeed<MutationResult>(Rejected.make({ subject, phase: "before-dispatch", reason: cause.reason }))
    : Effect.succeed<MutationResult>(OutcomeUnknown.make({ subject, reason: cause.reason })))) as Effect.Effect<MutationResult, PublicationError>
  return { id: subject, observe, mutate }
}
