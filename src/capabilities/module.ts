import type { CandidateConfig } from "../recipes/config.js"
import type {
  PreparedPublicationTag,
  ProviderAdapter
} from "../publication/provider.js"
import type {
  PreparationContributor,
  PublicationContributor
} from "../release/compiler.js"
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

export type { CompilationSnapshot } from "../release/compiler.js"

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
export interface PreparationCapability extends CapabilityCommon, PreparationContributor {
  readonly _tag: "PreparationCapability"
}

/**
 * One publication capability shape for every provider. The publish half is
 * the provider adapter itself — profile registration, recovery policy, and
 * typed subject derivation live on the contract that third parties implement,
 * not on a parallel first-party surface.
 */
export interface PublicationCapability<
  Tag extends PreparedPublicationTag = PreparedPublicationTag
> extends CapabilityCommon, PublicationContributor {
  readonly _tag: "PublicationCapability"
  readonly adapter: ProviderAdapter<Tag>
}

export type CapabilityModule =
  | ResolutionCapability
  | PreparationCapability
  | PublicationCapability
