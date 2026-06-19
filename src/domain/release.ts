import * as Schema from "effect/Schema"
import { ArtifactIntent, ArtifactInventoryItem } from "./artifact.js"
import { Operation } from "./operation.js"
import { TargetCapabilities, TargetConfig } from "./target.js"

export type * from "../types/effect-internal.js"

export const ReleaseName = Schema.String
export type ReleaseName = typeof ReleaseName.Type

export const ReleaseVersion = Schema.String
export type ReleaseVersion = typeof ReleaseVersion.Type

export const GitCommit = Schema.String
export type GitCommit = typeof GitCommit.Type

export const GitTag = Schema.String
export type GitTag = typeof GitTag.Type

export const ReleaseBump = Schema.Literals(["major", "minor", "patch", "none"])
export type ReleaseBump = typeof ReleaseBump.Type

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

export class RemoteStateReleaseDecision extends Schema.TaggedClass<RemoteStateReleaseDecision>()(
  "RemoteStateReleaseDecision",
  {}
) {}

export class GitTagReleaseDecision extends Schema.TaggedClass<GitTagReleaseDecision>()("GitTagReleaseDecision", {
  tag: Schema.optionalKey(GitTag),
  tagTemplate: Schema.optionalKey(Schema.String),
  packagePath: Schema.optionalKey(Schema.String),
  requireCurrentRef: Schema.optionalKey(Schema.Boolean)
}) {}

export class ConventionalCommitReleaseRule extends Schema.Class<ConventionalCommitReleaseRule>(
  "ConventionalCommitReleaseRule"
)({
  type: Schema.optionalKey(Schema.String),
  breaking: Schema.optionalKey(Schema.Boolean),
  release: ReleaseBump
}) {}

export class ConventionalCommitsReleaseDecision extends Schema.TaggedClass<ConventionalCommitsReleaseDecision>()(
  "ConventionalCommitsReleaseDecision",
  {
    packagePath: Schema.optionalKey(Schema.String),
    tagTemplate: Schema.optionalKey(Schema.String),
    base: Schema.optionalKey(Schema.Literal("latest-tag")),
    preset: Schema.optionalKey(Schema.Literal("conventionalcommits")),
    releaseRules: Schema.optionalKey(Schema.Array(ConventionalCommitReleaseRule))
  }
) {}

export class IntentFilesReleaseDecision extends Schema.TaggedClass<IntentFilesReleaseDecision>()(
  "IntentFilesReleaseDecision",
  {
    directory: Schema.optionalKey(Schema.String),
    packagePath: Schema.optionalKey(Schema.String),
    tagTemplate: Schema.optionalKey(Schema.String),
    requireIntent: Schema.optionalKey(Schema.Boolean)
  }
) {}

export const ReleaseDecisionStrategy = Schema.Union([
  RemoteStateReleaseDecision,
  GitTagReleaseDecision,
  ConventionalCommitsReleaseDecision,
  IntentFilesReleaseDecision
])
export type ReleaseDecisionStrategy = typeof ReleaseDecisionStrategy.Type

export class ReleaseIntentFile extends Schema.Class<ReleaseIntentFile>("ReleaseIntentFile")({
  "$schema": Schema.optionalKey(Schema.String),
  "package": ReleaseName,
  release: ReleaseBump,
  summary: Schema.String,
  empty: Schema.optionalKey(Schema.Boolean)
}) {}

export class SourceMetadata extends Schema.Class<SourceMetadata>("SourceMetadata")({
  root: Schema.String,
  configPath: Schema.optionalKey(Schema.String)
}) {}

export class ReleaseIntent extends Schema.Class<ReleaseIntent>("ReleaseIntent")({
  "$schema": Schema.optionalKey(Schema.String),
  identity: ReleaseIdentitySource,
  releaseDecision: Schema.optionalKey(ReleaseDecisionStrategy),
  artifacts: Schema.Array(ArtifactIntent),
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
