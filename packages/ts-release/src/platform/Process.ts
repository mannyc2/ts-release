import * as Effect from "effect/Effect"
import { spawn } from "node:child_process"

export interface ProcessBounds {
  readonly timeoutMilliseconds: number
  readonly maximumOutputBytes: number
}
export interface ProcessResult {
  readonly exitCode: number
  readonly stdout: Uint8Array
}
type RawCommand<E> = (
  args: readonly string[],
  input?: Uint8Array,
  environment?: Readonly<Record<string, string>>,
) => Effect.Effect<ProcessResult, E>

export const command = <E>(
  executable: string,
  directory: string,
  options: ProcessBounds,
  error: () => E,
): RawCommand<E> =>
  Effect.fn("native.command")(function* (args, input, environment = {}) {
    const selected = yield* Effect.try({
      try: () => {
        if (!args.length || args.some((arg) => typeof arg !== "string" || arg.includes("\0")))
          throw error()
        return {
          args: [...args],
          body: input === undefined ? undefined : new Uint8Array(input),
          env: { ...environment },
        }
      },
      catch: error,
    })
    return yield* Effect.callback<ProcessResult, E>((resume) => {
      let child: ReturnType<typeof spawn> | undefined,
        finished = false,
        failed = false,
        bytes = 0
      const chunks: Buffer[] = []
      let closed = Promise.resolve()
      const kill = () => {
        if (!child || finished) return
        if (process.platform !== "win32" && child.pid) {
          try {
            process.kill(-child.pid, "SIGKILL")
            return
          } catch {
            /* already gone */
          }
        }
        child.kill("SIGKILL")
      }
      const stop = () => {
        failed = true
        kill()
      }
      const timer = setTimeout(stop, options.timeoutMilliseconds)
      try {
        child = spawn(executable, selected.args, {
          cwd: directory,
          env: selected.env,
          shell: false,
          detached: process.platform !== "win32",
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        })
        closed = new Promise<void>((resolve) => child!.once("close", () => resolve()))
        child.on("error", () => {
          failed = true
        })
        child.stdin!.on("error", stop)
        child.stdout!.on("data", (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > options.maximumOutputBytes) {
            stop()
            return
          }
          chunks.push(Buffer.from(chunk))
        })
        child.stderr!.on("data", (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > options.maximumOutputBytes) stop()
        })
        child.on("close", (code) => {
          finished = true
          clearTimeout(timer)
          resume(
            failed || code === null
              ? Effect.fail(error())
              : Effect.succeed({ exitCode: code, stdout: new Uint8Array(Buffer.concat(chunks)) }),
          )
        })
        child.stdin!.end(selected.body)
      } catch {
        stop()
        clearTimeout(timer)
        resume(Effect.fail(error()))
      }
      return Effect.promise(async () => {
        clearTimeout(timer)
        kill()
        await closed
      })
    })
  })
