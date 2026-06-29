import * as Schema from "effect/Schema"
import { ArtifactIntent, ArtifactInventoryItem, ArtifactRecipe } from "./artifact.js"
import { Operation } from "./operation.js"
import { TargetCapabilities, TargetConfig } from "./target.js"

export type * from "../types/effect-internal.js"

export const ReleaseName = Schema.NonEmptyString
export type ReleaseName = typeof ReleaseName.Type

export const ReleaseVersion = Schema.NonEmptyString
export type ReleaseVersion = typeof ReleaseVersion.Type

export const GitCommit = Schema.NonEmptyString
export type GitCommit = typeof GitCommit.Type

export const GitTag = Schema.NonEmptyString
export type GitTag = typeof GitTag.Type

export class ReleaseIdentity extends Schema.Class<ReleaseIdentity>("ReleaseIdentity")({
  name: ReleaseName,
  version: ReleaseVersion,
  commit: GitCommit,
  tag: Schema.optionalKey(GitTag),
  notes: Schema.optionalKey(Schema.String)
}) {}

export class ReleasePackageManifest extends Schema.Class<ReleasePackageManifest>("ReleasePackageManifest")({
  name: ReleaseName,
  version: ReleaseVersion
}) {}

export class StaticReleaseIdentitySource extends Schema.Class<StaticReleaseIdentitySource>(
  "StaticReleaseIdentitySource"
)({
  name: ReleaseName,
  version: ReleaseVersion,
  commit: GitCommit,
  tag: Schema.optionalKey(GitTag),
  notes: Schema.optionalKey(Schema.String)
}) {}

export class PackageManifestReleaseIdentitySource extends Schema.TaggedClass<PackageManifestReleaseIdentitySource>()(
  "PackageManifestReleaseIdentitySource",
  {
    packagePath: Schema.optionalKey(Schema.String),
    commit: GitCommit,
    tagTemplate: Schema.optionalKey(Schema.String),
    notes: Schema.optionalKey(Schema.String)
  }
) {}

export const ReleaseIdentitySource = Schema.Union([
  StaticReleaseIdentitySource,
  PackageManifestReleaseIdentitySource
])
export type ReleaseIdentitySource = typeof ReleaseIdentitySource.Type

export class SourceMetadata extends Schema.Class<SourceMetadata>("SourceMetadata")({
  root: Schema.String,
  configPath: Schema.optionalKey(Schema.String)
}) {}

export class ReleaseIntent extends Schema.Class<ReleaseIntent>("ReleaseIntent")({
  "$schema": Schema.optionalKey(Schema.String),
  identity: ReleaseIdentitySource,
  artifacts: Schema.Array(ArtifactIntent),
  artifactRecipes: Schema.optionalKey(Schema.Array(ArtifactRecipe)),
  targets: Schema.Array(TargetConfig),
  strict: Schema.optionalKey(Schema.Boolean),
  evidenceDirectory: Schema.optionalKey(Schema.String)
}) {}

export class ReleaseModel extends Schema.Class<ReleaseModel>("ReleaseModel")({
  identity: ReleaseIdentity,
  source: SourceMetadata,
  artifacts: Schema.Array(ArtifactInventoryItem),
  targets: Schema.Array(TargetConfig),
  strict: Schema.Boolean,
  evidenceDirectory: Schema.String
}) {}

export class PlannerMetadata extends Schema.Class<PlannerMetadata>("PlannerMetadata")({
  createdBy: Schema.String,
  planSchemaVersion: Schema.Literal("release-plan/v1")
}) {}

export class ReleasePlan extends Schema.Class<ReleasePlan>("ReleasePlan")({
  schemaVersion: Schema.Literal("release-plan/v1"),
  identity: ReleaseIdentity,
  source: SourceMetadata,
  artifacts: Schema.Array(ArtifactInventoryItem),
  targets: Schema.Array(TargetConfig),
  targetCapabilities: Schema.Array(TargetCapabilities),
  operations: Schema.Array(Operation),
  evidenceDirectory: Schema.String,
  metadata: PlannerMetadata
}) {}
