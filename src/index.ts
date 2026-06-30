import type { ReleaseConfig } from "./config/schema.js"

export {
  RELEASE_CONFIG_SCHEMA_ID,
  releaseConfigJsonSchemaDocument as releaseConfigJsonSchema,
  renderReleaseConfigJsonSchema
} from "./config/schema.js"

export type { ReleaseConfig } from "./config/schema.js"

export interface ReleasePlanSummaryArtifact {
  readonly name: string
  readonly path: string
  readonly platform?: string | undefined
}

export interface ReleasePlanSummaryTarget {
  readonly name: string
  readonly operations: number
  readonly publishes: boolean
}

export interface ReleasePlanSummary {
  readonly name: string
  readonly version: string
  readonly artifacts: ReadonlyArray<ReleasePlanSummaryArtifact>
  readonly targets: ReadonlyArray<ReleasePlanSummaryTarget>
}

export const defineRelease = <const Config extends ReleaseConfig>(config: Config): Config =>
  config
