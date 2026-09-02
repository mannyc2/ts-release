import type { CandidateConfig } from "../recipes/config.js"
import type {
  PreparedPublicationTag,
  ProviderAdapter
} from "../publication/provider.js"
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

/**
 * One publication capability shape for every provider. The publish half is
 * the provider adapter itself — profile registration, recovery policy, and
 * typed subject derivation live on the contract that third parties implement,
 * not on a parallel first-party surface.
 */
export interface PublicationCapability<
  Tag extends PreparedPublicationTag = PreparedPublicationTag
> extends CapabilityCommon {
  readonly _tag: "PublicationCapability"
  readonly adapter: ProviderAdapter<Tag>
  readonly contribute: (input: CompilationSnapshot) => CapabilityContribution
}

export type CapabilityModule =
  | ResolutionCapability
  | PreparationCapability
  | PublicationCapability
