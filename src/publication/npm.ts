import { createHash } from "node:crypto"
import * as Effect from "effect/Effect"
import type { CredentialRequest, ResolvedAuthStrategy } from "../model/authority.js"
import { CredentialRequest as CredentialRequestSchema } from "../model/authority.js"
import { NonEmptyName } from "../model/primitives.js"
import type { PreparedNpmPublication } from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import type { CredentialGrant } from "./authority.js"
import type { HttpAuthorizerShape } from "./http.js"
import {
  ReleaseSubjectError,
  type ReleaseObservationContext,
  type ReleaseSubject
} from "./coordinator.js"
import {
  Conflict,
  Difference,
  InconclusiveObservation,
  PresentDifferent,
  ProviderBlocked,
  SafeReason,
  type MutationDecision,
  type Observation,
  type ProviderDecision
} from "./report.js"

const integrity = (bytes: Uint8Array): string =>
  `sha512-${createHash("sha512").update(bytes).digest("base64")}`

const shasum = (bytes: Uint8Array): string =>
  createHash("sha1").update(bytes).digest("hex")

const fingerprint = (value: string): SafeReason => SafeReason.make(
  `provider value sha256-${createHash("sha256").update(value).digest("hex")}`
)

const registryVersionUrl = (publication: PreparedNpmPublication): string =>
  `${publication.registryUrl}${encodeURIComponent(publication.packageName)}/${encodeURIComponent(publication.version)}`

const asObject = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined

const parseJson = (body: Uint8Array | string): unknown | undefined => {
  try {
    const text = typeof body === "string"
      ? body
      : new TextDecoder("utf-8", { fatal: true }).decode(body)
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined

const registryDigests = (
  value: unknown
): { readonly integrity?: string, readonly shasum?: string } | undefined => {
  const metadata = asObject(value)
  const dist = metadata === undefined ? undefined : asObject(metadata.dist)
  if (dist === undefined) return undefined
  const integrityValue = nonEmptyString(dist.integrity)
  const shasumValue = nonEmptyString(dist.shasum)
  return {
    ...(integrityValue === undefined ? {} : { integrity: integrityValue }),
    ...(shasumValue === undefined ? {} : { shasum: shasumValue })
  }
}

const observationRequests = (
  publication: PreparedNpmPublication
): readonly [CredentialRequest, ...Array<CredentialRequest>] => {
  const make = (strategy: ResolvedAuthStrategy): CredentialRequest => CredentialRequestSchema.make({
    subject: publication.authority.subject,
    provider: publication.authority.provider,
    audience: publication.authority.audience,
    purpose: "observe",
    strategy
  })
  const first = publication.authority.observationStrategies[0]!
  return [make(first), ...publication.authority.observationStrategies.slice(1).map(make)]
}

const mutationRequest = (publication: PreparedNpmPublication): CredentialRequest =>
  CredentialRequestSchema.make({
    subject: publication.authority.subject,
    provider: publication.authority.provider,
    audience: publication.authority.audience,
    purpose: "publish",
    strategy: publication.authority.publishStrategy
  })

const inconclusive = (
  publication: PreparedNpmPublication,
  reason: string
): InconclusiveObservation => InconclusiveObservation.make({
  subject: publication.authority.subject,
  reason: SafeReason.make(reason)
})

const difference = (field: "integrity" | "shasum", expected: string, observed: string): Difference =>
  Difference.make({
    field: NonEmptyName.make(field),
    expected: SafeReason.make(expected),
    observed: fingerprint(observed)
  })

const decide = (
  publication: PreparedNpmPublication,
  observation: Observation
): ProviderDecision => observation._tag === "PresentDifferent"
  ? Conflict.make({ subject: publication.authority.subject, differences: observation.differences })
  : ProviderBlocked.make({
    subject: publication.authority.subject,
    reason: SafeReason.make(
      "npm publication remains blocked until Plan 225 proves exact equivalence or authoritative absence."
    )
  })

const unsupportedMutation = (
  publication: PreparedNpmPublication,
  _decision: MutationDecision
): Effect.Effect<never, ReleaseSubjectError> => Effect.fail(new ReleaseSubjectError({
  subject: publication.authority.subject,
  phase: "mutate",
  commitment: "before-dispatch",
  reason: SafeReason.make(
    "npm mutation is unavailable until Plan 225 installs the certified publisher path."
  )
}))

/**
 * Plan-224 npm subject. Observation may prove a conflict, but Plan 225 owns
 * the evidence required to claim exact equivalence, absence, or mutation.
 */
export const makeNpmSubject = (
  bundle: PreparedBundle,
  publication: PreparedNpmPublication,
  http: HttpAuthorizerShape
): ReleaseSubject => {
  const bytes = bundle.blobs.get(publication.artifactId.toString())
  const expectedIntegrity = bytes === undefined ? undefined : integrity(bytes)
  const expectedShasum = bytes === undefined ? undefined : shasum(bytes)

  const observe = Effect.fn("NpmReleaseSubject.observe")(function*(
    grant: CredentialGrant,
    _context: ReleaseObservationContext
  ) {
    if (bytes === undefined || expectedIntegrity === undefined || expectedShasum === undefined) {
      return inconclusive(publication, "The exact prepared npm artifact bytes are unavailable.")
    }
    if (grant._tag === "WorkloadIdentity") {
      return yield* new ReleaseSubjectError({
        subject: publication.authority.subject,
        phase: "observe",
        commitment: "before-dispatch",
        reason: SafeReason.make("Workload identity cannot authorize npm metadata observation.")
      })
    }
    const response = yield* http.execute({
      subject: publication.authority.subject,
      method: "GET",
      url: registryVersionUrl(publication),
      headers: { accept: "application/json" }
    }, grant).pipe(Effect.mapError((cause) => new ReleaseSubjectError({
      subject: publication.authority.subject,
      phase: "observe",
      commitment: cause._tag === "CredentialPlatformError" ? cause.commitment : "before-dispatch",
      reason: SafeReason.make("npm metadata observation could not be completed by the host HTTP boundary.")
    })))

    if (response.status === 404) {
      return inconclusive(
        publication,
        "npm returned 404, which Plan 224 does not treat as authoritative package-version absence."
      )
    }
    if (response.status < 200 || response.status >= 300) {
      return inconclusive(publication, `npm metadata observation returned HTTP ${response.status}.`)
    }

    const facts = registryDigests(parseJson(response.body))
    if (facts === undefined) {
      return inconclusive(publication, "npm metadata was malformed or omitted its distribution object.")
    }

    const differences: Array<Difference> = []
    if (facts.integrity !== undefined && facts.integrity !== expectedIntegrity) {
      differences.push(difference("integrity", expectedIntegrity, facts.integrity))
    }
    if (facts.shasum !== undefined && facts.shasum !== expectedShasum) {
      differences.push(difference("shasum", expectedShasum, facts.shasum))
    }
    if (differences.length > 0) {
      return PresentDifferent.make({
        subject: publication.authority.subject,
        differences: differences as [Difference, ...Array<Difference>]
      })
    }
    if (facts.integrity === undefined || facts.shasum === undefined) {
      return inconclusive(publication, "npm metadata omitted either the sha512 integrity or sha1 shasum.")
    }
    return inconclusive(
      publication,
      "npm metadata digests look exact, but Plan 225 has not yet established complete equivalence evidence."
    )
  })

  return {
    id: publication.authority.subject,
    observationRequests: observationRequests(publication),
    mutationRequest: mutationRequest(publication),
    observe,
    decide: (observation) => decide(publication, observation),
    mutate: (decision) => unsupportedMutation(publication, decision)
  }
}
