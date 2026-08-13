import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { CredentialRequest, ResolvedAuthStrategy } from "../model/authority.js"
import { CanonicalAudience, CredentialRequest as CredentialRequestSchema } from "../model/authority.js"
import { digestEquals, formatSha256Hex, parseSha256Hex, sha256Digest } from "../model/digest.js"
import { NonEmptyName } from "../model/primitives.js"
import { encodePreparedRelease, type PreparedPyPiFile, type PreparedPyPiPublication } from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import type { CredentialGrant, MutationCredentialGrant } from "./authority.js"
import {
  PublicationClaimRequest,
  unavailablePublicationClaimStore,
  type PublicationClaimStoreShape
} from "./claim.js"
import type { AuthorizedMutationHttpShape, HttpAuthorizerShape, HttpResponse } from "./http.js"
import {
  ReleaseSubjectError,
  type ReleaseObservationContext,
  type ReleaseSubject
} from "./coordinator.js"
import {
  AbsenceBasis,
  AuthoritativelyAbsent,
  Conflict,
  Difference,
  InconclusiveObservation,
  MutationPrecondition,
  NeedsMutation,
  OutcomeUnknown,
  PresentDifferent,
  PresentEquivalent,
  ProviderAlreadyEquivalent,
  ProviderBlocked,
  ProviderRejectionFact,
  RejectedByProvider,
  SafeReason,
  Started,
  VisibilityBasis,
  VisibilityPending,
  type MutationDecision,
  type Observation,
  type ProviderDecision
} from "./report.js"
import { makeRecoveryCapabilityProfile } from "./recovery.js"

export const pypiRecoveryCapabilityProfile = makeRecoveryCapabilityProfile({
  observation: "exact",
  authoritativeAbsence: "provider-specific",
  createAuthorization: "none",
  replay: "unsafe",
  identifierReuse: "consumed-after-delete",
  correction: [],
  exposure: "persistent-to-consumers",
  historyRequirement: "durable-cas-required",
  readConvergence: {
    contract: {
      _tag: "assumed",
      basis: "ASSUMED/UNVERIFIED: no authorized live mutation evidence establishes PyPI Simple API read-convergence timing."
    },
    observationRetry: {
      maxAttempts: 6,
      backoff: { baseMs: 2_000, factor: 2, capMs: 30_000 },
      totalBudgetMs: 120_000
    },
    retryEligible: "VisibilityPending | Inconclusive",
    exhaustion: "UncertainSubject with full trace"
  }
})

export const pypiProviderProtocolDocumentation = Object.freeze({
  reviewedAt: "2026-08-13",
  simpleApi: "https://packaging.python.org/en/latest/specifications/simple-repository-api/",
  yanking: "https://packaging.python.org/en/latest/specifications/file-yanking/",
  upload: "https://docs.pypi.org/api/upload/",
  trustedPublishing: "https://docs.pypi.org/trusted-publishers/using-a-publisher/"
})

/** No stable exact conditional per-file yank mutation is installed. */
export class PyPiYankUnsupported
  extends Schema.TaggedErrorClass<PyPiYankUnsupported>()("PyPiYankUnsupported", {
    filename: Schema.NonEmptyString,
    reason: SafeReason
  }) {}

const asObject = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined

