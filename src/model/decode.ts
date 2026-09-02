// The rc-line sync decoder throws a generic "Schema validation failed" with
// the issue only in `cause`; refusals in this codebase must name what
// disagreed, so this boundary restores the formatted issue as the message.
import * as Schema from "effect/Schema"
import * as SchemaIssue from "effect/SchemaIssue"

const formatIssue = SchemaIssue.makeFormatterDefault()

/** Human-readable failure text; unwraps rc-line generic schema errors. */
export const describeFailure = (cause: unknown): string => {
  if (cause instanceof Error) {
    return SchemaIssue.isIssue(cause.cause) ? formatIssue(cause.cause) : cause.message
  }
  return String(cause)
}

export const decodeUnknownSync: typeof Schema.decodeUnknownSync = (schema, options) => {
  const decode = Schema.decodeUnknownSync(schema, options)
  return (input, overrideOptions) => {
    try {
      return decode(input, overrideOptions)
    } catch (error) {
      if (error instanceof Error && SchemaIssue.isIssue(error.cause)) {
        throw new Error(formatIssue(error.cause), { cause: error.cause })
      }
      throw error
    }
  }
}
