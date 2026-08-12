import * as Effect from "effect/Effect"
import type { CredentialRequest, ResolvedAuthStrategy } from "../model/authority.js"
import { CredentialRequest as CredentialRequestSchema } from "../model/authority.js"
import {
  digestEquals,
  formatGitHubSha256,
  formatSha256Hex,
  parseGitHubSha256,
  sha256Digest,
  type Sha256Digest
} from "../model/digest.js"
import { NonEmptyName } from "../model/primitives.js"
import type { PreparedGitHubPublication } from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import type {
  CredentialGrant,
  MutationCredentialGrant,
  PublisherOperation,
  ScopedSecret
} from "./authority.js"
import {
  ReleaseSubjectError,
  type ReleaseObservationContext,
  type ReleaseSubject
} from "./coordinator.js"
import type {
  AuthorizedMutationHttpShape,
  HttpAuthorizerShape,
  HttpResponse,
  MutationHttpRequest
} from "./http.js"
import {
  AbsenceBasis,
  Applied,
  AuthoritativelyAbsent,
  Conflict,
  CreateAuthorizationProof,
  Difference,
  InconclusiveObservation,
  MutationPrecondition,
  NeedsMutation,
  OutcomeUnknown,
  PresentDifferent,
  PresentEquivalent,
  ProviderAlreadyEquivalent,
  ProviderAuthorizedCreate,
  ProviderBlocked,
  ProviderMutationFact,
  ProviderRejectionFact,
  RejectedByProvider,
  SafeReason,
  VisibilityBasis,
  VisibilityPending,
  type MutationAttempt,
  type MutationDecision,
  type Observation,
  type ProviderDecision
} from "./report.js"
import { makeRecoveryCapabilityProfile } from "./recovery.js"

const githubApiVersion = "2022-11-28"
const githubJsonHeaders = {
  accept: "application/vnd.github+json",
  "x-github-api-version": githubApiVersion
} as const
const gitObjectSha = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u
const maximumTagDepth = 32
const maximumAssetPages = 1_000

/**
 * Timing values are policy bounds, not measured provider facts. They remain
 * ASSUMED/UNVERIFIED until an explicitly authorized live run records evidence.
 */
export const githubRecoveryCapabilityProfile = makeRecoveryCapabilityProfile({
  observation: "exact",
  authoritativeAbsence: "provider-specific",
  createAuthorization: "authenticated-namespace-and-unique-coordinate",
  replay: "coordinate-unique",
  identifierReuse: "reusable",
  correction: [],
  exposure: "persistent-to-consumers",
  historyRequirement: "optional-evidence",
  readConvergence: {
    contract: {
      _tag: "assumed",
      basis: "ASSUMED/UNVERIFIED: no authorized live mutation evidence establishes GitHub read-convergence timing."
    },
    observationRetry: {
      maxAttempts: 5,
      backoff: { baseMs: 1_000, factor: 2, capMs: 15_000 },
      totalBudgetMs: 60_000
    },
    retryEligible: "VisibilityPending | Inconclusive",
    exhaustion: "UncertainSubject with full trace"
  }
})

interface RepositoryFacts {
  readonly fullName: string
}

interface GitObjectFacts {
  readonly type: "commit" | "tag"
  readonly sha: string
}

interface ReleaseFacts {
  readonly id: number
  readonly tag: string
  readonly title: string
  readonly body: string
  readonly draft: boolean
  readonly prerelease: boolean
  readonly uploadUrl: string
}

interface ReleaseAssetFacts {
  readonly name: string
  readonly size: number
  readonly mediaType: string
  readonly state: "uploaded"
  readonly digest:
    | { readonly _tag: "Present", readonly value: Sha256Digest }
    | { readonly _tag: "Missing" }
    | { readonly _tag: "Malformed" }
  readonly apiUrl: string
}

type GithubMutationPlan =
  | {
    readonly _tag: "CreateRelease"
    readonly tagAbsent: boolean
  }
  | {
    readonly _tag: "UploadAssets"
    readonly releaseId: number
    readonly uploadUrl: string
    readonly assetIndexes: ReadonlyArray<number>
  }

type PageResult =
  | { readonly _tag: "Complete", readonly assets: ReadonlyArray<ReleaseAssetFacts> }
  | { readonly _tag: "Inconclusive", readonly reason: string }

const asObject = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined

const asNonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined

const asNonNegativeSize = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined

const asPositiveId = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined

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

const responseHeader = (response: HttpResponse, name: string): string | undefined => {
  const lower = name.toLowerCase()
  return Object.entries(response.headers).find(([candidate]) => candidate.toLowerCase() === lower)?.[1]
}

const repositoryFacts = (value: unknown): RepositoryFacts | undefined => {
  const object = asObject(value)
  const fullName = asNonEmptyString(object?.full_name)
  return fullName === undefined ? undefined : { fullName }
}

const gitObjectFacts = (value: unknown): GitObjectFacts | undefined => {
  const object = asObject(value)
  const type = object?.type
  const sha = asString(object?.sha)
  return (type !== "commit" && type !== "tag") || sha === undefined || !gitObjectSha.test(sha)
    ? undefined
    : { type, sha }
}

const parseRef = (
  value: unknown,
  expectedRef: string
): GitObjectFacts | undefined => {
  const object = asObject(value)
  return object?.ref !== expectedRef ? undefined : gitObjectFacts(object.object)
}

const parseTagObject = (
  value: unknown,
  expectedSha: string
): GitObjectFacts | undefined => {
  const object = asObject(value)
  return object?.sha !== expectedSha ? undefined : gitObjectFacts(object.object)
}

const releaseFacts = (value: unknown): ReleaseFacts | undefined => {
  const object = asObject(value)
  const id = asPositiveId(object?.id)
  const tag = asNonEmptyString(object?.tag_name)
  const title = asString(object?.name)
  const body = object?.body === null ? "" : asString(object?.body)
  const draft = asBoolean(object?.draft)
  const prerelease = asBoolean(object?.prerelease)
  const uploadUrl = asNonEmptyString(object?.upload_url)
  return id === undefined || tag === undefined || title === undefined || body === undefined ||
      draft === undefined || prerelease === undefined || uploadUrl === undefined
    ? undefined
    : { id, tag, title, body, draft, prerelease, uploadUrl }
}

const releaseAssetApiUrl = (
  publication: PreparedGitHubPublication,
  value: unknown
): string | undefined => {
  if (typeof value !== "string") return undefined
  const prefix = `${publication.authority.audience}/releases/assets/`
  const id = value.startsWith(prefix) ? value.slice(prefix.length) : ""
  return /^[1-9][0-9]*$/u.test(id) ? value : undefined
}

const releaseAssetDigest = (
  asset: Readonly<Record<string, unknown>>
): ReleaseAssetFacts["digest"] => {
  if (!Object.hasOwn(asset, "digest") || asset.digest === null) return { _tag: "Missing" }
  try {
    return { _tag: "Present", value: parseGitHubSha256(asset.digest) }
  } catch {
    return { _tag: "Malformed" }
  }
}

const releaseAssetFacts = (
  publication: PreparedGitHubPublication,
  value: unknown
): ReleaseAssetFacts | undefined => {
  const object = asObject(value)
  if (object === undefined) return undefined
  const name = asNonEmptyString(object.name)
  const size = asNonNegativeSize(object.size)
  const mediaType = asNonEmptyString(object.content_type)
  const apiUrl = releaseAssetApiUrl(publication, object.url)
  if (name === undefined || size === undefined || mediaType === undefined ||
    object.state !== "uploaded" || apiUrl === undefined) return undefined
  return {
    name,
    size,
    mediaType,
    state: "uploaded",
    digest: releaseAssetDigest(object),
    apiUrl
  }
}

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
  SafeReason.make(
    `${origin} value sha256-${formatSha256Hex(sha256Digest(new TextEncoder().encode(value)))}`
  )

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

const pending = (
  publication: PreparedGitHubPublication,
  detail: string
): VisibilityPending => VisibilityPending.make({
  subject: publication.authority.subject,
  expectation: SafeReason.make("The accepted GitHub mutation is expected to become exactly observable."),
  basis: VisibilityBasis.make({
    kind: NonEmptyName.make("github-read-convergence"),
    detail: SafeReason.make(detail)
  })
})

const absent = (
  publication: PreparedGitHubPublication,
  kind: string,
  detail: string
): AuthoritativelyAbsent => AuthoritativelyAbsent.make({
  subject: publication.authority.subject,
  basis: AbsenceBasis.make({
    kind: NonEmptyName.make(kind),
    detail: SafeReason.make(detail)
  })
})

