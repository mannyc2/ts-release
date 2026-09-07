import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { createHash } from "node:crypto"
import { ReleaseError } from "@mannyc1/ts-release"
import { decodeJson } from "@mannyc1/ts-release/http"
import { UploadIntent } from "./Model.js"

export const invalid = (code: string): never => {
  throw new ReleaseError({
    code: `pypi-${code}`,
    message: `Python index ${code.replaceAll("-", " ")} could not be admitted`,
  })
}
export const attempt = <A>(body: () => A) =>
  Effect.try({
    try: body,
    catch: (error) =>
      error instanceof ReleaseError
        ? error
        : new ReleaseError({
            code: "pypi-data",
            message: "Python index data could not be admitted",
          }),
  })
export const encode = (input: unknown) => new TextEncoder().encode(JSON.stringify(input))
export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
export const own = <A, I>(codec: Schema.Codec<A, I>, input: unknown): A => {
  const decode = Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })
  return decode(decodeJson(encode(Schema.encodeSync(codec)(decode(input)))))
}
export const object = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return invalid("object")
  return value as Record<string, unknown>
}
export const scopeFor = (intent: UploadIntent) => JSON.stringify(own(UploadIntent, intent))
export const readScope = (scope: string) => {
  const intent = own(UploadIntent, decodeJson(new TextEncoder().encode(scope)))
  if (scope !== scopeFor(intent)) invalid("scope")
  return intent
}
export const MAX_BYTES = 128 * 1024 * 1024
