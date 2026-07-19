// Invariant: config is located, parsed, migration-checked, and Schema-decoded exactly once.
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { parseJsonAs } from "../grammar/json.js"
import { ConfigError } from "./errors.js"
import { decodeReleaseConfig, DEFAULT_CONFIG_PATH, type ReleaseIntent } from "./schema.js"
import migrations from "../assets/config-migrations.json" with { type: "json" }

export interface ConfigSource {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
}

export const configPath = (source: ConfigSource): string => source.configPath ?? DEFAULT_CONFIG_PATH

const configRoot = (path: Path.Path, source: ConfigSource): string =>
  source.root ?? (source.configPath !== undefined && path.isAbsolute(source.configPath)
    ? path.dirname(source.configPath)
    : ".")

const migrationHints: Readonly<Record<string, string>> = migrations.hints
const forbiddenFields = new Set(migrations.forbiddenFields)
const forbiddenRootFields = new Set(migrations.forbiddenRootFields)
const removedBooleanValues = new Set(migrations.removedBooleanValues)
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const findRemovedField = (
  value: unknown,
  parent: string = "$"
): { readonly reason: string } | undefined => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findRemovedField(item, `${parent}[${index}]`)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (!isRecord(value)) return undefined
  for (const [key, item] of Object.entries(value)) {
    const path = `${parent}.${key}`
    const field = parent === "$" ? key : path
    const hint = migrationHints[path] ?? migrationHints[key]
    if (hint !== undefined) return { reason: `Release config uses removed field ${field}. ${hint}` }
    if (forbiddenFields.has(key) || (parent === "$" && forbiddenRootFields.has(key))) {
      return { reason: `Release config uses removed field ${field}. Use the compact project/build/publish config shape.` }
    }
    if (typeof item === "boolean" && removedBooleanValues.has(path.slice(2))) {
      return { reason: `Release config no longer accepts booleans at ${path.slice(2)}. Use {} to enable with defaults, or remove the key to disable.` }
    }
    const found = findRemovedField(item, path)
    if (found !== undefined) return found
  }
  return undefined
}

export const decodeReleaseIntent = Effect.fn("config.decode")(function*(
  input: unknown,
  pathName: string = DEFAULT_CONFIG_PATH
) {
  const removed = findRemovedField(input)
  if (removed !== undefined) return yield* Effect.fail(ConfigError.make({
    kind: "validation",
    path: pathName,
    reason: removed.reason
  }))
  return yield* decodeReleaseConfig(input).pipe(Effect.mapError((error) => ConfigError.make({
    kind: "validation", path: pathName, reason: error.message
  })))
})

export const parseReleaseIntent = Effect.fn("config.parse")(function*(
  input: string,
  pathName: string = DEFAULT_CONFIG_PATH
) {
  const parsed = yield* parseJsonAs(Schema.Unknown, input, (cause) => ConfigError.make({
    kind: "parse", path: pathName, reason: "Release config is not valid JSON.", cause
  }))
  return yield* decodeReleaseIntent(parsed, pathName)
})

export interface LoadedReleaseIntent {
  readonly intent: ReleaseIntent
  readonly root: string
  readonly sourcePath?: string | undefined
}

export const loadReleaseIntent = Effect.fn("config.load")(function*(
  config: string | ReleaseIntent | undefined,
  source: ConfigSource = {}
) {
  const path = yield* Path.Path
  if (typeof config === "object" && config !== null) return {
    intent: yield* decodeReleaseIntent(config, source.configPath ?? "inline config"),
    root: configRoot(path, source),
    sourcePath: source.configPath
  } satisfies LoadedReleaseIntent
  const disk = typeof config === "string" ? { ...source, configPath: config } : source
  const pathName = configPath(disk)
  const root = configRoot(path, disk)
  const readPath = path.isAbsolute(pathName) ? pathName : path.resolve(root, pathName)
  const fs = yield* FileSystem.FileSystem
  const contents = yield* fs.readFileString(readPath).pipe(Effect.mapError((error) => ConfigError.make({
    kind: "read", path: pathName, reason: error.message
  })))
  return {
    intent: yield* parseReleaseIntent(contents, pathName),
    root,
    sourcePath: pathName
  } satisfies LoadedReleaseIntent
})
