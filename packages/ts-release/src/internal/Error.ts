import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

/** A failure to admit or execute a release operation. */
export class ReleaseError extends Schema.TaggedError<ReleaseError>()("ReleaseError", {
  code: Schema.String,
  message: Schema.String,
}) {}
export function fail(code: string, message: string): never {
  throw new ReleaseError({ code, message })
}
export const attempt = <A>(body: () => A): Effect.Effect<A, ReleaseError> =>
  Effect.try({
    try: body,
    catch: (error) =>
      error instanceof ReleaseError
        ? error
        : new ReleaseError({ code: "invalid-data", message: "Value could not be admitted" }),
  })
