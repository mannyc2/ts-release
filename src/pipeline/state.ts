import * as Schema from "effect/Schema"
import { SemverVersion } from "./semver.js"


export class ReleaseIdentity extends Schema.Class<ReleaseIdentity>("PipelineReleaseIdentity")({
  name: Schema.String,
  normalizedName: Schema.String,
  version: SemverVersion,
  tag: Schema.String,
  commit: Schema.String,
  shortCommit: Schema.String,
  notes: Schema.optional(Schema.String),
  versionSource: Schema.String,
  snapshot: Schema.Boolean
}) {}

export class PipeNotice extends Schema.Class<PipeNotice>("PipeNotice")({
  pipeId: Schema.String,
  severity: Schema.Literals(["info", "warning"]),
  reason: Schema.String
}) {}
