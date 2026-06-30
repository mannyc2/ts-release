import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import { ReleaseIntent } from "../domain/release.js"
import { ConfigParseError, ConfigReadError, ConfigValidationError } from "./errors.js"
import { decodeReleaseConfig, DEFAULT_CONFIG_PATH } from "./schema.js"

export type * from "../types/effect-internal.js"

const forbiddenConfigFields = new Set(["_tag", "dryRunSupport", "mutability", "recovery"])
const forbiddenTopLevelConfigFields = new Set(["identity", "targets", "artifactRecipes", "evidenceDirectory"])

const isRecord = (value: unknown): value is { readonly [key: string]: unknown } =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const findForbiddenConfigField = (value: unknown, fieldPath: string = "$"): string | undefined => {
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
    if (forbiddenConfigFields.has(key) || (fieldPath === "$" && forbiddenTopLevelConfigFields.has(key))) {
      return fieldPath === "$" ? key : `${fieldPath}.${key}`
    }
    const nested = findForbiddenConfigField(item, `${fieldPath}.${key}`)
    if (nested !== undefined) {
      return nested
    }
  }
  return undefined
}

export const parseReleaseIntent = Effect.fn("parseReleaseIntent")(function*(input: string, path: string = DEFAULT_CONFIG_PATH) {
  const parsed: unknown = yield* Effect.try({
    try: () => JSON.parse(input),
    catch: (cause) =>
      ConfigParseError.make({
        path,
        reason: "Release config is not valid JSON.",
        cause
      })
  })

  const forbiddenField = findForbiddenConfigField(parsed)
  if (forbiddenField !== undefined) {
    return yield* Effect.fail(
      ConfigValidationError.make({
        path,
        reason: `Release config uses removed legacy field ${forbiddenField}. Use the compact project/build/publish config shape.`
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

export const loadReleaseIntent = Effect.fn("loadReleaseIntent")(function*(path: string = DEFAULT_CONFIG_PATH) {
  const fs = yield* FileSystem.FileSystem
  const contents = yield* fs.readFileString(path).pipe(
    Effect.mapError((error) =>
      ConfigReadError.make({
        path,
        reason: error.message,
        cause: error
      })
    )
  )

  return yield* parseReleaseIntent(contents, path)
})

export const encodeReleaseIntent = (intent: ReleaseIntent): ReleaseIntent => intent