const parseJson = (body: Uint8Array | string): unknown | undefined => {
  try {
    const text = typeof body === "string" ? body : new TextDecoder("utf-8", { fatal: true }).decode(body)
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

const header = (response: HttpResponse, name: string): string | undefined => {
  const found = Object.entries(response.headers).find(([candidate]) => candidate.toLowerCase() === name.toLowerCase())
  return found?.[1]
}

const contentType = (value: string | undefined): string | undefined => value?.split(";", 1)[0]?.trim().toLowerCase()

type SimpleFile = {
  readonly filename: string
  readonly size: number
  readonly sha256: string
  readonly yanked: false | string
}

type SimpleProject = {
  readonly apiVersion: string
  readonly name: string
  readonly files: ReadonlyArray<SimpleFile>
}

const simpleProject = (value: unknown): SimpleProject | undefined => {
  const root = asObject(value)
  const meta = root === undefined ? undefined : asObject(root.meta)
  if (root === undefined || meta === undefined || typeof meta["api-version"] !== "string" ||
      typeof root.name !== "string" || !Array.isArray(root.files)) return undefined
  const files: Array<SimpleFile> = []
  const filenames = new Set<string>()
  for (const raw of root.files) {
    const file = asObject(raw)
    const hashes = file === undefined ? undefined : asObject(file.hashes)
    if (file === undefined || hashes === undefined || typeof file.filename !== "string" ||
        !Number.isSafeInteger(file.size) || (file.size as number) < 0 ||
        typeof hashes.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(hashes.sha256)) return undefined
    if (filenames.has(file.filename)) return undefined
    filenames.add(file.filename)
    const rawYanked = file.yanked
    if (rawYanked !== undefined && typeof rawYanked !== "boolean" && typeof rawYanked !== "string") return undefined
    files.push({
      filename: file.filename,
      size: file.size as number,
      sha256: hashes.sha256,
      yanked: rawYanked === true ? "yanked without a reason" : typeof rawYanked === "string" && rawYanked.length > 0
        ? rawYanked : false
    })
  }
  return { apiVersion: meta["api-version"], name: root.name, files }
}

const fingerprint = (value: string): SafeReason => SafeReason.make(
  `provider value sha256-${formatSha256Hex(sha256Digest(new TextEncoder().encode(value)))}`
)

const difference = (field: string, expected: string, observed: string): Difference => Difference.make({
  field: NonEmptyName.make(field),
  expected: SafeReason.make(expected),
  observed: fingerprint(observed)
})

const inconclusive = (file: PreparedPyPiFile, reason: string): InconclusiveObservation =>
  InconclusiveObservation.make({ subject: file.authority.subject, reason: SafeReason.make(reason) })

const observationRequests = (
  publication: PreparedPyPiPublication,
  file: PreparedPyPiFile
): readonly [CredentialRequest, ...Array<CredentialRequest>] => {
  const strategy: ResolvedAuthStrategy = file.authority.observationStrategies[0]!
  return [CredentialRequestSchema.make({
    subject: file.authority.subject,
    provider: file.authority.provider,
    audience: CanonicalAudience.make(publication.projectUrl),
    purpose: "observe",
    strategy
  })]
}

const mutationRequest = (file: PreparedPyPiFile): CredentialRequest => CredentialRequestSchema.make({
  subject: file.authority.subject,
  provider: file.authority.provider,
  audience: file.authority.audience,
  purpose: "publish",
  strategy: file.authority.publishStrategy
})

const visibilityPending = (file: PreparedPyPiFile): VisibilityPending => VisibilityPending.make({
  subject: file.authority.subject,
  expectation: SafeReason.make("The exact uploaded PyPI filename, size, and SHA-256 become visible."),
  basis: VisibilityBasis.make({
    kind: NonEmptyName.make("pypi-post-upload-simple-read"),
    detail: SafeReason.make("The same invocation dispatched one exact upload and is rereading the JSON Simple API only.")
  })
})

const visibleFileAbsent = (file: PreparedPyPiFile): AuthoritativelyAbsent => AuthoritativelyAbsent.make({
  subject: file.authority.subject,
  basis: AbsenceBasis.make({
    kind: NonEmptyName.make("pypi-visible-project-file-absent"),
    detail: SafeReason.make("A standards-compliant visible project page omitted the exact prepared filename.")
  })
})

const decide = (file: PreparedPyPiFile, observation: Observation): ProviderDecision => {
  switch (observation._tag) {
    case "PresentEquivalent": return ProviderAlreadyEquivalent.make({ subject: file.authority.subject })
    case "PresentDifferent": return Conflict.make({ subject: file.authority.subject, differences: observation.differences })
    case "AuthoritativelyAbsent": return observation.basis.kind === "pypi-visible-project-file-absent"
      ? NeedsMutation.make({
        subject: file.authority.subject,
        precondition: MutationPrecondition.make({ kind: NonEmptyName.make("pypi-visible-project-file-absent") })
      })
      : ProviderBlocked.make({
        subject: file.authority.subject,
        reason: SafeReason.make("PyPI absence lacks a visible-project exact-filename proof.")
      })
    case "VisibilityPending":
    case "Inconclusive": return ProviderBlocked.make({
      subject: file.authority.subject,
      reason: SafeReason.make("PyPI observation did not prove exact equivalence or visible-project file absence.")
    })
  }
}

const bytesConcat = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}

const containsBytes = (haystack: Uint8Array, needle: Uint8Array): boolean => {
  if (needle.length === 0 || needle.length > haystack.length) return false
  outer: for (let offset = 0; offset <= haystack.length - needle.length; offset += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[offset + index] !== needle[index]) continue outer
    }
    return true
  }
  return false
}