const observationFailure = (
  publication: PreparedGitHubPublication,
  reason: string,
  commitment: "before-dispatch" | "unknown" = "unknown"
): ReleaseSubjectError => new ReleaseSubjectError({
  subject: publication.authority.subject,
  phase: "observe",
  commitment,
  reason: SafeReason.make(reason)
})

const mapObservationError = (
  publication: PreparedGitHubPublication,
  error: { readonly _tag: string, readonly commitment?: "before-dispatch" | "unknown" }
): ReleaseSubjectError => observationFailure(
  publication,
  "GitHub observation could not be completed by the host HTTP boundary.",
  error._tag === "CredentialPlatformError" ? error.commitment ?? "before-dispatch" : "before-dispatch"
)

const get = (
  publication: PreparedGitHubPublication,
  http: HttpAuthorizerShape,
  grant: Exclude<CredentialGrant, { readonly _tag: "WorkloadIdentity" }>,
  url: string,
  accept = "application/vnd.github+json"
): Effect.Effect<HttpResponse, ReleaseSubjectError> => http.execute({
  subject: publication.authority.subject,
  method: "GET",
  url,
  headers: { accept, "x-github-api-version": githubApiVersion }
}, grant).pipe(Effect.mapError((error) => mapObservationError(publication, error)))

const releaseUrl = (publication: PreparedGitHubPublication): string =>
  `${publication.authority.audience}/releases/tags/${encodeURIComponent(publication.tag)}`

const refUrl = (publication: PreparedGitHubPublication): string =>
  `${publication.authority.audience}/git/ref/tags/${encodeURIComponent(publication.tag)}`

const tagObjectUrl = (publication: PreparedGitHubPublication, sha: string): string =>
  `${publication.authority.audience}/git/tags/${sha}`

const assetsPageUrl = (
  publication: PreparedGitHubPublication,
  releaseId: number,
  page: number
): string => `${publication.authority.audience}/releases/${releaseId}/assets?per_page=100&page=${page}`

const linkNextUrl = (value: string | undefined): { readonly malformed: boolean, readonly url?: string } => {
  if (value === undefined) return { malformed: false }
  const matches = [...value.matchAll(/<([^>]+)>\s*;\s*rel="next"/gu)]
  if (matches.length > 1 || (/rel="next"/u.test(value) && matches.length !== 1)) return { malformed: true }
  const url = matches[0]?.[1]
  return url === undefined ? { malformed: false } : { malformed: false, url }
}

const listAllAssets = Effect.fn("GitHubReleaseSubject.listAllAssets")(function*(
  publication: PreparedGitHubPublication,
  http: HttpAuthorizerShape,
  grant: Exclude<CredentialGrant, { readonly _tag: "WorkloadIdentity" }>,
  releaseId: number
) {
  const assets: Array<ReleaseAssetFacts> = []
  let page = 1
  while (page <= maximumAssetPages) {
    const expectedUrl = assetsPageUrl(publication, releaseId, page)
    const response = yield* get(publication, http, grant, expectedUrl)
    if (response.status !== 200) {
      return { _tag: "Inconclusive", reason: `GitHub asset enumeration returned HTTP ${response.status}.` } satisfies PageResult
    }
    const raw = parseJson(response.body)
    if (!Array.isArray(raw)) {
      return { _tag: "Inconclusive", reason: "A GitHub asset page was malformed." } satisfies PageResult
    }
    const parsed = raw.map((value) => releaseAssetFacts(publication, value))
    if (parsed.some((value) => value === undefined)) {
      return {
        _tag: "Inconclusive",
        reason: "A GitHub asset page omitted or malformed an exact asset identity fact."
      } satisfies PageResult
    }
    assets.push(...parsed as Array<ReleaseAssetFacts>)
    const next = linkNextUrl(responseHeader(response, "link"))
    if (next.malformed) {
      return { _tag: "Inconclusive", reason: "GitHub asset pagination metadata was malformed." } satisfies PageResult
    }
    const computedNext = assetsPageUrl(publication, releaseId, page + 1)
    if (next.url !== undefined && next.url !== computedNext) {
      return {
        _tag: "Inconclusive",
        reason: "GitHub asset pagination left the exact prepared repository scope or skipped a page."
      } satisfies PageResult
    }
    if (next.url === undefined && raw.length < 100) {
      return { _tag: "Complete", assets } satisfies PageResult
    }
    page += 1
  }
  return {
    _tag: "Inconclusive",
    reason: "GitHub asset pagination exceeded the bounded full-enumeration limit."
  } satisfies PageResult
})

