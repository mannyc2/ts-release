import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"

interface BuildResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const root = process.cwd()

const makeTempDirectory = Effect.fn("scripts.checkActionBundle.makeTempDirectory")(function*() {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.makeTempDirectory({ prefix: "ts-release-action-bundle-" }).pipe(
    Effect.mapError((cause) => new Error("Failed to create temporary directory.", { cause }))
  )
})

const removeTempDirectory = Effect.fn("scripts.checkActionBundle.removeTempDirectory")(function*(path: string) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.remove(path, { recursive: true, force: true }).pipe(
    Effect.mapError((cause) => new Error(`Failed to remove temporary directory ${path}.`, { cause }))
  )
})

const ignoreRemoveTempDirectoryError = (path: string) =>
  removeTempDirectory(path).pipe(
    Effect.match({
      onFailure: () => undefined,
      onSuccess: () => undefined
    })
  )

const readBytes = Effect.fn("scripts.checkActionBundle.readBytes")(function*(path: string) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFile(path).pipe(
    Effect.mapError((cause) => new Error(`Failed to read ${path}.`, { cause }))
  )
})

const commandOutput = (stream: Stream.Stream<Uint8Array, unknown>) =>
  Stream.mkString(Stream.decodeText(stream))

const runChildProcess = Effect.fn("scripts.checkActionBundle.runChildProcess")(function*(
  command: ChildProcess.Command
) {
  const spawner = yield* ChildProcessSpawner
  const output = yield* Effect.scoped(
    Effect.gen(function*() {
      const handle = yield* spawner.spawn(command)
      return yield* Effect.all({
        stdout: commandOutput(handle.stdout),
        stderr: commandOutput(handle.stderr),
        exitCode: handle.exitCode
      }, { concurrency: "unbounded" })
    })
  )
  return {
    exitCode: Number(output.exitCode),
    stdout: output.stdout,
    stderr: output.stderr
  }
})

const buildTempBundle = Effect.fn("scripts.checkActionBundle.buildTempBundle")(function*(
  actionRoot: string,
  outputPath: string
) {
  const result: BuildResult = yield* runChildProcess(
    ChildProcess.make(
      "bun",
      [
        "build",
        "src/index.ts",
        "--target=node",
        "--format=esm",
        "--outfile",
        outputPath
      ],
      {
        cwd: actionRoot,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe"
      }
    )
  ).pipe(
    Effect.mapError((cause) => new Error("Action bundle temp build failed.", { cause }))
  )

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
  const path = yield* Path.Path
  const actionRoot = path.join(root, "apps", "ts-release-action")
  const trackedBundlePath = path.join(actionRoot, "dist", "index.js")
  const tempDirectory = yield* makeTempDirectory()
  const tempBundlePath = path.join(tempDirectory, "index.js")
  const check = Effect.gen(function*() {
    yield* buildTempBundle(actionRoot, tempBundlePath)
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

BunRuntime.runMain(
  checkActionBundle().pipe(
    Effect.tap(() => Effect.sync(() => console.log("Action bundle is fresh."))),
    Effect.catch((cause: Error) =>
      Effect.sync(() => {
        console.error(cause.message)
        process.exitCode = 1
      })
    ),
    Effect.provide(BunServices.layer)
  )
)
