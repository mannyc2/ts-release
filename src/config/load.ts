import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Schema from "effect/Schema"
import { parseJsonAs } from "../pipeline/json.js"
import { ConfigParseError, ConfigReadError, ConfigValidationError } from "./errors.js"
import { decodeReleaseConfig, DEFAULT_CONFIG_PATH, type ReleaseIntent } from "./schema.js"


const forbiddenConfigFields = new Set(["_tag", "dryRunSupport", "mutability", "recovery"])
const forbiddenTopLevelConfigFields = new Set([
  "identity",
  "targets",
  "artifactRecipes",
  "build",
  "evidenceDirectory",
  "strict"
])
const safeRelativePathFields = new Set([
  "path",
  "packagePath",
  "entry",
  "output",
  "outDir",
  "formulaPath",
  "tapDirectory",
  "manifestPath",
  "bucketDirectory",
  "directory",
  "sourcePath"
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

const unsafeRelativePathReason = (value: string): string | undefined => {
  const isEmpty = value.trim().length === 0
  const isAbsolute = value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)
  const hasTraversal = value.split(/[\\/]+/).includes("..")
  return isEmpty || isAbsolute || hasTraversal
    ? "Path must be non-empty, relative, and must not contain parent traversal."
    : undefined
}

const unsafeWorkflowReason = (value: string): string | undefined => {
  const hasPathSeparator = value.includes("/") || value.includes("\\")
  const hasWorkflowExtension = value.endsWith(".yml") || value.endsWith(".yaml")
  return hasPathSeparator || !hasWorkflowExtension
    ? "Workflow must be a .yml or .yaml filename without path separators."
    : undefined
}

const findScalarValidationError = (
  value: unknown,
  fieldPath: string = "$"
): { readonly field: string; readonly reason: string } | undefined => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const nested = findScalarValidationError(item, `${fieldPath}[${index}]`)
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
    if (typeof item === "string") {
      if (safeRelativePathFields.has(key)) {
        const reason = unsafeRelativePathReason(item)
        if (reason !== undefined) {
          return { field: fieldPath === "$" ? key : `${fieldPath}.${key}`, reason }
        }
      }
      if (key === "workflow") {
        const reason = unsafeWorkflowReason(item)
        if (reason !== undefined) {
          return { field: fieldPath === "$" ? key : `${fieldPath}.${key}`, reason }
        }
      }
      if (fieldPath === "$" && key === "evidence") {
        const reason = unsafeRelativePathReason(item)
        if (reason !== undefined) {
          return { field: key, reason }
        }
      }
    }
    const nested = findScalarValidationError(item, fieldPath === "$" ? key : `${fieldPath}.${key}`)
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

  const scalarValidation = findScalarValidationError(parsed)
  if (scalarValidation !== undefined) {
    return yield* Effect.fail(
      ConfigValidationError.make({
        path,
        reason: `${scalarValidation.field}: ${scalarValidation.reason}`
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
