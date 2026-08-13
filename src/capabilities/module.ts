import type { CandidateConfig } from "../recipes/config.js"
import type { ReleaseSubject } from "../publication/coordinator.js"
import type {
  AuthorizedMutationHttpShape,
  HttpAuthorizerShape
} from "../publication/http.js"
import type {
  CertifiedPublisherSpawnShape,
  NpmUserConfigResourceShape
} from "../publication/publisher.js"
import type { PublicationProfileRegistration } from "../publication/recovery.js"
import type { PublicationClaimStoreShape } from "../publication/claim.js"
import type {
  PreparedGitHubPublication,
  PreparedCatalogPublication,
  PreparedNpmPublication,
  PreparedPyPiPublication
} from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import type { VerifiedReleaseContext } from "../release/context.js"
import type {
  CapabilityContribution,
  OutputDeclaration
} from "../release/graph.js"
import type { ObservedFacts } from "../resolve/facts.js"

/** The deliberately small, installed product algebra. Inclusion means support. */
export type CapabilityId =
  | "release.identity"
  | "prepare.source"
  | "prepare.package"
  | "render.homebrew"
  | "render.scoop"
  | "publish.npm"
  | "publish.pypi"
  | "publish.catalog-git"
  | "publish.github"

export type FieldEffect =
  | "resolved-intent"
  | "graph"
  | "prepared-bytes"
  | "runtime-requirement"
  | "recovery-policy"
  | "authoring-only"

export interface OwnedConfigField {
  /** Exact path emitted by scripts/lib/config-fields.ts; prefixes never count. */
  readonly path: string
  readonly effect: FieldEffect
}

export interface CapabilityCertification {
  /** Evidence references do not install a capability. */
  readonly tests: ReadonlyArray<string>
  readonly boundary: "root-api" | "provider-protocol"
}

export interface CapabilityRequirements {
  readonly executionHosts: ReadonlyArray<"linux" | "darwin">
  readonly nativeTools: ReadonlyArray<string>
  readonly artifactTargets: ReadonlyArray<string>
  readonly credentialStrategies: ReadonlyArray<string>
}

export interface CompilationSnapshot {
  readonly config: CandidateConfig
  readonly context: VerifiedReleaseContext
  /** Immutable outputs from the preceding explicit compilation phase. */
  readonly availableArtifacts: ReadonlyArray<OutputDeclaration>
}

interface CapabilityCommon {
  readonly id: CapabilityId
  readonly fields: ReadonlyArray<OwnedConfigField>
  readonly requirements: CapabilityRequirements
  readonly certification: CapabilityCertification
}

/** Canonical authored identity and observed facts have one resolver. */
export interface ResolutionCapability extends CapabilityCommon {
  readonly _tag: "ResolutionCapability"
  readonly resolve: (authored: unknown, facts: ObservedFacts) => CandidateConfig
}

/** Preparation has no provider, credential, or subject surface. */
export interface PreparationCapability extends CapabilityCommon {
  readonly _tag: "PreparationCapability"
  readonly phase: "source" | "package" | "render"
  readonly contribute: (input: CompilationSnapshot) => CapabilityContribution
}

/** Opaque provider services supplied only by the default or custom host layer. */
export interface PublicationSubjectServices {
  readonly http: HttpAuthorizerShape
  readonly mutationHttp: AuthorizedMutationHttpShape
  readonly userConfigs: NpmUserConfigResourceShape
  readonly publisher: CertifiedPublisherSpawnShape
  readonly claims: PublicationClaimStoreShape
}

interface PublicationCapabilityCommon extends CapabilityCommon {
  readonly _tag: "PublicationCapability"
  /** The exact registration also consumed by recovery documentation. */
  readonly profile: PublicationProfileRegistration
  readonly contribute: (input: CompilationSnapshot) => CapabilityContribution
}

export interface NpmPublicationCapability extends PublicationCapabilityCommon {
  readonly id: "publish.npm"
  readonly preparedTag: "PreparedNpmPublication"
  readonly subjects: (
    bundle: PreparedBundle,
    publication: PreparedNpmPublication,
    services: PublicationSubjectServices
  ) => readonly [ReleaseSubject]
}

export interface GitHubPublicationCapability extends PublicationCapabilityCommon {
  readonly id: "publish.github"
  readonly preparedTag: "PreparedGitHubPublication"
  readonly subjects: (
    bundle: PreparedBundle,
    publication: PreparedGitHubPublication,
    services: PublicationSubjectServices
  ) => readonly [ReleaseSubject]
}

export interface PyPiPublicationCapability extends PublicationCapabilityCommon {
  readonly id: "publish.pypi"
  readonly preparedTag: "PreparedPyPiPublication"
  readonly subjects: (
    bundle: PreparedBundle,
    publication: PreparedPyPiPublication,
    services: PublicationSubjectServices
  ) => ReadonlyArray<ReleaseSubject>
}

export interface CatalogPublicationCapability extends PublicationCapabilityCommon {
  readonly id: "publish.catalog-git"
  readonly preparedTag: "PreparedCatalogPublication"
  readonly subjects: (
    bundle: PreparedBundle,
    publication: PreparedCatalogPublication,
    services: PublicationSubjectServices
  ) => readonly [ReleaseSubject]
}

export type PublicationCapability =
  | NpmPublicationCapability
  | PyPiPublicationCapability
  | CatalogPublicationCapability
  | GitHubPublicationCapability

export type CapabilityModule =
  | ResolutionCapability
  | PreparationCapability
  | PublicationCapability
