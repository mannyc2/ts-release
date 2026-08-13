import { join } from "node:path"
import * as Effect from "effect/Effect"
import type { CredentialRequest, ResolvedAuthStrategy } from "../model/authority.js"
import { CredentialRequest as CredentialRequestSchema } from "../model/authority.js"
import {
  digestEquals,
  formatNpmSha1Shasum,
  formatNpmSha512Sri,
  formatSha256Hex,
  parseNpmSha1Shasum,
  parseNpmSha512Sri,
  sha1Digest,
  sha256Digest,
  sha512Digest,
  type Sha1Digest,
  type Sha512Digest
} from "../model/digest.js"
import { NonEmptyName } from "../model/primitives.js"
import type { PreparedNpmPublication } from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import type { CredentialGrant, MutationCredentialGrant } from "./authority.js"
import type {
  CertifiedPublisherResult,
  CertifiedPublisherSpawnShape,
  NpmPublishOperation,
  NpmUserConfigResourceShape
} from "./publisher.js"
import type { HttpAuthorizerShape } from "./http.js"
import {
  ReleaseSubjectError,
  type ReleaseObservationContext,
  type ReleaseSubject
} from "./coordinator.js"
import {
  Conflict,
  AbsenceBasis,
  AuthoritativelyAbsent,
  CreateAuthorizationProof,
  Difference,
  InconclusiveObservation,
  MutationPrecondition,
  NeedsMutation,
  OutcomeUnknown,
  PresentEquivalent,
  PresentDifferent,
  ProviderAlreadyEquivalent,
  ProviderAuthorizedCreate,
  ProviderBlocked,
  RejectedBeforeDispatch,
  SafeReason,
  VisibilityBasis,
  VisibilityPending,
  type MutationDecision,
  type Observation,
  type ProviderDecision
} from "./report.js"
import { makeRecoveryCapabilityProfile } from "./recovery.js"

/**
 * Timing values are policy bounds, not measured provider facts. They remain
 * ASSUMED/UNVERIFIED until an explicitly authorized live run records evidence.
 */
