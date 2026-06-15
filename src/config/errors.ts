import * as Schema from "effect/Schema"

export type * from "../types/effect-internal.js"

export class ConfigReadError extends Schema.TaggedErrorClass<ConfigReadError>()("ConfigReadError", {
  path: Schema.String,
  reason: Schema.String
}) {}

export class ConfigParseError extends Schema.TaggedErrorClass<ConfigParseError>()("ConfigParseError", {
  path: Schema.String,
  reason: Schema.String
}) {}

export class ConfigValidationError extends Schema.TaggedErrorClass<ConfigValidationError>()("ConfigValidationError", {
  path: Schema.String,
  reason: Schema.String
}) {}

export type ConfigError = ConfigReadError | ConfigParseError | ConfigValidationError

export const formatUnknown = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)
