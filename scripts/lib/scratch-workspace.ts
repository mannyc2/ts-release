import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"

export class UnsafeScratchPathError extends Schema.TaggedErrorClass<UnsafeScratchPathError>()(
  "UnsafeScratchPathError",
  {
    path: Schema.String,
    reason: Schema.String
  }
) {}

export interface SafeRemovalOptions {
  readonly expectedParent?: string | undefined
  readonly allowedBasenames?: ReadonlyArray<string> | undefined
  readonly allowedPrefixes?: ReadonlyArray<string> | undefined
}

const homeDirectories = (): ReadonlyArray<string> =>
  ["HOME", "USERPROFILE"]
    .map((name) => process.env[name])
    .filter((value): value is string => value !== undefined && value.length > 0)

const failUnsafe = (path: string, reason: string): Effect.Effect<never, UnsafeScratchPathError> =>
  Effect.fail(UnsafeScratchPathError.make({ path, reason }))

const basenameAllowed = (
  basename: string,
  allowedBasenames: ReadonlyArray<string>,
  allowedPrefixes: ReadonlyArray<string>
): boolean =>
  allowedBasenames.includes(basename) ||
  allowedPrefixes.some((prefix) => prefix.length > 0 && basename.startsWith(prefix))

export const assertSafeRemovalPath = Effect.fn("scripts.assertSafeRemovalPath")(function*(
  targetPath: string,
  options: SafeRemovalOptions = {}
) {
  const path = yield* Path.Path
  if (targetPath.trim().length === 0) {
    return yield* failUnsafe(targetPath, "Scratch path must not be empty.")
  }

  const resolved = path.resolve(targetPath)
  const currentRoot = path.resolve(".")
  const parsed = path.parse(resolved)
  const basename = path.basename(resolved)
  const allowedBasenames = options.allowedBasenames ?? []
  const allowedPrefixes = options.allowedPrefixes ?? []

  if (resolved === parsed.root) {
    return yield* failUnsafe(resolved, "Scratch path must not be the filesystem root.")
  }
  if (resolved === currentRoot) {
    return yield* failUnsafe(resolved, "Scratch path must not be the repository root.")
  }
  for (const home of homeDirectories()) {
    if (resolved === path.resolve(home)) {
      return yield* failUnsafe(resolved, "Scratch path must not be the home directory.")
    }
  }
  if (options.expectedParent !== undefined && path.dirname(resolved) !== path.resolve(options.expectedParent)) {
    return yield* failUnsafe(resolved, `Scratch path must be a direct child of ${path.resolve(options.expectedParent)}.`)
  }
  if (allowedBasenames.length === 0 && allowedPrefixes.length === 0) {
    return yield* failUnsafe(resolved, "Scratch path requires an allowed basename or prefix.")
  }
  if (!basenameAllowed(basename, allowedBasenames, allowedPrefixes)) {
    return yield* failUnsafe(resolved, `Scratch path basename ${basename} is not allowed.`)
  }

  return resolved
})

export const removeScratchDirectory = Effect.fn("scripts.removeScratchDirectory")(function*(
  targetPath: string,
  options: SafeRemovalOptions
) {
  const fs = yield* FileSystem.FileSystem
  const resolved = yield* assertSafeRemovalPath(targetPath, options)
  yield* fs.remove(resolved, { recursive: true, force: true })
})

export const prepareScratchDirectory = Effect.fn("scripts.prepareScratchDirectory")(function*(
  targetPath: string,
  options: SafeRemovalOptions
) {
  const fs = yield* FileSystem.FileSystem
  const resolved = yield* assertSafeRemovalPath(targetPath, options)
  yield* fs.remove(resolved, { recursive: true, force: true })
  yield* fs.makeDirectory(resolved, { recursive: true })
  return resolved
})

export const makeRepoScratchDirectory = Effect.fn("scripts.makeRepoScratchDirectory")(function*(
  prefix: string,
  root: string = "."
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  if (!prefix.startsWith(".tmp-")) {
    return yield* failUnsafe(prefix, "Repository scratch directory prefixes must start with .tmp-.")
  }
  return yield* fs.makeTempDirectory({
    directory: path.resolve(root),
    prefix
  })
})

export const makeSystemScratchDirectory = Effect.fn("scripts.makeSystemScratchDirectory")(function*(prefix: string) {
  const fs = yield* FileSystem.FileSystem
  if (prefix.length === 0) {
    return yield* failUnsafe(prefix, "System scratch directory prefix must not be empty.")
  }
  return yield* fs.makeTempDirectory({ prefix })
})