const multipart = (
  publication: PreparedPyPiPublication,
  file: PreparedPyPiFile,
  bytes: Uint8Array
): { readonly contentType: string, readonly body: Uint8Array } => {
  const encode = (value: string): Uint8Array => new TextEncoder().encode(value)
  const boundaryBase = `ts-release-${file.sha256.hex}`
  let boundary = boundaryBase
  for (let suffix = 0; containsBytes(bytes, encode(boundary)); suffix += 1) {
    boundary = `${boundaryBase}-${suffix + 1}`
  }
  const fields: ReadonlyArray<readonly [string, string]> = [
    [":action", "file_upload"],
    ["protocol_version", "1"],
    ["sha256_digest", file.sha256.hex],
    ["filetype", file.distribution._tag === "wheel" ? "bdist_wheel" : "sdist"],
    ["pyversion", file.distribution.pythonTag],
    ["metadata_version", file.distribution.metadataVersion],
    ["name", publication.project],
    ["version", publication.version]
  ]
  const parts: Array<Uint8Array> = []
  for (const [name, value] of fields) parts.push(encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
  ))
  parts.push(encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="content"; filename="${file.filename}"\r\n` +
    `Content-Type: ${file.mediaType}\r\n\r\n`
  ))
  parts.push(bytes)
  parts.push(encode(`\r\n--${boundary}--\r\n`))
  return { contentType: `multipart/form-data; boundary=${boundary}`, body: bytesConcat(parts) }
}

const validDecision = (decision: MutationDecision): boolean =>
  decision._tag === "NeedsMutation" && decision.precondition.kind === "pypi-visible-project-file-absent"

const mutationFailure = (file: PreparedPyPiFile, cause: unknown): ReleaseSubjectError =>
  new ReleaseSubjectError({
    subject: file.authority.subject,
    phase: "mutate",
    commitment: typeof cause === "object" && cause !== null && "commitment" in cause && cause.commitment === "unknown"
      ? "unknown" : "before-dispatch",
    reason: SafeReason.make("The typed PyPI upload boundary rejected or lost the exact prepared file operation.")
  })

/** One exact independently recoverable Simple-API/upload subject. */
export const makePyPiSubject = (
  bundle: PreparedBundle,
  publication: PreparedPyPiPublication,
  file: PreparedPyPiFile,
  http: HttpAuthorizerShape,
  mutationHttp: AuthorizedMutationHttpShape,
  prerequisites: ReadonlyArray<PreparedPyPiFile> = [],
  claims: PublicationClaimStoreShape = unavailablePublicationClaimStore
): ReleaseSubject => {
  const bytes = bundle.blobs.get(file.artifactId.toString())
  const preparedDigest = sha256Digest(encodePreparedRelease(bundle.manifest))
  const observe = Effect.fn("PyPiFileSubject.observe")(function*(
    grant: CredentialGrant,
    context: ReleaseObservationContext
  ) {
    if (grant._tag !== "AnonymousAccess") {
      return inconclusive(file, "PyPI Simple API observation requires the prepared anonymous strategy.")
    }
    if (bytes === undefined || bytes.length !== file.size || !digestEquals(sha256Digest(bytes), file.sha256)) {
      return inconclusive(file, "The exact prepared PyPI artifact bytes are unavailable.")
    }
    const response = yield* http.execute({
      subject: file.authority.subject,
      method: "GET",
      url: publication.projectUrl,
      headers: { accept: "application/vnd.pypi.simple.v1+json" }
    }, grant).pipe(Effect.mapError((cause) => new ReleaseSubjectError({
      subject: file.authority.subject,
      phase: "observe",
      commitment: cause._tag === "CredentialPlatformError" ? cause.commitment : "before-dispatch",
      reason: SafeReason.make("PyPI Simple API observation could not be completed by the host HTTP boundary.")
    })))
    if (response.status === 404) {
      return context.phase === "post-mutation" && context.attempt._tag !== "RejectedBeforeDispatch"
        ? visibilityPending(file)
        : inconclusive(file, "A PyPI project 404 does not prove public absence, private absence, or first-create authority.")
    }
    if (response.status < 200 || response.status >= 300) {
      return inconclusive(file, `PyPI Simple API observation returned HTTP ${response.status}.`)
    }
    if (contentType(header(response, "content-type")) !== "application/vnd.pypi.simple.v1+json") {
      return inconclusive(file, "PyPI Simple API response did not negotiate the required v1 JSON media type.")
    }
    const project = simpleProject(parseJson(response.body))
    if (project === undefined) return inconclusive(file, "PyPI Simple API response was malformed or omitted exact file equality fields.")
    const version = /^(\d+)\.(\d+)$/u.exec(project.apiVersion)
    if (version === null || Number(version[1]) !== 1 || Number(version[2]) < 1) {
      return inconclusive(file, "PyPI Simple API version is older than 1.1 or has an unsupported major version.")
    }
    if (project.name !== publication.project) {
      return PresentDifferent.make({
        subject: file.authority.subject,
        differences: [difference("project", publication.project, project.name)]
      })
    }
    const observed = project.files.find((candidate) => candidate.filename === file.filename)
    if (observed === undefined) {
      return context.phase === "post-mutation" && context.attempt._tag !== "RejectedBeforeDispatch"
        ? visibilityPending(file)
        : visibleFileAbsent(file)
    }
    const differences: Array<Difference> = []
    if (observed.size !== file.size) differences.push(difference("size", String(file.size), String(observed.size)))
    try {
      if (!digestEquals(parseSha256Hex(observed.sha256), file.sha256)) {
        differences.push(difference("sha256", file.sha256.hex, observed.sha256))
      }
    } catch {
      return inconclusive(file, "PyPI Simple API returned a malformed SHA-256 digest.")
    }
    if (observed.yanked !== false) differences.push(difference("yanked", "false", observed.yanked))
    return differences.length === 0
      ? PresentEquivalent.make({ subject: file.authority.subject })
      : PresentDifferent.make({
        subject: file.authority.subject,
        differences: differences as [Difference, ...Array<Difference>]
      })
  })

  const mutate = (decision: MutationDecision, grant: MutationCredentialGrant) => {
    if (!validDecision(decision) || bytes === undefined) return Effect.fail(new ReleaseSubjectError({
      subject: file.authority.subject,
      phase: "mutate",
      commitment: "before-dispatch",
      reason: SafeReason.make("PyPI mutation lacks its exact visible-project file-absence proof or prepared bytes.")
    }))
    if (grant._tag === "WorkloadIdentity" || publication.authentication.strategy !== "token") {
      return Effect.fail(new ReleaseSubjectError({
        subject: file.authority.subject,
        phase: "mutate",
        commitment: "before-dispatch",
        reason: SafeReason.make("PyPI trusted publishing is owned externally by pypa/gh-action-pypi-publish@release/v1.")
      }))
    }
    const operation = {
      _tag: "PublishOperation" as const,
      subject: file.authority.subject,
      provider: file.authority.provider,
      audience: file.authority.audience,
      purpose: "publish" as const,
      decision
    }
    const form = multipart(publication, file, bytes)
    return mutationHttp.execute(operation, {
      method: "POST",
      url: publication.uploadUrl,
      credentialScheme: "pypi-token-basic",
      headers: {
        accept: "text/plain, application/json;q=0.1",
        "content-type": form.contentType,
        "content-length": String(form.body.length)
      },
      body: form.body
    }, grant).pipe(
      Effect.map((response) => response.status >= 200 && response.status < 300
        ? Started.make({ subject: file.authority.subject })
        : response.status >= 300 && response.status < 400
        ? OutcomeUnknown.make({
          subject: file.authority.subject,
          reason: SafeReason.make("PyPI upload returned a redirect that the typed boundary did not follow.")
        })
        : RejectedByProvider.make({
          subject: file.authority.subject,
          fact: ProviderRejectionFact.make({
            subject: file.authority.subject,
            code: NonEmptyName.make(`pypi-http-${response.status}`),
            detail: SafeReason.make(`PyPI upload returned HTTP ${response.status}; exact reobservation determines remote state.`)
          })
        })),
      Effect.mapError((cause) => mutationFailure(file, cause))
    )
  }

  const claimMutation = (decision: MutationDecision) => publication.authentication.strategy !== "token"
    ? Effect.fail(new ReleaseSubjectError({
      subject: file.authority.subject,
      phase: "mutate",
      commitment: "before-dispatch",
      reason: SafeReason.make("PyPI trusted publishing is external-host-owned and cannot enter the stock terminal-claim or upload path.")
    }))
    : !validDecision(decision)
    ? Effect.fail(new ReleaseSubjectError({
      subject: file.authority.subject,
      phase: "mutate",
      commitment: "before-dispatch",
      reason: SafeReason.make("PyPI terminal claim requires the exact visible-project file-absence decision.")
    }))
    : claims.claim(PublicationClaimRequest.make({
      subject: file.authority.subject,
      preparedDigest
    })).pipe(Effect.mapError(() => new ReleaseSubjectError({
      subject: file.authority.subject,
      phase: "mutate",
      commitment: "before-dispatch",
      reason: SafeReason.make("The shared terminal PyPI publication claim was unavailable or occupied.")
    })))

  return {
    id: file.authority.subject,
    recovery: pypiRecoveryCapabilityProfile,
    ...(prerequisites.length === 0 ? {} : { prerequisites: prerequisites.map((prior) => prior.authority.subject) }),
    observationRequests: observationRequests(publication, file),
    mutationRequest: mutationRequest(file),
    claimMutation,
    observe,
    decide: (observation) => decide(file, observation),
    mutate
  }
}

export const makePyPiSubjects = (
  bundle: PreparedBundle,
  publication: PreparedPyPiPublication,
  http: HttpAuthorizerShape,
  mutationHttp: AuthorizedMutationHttpShape,
  claims: PublicationClaimStoreShape = unavailablePublicationClaimStore
): ReadonlyArray<ReleaseSubject> => publication.files.map((file, index) =>
  makePyPiSubject(bundle, publication, file, http, mutationHttp, publication.files.slice(0, index), claims))
