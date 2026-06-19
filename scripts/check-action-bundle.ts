import * as Effect from "effect/Effect"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

interface BuildResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const root = process.cwd()
const actionRoot = join(root, "apps", "ts-release-action")
const trackedBundlePath = join(actionRoot, "dist", "index.js")

const formatUnknown = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const makeTempDirectory = Effect.fn("scripts.checkActionBundle.makeTempDirectory")(function*() {
  return yield* Effect.tryPromise({
    try: () => mkdtemp(join(tmpdir(), "ts-release-action-bundle-")),
    catch: (cause) => new Error(`Failed to create temporary directory: ${formatUnknown(cause)}`)
  })
})

const removeTempDirectory = Effect.fn("scripts.checkActionBundle.removeTempDirectory")(function*(path: string) {
  return yield* Effect.tryPromise({
    try: () => rm(path, { recursive: true, force: true }),
    catch: (cause) => new Error(`Failed to remove temporary directory ${path}: ${formatUnknown(cause)}`)
  })
})

const ignoreRemoveTempDirectoryError = (path: string) =>
  removeTempDirectory(path).pipe(
    Effect.match({
      onFailure: () => undefined,
      onSuccess: () => undefined
    })
  )

const readBytes = Effect.fn("scripts.checkActionBundle.readBytes")(function*(path: string) {
  return yield* Effect.tryPromise({
    try: () => readFile(path),
    catch: (cause) => new Error(`Failed to read ${path}: ${formatUnknown(cause)}`)
  })
})

const decodeBytes = (bytes: Uint8Array): string =>
  new TextDecoder().decode(bytes)

const buildTempBundle = Effect.fn("scripts.checkActionBundle.buildTempBundle")(function*(outputPath: string) {
  const result: BuildResult = yield* Effect.sync(() => {
    const process = Bun.spawnSync([
      "bun",
      "build",
      "src/index.ts",
      "--target=node",
      "--format=esm",
      "--outfile",
      outputPath
    ], {
      cwd: actionRoot,
      stdout: "pipe",
      stderr: "pipe"
    })
    return {
      exitCode: process.exitCode,
      stdout: decodeBytes(process.stdout),
      stderr: decodeBytes(process.stderr)
    }
  })

  if (result.exitCode !== 0) {
    return yield* Effect.fail(
      new Error(
        [
          `Action bundle temp build failed with exit code ${result.exitCode}.`,
          result.stdout.trim(),
          result.stderr.trim()
        ].filter((line) => line.length > 0).join("\n")
      )
    )
  }
})

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) {
    return false
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}

const staleBundleMessage =
  "Action bundle is stale. Run bun run --cwd apps/ts-release-action build and include apps/ts-release-action/dist/index.js."

const checkActionBundle = Effect.fn("scripts.checkActionBundle")(function*() {
  const tempDirectory = yield* makeTempDirectory()
  const tempBundlePath = join(tempDirectory, "index.js")
  const check = Effect.gen(function*() {
    yield* buildTempBundle(tempBundlePath)
    const trackedBundle = yield* readBytes(trackedBundlePath)
    const tempBundle = yield* readBytes(tempBundlePath)
    if (!bytesEqual(trackedBundle, tempBundle)) {
      return yield* Effect.fail(new Error(staleBundleMessage))
    }
  })

  return yield* check.pipe(
    Effect.ensuring(ignoreRemoveTempDirectoryError(tempDirectory))
  )
})

try {
  await Effect.runPromise(checkActionBundle())
  console.log("Action bundle is fresh.")
} catch (cause) {
  console.error(formatUnknown(cause))
  process.exit(1)
}
