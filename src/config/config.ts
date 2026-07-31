import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  ConfigDecodeError,
  ConfigValueError
} from "../model/errors.js"
import { CandidateConfig } from "../recipes/config.js"

export {
  CandidateArtifact,
  CandidateChecksum,
  CandidateConfig,
  CandidateProject
} from "../recipes/config.js"

const jsonFailure = (value: unknown, parents: Set<object>): string | undefined => {
  if (value === null || typeof value === "boolean" || typeof value === "string") return undefined
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && !Object.is(value, -0) ? undefined : "invalid number"
  }
  if (typeof value !== "object") return `invalid ${typeof value}`
  if (parents.has(value)) return "cyclic value"
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
    return "non-plain object"
  }
  parents.add(value)
  const items = Array.isArray(value) ? value : Object.values(value)
  if (Array.isArray(value) && items.length !== Object.keys(value).length) return "sparse array"
  for (const item of items) {
    const failure = jsonFailure(item, parents)
    if (failure !== undefined) return failure
  }
  parents.delete(value)
  return undefined
}

export const decodeConfig = Effect.fn("decodeConfig")(function*(input: unknown) {
  if (typeof input === "string") {
    return yield* ConfigValueError.make({ reason: "Core config must be a value, not text or path." })
  }
  const failure = jsonFailure(input, new Set())
  if (failure !== undefined) return yield* ConfigValueError.make({ reason: failure })
  return yield* Schema.decodeUnknownEffect(CandidateConfig, {
    onExcessProperty: "error"
  })(input).pipe(
    Effect.mapError((error) => ConfigDecodeError.make({ reason: error.message }))
  )
})
