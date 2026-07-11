import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { parseJsonAs } from "../pipeline/json.js"
import { ConfigParseError, ConfigValidationError } from "./errors.js"
import { decodeReleaseConfig, DEFAULT_CONFIG_PATH } from "./schema.js"


const forbiddenConfigFields = new Set(["_tag", "dryRunSupport", "mutability", "recovery"])
const forbiddenTopLevelConfigFields = new Set([
  "identity",
  "targets",
  "artifactRecipes",
  "build",
  "evidenceDirectory",
  "strict"
])
const isRecord = (value: unknown): value is { readonly [key: string]: unknown } =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const removedFieldHint = (parentPath: string, key: string): string | undefined => {
  if (key === "outputs") {
    return "Use builds[].targets plus a build-level output template; include {ext} for platform executable extensions."
  }
  if (key === "consumers") {
    return "Consumer wiring was removed; publish sections select artifacts with catalog filters and optional ids."
  }
  if (key === "downloadUrl") {
    return "Download URLs are derived from publish.github.repository or supplied as a section-level catalog URL."
  }
  if (parentPath === "$.project" && key === "package") {
    return "Use project.packageName for package identity, or publish.npm.packageName for npm publishing."
  }
  if (parentPath === "$" && key === "strict") {
    return "Strict mode was removed; reviewable operations now encode validation behavior directly."
  }
  if (parentPath === "$.npmPackage" && key === "id") {
    return "The npm package artifact id is fixed as npm-package."
  }
  return undefined
}

const findForbiddenConfigField = (
  value: unknown,
  fieldPath: string = "$"
): { readonly field: string; readonly hint: string } | undefined => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const nested = findForbiddenConfigField(item, `${fieldPath}[${index}]`)
      if (nested !== undefined) {
        return nested
      }
    }
    return undefined
  }
  if (!isRecord(value)) {
    return undefined
  }
  for (const [key, item] of Object.entries(value)) {
    const removedHint = removedFieldHint(fieldPath, key)
    if (removedHint !== undefined) {
      return {
        field: fieldPath === "$" ? key : `${fieldPath}.${key}`,
        hint: removedHint
      }
    }
    if (forbiddenConfigFields.has(key) || (fieldPath === "$" && forbiddenTopLevelConfigFields.has(key))) {
      return {
        field: fieldPath === "$" ? key : `${fieldPath}.${key}`,
        hint: "Use the compact project/build/publish config shape."
      }
    }
    const nested = findForbiddenConfigField(item, `${fieldPath}.${key}`)
    if (nested !== undefined) {
      return nested
    }
  }
  return undefined
}

export const parseReleaseIntent = Effect.fn("parseReleaseIntent")(function*(input: string, path: string = DEFAULT_CONFIG_PATH) {
  const parsed = yield* parseJsonAs(
    Schema.Unknown,
    input,
    (cause) =>
      ConfigParseError.make({
        path,
        reason: "Release config is not valid JSON.",
        cause
      })
  )

  const forbiddenField = findForbiddenConfigField(parsed)
  if (forbiddenField !== undefined) {
    return yield* Effect.fail(
      ConfigValidationError.make({
        path,
        reason: `Release config uses removed field ${forbiddenField.field}. ${forbiddenField.hint}`
      })
    )
  }

  return yield* decodeReleaseConfig(parsed).pipe(
    Effect.mapError((error) =>
      ConfigValidationError.make({
        path,
        reason: error.message
      })
    )
  )
})

