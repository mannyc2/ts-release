// Invariant: environment reads, command timing, and native process execution have one injected platform owner.
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { CommandSpec } from "../grammar/operation.js"
import { CommandRunnerError, ReleaseCommandRunner, type CommandResult } from "./host.js"
import inheritedEnvNames from "../assets/inherited-env.json" with { type: "json" }


export interface PlatformCommandRunnerOptions {
  readonly root?: string | undefined
}

export const readOptionalEnv = (name: string): Effect.Effect<string | undefined> =>
  Config.string(name).pipe(
    Effect.option,
    Effect.map(Option.getOrUndefined)
  )

export const readEnvironment = Effect.fn("platform.readEnvironment")(function*(
  names: Iterable<string>
) {
  const values = new Map<string, string | undefined>()
  for (const name of names) {
    values.set(name, yield* readOptionalEnv(name))
  }
  return values
})

const commandEnv = Effect.fn("platform.commandEnv")(function*(command: CommandSpec) {
  const names = new Set([
    ...inheritedEnvNames,
    ...command.requiredEnv
  ])
  const env: Record<string, string> = {}
  const values = yield* readEnvironment(names)
  for (const [name, value] of values) {
    if (value !== undefined) {
      env[name] = value
    }
  }

  const missing = command.requiredEnv.filter((name) => values.get(name) === undefined)
  if (missing.length > 0) {
    return yield* Effect.fail(
      CommandRunnerError.make({
        operation: "runCommand",
        reason: `Missing required environment variables: ${missing.join(", ")}`
      })
    )
  }

  return env
})

export const nowIso = Effect.fn("platform.nowIso")(function*() {
  const millis = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  return new Date(millis).toISOString()
})

export const startTiming = Effect.fn("platform.startTiming")(function*() {
  return {
    startedAt: yield* nowIso(),
    startedMillis: yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  }
})

export const endTiming = Effect.fn("platform.endTiming")(function*(start: Effect.Success<ReturnType<typeof startTiming>>) {
  const endedAt = yield* nowIso()
  const endedMillis = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
  return { startedAt: start.startedAt, endedAt, durationMillis: Math.max(0, endedMillis - start.startedMillis) }
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
            const timing = yield* startTiming()
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
                  reason: "Command execution failed.",
                  cause
                })
              )
            )
            return {
              command,
              exitCode: Number(output.exitCode),
              stdout: output.stdout,
              stderr: output.stderr,
              ...(yield* endTiming(timing))
            } satisfies CommandResult
          })
      }
    })
  )
