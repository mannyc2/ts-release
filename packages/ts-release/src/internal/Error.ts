import { Effect, Schema } from "effect"

/** A failure to admit or execute a release operation. */
export class ReleaseError extends Schema.TaggedError<ReleaseError>()("ReleaseError", {
  code: Schema.String,
  message: Schema.String,
}) {}
export function fail(code: string, message: string): never {
  throw new ReleaseError({ code, message })
}
export const failure = (code: string, message: string) => new ReleaseError({ code, message })
export const reject = (code: string, message: string): Effect.Effect<never, ReleaseError> =>
  Effect.fail(failure(code, message))
export const attempt = <A>(body: () => A): Effect.Effect<A, ReleaseError> =>
  Effect.try({
    try: body,
    catch: (error) =>
      error instanceof ReleaseError
        ? error
        : new ReleaseError({ code: "invalid-data", message: "Value could not be admitted" }),
  })
