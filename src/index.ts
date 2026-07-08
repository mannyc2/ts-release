import type { ReleaseConfig } from "./config/schema.js"

export type * from "./types/effect-internal.js"

export {
  build,
  disposeReleaseRuntime,
  plan,
  release,
  verify
} from "./api/api.js"

export {
  ReleaseApiError
} from "./api/errors.js"

export {
  RELEASE_CONFIG_SCHEMA_ID,
  releaseConfigJsonSchemaDocument as releaseConfigJsonSchema,
  renderReleaseConfigJsonSchema
} from "./config/schema.js"

export type { ReleaseConfig } from "./config/schema.js"

export type {
  BuildSummary,
  ReleasePlanSummary,
  ReleaseRunOptions,
  ReleaseSummary,
  RunOptions,
  VerifySummary
} from "./engine/engine.js"

export const defineRelease = <const Config extends ReleaseConfig>(config: Config): Config =>
  config
