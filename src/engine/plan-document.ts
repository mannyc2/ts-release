import * as Schema from "effect/Schema"
import {
  ArtifactInventoryItem
} from "../pipeline/artifact.js"
import { ReleaseState } from "../pipeline/state.js"


export class SourceMetadata extends Schema.Class<SourceMetadata>("SourceMetadata")({
  root: Schema.String,
  configPath: Schema.optionalKey(Schema.String)
}) {}

export class ReleasePlanDocument extends Schema.Class<ReleasePlanDocument>("ReleasePlanDocument")({
  schemaVersion: Schema.Literal("release-plan/v2"),
  state: ReleaseState,
  source: SourceMetadata,
  artifacts: Schema.Array(ArtifactInventoryItem),
  evidenceDirectory: Schema.String
}) {}