export const npmRecoveryCapabilityProfile = makeRecoveryCapabilityProfile({
  observation: "conditional",
  authoritativeAbsence: "provider-specific",
  createAuthorization: "authenticated-namespace-and-unique-coordinate",
  replay: "coordinate-unique",
  identifierReuse: "consumed-after-delete",
  // The authored correction surface currently produces an operator proposal;
  // no conditional npm correction adapter is installed.
  correction: [],
  exposure: "persistent-to-consumers",
  historyRequirement: "optional-evidence",
  readConvergence: {
    contract: {
      _tag: "assumed",
      basis: "ASSUMED/UNVERIFIED: no authorized live mutation evidence establishes npm read-convergence timing."
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

/** Primary provider documentation reviewed for this protocol implementation. */
export const npmProviderProtocolDocumentation = Object.freeze({
  reviewedAt: "2026-08-12",
  packageMetadata: "https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md",
  publish: "https://docs.npmjs.com/cli/v11/commands/npm-publish/",
  distTags: "https://docs.npmjs.com/adding-dist-tags-to-packages/",
  trustedPublishing: "https://docs.npmjs.com/trusted-publishers/"
})

type NpmPublicationContract = PreparedNpmPublication & {
  readonly distTag: { readonly toString: () => string }
  readonly access: "public" | "restricted"
  readonly authentication:
    | { readonly strategy: "token" }
    | {
      readonly strategy: "trusted-publishing"
      readonly attestation: {
        readonly provider: "github-actions"
        readonly runner: "github-hosted"
        readonly repository: string
        readonly workflow: string
        readonly workflowRef: string
        readonly allowedAction: "npm-publish-direct"
      }
    }
  readonly provenance: "automatic" | "required" | "disabled"
}

const contractOf = (publication: PreparedNpmPublication): NpmPublicationContract =>
  publication as NpmPublicationContract

const fingerprint = (value: string): SafeReason => SafeReason.make(
  `provider value sha256-${formatSha256Hex(sha256Digest(new TextEncoder().encode(value)))}`
)

const registryEndpoint = (publication: NpmPublicationContract): string => {
  const value = publication.registryUrl.toString()
  return value.endsWith("/") ? value : `${value}/`
}

const registryPackageUrl = (publication: NpmPublicationContract): string =>
  `${registryEndpoint(publication)}${encodeURIComponent(publication.packageName).replace(/^%40/u, "@")}`

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

type RegistryPackageFacts = {
  readonly name: string
  readonly versions: Readonly<Record<string, unknown>>
  readonly distTags: Readonly<Record<string, unknown>>
}

const registryPackageFacts = (value: unknown): RegistryPackageFacts | undefined => {
  const metadata = asObject(value)
  if (metadata === undefined || typeof metadata.name !== "string") return undefined
  const versions = asObject(metadata.versions)
  const distTags = asObject(metadata["dist-tags"])
  return versions === undefined || distTags === undefined
    ? undefined
    : { name: metadata.name, versions, distTags }
}

type RegistryVersionFacts = {
  readonly name: string
  readonly version: string
  readonly integrity: Sha512Digest
  readonly shasum: Sha1Digest
}

const registryVersionFacts = (value: unknown): RegistryVersionFacts | undefined => {
  const metadata = asObject(value)
  const dist = metadata === undefined ? undefined : asObject(metadata.dist)
  if (metadata === undefined || dist === undefined || typeof metadata.name !== "string" ||
    typeof metadata.version !== "string") return undefined
  try {
    return {
      name: metadata.name,
      version: metadata.version,
      integrity: parseNpmSha512Sri(dist.integrity),
      shasum: parseNpmSha1Shasum(dist.shasum)
    }
  } catch {
    return undefined
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

const difference = (
  field: "name" | "version" | "integrity" | "shasum" | "dist-tag",
  expected: string,
  observed: string
): Difference =>
  Difference.make({
    field: NonEmptyName.make(field),
    expected: SafeReason.make(expected),
    observed: fingerprint(observed)
  })

const visibleVersionAbsent = (publication: NpmPublicationContract): AuthoritativelyAbsent =>
  AuthoritativelyAbsent.make({
    subject: publication.authority.subject,
    basis: AbsenceBasis.make({
      kind: NonEmptyName.make("npm-visible-package-version-absent"),
      detail: SafeReason.make("Authoritative package metadata omitted the exact prepared version coordinate.")
    })
  })

const trustedDirectCreate = (publication: NpmPublicationContract): boolean =>
  publication.authentication.strategy === "trusted-publishing" &&
  publication.authentication.attestation.provider === "github-actions" &&
  publication.authentication.attestation.runner === "github-hosted" &&
  publication.authentication.attestation.allowedAction === "npm-publish-direct" &&
  publication.authority.publishStrategy.kind === "trusted-publishing" &&
  publication.authority.publishStrategy.repository === publication.authentication.attestation.repository &&
  publication.authority.publishStrategy.workflow ===
    `.github/workflows/${publication.authentication.attestation.workflow}` &&
  publication.authority.publishStrategy.workflowRef === publication.authentication.attestation.workflowRef &&
  publication.authority.publishStrategy.allowedAction === "npm-publish-direct" &&
  publication.authority.publishStrategy.publisherSink === "certified-npm-cli"

const authorizedCreateAbsence = (publication: NpmPublicationContract): AuthoritativelyAbsent =>
  AuthoritativelyAbsent.make({
    subject: publication.authority.subject,
    basis: AbsenceBasis.make({
      kind: NonEmptyName.make("npm-trusted-direct-create"),
      detail: SafeReason.make("The prepared trusted-publishing attestation authorizes this exact direct-create coordinate.")
    })
  })

const visibilityPending = (publication: NpmPublicationContract): VisibilityPending =>
  VisibilityPending.make({
    subject: publication.authority.subject,
    expectation: SafeReason.make("The exact published npm version and dist-tag become visible."),
    basis: VisibilityBasis.make({
      kind: NonEmptyName.make("npm-post-publish-read"),
      detail: SafeReason.make("The same invocation dispatched one publish and is rereading provider metadata only.")
    })
  })

const decide = (
  publication: NpmPublicationContract,
  observation: Observation
): ProviderDecision => {
  switch (observation._tag) {
    case "PresentEquivalent":
      return ProviderAlreadyEquivalent.make({ subject: publication.authority.subject })
    case "PresentDifferent":
      return Conflict.make({ subject: publication.authority.subject, differences: observation.differences })
    case "AuthoritativelyAbsent":
      return observation.basis.kind === "npm-visible-package-version-absent"
        ? NeedsMutation.make({
          subject: publication.authority.subject,
          precondition: MutationPrecondition.make({ kind: NonEmptyName.make("npm-visible-package-version-absent") })
        })
        : trustedDirectCreate(publication) && observation.basis.kind === "npm-trusted-direct-create"
          ? ProviderAuthorizedCreate.make({
            subject: publication.authority.subject,
            proof: CreateAuthorizationProof.make({ kind: NonEmptyName.make("npm-trusted-direct-create") })
          })
          : ProviderBlocked.make({
            subject: publication.authority.subject,
            reason: SafeReason.make("The npm namespace has no exact prepared create authorization.")
          })
    case "VisibilityPending":
    case "Inconclusive":
      return ProviderBlocked.make({
        subject: publication.authority.subject,
        reason: SafeReason.make("npm observation did not prove exact equivalence or an authorized absent coordinate.")
      })
  }
}

const publishOperation = (
  publication: NpmPublicationContract,
  decision: MutationDecision
): NpmPublishOperation => ({
  _tag: "PublishOperation",
  subject: publication.authority.subject,
  provider: publication.authority.provider,
  audience: publication.authority.audience,
  purpose: "publish",
  decision
})

const sinkFailure = (publication: NpmPublicationContract, cause: unknown): ReleaseSubjectError =>
  new ReleaseSubjectError({
    subject: publication.authority.subject,
    phase: "mutate",
    commitment: typeof cause === "object" && cause !== null && "commitment" in cause && cause.commitment === "unknown"
      ? "unknown"
      : "before-dispatch",
    reason: SafeReason.make("The certified npm publisher boundary rejected or lost the prepared operation.")
  })

const publisherAttempt = (
  publication: NpmPublicationContract,
  result: CertifiedPublisherResult
): RejectedBeforeDispatch | OutcomeUnknown => result._tag === "RejectedBeforeStart"
  ? RejectedBeforeDispatch.make({
    subject: publication.authority.subject,
    reason: SafeReason.make("The certified npm publisher process did not start.")
  })
  : OutcomeUnknown.make({
    subject: publication.authority.subject,
    reason: SafeReason.make(result._tag === "PublisherExited"
      ? "The npm publisher started and exited; exact registry reobservation must establish its effect."
      : "The npm publisher started, but its terminal process result was unavailable.")
  })

const validMutationDecision = (
  publication: NpmPublicationContract,
  decision: MutationDecision
): boolean => decision._tag === "NeedsMutation"
  ? decision.precondition.kind === "npm-visible-package-version-absent"
  : decision.proof.kind === "npm-trusted-direct-create" && trustedDirectCreate(publication)

/** Exact Plan-225 npm subject over host-owned observation, credential, and process sinks. */
export const makeNpmSubject = (
  bundle: PreparedBundle,
  publication: PreparedNpmPublication,
  http: HttpAuthorizerShape,
  userConfigs: NpmUserConfigResourceShape,
  publisher: CertifiedPublisherSpawnShape
): ReleaseSubject => {
  const intent = contractOf(publication)
  const packageArtifact = bundle.manifest.artifacts.find((artifact) =>
    artifact.id.toString() === intent.artifactId.toString())
  const bytes = bundle.blobs.get(intent.artifactId.toString())
  const expectedIntegrity = bytes === undefined ? undefined : sha512Digest(bytes)
  const expectedShasum = bytes === undefined ? undefined : sha1Digest(bytes)
  const tarballPath = packageArtifact === undefined
    ? undefined
    : join(bundle.directory, "blobs", packageArtifact.blob.hex)

  const observe = Effect.fn("NpmReleaseSubject.observe")(function*(
    grant: CredentialGrant,
    context: ReleaseObservationContext
  ) {
    if (bytes === undefined || packageArtifact === undefined || tarballPath === undefined ||
      expectedIntegrity === undefined || expectedShasum === undefined) {
      return inconclusive(intent, "The exact prepared npm artifact bytes are unavailable.")
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
      subject: intent.authority.subject,
      method: "GET",
      url: registryPackageUrl(intent),
      headers: { accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8" }
    }, grant).pipe(Effect.mapError((cause) => new ReleaseSubjectError({
      subject: intent.authority.subject,
      phase: "observe",
      commitment: cause._tag === "CredentialPlatformError" ? cause.commitment : "before-dispatch",
      reason: SafeReason.make("npm metadata observation could not be completed by the host HTTP boundary.")
    })))

    if (response.status === 404) {
      if (context.phase === "post-mutation" && context.attempt._tag !== "RejectedBeforeDispatch") {
        return visibilityPending(intent)
      }
      return trustedDirectCreate(intent)
        ? authorizedCreateAbsence(intent)
        : inconclusive(intent, "npm package visibility is unavailable and no trusted direct-create proof exists.")
    }
    if (response.status < 200 || response.status >= 300) {
      return inconclusive(intent, `npm metadata observation returned HTTP ${response.status}.`)
    }

    const packument = registryPackageFacts(parseJson(response.body))
    if (packument === undefined) {
      return inconclusive(intent, "npm package metadata was malformed or omitted versions or dist-tags.")
    }
    if (packument.name !== intent.packageName) {
      return PresentDifferent.make({
        subject: intent.authority.subject,
        differences: [difference("name", intent.packageName.toString(), packument.name)]
      })
    }
    const rawVersion = packument.versions[intent.version.toString()]
    if (rawVersion === undefined) {
      return context.phase === "post-mutation" && context.attempt._tag !== "RejectedBeforeDispatch"
        ? visibilityPending(intent)
        : visibleVersionAbsent(intent)
    }
    const observed = registryVersionFacts(rawVersion)
    if (observed === undefined) return inconclusive(intent, "The exact npm version metadata was malformed.")

    const differences: Array<Difference> = []
    if (observed.name !== intent.packageName) {
      differences.push(difference("name", intent.packageName.toString(), observed.name))
    }
    if (observed.version !== intent.version) {
      differences.push(difference("version", intent.version.toString(), observed.version))
    }
    if (!digestEquals(observed.integrity, expectedIntegrity)) {
      differences.push(difference(
        "integrity",
        formatNpmSha512Sri(expectedIntegrity),
        formatNpmSha512Sri(observed.integrity)
      ))
    }
    if (!digestEquals(observed.shasum, expectedShasum)) {
      differences.push(difference(
        "shasum",
        formatNpmSha1Shasum(expectedShasum),
        formatNpmSha1Shasum(observed.shasum)
      ))
    }
    if (differences.length > 0) {
      return PresentDifferent.make({
        subject: intent.authority.subject,
        differences: differences as [Difference, ...Array<Difference>]
      })
    }
    const tag = packument.distTags[intent.distTag.toString()]
    if (tag !== intent.version) {
      if (context.phase === "post-mutation" && context.attempt._tag !== "RejectedBeforeDispatch") {
        return visibilityPending(intent)
      }
      return PresentDifferent.make({
        subject: intent.authority.subject,
        differences: [difference(
          "dist-tag",
          intent.version.toString(),
          typeof tag === "string" ? tag : "<missing>"
        )]
      })
    }
    return PresentEquivalent.make({ subject: intent.authority.subject })
  })

  const mutate = (
    decision: MutationDecision,
    grant: MutationCredentialGrant
  ) => {
    if (!validMutationDecision(intent, decision) || tarballPath === undefined) {
      return Effect.fail(new ReleaseSubjectError({
        subject: intent.authority.subject,
        phase: "mutate",
        commitment: "before-dispatch",
        reason: SafeReason.make("The npm mutation lacks its exact prepared absence proof or tarball path.")
      }))
    }
    const operation = publishOperation(intent, decision)
    const publisherSpec = {
      operation,
      cwd: bundle.directory,
      tarballPath,
      packageName: intent.packageName,
      version: intent.version,
      registryUrl: intent.registryUrl,
      distTag: intent.distTag,
      access: intent.access,
      provenance: intent.provenance
    } as const
    return Effect.scoped(Effect.gen(function*() {
      if (grant._tag === "WorkloadIdentity") {
        yield* publisher.preflightTrustedNpm(operation, grant)
        return yield* publisher.spawn({
          _tag: "WorkloadPublisherSpec",
          ...publisherSpec
        }, grant)
      }
      const userConfig = yield* userConfigs.acquire({
        operation,
        registryUrl: registryEndpoint(intent)
      }, grant)
      return yield* publisher.spawn({
        _tag: "NpmPublisherSpec",
        ...publisherSpec,
        userConfig
      }, grant)
    })).pipe(
      Effect.map((result) => publisherAttempt(intent, result)),
      Effect.mapError((cause) => sinkFailure(intent, cause))
    )
  }

  return {
    id: intent.authority.subject,
    recovery: npmRecoveryCapabilityProfile,
    observationRequests: observationRequests(intent),
    mutationRequest: mutationRequest(intent),
    observe,
    decide: (observation) => decide(intent, observation),
    mutate
  }
}
