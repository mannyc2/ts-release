// Invariant: ReleaseIntent is the sole wire representation and source of its JSON Schema.
import * as Schema from "effect/Schema"
import type * as JsonSchema from "effect/JsonSchema"
import { ReleaseConfigBunExecutableBuild } from "../features/bun.js"
import { ReleaseConfigCommandBuild } from "../features/command.js"
import { ReleaseConfigPrebuiltBuild } from "../features/prebuilt.js"
import { ReleaseConfigArchive } from "../features/archive.js"
import { ReleaseConfigHomebrewPublish } from "../features/catalog-homebrew.js"
import { ReleaseConfigScoopPublish } from "../features/catalog-scoop.js"
import { ReleaseConfigCatalogEntry } from "../features/catalog-generic.js"
import { ReleaseConfigManualArtifact } from "../features/import-artifacts.js"
import { ReleaseConfigChecksum } from "../features/checksum.js"
import { ReleaseConfigNpmPackageBuild } from "../features/npm-pack.js"
import { ReleaseConfigGitHubPublish } from "../features/publish-github.js"
import { ReleaseConfigNpmPublish } from "../features/publish-npm.js"
import { ReleaseConfigPyPiPublish } from "../features/publish-pypi.js"
import { ReleaseConfigPyPiWheelBuild } from "../features/pypi-wheel.js"
import { SafeRelativePath } from "../grammar/artifact.js"

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
  catalogs: Schema.optionalKey(Schema.Array(ReleaseConfigCatalogEntry)),
  publish: ReleaseConfigPublish,
  evidence: Schema.optionalKey(Schema.Union([SafeRelativePath, ReleaseConfigEvidence]))
}) {}

export const decodeReleaseConfig = Schema.decodeUnknownEffect(ReleaseIntent, { onExcessProperty: "error" })

export const releaseConfigJsonSchemaDocument = (): JsonSchema.JsonSchema => {
  const document = Schema.toJsonSchemaDocument(ReleaseIntent)
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
