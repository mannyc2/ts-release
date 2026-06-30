import * as Schema from "effect/Schema"
import {
  ArtifactFormat,
  ArtifactIntent,
  ArtifactInventoryItem,
  ArtifactRecipe,
  BunExecutableCompileTarget,
  Checksum,
  InstallableArtifactVariant,
  InstallableArtifactVariantOverride,
  PyPiWheelBinaryArtifact
} from "./artifact.js"
import { Operation } from "./operation.js"
import {
  NpmAccess,
  TargetCapabilities,
  TargetConfig,
  TrustedPublishingProvider
} from "./target.js"

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

export class ReleaseConfigProject extends Schema.Class<ReleaseConfigProject>("ReleaseConfigProject")({
  name: Schema.optionalKey(Schema.NonEmptyString),
  package: Schema.optionalKey(Schema.NonEmptyString),
  packageName: Schema.optionalKey(Schema.NonEmptyString),
  version: Schema.optionalKey(Schema.NonEmptyString),
  repository: Schema.optionalKey(Schema.NonEmptyString),
  packagePath: Schema.optionalKey(Schema.NonEmptyString),
  commit: Schema.optionalKey(Schema.NonEmptyString),
  tag: Schema.optionalKey(Schema.NonEmptyString),
  tagTemplate: Schema.optionalKey(Schema.NonEmptyString),
  notes: Schema.optionalKey(Schema.String)
}) {}

export class ReleaseConfigNpmPackageBuild extends Schema.Class<ReleaseConfigNpmPackageBuild>(
  "ReleaseConfigNpmPackageBuild"
)({
  id: Schema.optionalKey(Schema.NonEmptyString),
  path: Schema.optionalKey(Schema.NonEmptyString),
  consumers: Schema.optionalKey(Schema.Array(Schema.String))
}) {}

export class ReleaseConfigManualArtifact extends Schema.Class<ReleaseConfigManualArtifact>(
  "ReleaseConfigManualArtifact"
)({
  id: Schema.String,
  path: Schema.String,
  downloadUrl: Schema.optionalKey(Schema.String),
  format: ArtifactFormat,
  consumers: Schema.Array(Schema.String),
  checksum: Schema.optionalKey(Checksum),
  variant: Schema.optionalKey(InstallableArtifactVariant)
}) {}

export class ReleaseConfigBunExecutableOutput extends Schema.Class<ReleaseConfigBunExecutableOutput>(
  "ReleaseConfigBunExecutableOutput"
)({
  id: Schema.optionalKey(Schema.String),
  target: BunExecutableCompileTarget,
  path: Schema.optionalKey(Schema.String),
  downloadUrl: Schema.optionalKey(Schema.String),
  consumers: Schema.optionalKey(Schema.Array(Schema.String)),
  variant: Schema.optionalKey(InstallableArtifactVariantOverride)
}) {}

export class ReleaseConfigBunExecutableBuild extends Schema.Class<ReleaseConfigBunExecutableBuild>(
  "ReleaseConfigBunExecutableBuild"
)({
  id: Schema.optionalKey(Schema.String),
  entry: Schema.String,
  targets: Schema.optionalKey(Schema.Array(BunExecutableCompileTarget)),
  outputs: Schema.optionalKey(Schema.Array(ReleaseConfigBunExecutableOutput)),
  outDir: Schema.optionalKey(Schema.String),
  name: Schema.optionalKey(Schema.String),
  consumers: Schema.optionalKey(Schema.Array(Schema.String)),
  binaryName: Schema.optionalKey(Schema.String),
  installPath: Schema.optionalKey(Schema.String),
  minify: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseConfigPyPiWheelBuild extends Schema.Class<ReleaseConfigPyPiWheelBuild>(
  "ReleaseConfigPyPiWheelBuild"
)({
  id: Schema.String,
  path: Schema.String,
  wheelTag: Schema.String,
  packageName: Schema.String,
  moduleName: Schema.String,
  consoleScript: Schema.String,
  summary: Schema.String,
  homepage: Schema.String,
  license: Schema.String,
  requiresPython: Schema.String,
  binaries: Schema.Array(PyPiWheelBinaryArtifact),
  consumers: Schema.optionalKey(Schema.Array(Schema.String))
}) {}

export class ReleaseConfigBuild extends Schema.Class<ReleaseConfigBuild>("ReleaseConfigBuild")({
  npmPackage: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigNpmPackageBuild])),
  bun: Schema.optionalKey(ReleaseConfigBunExecutableBuild),
  pypiWheel: Schema.optionalKey(Schema.Union([ReleaseConfigPyPiWheelBuild, Schema.Array(ReleaseConfigPyPiWheelBuild)])),
  artifacts: Schema.optionalKey(Schema.Array(ReleaseConfigManualArtifact))
}) {}

