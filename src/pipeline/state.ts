import * as Schema from "effect/Schema"
import { ArtifactCatalog } from "./catalog.js"
import { PipelineOperation } from "./operation.js"

export type * from "../types/effect-internal.js"

export class ReleaseIdentity extends Schema.Class<ReleaseIdentity>("PipelineReleaseIdentity")({
  name: Schema.String,
  normalizedName: Schema.String,
  version: Schema.String,
  tag: Schema.String,
  commit: Schema.String,
  shortCommit: Schema.String,
  notes: Schema.optionalKey(Schema.String),
  versionSource: Schema.String,
  snapshot: Schema.Boolean
}) {}

export class PipeNotice extends Schema.Class<PipeNotice>("PipeNotice")({
  pipeId: Schema.String,
  severity: Schema.Literals(["info", "warning"]),
  reason: Schema.String
}) {}

export class ReleaseState extends Schema.Class<ReleaseState>("ReleaseState")({
  identity: ReleaseIdentity,
  strict: Schema.Boolean,
  artifacts: ArtifactCatalog,
  operations: Schema.Array(PipelineOperation),
  notices: Schema.Array(PipeNotice)
}) {}

export const emptyReleaseState = (identity: ReleaseIdentity, strict: boolean): ReleaseState =>
  ReleaseState.make({
    identity,
    strict,
    artifacts: ArtifactCatalog.empty,
    operations: [],
    notices: []
  })
