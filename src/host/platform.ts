import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { CommandSpec } from "../domain/operation.js"
import { CommandResult, CommandRunnerError, ReleaseCommandRunner } from "./host.js"

export type * from "../types/effect-internal.js"

export interface PlatformCommandRunnerOptions {
  readonly root?: string | undefined
}

const inheritedEnvNames = [
  "PATH",
  "HOME",
  "USERPROFILE",
  "SystemRoot",
  "TEMP",
  "TMP"
]

const formatUnknown = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const readOptionalEnv = (name: string): Effect.Effect<string | undefined> =>
  Config.string(name).pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined)
  )

const commandEnv = Effect.fn("platform.commandEnv")(function*(command: CommandSpec) {
  const names = new Set([
    ...inheritedEnvNames,
    ...command.requiredEnv
  ])
  const env: Record<string, string> = {}
  for (const name of names) {
    const value = yield* readOptionalEnv(name)
    if (value !== undefined) {
      env[name] = value
    }
  }
  return env
})

const validateEnv = (command: CommandSpec): Effect.Effect<void, CommandRunnerError> =>
  Effect.gen(function*() {
    const missing: Array<string> = []
    for (const name of command.requiredEnv) {
      const value = yield* readOptionalEnv(name)
      if (value === undefined) {
        missing.push(name)
      }
    }
    if (missing.length > 0) {
      return yield* Effect.fail(
        CommandRunnerError.make({
          operation: "runCommand",
          reason: `Missing required environment variables: ${missing.join(", ")}`
        })
      )
    }
  })

const nowIso = Effect.fn("platform.nowIso")(function*() {
  const millis = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  return new Date(millis).toISOString()
})

const commandOutput = (stream: Stream.Stream<Uint8Array, unknown>) =>
  Stream.mkString(Stream.decodeText(stream))

export const makePlatformCommandRunnerLayer = (
  options: PlatformCommandRunnerOptions = {}
): Layer.Layer<ReleaseCommandRunner, never, ChildProcessSpawner> =>
  Layer.effect(ReleaseCommandRunner)(
    Effect.gen(function*() {
      const spawner = yield* ChildProcessSpawner

      const commandCwd = (command: CommandSpec): string | undefined =>
        command.cwd === undefined
          ? options.root
          : command.cwd

      return {
        runCommand: (command) =>
          Effect.gen(function*() {
            yield* validateEnv(command)
            const startedAt = yield* nowIso()
            const startedMillis = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
            const env = yield* commandEnv(command)
            const cwd = commandCwd(command)
            const childCommand = ChildProcess.make(command.executable, command.args, {
              ...(cwd === undefined ? {} : { cwd }),
              env,
              extendEnv: false,
              stdin: "ignore",
              stdout: "pipe",
              stderr: "pipe"
            })
            const output = yield* Effect.scoped(
              Effect.gen(function*() {
                const handle = yield* spawner.spawn(childCommand)
                return yield* Effect.all({
                  stdout: commandOutput(handle.stdout),
                  stderr: commandOutput(handle.stderr),
                  exitCode: handle.exitCode
                }, { concurrency: "unbounded" })
              })
            ).pipe(
              Effect.mapError((cause) =>
                CommandRunnerError.make({
                  operation: "runCommand",
                  reason: formatUnknown(cause)
                })
              )
            )
            const endedAt = yield* nowIso()
            const endedMillis = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
            return CommandResult.make({
              command,
              exitCode: Number(output.exitCode),
              stdout: output.stdout,
              stderr: output.stderr,
              startedAt,
              endedAt,
              durationMillis: Math.max(0, endedMillis - startedMillis)
            })
          })
      }
    })
  )

export const PlatformCommandRunnerLayer: Layer.Layer<
  ReleaseCommandRunner,
  never,
  ChildProcessSpawner
> = makePlatformCommandRunnerLayer()
