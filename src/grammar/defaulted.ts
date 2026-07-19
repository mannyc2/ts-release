// Invariant: a wire-optional field decodes to one total value while encoding and JSON Schema retain the wire shape.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
export const defaulted = <S extends Schema.Top>(schema: S, value: S["Type"]) => Schema.optionalKey(schema).pipe(Schema.decodeTo(schema, {
    decode: SchemaGetter.withDefault(Effect.succeed(value)), encode: SchemaGetter.passthrough()
  }))
