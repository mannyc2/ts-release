import { constants } from "node:fs"
import { open } from "node:fs/promises"
import { runApplication } from "../platform/Application.js"

const usage = "Usage: ts-release <application.mjs> <input.json>\n"
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
  const [application, inputFile] = args
  if (args.length !== 2 || !application || !inputFile) {
    await write(process.stderr, usage)
    return 1
  }
  const controller = new AbortController()
  // An Effect waiting without native handles still owns this process lifetime.
  const keepAlive = setInterval(() => {}, 2_147_483_647)
  let interrupted = 0
  const stop = (code: number) => {
    interrupted ||= code
    controller.abort()
  }
  const interrupt = () => stop(130)
  const terminate = () => stop(143)
  process.on("SIGINT", interrupt)
  process.on("SIGTERM", terminate)
  try {
    const file = await open(inputFile, constants.O_RDONLY | constants.O_NONBLOCK)
    let input: unknown
    try {
      if (!(await file.stat()).isFile()) throw new Error("Expected a regular input file")
      input = JSON.parse(await file.readFile({ encoding: "utf8", signal: controller.signal }))
    } finally {
      await file.close()
    }
    const report = await runApplication(application, input, controller.signal)
    if (!(await write(process.stdout, JSON.stringify(report) + "\n", controller.signal)))
      return interrupted || 1
    return interrupted || (report.operations.every((op) => op.status === "Satisfied") ? 0 : 2)
  } catch {
    if (!interrupted)
      await write(
        process.stderr,
        "ts-release: application failed; inspect the durable journal before resuming.\n",
        controller.signal,
      )
    return interrupted || 1
  } finally {
    clearInterval(keepAlive)
    process.off("SIGINT", interrupt)
    process.off("SIGTERM", terminate)
  }
}
