import { createHash } from "node:crypto"
import * as Effect from "effect/Effect"
import type { CredentialRequest, ResolvedAuthStrategy } from "../model/authority.js"
import { CredentialRequest as CredentialRequestSchema } from "../model/authority.js"
import { NonEmptyName } from "../model/primitives.js"
import type { PreparedGitHubPublication } from "../release/prepared.js"
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

interface ReleaseAssetFacts {
  readonly name?: string
  readonly size?: number
  readonly mediaType?: string
}

interface ReleaseFacts {
  readonly tag?: string
  readonly title?: string
  readonly body?: string
  readonly draft?: boolean
  readonly prerelease?: boolean
  readonly assets?: ReadonlyArray<ReleaseAssetFacts>
}

const asObject = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined

const asSize = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined

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

const parseAsset = (value: unknown): ReleaseAssetFacts => {
  const asset = asObject(value)
  if (asset === undefined) return {}
  const name = asString(asset.name)
  const size = asSize(asset.size)
  const mediaType = asString(asset.content_type)
  return {
    ...(name === undefined ? {} : { name }),
    ...(size === undefined ? {} : { size }),
    ...(mediaType === undefined ? {} : { mediaType })
  }
}

const parseRelease = (value: unknown): ReleaseFacts | undefined => {
  const release = asObject(value)
  if (release === undefined) return undefined
  const tag = asString(release.tag_name)
  const title = asString(release.name)
  const body = release.body === null ? "" : asString(release.body)
  const draft = asBoolean(release.draft)
  const prerelease = asBoolean(release.prerelease)
  const assets = Array.isArray(release.assets) ? release.assets.map(parseAsset) : undefined
  return {
    ...(tag === undefined ? {} : { tag }),
    ...(title === undefined ? {} : { title }),
    ...(body === undefined ? {} : { body }),
    ...(draft === undefined ? {} : { draft }),
    ...(prerelease === undefined ? {} : { prerelease }),
    ...(assets === undefined ? {} : { assets })
  }
}

const releaseUrl = (publication: PreparedGitHubPublication): string =>
  `${publication.authority.audience}/releases/tags/${encodeURIComponent(publication.tag)}`

