import * as Schema from "effect/Schema"
import type * as JsonSchema from "effect/JsonSchema"
import {
  ReleaseConfigBunExecutableBuild
} from "../builders/bun.js"
import {
  ReleaseConfigCommandBuild
} from "../builders/command.js"
import {
  ReleaseConfigPrebuiltBuild
} from "../builders/prebuilt.js"
import {
  ReleaseConfigArchive
} from "../pipes/archive.js"
import {
  ReleaseConfigHomebrewPublish
} from "../pipes/catalog-homebrew.js"
import {
  ReleaseConfigScoopPublish
} from "../pipes/catalog-scoop.js"
import {
  ReleaseConfigManualArtifact
} from "../pipes/import-artifacts.js"
import {
  ReleaseConfigChecksum
} from "../pipes/checksum.js"
import {
  ReleaseConfigNpmPackageBuild
} from "../pipes/npm-pack.js"
import {
  ReleaseConfigGitHubPublish
} from "../pipes/publish-github.js"
import {
  ReleaseConfigNpmPublish
} from "../pipes/publish-npm.js"
import {
  ReleaseConfigPyPiPublish
} from "../pipes/publish-pypi.js"
import {
  ReleaseConfigPyPiWheelBuild
} from "../pipes/pypi-wheel.js"
import { SafeRelativePath } from "../pipeline/artifact.js"

export const DEFAULT_CONFIG_PATH = "release.config.json"
export const RELEASE_CONFIG_SCHEMA_ID = "https://mannyc2.github.io/ts-release/schema/release-config.schema.json"
export const ReleaseVersionSource = Schema.Literals(["manifest", "git-tag"])
export type ReleaseVersionSource = typeof ReleaseVersionSource.Type

export class ReleaseConfigProject extends Schema.Class<ReleaseConfigProject>("ReleaseConfigProject")({
  name: Schema.optionalKey(Schema.NonEmptyString),
  packageName: Schema.optionalKey(Schema.NonEmptyString),
  version: Schema.optionalKey(Schema.NonEmptyString),
  repository: Schema.optionalKey(Schema.NonEmptyString),
  packagePath: Schema.optionalKey(SafeRelativePath),
  commit: Schema.optionalKey(Schema.NonEmptyString),
  tag: Schema.optionalKey(Schema.NonEmptyString),
  tagTemplate: Schema.optionalKey(Schema.NonEmptyString),
  notes: Schema.optionalKey(Schema.String)
}) {}

export const ReleaseConfigBuildItem = Schema.Union([
  ReleaseConfigBunExecutableBuild,
  ReleaseConfigCommandBuild,
  ReleaseConfigPrebuiltBuild
])
export type ReleaseConfigBuildItem = typeof ReleaseConfigBuildItem.Type

export class ReleaseConfigPublish extends Schema.Class<ReleaseConfigPublish>("ReleaseConfigPublish")({
  npm: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigNpmPublish])),
  github: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigGitHubPublish])),
  homebrew: Schema.optionalKey(ReleaseConfigHomebrewPublish),
  scoop: Schema.optionalKey(ReleaseConfigScoopPublish),
  pypi: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigPyPiPublish]))
}) {}

export class ReleaseConfigEvidence extends Schema.Class<ReleaseConfigEvidence>("ReleaseConfigEvidence")({
  directory: SafeRelativePath
}) {}

export class ReleaseIntent extends Schema.Class<ReleaseIntent>("ReleaseIntent")({
  "$schema": Schema.optionalKey(Schema.String),
  project: ReleaseConfigProject,
  versionFrom: Schema.optionalKey(ReleaseVersionSource),
  builds: Schema.optionalKey(Schema.Array(ReleaseConfigBuildItem)),
  npmPackage: Schema.optionalKey(Schema.Union([Schema.Boolean, ReleaseConfigNpmPackageBuild])),
  pypiWheel: Schema.optionalKey(Schema.Union([ReleaseConfigPyPiWheelBuild, Schema.Array(ReleaseConfigPyPiWheelBuild)])),
  artifacts: Schema.optionalKey(Schema.Array(ReleaseConfigManualArtifact)),
  archives: Schema.optionalKey(Schema.Array(ReleaseConfigArchive)),
  checksum: Schema.optionalKey(ReleaseConfigChecksum),
  publish: ReleaseConfigPublish,
  evidence: Schema.optionalKey(Schema.Union([SafeRelativePath, ReleaseConfigEvidence]))
}) {}

export const ReleaseConfig = ReleaseIntent
export type ReleaseConfig = typeof ReleaseConfig.Type

export const decodeReleaseConfig = Schema.decodeUnknownEffect(ReleaseConfig)

export const releaseConfigJsonSchemaDocument = (): JsonSchema.JsonSchema => {
  const document = Schema.toJsonSchemaDocument(ReleaseConfig)
  return {
    ...document.schema,
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: RELEASE_CONFIG_SCHEMA_ID,
    title: "ts-release configuration",
    description: "Configuration for an artifact-first ts-release distribution workflow.",
    $defs: document.definitions
  }
}

export const renderReleaseConfigJsonSchema = (): string =>
  `${JSON.stringify(releaseConfigJsonSchemaDocument(), null, 2)}\n`
