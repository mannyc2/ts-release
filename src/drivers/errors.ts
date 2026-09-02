import * as Schema from "effect/Schema"

export class DriverError
  extends Schema.TaggedError<DriverError>()("DriverError", {
    reason: Schema.String, commitment: Schema.Literals(["before-commit", "unknown"])
  }) {}
