import * as Schema from "effect/Schema"
import { AnnounceOp, BuildOp, CatalogOp, ProcessOp, PublishOp, ValidateOp, VerifyOp } from "./operation.js"
import { NonEmptyName, Version } from "./primitives.js"

export class ReleaseIdentityV6 extends Schema.Class<ReleaseIdentityV6>("ReleaseIdentityV6")({
  name: NonEmptyName, version: Version, tag: NonEmptyName, commit: NonEmptyName,
  snapshot: Schema.Boolean
}) {}

export class Annotation extends Schema.Class<Annotation>("Annotation")({
  key: Schema.NonEmptyString, value: Schema.String
}) {}

export class ReleaseStages extends Schema.Class<ReleaseStages>("ReleaseStages")({
  build: Schema.Array(BuildOp), process: Schema.Array(ProcessOp), catalog: Schema.Array(CatalogOp),
  validate: Schema.Array(ValidateOp), publish: Schema.Array(PublishOp), announce: Schema.Array(AnnounceOp),
  verify: Schema.Array(VerifyOp)
}) {}

export class ReleasePlanV6 extends Schema.Class<ReleasePlanV6>("ReleasePlanV6")({
  schemaVersion: Schema.Literal("release-plan/v6"), identity: ReleaseIdentityV6, stages: ReleaseStages,
  annotations: Schema.Array(Annotation)
}) {}
