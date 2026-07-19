// Invariant: this root is the package's only public TypeScript surface; internal taxonomy never leaks as subpaths.
import type { ReleaseIntent } from "./config/schema.js"

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

export type { ReleaseIntent } from "./config/schema.js"

export type {
  ArtifactSummary,
  BuildSummary,
  ReleasePlanSummary,
  ReleaseSummary,
  RunOptions,
  VerifySummary
} from "./engine/engine.js"

export const defineRelease = <const Config extends ReleaseIntent>(config: Config): Config =>
  config
