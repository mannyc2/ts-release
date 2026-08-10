import * as Schema from "effect/Schema"

export class ReleaseInputError
  extends Schema.TaggedErrorClass<ReleaseInputError>()("ReleaseInputError", { reason: Schema.String }) {}
