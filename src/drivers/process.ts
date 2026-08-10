import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { readEnvironment } from "./environment.js"
import { redactOutput } from "./redact.js"
import { failure } from "./utils.js"
import type { DriverError } from "./errors.js"

export type CommandOutcome = {
  readonly exitCode: number, readonly stdout: string, readonly stderr: string
}
export type RunCommand = (command: {
  readonly argv: ReadonlyArray<string>, readonly cwd: string,
  readonly environmentNames: ReadonlyArray<string>
}) => Effect.Effect<CommandOutcome, DriverError>

const collect = (stream: Stream.Stream<Uint8Array, unknown>) =>
  Stream.mkString(Stream.decodeText(stream))

// Spawning is the capability that differs across hosts, so it arrives as a
// service. The runner is built once per live layer and closes over the
// spawner, keeping DriverCatalog method requirements at never.
export const makeRunCommand: Effect.Effect<RunCommand, never, ChildProcessSpawner> =
  Effect.gen(function*() {
    const spawner = yield* ChildProcessSpawner
    return (command) => Effect.gen(function*() {
      const env = yield* readEnvironment(command.environmentNames)
      const handle = yield* spawner.spawn(ChildProcess.make(
        command.argv[0]!,
        [...command.argv.slice(1)],
        { cwd: command.cwd, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" }
      ))
      const output = yield* Effect.all({
        stdout: collect(handle.stdout),
        stderr: collect(handle.stderr),
        exitCode: handle.exitCode
      }, { concurrency: "unbounded" })
      // Redaction lives here, where the env values are in hand: every
      // consumer of child output (Exec failures, publisher stdout/stderr)
      // is covered at the source and no driver can forget.
      return {
        stdout: redactOutput(output.stdout, env),
        stderr: redactOutput(output.stderr, env),
        exitCode: Number(output.exitCode)
      }
    }).pipe(
      Effect.scoped,
      Effect.mapError((cause) => failure(String(cause)))
    )
  })
