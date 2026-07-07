import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import { ConfigReadError } from "./errors.js"
import { DEFAULT_CONFIG_PATH } from "./schema.js"

export interface ConfigSource {
  readonly root?: string | undefined
  readonly configPath?: string | undefined
}

export const configPath = (options: ConfigSource): string =>
  options.configPath ?? DEFAULT_CONFIG_PATH

export const configRoot = (path: Path.Path, options: ConfigSource): string => {
  if (options.root !== undefined) {
    return options.root
  }
  if (options.configPath !== undefined && path.isAbsolute(options.configPath)) {
    return path.dirname(options.configPath)
  }
  return "."
}

export const configReadPath = (path: Path.Path, options: ConfigSource): string => {
  const pathName = configPath(options)
  return path.isAbsolute(pathName) ? pathName : path.resolve(configRoot(path, options), pathName)
}

export const readReleaseConfig = Effect.fn("config.readReleaseConfig")(function*(options: ConfigSource) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const pathName = configPath(options)
  const readPath = configReadPath(path, options)
  return yield* fs.readFileString(readPath).pipe(
    Effect.mapError((error) =>
      ConfigReadError.make({
        path: pathName,
        reason: error.message
      })
    )
  )
})
