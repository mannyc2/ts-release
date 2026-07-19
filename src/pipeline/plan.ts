// Invariant: release-plan/v3 is the sole strict durable plan; transient accumulator state is never encoded here.
import * as Schema from "effect/Schema"
import { Artifact } from "./artifact.js"
import { Operation } from "./operation.js"
import { PipeNotice, ReleaseIdentity } from "./state.js"

export class SourceMetadata extends Schema.Class<SourceMetadata>("SourceMetadata")({
  root: Schema.String,
  configPath: Schema.optional(Schema.String)
}) {}

export class ReleasePlan extends Schema.Class<ReleasePlan>("ReleasePlan")({
  schemaVersion: Schema.Literal("release-plan/v3"),
  identity: ReleaseIdentity,
  artifacts: Schema.Array(Artifact),
  operations: Schema.Array(Operation),
  notices: Schema.Array(PipeNotice),
  source: SourceMetadata,
  evidenceDirectory: Schema.String
}) {}

const releasePlanDecodeOptions = { onExcessProperty: "error" } as const

export const decodeReleasePlan = Schema.decodeUnknownEffect(ReleasePlan, releasePlanDecodeOptions)
export const decodeReleasePlanSync = Schema.decodeUnknownSync(ReleasePlan, releasePlanDecodeOptions)
