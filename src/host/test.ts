import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ChecksumAlgorithm } from "../domain/artifact.js"
import { CommandSpec } from "../domain/operation.js"
import { CommandResult, FileInfo, HostError, ReleaseHost } from "./host.js"

export type * from "../types/effect-internal.js"

export interface TestCommandResponse {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export interface TestReleaseHostOptions {
  readonly files?: ReadonlyMap<string, string> | undefined
  readonly directories?: ReadonlySet<string> | undefined
  readonly env?: ReadonlyMap<string, string> | undefined
  readonly commands?: ReadonlyMap<string, TestCommandResponse> | undefined
  readonly timestamps?: ReadonlyArray<string> | undefined
}

export const commandKey = (command: CommandSpec): string =>
  [command.executable, ...command.args].join("\u0000")

const checksumPrefix = (algorithm: ChecksumAlgorithm): string =>
  algorithm === "sha256" ? "sha256" : "sha512"

export const makeTestReleaseHostLayer = (
  options: TestReleaseHostOptions = {}
): Layer.Layer<ReleaseHost> => {
  const files = new Map(options.files ?? [])
  const directories = new Set(options.directories ?? [])
  const env = new Map(options.env ?? [])
  const commands = new Map(options.commands ?? [])
  const timestamps = [...(options.timestamps ?? ["2026-06-16T00:00:00.000Z"])]
  let timestampIndex = 0

  const nextTimestamp = (): string => {
    const value = timestamps[timestampIndex] ?? timestamps[timestamps.length - 1] ?? "2026-06-16T00:00:00.000Z"
    timestampIndex += 1
    return value
  }

  return Layer.succeed(ReleaseHost)({
    readFileString: (path) =>
      Effect.sync(() => files.get(path)).pipe(
        Effect.flatMap((contents) =>
          contents === undefined
            ? Effect.fail(HostError.make({ operation: "readFileString", path, reason: "File not found" }))
            : Effect.succeed(contents)
        )
      ),

    writeFileString: (path, contents) =>
      Effect.sync(() => {
        files.set(path, contents)
      }),

    stat: (path) =>
      Effect.sync(() => {
        const contents = files.get(path)
        if (contents !== undefined) {
          return FileInfo.make({ path, sizeBytes: contents.length, kind: "file" })
        }
        if (directories.has(path)) {
          return FileInfo.make({ path, sizeBytes: 0, kind: "directory" })
        }
        return undefined
      }).pipe(
        Effect.flatMap((info) =>
          info === undefined
            ? Effect.fail(HostError.make({ operation: "stat", path, reason: "File not found" }))
            : Effect.succeed(info)
        )
      ),

    hashFile: (path, algorithm) =>
      Effect.sync(() => files.get(path)).pipe(
        Effect.flatMap((contents) =>
          directories.has(path)
            ? Effect.fail(HostError.make({ operation: "hashFile", path, reason: "Only file artifacts can be hashed" }))
            : contents === undefined
            ? Effect.fail(HostError.make({ operation: "hashFile", path, reason: "File not found" }))
            : Effect.succeed(`${checksumPrefix(algorithm)}:${contents.length}:${path}`)
        )
      ),

    readEnv: (name) => Effect.sync(() => env.get(name)),

    runCommand: (command) =>
      Effect.gen(function*() {
        const missing: Array<string> = []
        for (const name of command.requiredEnv) {
          if (!env.has(name)) {
            missing.push(name)
          }
        }
        if (missing.length > 0) {
          return yield* Effect.fail(
            HostError.make({
              operation: "runCommand",
              reason: `Missing required environment variables: ${missing.join(", ")}`
            })
          )
        }
        const startedAt = nextTimestamp()
        const endedAt = nextTimestamp()
        const response = commands.get(commandKey(command)) ?? {
          exitCode: 0,
          stdout: "",
          stderr: ""
        }
        return CommandResult.make({
          command,
          exitCode: response.exitCode,
          stdout: response.stdout,
          stderr: response.stderr,
          startedAt,
          endedAt,
          durationMillis: 0
        })
      }),

    now: Effect.sync(nextTimestamp)
  })
}