const observationRequests = (
  publication: PreparedGitHubPublication
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

const mutationRequest = (publication: PreparedGitHubPublication): CredentialRequest =>
  CredentialRequestSchema.make({
    subject: publication.authority.subject,
    provider: publication.authority.provider,
    audience: publication.authority.audience,
    purpose: "publish",
    strategy: publication.authority.publishStrategy
  })

const valueFingerprint = (origin: "prepared" | "provider", value: string): SafeReason =>
  SafeReason.make(`${origin} value sha256-${createHash("sha256").update(value).digest("hex")}`)

const textDifference = (
  field: string,
  expected: string,
  observed: string
): Difference => Difference.make({
  field: NonEmptyName.make(field),
  expected: valueFingerprint("prepared", expected),
  observed: valueFingerprint("provider", observed)
})

const scalarDifference = (
  field: string,
  expected: boolean | number | string,
  observed: boolean | number | string
): Difference => Difference.make({
  field: NonEmptyName.make(field),
  expected: SafeReason.make(String(expected)),
  observed: SafeReason.make(String(observed))
})

const inconclusive = (
  publication: PreparedGitHubPublication,
  reason: string
): InconclusiveObservation => InconclusiveObservation.make({
  subject: publication.authority.subject,
  reason: SafeReason.make(reason)
})

const compareRelease = (
  bundle: PreparedBundle,
  publication: PreparedGitHubPublication,
  facts: ReleaseFacts
): ReadonlyArray<Difference> => {
  const differences: Array<Difference> = []
  const expectedBody = publication.body ?? ""
  if (facts.tag !== undefined && facts.tag !== publication.tag.toString()) {
    differences.push(textDifference("tag", publication.tag.toString(), facts.tag))
  }
  if (facts.title !== undefined && facts.title !== publication.title.toString()) {
    differences.push(textDifference("title", publication.title.toString(), facts.title))
  }
  if (facts.body !== undefined && facts.body !== expectedBody) {
    differences.push(textDifference("body", expectedBody, facts.body))
  }
  if (facts.draft !== undefined && facts.draft !== publication.draft) {
    differences.push(scalarDifference("draft", publication.draft, facts.draft))
  }
  if (facts.prerelease !== undefined && facts.prerelease !== publication.prerelease) {
    differences.push(scalarDifference("prerelease", publication.prerelease, facts.prerelease))
  }

  for (const [index, intended] of publication.assets.entries()) {
    const candidates = facts.assets?.filter((candidate) => candidate.name === intended.name) ?? []
    if (candidates.length > 1) {
      differences.push(scalarDifference(`asset[${index}].name-count`, 1, candidates.length))
      continue
    }
    const candidate = candidates[0]
    const bytes = bundle.blobs.get(intended.artifactId.toString())
    if (candidate === undefined || bytes === undefined) continue
    if (candidate.size !== undefined && candidate.size !== bytes.length) {
      differences.push(scalarDifference(`asset[${index}].size`, bytes.length, candidate.size))
    }
    if (candidate.mediaType !== undefined && candidate.mediaType !== intended.mediaType) {
      differences.push(textDifference(`asset[${index}].mediaType`, intended.mediaType, candidate.mediaType))
    }
  }
  return differences
}

const decide = (
  publication: PreparedGitHubPublication,
  observation: Observation
): ProviderDecision => observation._tag === "PresentDifferent"
  ? Conflict.make({ subject: publication.authority.subject, differences: observation.differences })
  : ProviderBlocked.make({
    subject: publication.authority.subject,
    reason: SafeReason.make(
      "GitHub publication remains blocked until Plan 226 proves exact equivalence or authoritative absence."
    )
  })

const unsupportedMutation = (
  publication: PreparedGitHubPublication,
  _decision: MutationDecision
): Effect.Effect<never, ReleaseSubjectError> => Effect.fail(new ReleaseSubjectError({
  subject: publication.authority.subject,
  phase: "mutate",
  commitment: "before-dispatch",
  reason: SafeReason.make(
    "GitHub mutation is unavailable until Plan 226 installs truthful release and asset wires."
  )
}))

/**
 * Plan-224 GitHub subject. The release and all intended assets are one exact
 * prepared subject; Plan 226 owns commit/digest truth and mutation wires.
 */
export const makeGithubSubjects = (
  bundle: PreparedBundle,
  publication: PreparedGitHubPublication,
  http: HttpAuthorizerShape
): readonly [ReleaseSubject] => {
  const observe = Effect.fn("GitHubReleaseSubject.observe")(function*(
    grant: CredentialGrant,
    _context: ReleaseObservationContext
  ) {
    if (grant._tag === "WorkloadIdentity") {
      return yield* new ReleaseSubjectError({
        subject: publication.authority.subject,
        phase: "observe",
        commitment: "before-dispatch",
        reason: SafeReason.make("Workload identity cannot authorize GitHub release observation.")
      })
    }
    const response = yield* http.execute({
      subject: publication.authority.subject,
      method: "GET",
      url: releaseUrl(publication),
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28"
      }
    }, grant).pipe(Effect.mapError((cause) => new ReleaseSubjectError({
      subject: publication.authority.subject,
      phase: "observe",
      commitment: cause._tag === "CredentialPlatformError" ? cause.commitment : "before-dispatch",
      reason: SafeReason.make("GitHub release observation could not be completed by the host HTTP boundary.")
    })))

    if (response.status === 404) {
      return inconclusive(
        publication,
        "GitHub returned 404, which Plan 224 does not treat as authoritative release absence."
      )
    }
    if (response.status < 200 || response.status >= 300) {
      return inconclusive(publication, `GitHub release observation returned HTTP ${response.status}.`)
    }
    const facts = parseRelease(parseJson(response.body))
    if (facts === undefined) {
      return inconclusive(publication, "The GitHub release response was malformed.")
    }
    const differences = compareRelease(bundle, publication, facts)
    if (differences.length > 0) {
      return PresentDifferent.make({
        subject: publication.authority.subject,
        differences: differences as [Difference, ...Array<Difference>]
      })
    }
    return inconclusive(
      publication,
      "GitHub release metadata looks exact, but Plan 226 has not yet established commit and asset digest truth."
    )
  })

  return [{
    id: publication.authority.subject,
    observationRequests: observationRequests(publication),
    mutationRequest: mutationRequest(publication),
    observe,
    decide: (observation) => decide(publication, observation),
    mutate: (decision) => unsupportedMutation(publication, decision)
  }]
}
