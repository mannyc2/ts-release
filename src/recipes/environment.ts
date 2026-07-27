import * as Schema from "effect/Schema"

const PublicEnvironmentName = Schema.NonEmptyString.check(Schema.makeFilter((value: string) =>
  /(?:token|secret|password|private|credential)/iu.test(value)
    ? "Inherited environment names must be explicitly non-secret."
    : undefined))
export const EnvironmentValue = Schema.Union([
  Schema.String,
  Schema.Struct({ inherit: PublicEnvironmentName })
])
export type EnvironmentValue = typeof EnvironmentValue.Type
export const CandidateEnvironment = Schema.Record(Schema.NonEmptyString, EnvironmentValue)
export const mergeEnvironment = (
  defaults: Readonly<Record<string, string>>,
  root: Readonly<Record<string, EnvironmentValue>>,
  recipe: Readonly<Record<string, EnvironmentValue>>
): Readonly<Record<string, EnvironmentValue>> => ({ ...defaults, ...root, ...recipe })
export const renderEnvironment = (value: EnvironmentValue): string =>
  typeof value === "string" ? value : `$${value.inherit}`
