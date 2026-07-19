// Invariant: JSON boundaries accept only Schema JSON values and return no alternate document representation.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export const parseJsonAs = <S extends Schema.Top, E>(
  schema: S,
  input: string,
  makeError: (cause: unknown) => E
): Effect.Effect<S["Type"], E, S["DecodingServices"]> =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(input).pipe(
    Effect.mapError(makeError)
  )
