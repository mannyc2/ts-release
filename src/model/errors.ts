import * as Schema from "effect/Schema"

const reason = { reason: Schema.String }
export const MISSING_COMMIT = "source.commit is required and could not be observed from the repository."
export class ConfigValueError extends Schema.TaggedError<ConfigValueError>()("ConfigValueError", reason) {}
export class ConfigDecodeError extends Schema.TaggedError<ConfigDecodeError>()("ConfigDecodeError", reason) {}
