import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import { ReleaseIntent } from "../domain/release.js"
import { ConfigParseError, ConfigReadError, ConfigValidationError } from "./errors.js"
import { decodeReleaseConfig, DEFAULT_CONFIG_PATH } from "./schema.js"

export type * from "../types/effect-internal.js"

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
