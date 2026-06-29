import * as Schema from "effect/Schema"
import type * as JsonSchema from "effect/JsonSchema"
import { ReleaseIntent } from "../domain/release.js"

export type * from "../types/effect-internal.js"

export const DEFAULT_CONFIG_PATH = "release.config.json"
export const RELEASE_CONFIG_SCHEMA_ID = "https://mannyc2.github.io/ts-release/schema/release-config.schema.json"

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
