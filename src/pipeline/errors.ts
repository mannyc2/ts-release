import * as Schema from "effect/Schema"

export type * from "../types/effect-internal.js"

export class PlanError extends Schema.TaggedErrorClass<PlanError>()("PlanError", {
  pipeId: Schema.String,
  field: Schema.optionalKey(Schema.String),
  reason: Schema.String
}) {}

export class IdentityError extends Schema.TaggedErrorClass<IdentityError>()("IdentityError", {
  source: Schema.String,
  field: Schema.optionalKey(Schema.String),
  reason: Schema.String,
  cause: Schema.optionalKey(Schema.Defect())
}) {}
