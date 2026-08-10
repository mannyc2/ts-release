import * as Schema from "effect/Schema"
import { existsSync, realpathSync, statSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { ReleaseInputError } from "./errors.js"
import type { CorrectInput, InspectInput, PrepareInput, PublishInput, ReleaseInput } from "./types.js"

const configInput = Schema.Struct({ config: Schema.Unknown, workspace: Schema.String, preparedDirectory: Schema.optionalKey(Schema.String) })
const inspectInput = Schema.Struct({ config: Schema.optionalKey(Schema.Unknown), prepared: Schema.optionalKey(Schema.String), workspace: Schema.optionalKey(Schema.String) })
const credentials = Schema.Struct({ read: Schema.NonEmptyString, publish: Schema.NonEmptyString })
const credentialInput = Schema.Struct({ npm: Schema.optionalKey(credentials), github: Schema.optionalKey(credentials) })
const publishInput = Schema.Struct({ prepared: Schema.String, credentials: Schema.optionalKey(credentialInput) })
const releaseInput = Schema.Struct({ config: Schema.Unknown, workspace: Schema.String, preparedDirectory: Schema.optionalKey(Schema.String), credentials: Schema.optionalKey(credentialInput) })
const correctInput = Schema.Struct({ prepared: Schema.String, correction: Schema.String, credentials: Schema.optionalKey(credentialInput) })

const decode = <S extends Schema.Top & Schema.Decoder<unknown>>(schema: S, value: unknown): S["Type"] => {
  try { return Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(value) as S["Type"] }
  catch (cause) { throw new ReleaseInputError({ reason: String(cause).split("\n").slice(0, 8).join("\n").slice(0, 500) }) }
}

export const decodePrepareInput = (value: unknown): PrepareInput => decode(configInput, value)
export const decodeReleaseInput = (value: unknown): ReleaseInput => decode(releaseInput, value)
export const decodePublishInput = (value: unknown): PublishInput => decode(publishInput, value)
export const decodeCorrectInput = (value: unknown): CorrectInput => decode(correctInput, value)
export const decodeInspectInput = (value: unknown): InspectInput => {
  const decoded = decode(inspectInput, value)
  if ((decoded.config === undefined) === (decoded.prepared === undefined)) throw new ReleaseInputError({ reason: "inspect requires exactly one of config or prepared." })
  if (decoded.config !== undefined && decoded.workspace === undefined) throw new ReleaseInputError({ reason: "inspect config requires workspace." })
  return decoded
}

export const absoluteDirectory = (value: string, field: string): string => {
  if (!isAbsolute(value) || !existsSync(value)) throw new ReleaseInputError({ reason: `${field} must be an existing absolute directory.` })
  const canonical = realpathSync(value)
  if (!statSync(canonical).isDirectory()) throw new ReleaseInputError({ reason: `${field} must be a directory.` })
  return canonical
}

export const workspaceRoot = (value: string): string => absoluteDirectory(value, "workspace")

export const preparedPath = (value: string): string => {
  const resolved = isAbsolute(value) ? resolve(value) : resolve(process.cwd(), value)
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) throw new ReleaseInputError({ reason: "prepared must name an existing bundle directory." })
  const root = realpathSync(resolved)
  if (dirname(root) === root || join(root, "prepared-release.json") === root) throw new ReleaseInputError({ reason: "prepared bundle path is invalid." })
  return root
}
