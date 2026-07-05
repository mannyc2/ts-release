import * as Schema from "effect/Schema"
import { ArtifactCatalog } from "./catalog.js"
import { Operation } from "./operation.js"


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
  artifacts: ArtifactCatalog,
  operations: Schema.Array(Operation),
  notices: Schema.Array(PipeNotice)
}) {}

export const emptyReleaseState = (identity: ReleaseIdentity): ReleaseState =>
  ReleaseState.make({
    identity,
    artifacts: ArtifactCatalog.empty,
    operations: [],
    notices: []
  })
