// Invariant: config failures share one durable shape; kind identifies the boundary that failed.
import * as Schema from "effect/Schema"

export class ConfigError extends Schema.TaggedErrorClass<ConfigError>()("ConfigError", {
  kind: Schema.Literals(["read", "parse", "validation"]),
  path: Schema.String,
  reason: Schema.String,
  cause: Schema.optionalKey(Schema.Defect())
}) {}
