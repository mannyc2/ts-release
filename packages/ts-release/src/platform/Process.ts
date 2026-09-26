import * as Effect from "effect/Effect"
import { spawn } from "node:child_process"

export type ProcessBounds = Readonly<{ timeoutMilliseconds: number; maximumOutputBytes: number }>
export type ProcessResult = Readonly<{ exitCode: number; stdout: Uint8Array }>
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
          return undefined
        return {
          args: [...args],
          body: input === undefined ? undefined : new Uint8Array(input),
          env: { ...environment },
        }
      },
      catch: error,
    })
    if (selected === undefined) return yield* Effect.fail(error())
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
      const output = (chunk: Buffer, capture = false) => {
        bytes += chunk.length
        if (bytes > options.maximumOutputBytes) stop()
        else if (capture) chunks.push(Buffer.from(chunk))
      }
      // Native process deadline shares the close callback and joins OS shutdown in the finalizer.
      // @effect-diagnostics-next-line globalTimersInEffect:off
      const timer = setTimeout(stop, options.timeoutMilliseconds)
      try {
        const owned = spawn(executable, selected.args, {
          cwd: directory,
          env: selected.env,
          shell: false,
          detached: process.platform !== "win32",
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        })
        child = owned
        closed = new Promise<void>((resolve) => owned.once("close", () => resolve()))
        owned.on("error", stop)
        owned.stdin.on("error", stop)
        owned.stdout.on("data", (chunk: Buffer) => output(chunk, true))
        owned.stderr.on("data", output)
        owned.on("close", (code) => {
          finished = true
          clearTimeout(timer)
          resume(
            failed || code === null
              ? Effect.fail(error())
              : Effect.succeed({ exitCode: code, stdout: new Uint8Array(Buffer.concat(chunks)) }),
          )
        })
        owned.stdin.end(selected.body)
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
