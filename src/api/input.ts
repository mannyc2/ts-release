import * as Schema from "effect/Schema"
import { existsSync, realpathSync, statSync } from "node:fs"
import { isAbsolute } from "node:path"
import { CompletePreparedReleaseRef } from "../release/prepared-ref.js"
import { AuthoredCorrection } from "../correction/intent.js"
import { PreparationModeUnsupported, ReleaseInputError } from "./errors.js"
import type {
  CorrectInput,
  InspectInput,
  ObserveInput,
  PrepareInput,
  PublishInput,
  ReleaseInput
} from "./types.js"

const prepareInput = Schema.Struct({
  config: Schema.Unknown,
  workspace: Schema.String
})

const inspectConfigInput = Schema.Struct({
  config: Schema.Unknown,
  workspace: Schema.String
})

const preparedInput = Schema.Struct({ prepared: CompletePreparedReleaseRef })
const inspectInput = Schema.Union([inspectConfigInput, preparedInput])
const publishInput = preparedInput
const observeInput = preparedInput

const releaseInput = Schema.Struct({
  config: Schema.Unknown,
  workspace: Schema.String,
  allowEmpty: Schema.optionalKey(Schema.Boolean)
})

const correctInput = Schema.Struct({
  prepared: CompletePreparedReleaseRef,
  correction: AuthoredCorrection
})

const decode = <S extends Schema.Top & Schema.Decoder<unknown>>(
  schema: S,
  value: unknown
): S["Type"] => {
  try {
    return Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(value) as S["Type"]
  } catch (cause) {
    throw new ReleaseInputError({
      reason: String(cause).split("\n").slice(0, 8).join("\n").slice(0, 500)
    })
  }
}

const rejectReservedPreparationMode = (value: unknown): void => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return
  const mode = (value as { readonly mode?: unknown }).mode
  if (mode !== "partition" && mode !== "merge") return
  throw PreparationModeUnsupported.make({
    mode,
    owner: "plan-235",
    reason: `Preparation mode '${mode}' is reserved and unsupported until plan 235 adds its first certified producer.`
  })
}

export const decodePrepareInput = (value: unknown): PrepareInput => {
  rejectReservedPreparationMode(value)
  return decode(prepareInput, value)
}

export const decodeReleaseInput = (value: unknown): ReleaseInput => {
  rejectReservedPreparationMode(value)
  return decode(releaseInput, value)
}

export const decodeObserveInput = (value: unknown): ObserveInput => decode(observeInput, value)
export const decodePublishInput = (value: unknown): PublishInput => decode(publishInput, value)
export const decodeCorrectInput = (value: unknown): CorrectInput => decode(correctInput, value)
export const decodeInspectInput = (value: unknown): InspectInput => decode(inspectInput, value)

export const absoluteDirectory = (value: string, field: string): string => {
  if (!isAbsolute(value) || !existsSync(value)) {
    throw new ReleaseInputError({ reason: `${field} must be an existing absolute directory.` })
  }
  const canonical = realpathSync(value)
  if (!statSync(canonical).isDirectory()) {
    throw new ReleaseInputError({ reason: `${field} must be a directory.` })
  }
  return canonical
}

export const workspaceRoot = (value: string): string => absoluteDirectory(value, "workspace")