export class ReleaseConfigNpmTrustedPublishing extends Schema.Class<ReleaseConfigNpmTrustedPublishing>(
  "ReleaseConfigNpmTrustedPublishing"
)({
  provider: Schema.optionalKey(TrustedPublishingProvider),
  workflow: Schema.optionalKey(Schema.String),
  packageExists: Schema.optionalKey(Schema.Literal(true)),
  verifyPackageExists: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseConfigPyPiTrustedPublishing extends Schema.Class<ReleaseConfigPyPiTrustedPublishing>(
  "ReleaseConfigPyPiTrustedPublishing"
)({
  provider: Schema.optionalKey(TrustedPublishingProvider),
  workflow: Schema.optionalKey(Schema.String),
  publisherConfigured: Schema.optionalKey(Schema.Literal(true))
}) {}

export class ReleaseConfigNpmPublish extends Schema.Class<ReleaseConfigNpmPublish>("ReleaseConfigNpmPublish")({
  registry: Schema.optionalKey(Schema.String),
  packageName: Schema.optionalKey(Schema.NonEmptyString),
  packagePath: Schema.optionalKey(Schema.String),
  tokenEnv: Schema.optionalKey(Schema.String),
  trustedPublishing: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigNpmTrustedPublishing])),
  access: Schema.optionalKey(NpmAccess),
  provenance: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseConfigGitHubPublish extends Schema.Class<ReleaseConfigGitHubPublish>(
  "ReleaseConfigGitHubPublish"
)({
  repository: Schema.optionalKey(Schema.String),
  tokenEnv: Schema.optionalKey(Schema.String),
  draft: Schema.optionalKey(Schema.Boolean),
  prerelease: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseConfigHomebrewPublish extends Schema.Class<ReleaseConfigHomebrewPublish>(
  "ReleaseConfigHomebrewPublish"
)({
  repository: Schema.String,
  formulaName: Schema.optionalKey(Schema.String),
  formulaPath: Schema.optionalKey(Schema.String),
  artifactId: Schema.optionalKey(Schema.String),
  artifactIds: Schema.optionalKey(Schema.Array(Schema.String)),
  homepage: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  url: Schema.optionalKey(Schema.String),
  tapDirectory: Schema.optionalKey(Schema.String),
  installPath: Schema.optionalKey(Schema.String),
  tokenEnv: Schema.optionalKey(Schema.String)
}) {}

export class ReleaseConfigScoopPublish extends Schema.Class<ReleaseConfigScoopPublish>(
  "ReleaseConfigScoopPublish"
)({
  repository: Schema.String,
  manifestName: Schema.optionalKey(Schema.String),
  manifestPath: Schema.optionalKey(Schema.String),
  artifactId: Schema.optionalKey(Schema.String),
  homepage: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  license: Schema.optionalKey(Schema.String),
  url: Schema.optionalKey(Schema.String),
  bin: Schema.optionalKey(Schema.String),
  bucketDirectory: Schema.optionalKey(Schema.String),
  tokenEnv: Schema.optionalKey(Schema.String)
}) {}

export class ReleaseConfigPyPiPublish extends Schema.Class<ReleaseConfigPyPiPublish>("ReleaseConfigPyPiPublish")({
  repositoryUrl: Schema.optionalKey(Schema.String),
  pythonExecutable: Schema.optionalKey(Schema.String),
  usernameEnv: Schema.optionalKey(Schema.String),
  passwordEnv: Schema.optionalKey(Schema.String),
  trustedPublishing: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigPyPiTrustedPublishing]))
}) {}

export class ReleaseConfigPublish extends Schema.Class<ReleaseConfigPublish>("ReleaseConfigPublish")({
  npm: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigNpmPublish])),
  github: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigGitHubPublish])),
  homebrew: Schema.optionalKey(ReleaseConfigHomebrewPublish),
  scoop: Schema.optionalKey(ReleaseConfigScoopPublish),
  pypi: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigPyPiPublish]))
}) {}

export class ReleaseConfigEvidence extends Schema.Class<ReleaseConfigEvidence>("ReleaseConfigEvidence")({
  directory: Schema.String
}) {}

export class ReleaseIntent extends Schema.Class<ReleaseIntent>("ReleaseIntent")({
  "$schema": Schema.optionalKey(Schema.String),
  project: ReleaseConfigProject,
  build: Schema.optionalKey(ReleaseConfigBuild),
  publish: ReleaseConfigPublish,
  strict: Schema.optionalKey(Schema.Boolean),
  evidence: Schema.optionalKey(Schema.Union([Schema.String, ReleaseConfigEvidence]))
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
