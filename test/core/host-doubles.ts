import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Sink from "effect/Sink"
import * as Stream from "effect/Stream"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import type * as ChildProcess from "effect/unstable/process/ChildProcess"
import {
  ChildProcessSpawner,
  ExitCode,
  make as makeSpawner,
  makeHandle,
  ProcessId
} from "effect/unstable/process/ChildProcessSpawner"

// The two host capabilities the live drivers require, as doubles. Their whole
// point is that they exist: before Plan 186 spawn and HTTP were ambient, so
// neither the Exec path nor the forge transport could be covered at all.
export interface SpawnedCommand {
  readonly argv: ReadonlyArray<string>
  readonly cwd: string | undefined
  readonly env: Record<string, string | undefined> | undefined
}
export interface SpawnRecorder {
  readonly commands: Array<SpawnedCommand>
  readonly layer: Layer.Layer<ChildProcessSpawner>
}
const bytes = (value: string) => Stream.make(new TextEncoder().encode(value))

export const recordingSpawner = (
  reply: (command: SpawnedCommand) => {
    readonly exitCode: number, readonly stdout?: string, readonly stderr?: string
  }
): SpawnRecorder => {
  const commands: Array<SpawnedCommand> = []
  const spawn = (command: ChildProcess.Command) => {
    if (command._tag !== "StandardCommand") return Effect.die("Piped commands are not used.")
    const recorded: SpawnedCommand = {
      argv: [command.command, ...command.args],
      cwd: command.options.cwd,
      env: command.options.env
    }
    commands.push(recorded)
    const result = reply(recorded)
    return Effect.succeed(makeHandle({
      pid: ProcessId(1),
      exitCode: Effect.succeed(ExitCode(result.exitCode)),
      isRunning: Effect.succeed(false),
      kill: () => Effect.void,
      stdin: Sink.drain,
      stdout: bytes(result.stdout ?? ""),
      stderr: bytes(result.stderr ?? ""),
      all: bytes(`${result.stdout ?? ""}${result.stderr ?? ""}`),
      getInputFd: () => Sink.drain,
      getOutputFd: () => Stream.empty,
      unref: Effect.succeed(Effect.void)
    }))
  }
  return {
    commands,
    layer: Layer.succeed(ChildProcessSpawner)(makeSpawner(spawn))
  }
}

export interface HttpExchange {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, string | undefined>>
}
export interface HttpRecorder {
  readonly exchanges: Array<HttpExchange>
  readonly layer: Layer.Layer<HttpClient.HttpClient>
}
export const recordingHttpClient = (
  reply: (exchange: HttpExchange) => {
    readonly status: number, readonly body?: unknown
  }
): HttpRecorder => {
  const exchanges: Array<HttpExchange> = []
  const client = HttpClient.make((request, url) => {
    const exchange: HttpExchange = {
      method: request.method,
      url: url.toString(),
      headers: request.headers
    }
    exchanges.push(exchange)
    const result = reply(exchange)
    return Effect.succeed(HttpClientResponse.fromWeb(request, new Response(
      result.body === undefined ? null : JSON.stringify(result.body),
      { status: result.status }
    )))
  })
  return { exchanges, layer: Layer.succeed(HttpClient.HttpClient)(client) }
}