const compareReleaseMetadata = (
  publication: PreparedGitHubPublication,
  facts: ReleaseFacts
): ReadonlyArray<Difference> => {
  const differences: Array<Difference> = []
  if (facts.tag !== publication.tag.toString()) {
    differences.push(textDifference("release.tag", publication.tag.toString(), facts.tag))
  }
  if (facts.title !== publication.title.toString()) {
    differences.push(textDifference("release.title", publication.title.toString(), facts.title))
  }
  const expectedBody = publication.body ?? ""
  if (facts.body !== expectedBody) differences.push(textDifference("release.body", expectedBody, facts.body))
  if (facts.draft !== publication.draft) {
    differences.push(scalarDifference("release.draft", publication.draft, facts.draft))
  }
  if (facts.prerelease !== publication.prerelease) {
    differences.push(scalarDifference("release.prerelease", publication.prerelease, facts.prerelease))
  }
  return differences
}

const validateUploadUrl = (
  publication: PreparedGitHubPublication,
  releaseId: number,
  value: string
): boolean => value ===
  `https://uploads.github.com/repos/${publication.repository}/releases/${releaseId}/assets{?name,label}`

const presentDifferent = (
  publication: PreparedGitHubPublication,
  differences: ReadonlyArray<Difference>
): PresentDifferent => PresentDifferent.make({
  subject: publication.authority.subject,
  differences: differences as [Difference, ...Array<Difference>]
})

const decideFor = (
  publication: PreparedGitHubPublication,
  observation: Observation,
  plan: GithubMutationPlan | undefined
): ProviderDecision => {
  switch (observation._tag) {
    case "PresentEquivalent":
      return ProviderAlreadyEquivalent.make({ subject: publication.authority.subject })
    case "PresentDifferent":
      return Conflict.make({ subject: publication.authority.subject, differences: observation.differences })
    case "AuthoritativelyAbsent":
      if (plan?._tag === "CreateRelease" && plan.tagAbsent) {
        return ProviderAuthorizedCreate.make({
          subject: publication.authority.subject,
          proof: CreateAuthorizationProof.make({
            kind: NonEmptyName.make("github-authenticated-repository-and-unique-tag")
          })
        })
      }
      if (plan?._tag === "CreateRelease") {
        return NeedsMutation.make({
          subject: publication.authority.subject,
          precondition: MutationPrecondition.make({
            kind: NonEmptyName.make("github-release-absent-at-exact-tag")
          })
        })
      }
      if (plan?._tag === "UploadAssets") {
        return NeedsMutation.make({
          subject: publication.authority.subject,
          precondition: MutationPrecondition.make({
            kind: NonEmptyName.make("github-intended-assets-authoritatively-absent")
          })
        })
      }
      return ProviderBlocked.make({
        subject: publication.authority.subject,
        reason: SafeReason.make("GitHub absence carried no exact mutation plan.")
      })
    case "VisibilityPending":
    case "Inconclusive":
      return ProviderBlocked.make({
        subject: publication.authority.subject,
        reason: SafeReason.make("GitHub publication truth is not yet conclusive enough to mutate.")
      })
  }
}

const mutationFailure = (
  publication: PreparedGitHubPublication,
  reason: string,
  commitment: "before-dispatch" | "unknown" = "before-dispatch"
): ReleaseSubjectError => new ReleaseSubjectError({
  subject: publication.authority.subject,
  phase: "mutate",
  commitment,
  reason: SafeReason.make(reason)
})

const unknownAttempt = (
  publication: PreparedGitHubPublication,
  reason: string
): OutcomeUnknown => OutcomeUnknown.make({
  subject: publication.authority.subject,
  reason: SafeReason.make(reason)
})

const rejectedAttempt = (
  publication: PreparedGitHubPublication,
  status: 401 | 403
): RejectedByProvider => RejectedByProvider.make({
  subject: publication.authority.subject,
  fact: ProviderRejectionFact.make({
    subject: publication.authority.subject,
    code: NonEmptyName.make(`github-http-${status}`),
    detail: SafeReason.make("GitHub conclusively rejected the mutation request before accepting this subject's first write.")
  })
})

