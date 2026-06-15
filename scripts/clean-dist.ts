import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { pathToFileURL } from "node:url"

export class UnsafeCleanPathError extends Schema.TaggedErrorClass<UnsafeCleanPathError>()(
  "UnsafeCleanPathError",
  {
    path: Schema.String,
    reason: Schema.String
  }
) {}

export const cleanDist = Effect.fn("scripts.cleanDist")(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = path.resolve(".")
  const dist = path.resolve(root, "dist")

  if (dist === root || path.dirname(dist) !== root || path.basename(dist) !== "dist") {
    return yield* Effect.fail(
      UnsafeCleanPathError.make({
        path: dist,
        reason: "Refusing to remove unexpected build directory."
      })
    )
  }

  yield* fs.remove(dist, { recursive: true, force: true })
})

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  BunRuntime.runMain(cleanDist().pipe(Effect.provide(BunServices.layer)))
}
