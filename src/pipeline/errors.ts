import * as Schema from "effect/Schema"


export class PlanError extends Schema.TaggedErrorClass<PlanError>()("PlanError", {
  pipeId: Schema.String,
  field: Schema.optional(Schema.String),
  reason: Schema.String
}) {}

export class IdentityError extends Schema.TaggedErrorClass<IdentityError>()("IdentityError", {
  source: Schema.String,
  field: Schema.optional(Schema.String),
  reason: Schema.String,
  cause: Schema.optional(Schema.Defect())
}) {}