const appliedAttempt = (publication: PreparedGitHubPublication): Applied => Applied.make({
  subject: publication.authority.subject,
  fact: ProviderMutationFact.make({
    subject: publication.authority.subject,
    detail: SafeReason.make("GitHub accepted the release mutation and every planned asset upload.")
  })
})

type MutationExchange =
  | { readonly _tag: "Response", readonly response: HttpResponse }
  | {
    readonly _tag: "Failure"
    readonly error: { readonly _tag: string, readonly commitment?: "before-dispatch" | "unknown" }
  }

const executeMutation = (
  mutationHttp: AuthorizedMutationHttpShape,
  operation: PublisherOperation,
  request: MutationHttpRequest,
  grant: ScopedSecret
): Effect.Effect<MutationExchange> => mutationHttp.execute(operation, request, grant).pipe(
  Effect.map((response) => ({ _tag: "Response", response } as const)),
  Effect.catch((error) => Effect.succeed({ _tag: "Failure", error } as const))
)

const uploadRequest = (
  publication: PreparedGitHubPublication,
  uploadUrl: string,
  index: number,
  bytes: Uint8Array
): MutationHttpRequest => {
  const asset = publication.assets[index]!
  const template = "{?name,label}"
  const expanded = `${uploadUrl.slice(0, -template.length)}?name=${encodeURIComponent(asset.name)}`
  return {
    method: "POST",
    url: expanded,
    headers: {
      ...githubJsonHeaders,
      "content-type": asset.mediaType,
      "content-length": String(bytes.length)
    },
    body: bytes
  }
}

/**
 * The exact tag ref and recursively peeled commit are established before the
 * release endpoint can contribute any equality or absence fact. Release
 * target_commitish is intentionally ignored: GitHub does not make it a stable
 * equality fact for a release whose tag already exists.
 */
