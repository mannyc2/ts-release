import { constants } from "node:fs"
import { open } from "node:fs/promises"
import { runApplication, runInterruptibleProcess } from "../platform/Application.js"

const usage = "Usage: ts-release [--observe] <application.mjs> <input.json>\n"
const write = (
  stream: typeof process.stdout | typeof process.stderr,
  text: string,
  signal?: AbortSignal,
): Promise<boolean> =>
  new Promise((resolve) => {
    const abort = () => {
      stream.destroy()
      resolve(false)
    }
    const error = () => resolve(false)
    stream.once("error", error)
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) return abort()
    stream.write(text, (failed) => {
      signal?.removeEventListener("abort", abort)
      // A failed write also emits an error event; consume that native event.
      if (!failed) stream.off("error", error)
      resolve(!failed)
    })
  })

/** The trusted application chooses its providers, layers and authorization.
 * This host only decodes input and emits the complete derived report. */
export async function runCommandLine(args: readonly string[]): Promise<number> {
  if (args.length === 1 && args[0] === "--help") {
    return (await write(process.stdout, usage)) ? 0 : 1
  }
  const observe = args[0] === "--observe"
  const positional = observe ? args.slice(1) : args
  const [application, inputFile] = positional
  if (positional.length !== 2 || !application || !inputFile) {
    await write(process.stderr, usage)
    return 1
  }
  return runInterruptibleProcess(async (signal, exitCode) => {
    try {
      const file = await open(inputFile, constants.O_RDONLY | constants.O_NONBLOCK)
      let input: unknown
      try {
        if (!(await file.stat()).isFile()) throw new Error("Expected a regular input file")
        input = JSON.parse(await file.readFile({ encoding: "utf8", signal }))
      } finally {
        await file.close()
      }
      const report = await runApplication(application, input, signal, observe ? "observe" : "run")
      if (!(await write(process.stdout, JSON.stringify(report) + "\n", signal)))
        return exitCode() || 1
      const complete = report.operations.every((op) => op.status === "Satisfied")
      if (!complete)
        await write(
          process.stderr,
          "ts-release: publication is incomplete. Inspect operation statuses in the JSON report. " +
            "Use ts-release --observe <application.mjs> <input.json> with the same application and input to refresh progress. " +
            "Keep the original Bundle, Plan and durable journal; unresolved dispatches cannot be retried based on absence alone.\n",
          signal,
        )
      return exitCode() || (complete ? 0 : 2)
    } catch {
      if (!exitCode())
        await write(
          process.stderr,
          "ts-release: application failed; verify the application module, input file and journal access. To inspect progress, run ts-release --observe <application.mjs> <input.json> with the same application and input. Preserve the original Bundle, Plan and durable journal before resuming.\n",
          signal,
        )
      return exitCode() || 1
    }
  })
}
