import * as Schema from "effect/Schema"

export type * from "../types/effect-internal.js"

export const TargetId = Schema.String
export type TargetId = typeof TargetId.Type

export const TargetAuthRequirement = Schema.Literals(["none", "env-token", "cli-auth"])
export type TargetAuthRequirement = typeof TargetAuthRequirement.Type

export const TargetDryRunSupport = Schema.Literals(["none", "native", "simulated"])
export type TargetDryRunSupport = typeof TargetDryRunSupport.Type

export const TargetMutability = Schema.Literals(["immutable", "mutable-release", "mutable-index"])
export type TargetMutability = typeof TargetMutability.Type

export const TargetRecovery = Schema.Literals(["publish-new-version", "delete-and-recreate", "manual"])
export type TargetRecovery = typeof TargetRecovery.Type

export const TargetValidationStrategy = Schema.Literals(["native-command", "simulated-plan", "skipped"])
export type TargetValidationStrategy = typeof TargetValidationStrategy.Type

export const NpmAccess = Schema.Literals(["public", "restricted"])
export type NpmAccess = typeof NpmAccess.Type

export class NpmRegistryTarget extends Schema.TaggedClass<NpmRegistryTarget>()("NpmRegistryTarget", {
  id: TargetId,
  registry: Schema.String,
  packagePath: Schema.String,
  tokenEnv: Schema.optionalKey(Schema.String),
  access: Schema.optionalKey(NpmAccess),
  provenance: Schema.optionalKey(Schema.Boolean),
  dryRunSupport: TargetDryRunSupport,
  mutability: TargetMutability,
  recovery: TargetRecovery
}) {}

export class GitHubReleaseTarget extends Schema.TaggedClass<GitHubReleaseTarget>()("GitHubReleaseTarget", {
  id: TargetId,
  repository: Schema.String,
  tokenEnv: Schema.optionalKey(Schema.String),
  draft: Schema.optionalKey(Schema.Boolean),
  prerelease: Schema.optionalKey(Schema.Boolean),
  dryRunSupport: TargetDryRunSupport,
  mutability: TargetMutability,
  recovery: TargetRecovery
}) {}

export class HomebrewTapTarget extends Schema.TaggedClass<HomebrewTapTarget>()("HomebrewTapTarget", {
  id: TargetId,
  repository: Schema.String,
  formulaName: Schema.String,
  formulaPath: Schema.String,
  artifactId: Schema.String,
  homepage: Schema.optionalKey(Schema.String),
  url: Schema.optionalKey(Schema.String),
  tapDirectory: Schema.optionalKey(Schema.String),
  installPath: Schema.optionalKey(Schema.String),
  tokenEnv: Schema.optionalKey(Schema.String),
  dryRunSupport: TargetDryRunSupport,
  mutability: TargetMutability,
  recovery: TargetRecovery
}) {}

export const TargetConfig = Schema.Union([NpmRegistryTarget, GitHubReleaseTarget, HomebrewTapTarget])
export type TargetConfig = typeof TargetConfig.Type

export class TargetCapabilities extends Schema.Class<TargetCapabilities>("TargetCapabilities")({
  targetId: TargetId,
  targetTag: Schema.String,
  authRequirement: TargetAuthRequirement,
  dryRunSupport: TargetDryRunSupport,
  mutability: TargetMutability,
  recovery: TargetRecovery,
  validationStrategy: TargetValidationStrategy
}) {}

export const targetOrder = (left: TargetConfig, right: TargetConfig): number =>
  left.id.localeCompare(right.id)

export const targetCapabilitiesOrder = (left: TargetCapabilities, right: TargetCapabilities): number =>
  left.targetId.localeCompare(right.targetId)

export const targetAuthRequirement = (target: TargetConfig): TargetAuthRequirement => {
  if (target._tag === "NpmRegistryTarget") {
    return target.tokenEnv === undefined ? "cli-auth" : "env-token"
  }
  return target.tokenEnv === undefined ? "cli-auth" : "env-token"
}