export const makeGithubSubjects = (
  bundle: PreparedBundle,
  publication: PreparedGitHubPublication,
  http: HttpAuthorizerShape,
  mutationHttp: AuthorizedMutationHttpShape
): readonly [ReleaseSubject] => {
  let mutationPlan: GithubMutationPlan | undefined

  const observe = Effect.fn("GitHubReleaseSubject.observe")(function*(
    grant: CredentialGrant,
    context: ReleaseObservationContext
  ) {
    mutationPlan = undefined
    const mutationMayStillBecomeVisible = context.phase === "post-mutation" &&
      context.attempt._tag !== "RejectedBeforeDispatch" &&
      context.attempt._tag !== "RejectedByProvider"
    if (grant._tag === "WorkloadIdentity") {
      return yield* observationFailure(
        publication,
        "Workload identity cannot authorize GitHub release observation.",
        "before-dispatch"
      )
    }
    const targetCommit = publication.targetCommit.toString()
    if (!gitObjectSha.test(targetCommit)) {
      return inconclusive(publication, "The prepared GitHub target commit is not a canonical full Git object identifier.")
    }
    const intendedNames = publication.assets.map((asset) => asset.name)
    if (new Set(intendedNames).size !== intendedNames.length) {
      return inconclusive(publication, "The prepared GitHub release repeats an asset name and cannot define an exact set.")
    }
    if (publication.assets.some((asset) => bundle.blobs.get(asset.artifactId.toString()) === undefined)) {
      return inconclusive(publication, "The prepared GitHub release is missing exact bytes for an intended asset.")
    }

    const repositoryResponse = yield* get(publication, http, grant, publication.authority.audience)
    if (repositoryResponse.status !== 200) {
      return inconclusive(publication, `GitHub repository visibility returned HTTP ${repositoryResponse.status}.`)
    }
    const repository = repositoryFacts(parseJson(repositoryResponse.body))
    if (repository === undefined || repository.fullName !== publication.repository) {
      return inconclusive(publication, "GitHub repository visibility did not establish the exact prepared repository coordinate.")
    }

    const referenceResponse = yield* get(publication, http, grant, refUrl(publication))
    if (referenceResponse.status === 404) {
      if (grant._tag === "AnonymousAccess") {
        return inconclusive(publication, "Anonymous GitHub tag absence cannot authorize creation in the prepared namespace.")
      }
      const danglingRelease = yield* get(publication, http, grant, releaseUrl(publication))
      if (danglingRelease.status === 200) {
        return presentDifferent(publication, [scalarDifference("tag.exists", true, false)])
      }
      if (danglingRelease.status !== 404) {
        return inconclusive(publication, `GitHub release observation returned HTTP ${danglingRelease.status}.`)
      }
      if (mutationMayStillBecomeVisible) {
        return pending(publication, "The exact GitHub tag and release are not visible after the accepted mutation.")
      }
      mutationPlan = { _tag: "CreateRelease", tagAbsent: true }
      return absent(
        publication,
        "github-authenticated-tag-and-release-absent",
        "Authenticated exact-repository reads found neither the prepared tag nor its release coordinate."
      )
    }
    if (referenceResponse.status !== 200) {
      return inconclusive(publication, `GitHub tag-ref observation returned HTTP ${referenceResponse.status}.`)
    }
    let object = parseRef(parseJson(referenceResponse.body), `refs/tags/${publication.tag}`)
    if (object === undefined) {
      return inconclusive(publication, "The GitHub tag-ref response was malformed or named a different ref.")
    }
    const visited = new Set<string>()
    for (let depth = 0; object.type === "tag"; depth += 1) {
      if (depth >= maximumTagDepth || visited.has(object.sha)) {
        return inconclusive(publication, "The GitHub annotated-tag chain was cyclic or exceeded its bounded peel depth.")
      }
      visited.add(object.sha)
      const tagResponse = yield* get(publication, http, grant, tagObjectUrl(publication, object.sha))
      if (tagResponse.status !== 200) {
        return inconclusive(publication, `GitHub annotated-tag observation returned HTTP ${tagResponse.status}.`)
      }
      const peeled = parseTagObject(parseJson(tagResponse.body), object.sha)
      if (peeled === undefined) {
        return inconclusive(publication, "A GitHub annotated-tag object was malformed or changed identity while peeling.")
      }
      object = peeled
    }
    if (object.sha !== targetCommit) {
      return presentDifferent(publication, [textDifference("tag.commit", targetCommit, object.sha)])
    }

    const releaseResponse = yield* get(publication, http, grant, releaseUrl(publication))
    if (releaseResponse.status === 404) {
      if (grant._tag === "AnonymousAccess") {
        return inconclusive(publication, "Anonymous GitHub release absence may hide a draft release and is not authoritative.")
      }
      if (mutationMayStillBecomeVisible) {
        return pending(publication, "The exact GitHub release is not yet visible after the accepted mutation.")
      }
      mutationPlan = { _tag: "CreateRelease", tagAbsent: false }
      return absent(
        publication,
        "github-authenticated-release-absent",
        "Authenticated exact-repository reads found the prepared tag but no release at that tag."
      )
    }
    if (releaseResponse.status !== 200) {
      return inconclusive(publication, `GitHub release observation returned HTTP ${releaseResponse.status}.`)
    }
    const release = releaseFacts(parseJson(releaseResponse.body))
    if (release === undefined || !validateUploadUrl(publication, release.id, release.uploadUrl)) {
      return inconclusive(publication, "The GitHub release response omitted identity facts or carried an invalid repository-scoped upload template.")
    }
    const releaseDifferences = compareReleaseMetadata(publication, release)
    if (releaseDifferences.length > 0) return presentDifferent(publication, releaseDifferences)

    const listed = yield* listAllAssets(publication, http, grant, release.id)
    if (listed._tag === "Inconclusive") return inconclusive(publication, listed.reason)
    const assetsByName = new Map<string, Array<ReleaseAssetFacts>>()
    for (const asset of listed.assets) {
      const candidates = assetsByName.get(asset.name) ?? []
      candidates.push(asset)
      assetsByName.set(asset.name, candidates)
    }
    const differences: Array<Difference> = []
    for (const [name, candidates] of assetsByName) {
      if (!intendedNames.includes(name)) {
        differences.push(textDifference("assets.extra-name", "no undeclared asset", name))
      }
      if (candidates.length > 1) {
        differences.push(scalarDifference(`asset.${name}.count`, 1, candidates.length))
      }
    }
    const missingIndexes: Array<number> = []
    const downloads: Array<{ readonly index: number, readonly facts: ReleaseAssetFacts, readonly expected: Sha256Digest }> = []
    for (const [index, intended] of publication.assets.entries()) {
      const candidates = assetsByName.get(intended.name) ?? []
      if (candidates.length === 0) {
        missingIndexes.push(index)
        continue
      }
      if (candidates.length !== 1) continue
      const observed = candidates[0]!
      const bytes = bundle.blobs.get(intended.artifactId.toString())!
      if (observed.size !== bytes.length) {
        differences.push(scalarDifference(`asset.${intended.name}.size`, bytes.length, observed.size))
      }
      if (observed.mediaType !== intended.mediaType) {
        differences.push(textDifference(`asset.${intended.name}.mediaType`, intended.mediaType, observed.mediaType))
      }
      const expected = sha256Digest(bytes)
      if (observed.digest._tag === "Malformed") {
        return inconclusive(publication, "A GitHub asset carried a malformed canonical sha256 digest.")
      }
      if (observed.digest._tag === "Missing") {
        downloads.push({ index, facts: observed, expected })
      } else if (!digestEquals(observed.digest.value, expected)) {
        differences.push(textDifference(
          `asset.${intended.name}.digest`,
          formatGitHubSha256(expected),
          formatGitHubSha256(observed.digest.value)
        ))
      }
    }
    if (differences.length > 0) return presentDifferent(publication, differences)
    for (const download of downloads) {
      const response = yield* get(
        publication,
        http,
        grant,
        download.facts.apiUrl,
        "application/octet-stream"
      ).pipe(
        Effect.map((result) => ({ _tag: "Response", result } as const)),
        Effect.catch(() => Effect.succeed({ _tag: "Unavailable" } as const))
      )
      if (response._tag === "Unavailable" || response.result.status !== 200) {
        return inconclusive(publication, "GitHub asset bytes could not be downloaded for exact sha256 observation.")
      }
      const bytes = typeof response.result.body === "string"
        ? new TextEncoder().encode(response.result.body)
        : response.result.body
      const digest = sha256Digest(bytes)
      if (!digestEquals(digest, download.expected)) {
        return presentDifferent(publication, [textDifference(
          `asset.${publication.assets[download.index]!.name}.digest`,
          formatGitHubSha256(download.expected),
          formatGitHubSha256(digest)
        )])
      }
    }
    if (missingIndexes.length > 0) {
      if (mutationMayStillBecomeVisible) {
        return pending(publication, "One or more intended GitHub assets are not yet visible after the accepted mutation.")
      }
      mutationPlan = {
        _tag: "UploadAssets",
        releaseId: release.id,
        uploadUrl: release.uploadUrl,
        assetIndexes: missingIndexes
      }
      return absent(
        publication,
        "github-intended-assets-absent",
        "A full paginated release-asset enumeration proved at least one intended asset name absent."
      )
    }
    return PresentEquivalent.make({ subject: publication.authority.subject })
  })

  const mutate = Effect.fn("GitHubReleaseSubject.mutate")(function*(
    decision: MutationDecision,
    grant: MutationCredentialGrant
  ): Effect.fn.Return<MutationAttempt, ReleaseSubjectError> {
    if (grant._tag !== "ScopedSecret") {
      return yield* mutationFailure(
        publication,
        "GitHub release mutation requires an opaque scoped-secret grant.",
        "before-dispatch"
      )
    }
    const plan = mutationPlan
    if (decision.subject !== publication.authority.subject || plan === undefined) {
      return yield* mutationFailure(publication, "The GitHub mutation decision has no matching exact observation plan.")
    }
    const expectedDecision = plan._tag === "CreateRelease" && plan.tagAbsent
      ? decision._tag === "ProviderAuthorizedCreate" &&
        decision.proof.kind === "github-authenticated-repository-and-unique-tag"
      : plan._tag === "CreateRelease"
      ? decision._tag === "NeedsMutation" && decision.precondition.kind === "github-release-absent-at-exact-tag"
      : decision._tag === "NeedsMutation" &&
        decision.precondition.kind === "github-intended-assets-authoritatively-absent"
    if (!expectedDecision) {
      return yield* mutationFailure(publication, "The GitHub mutation decision does not match its observed precondition.")
    }
    const indexes = plan._tag === "CreateRelease"
      ? publication.assets.map((_, index) => index)
      : [...plan.assetIndexes]
    const bytesByIndex = new Map<number, Uint8Array>()
    for (const index of indexes) {
      const asset = publication.assets[index]
      const bytes = asset === undefined ? undefined : bundle.blobs.get(asset.artifactId.toString())
      if (asset === undefined || bytes === undefined) {
        return yield* mutationFailure(publication, "An intended GitHub asset is unavailable before dispatch.")
      }
      bytesByIndex.set(index, bytes)
    }
    if (plan._tag === "UploadAssets" && !validateUploadUrl(publication, plan.releaseId, plan.uploadUrl)) {
      return yield* mutationFailure(publication, "The observed GitHub upload template failed validation before dispatch.")
    }
    const operation: PublisherOperation = {
      _tag: "PublishOperation",
      subject: publication.authority.subject,
      provider: publication.authority.provider,
      audience: publication.authority.audience,
      purpose: "publish",
      decision
    }
    let acceptedWrites = 0
    const dispatch = Effect.fn("GitHubReleaseSubject.dispatch")(function*(request: MutationHttpRequest) {
      const exchange = yield* executeMutation(mutationHttp, operation, request, grant)
      if (exchange._tag === "Failure") {
        if (acceptedWrites > 0 || exchange.error.commitment === "unknown") {
          return { _tag: "Attempt", attempt: unknownAttempt(
            publication,
            "GitHub transport outcome became unknown after mutation dispatch."
          ) } as const
        }
        return yield* mutationFailure(
          publication,
          "The authorized GitHub HTTP boundary rejected mutation before dispatch.",
          "before-dispatch"
        )
      }
      if (exchange.response.status === 201) {
        acceptedWrites += 1
        return { _tag: "Accepted", response: exchange.response } as const
      }
      if (acceptedWrites === 0 && (exchange.response.status === 401 || exchange.response.status === 403)) {
        return {
          _tag: "Attempt",
          attempt: rejectedAttempt(publication, exchange.response.status)
        } as const
      }
      return { _tag: "Attempt", attempt: unknownAttempt(
        publication,
        `GitHub returned conservative mutation status ${exchange.response.status}; exact outcome requires reobservation.`
      ) } as const
    })

    let uploadUrl: string
    if (plan._tag === "CreateRelease") {
      const body = JSON.stringify({
        tag_name: publication.tag.toString(),
        target_commitish: publication.targetCommit.toString(),
        name: publication.title.toString(),
        body: publication.body ?? "",
        draft: publication.draft,
        prerelease: publication.prerelease
      })
      const created = yield* dispatch({
        method: "POST",
        url: `${publication.authority.audience}/releases`,
        headers: {
          ...githubJsonHeaders,
          "content-type": "application/json",
          "content-length": String(new TextEncoder().encode(body).length)
        },
        body
      })
      if (created._tag === "Attempt") return created.attempt
      const facts = releaseFacts(parseJson(created.response.body))
      if (facts === undefined || !validateUploadUrl(publication, facts.id, facts.uploadUrl) ||
        compareReleaseMetadata(publication, facts).length > 0) {
        return unknownAttempt(
          publication,
          "GitHub accepted release creation but its response did not establish the exact release identity and repository-scoped upload template."
        )
      }
      uploadUrl = facts.uploadUrl
    } else {
      uploadUrl = plan.uploadUrl
    }
    for (const index of indexes) {
      const bytes = bytesByIndex.get(index)!
      const uploaded = yield* dispatch(uploadRequest(publication, uploadUrl, index, bytes))
      if (uploaded._tag === "Attempt") return uploaded.attempt
      const intended = publication.assets[index]!
      const facts = releaseAssetFacts(publication, parseJson(uploaded.response.body))
      if (facts === undefined || facts.name !== intended.name || facts.size !== bytes.length ||
        facts.mediaType !== intended.mediaType || facts.digest._tag === "Malformed" ||
        (facts.digest._tag === "Present" && !digestEquals(facts.digest.value, sha256Digest(bytes)))) {
        return unknownAttempt(
          publication,
          "GitHub accepted an asset upload but its response did not establish the exact uploaded asset identity."
        )
      }
    }
    return appliedAttempt(publication)
  })

  return [{
    id: publication.authority.subject,
    recovery: githubRecoveryCapabilityProfile,
    observationRequests: observationRequests(publication),
    mutationRequest: mutationRequest(publication),
    observe,
    decide: (observation) => decideFor(publication, observation, mutationPlan),
    mutate
  }]
}
