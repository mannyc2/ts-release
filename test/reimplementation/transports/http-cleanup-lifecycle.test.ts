import { expect, onTestFinished, test } from "bun:test"
import { join } from "node:path"

test("native HTTP joins both shutdowns and preserves response plus cleanup failure", async () => {
  let child: ReturnType<typeof Bun.spawn> | undefined
  let watchdog: ReturnType<typeof setTimeout> | undefined
  onTestFinished(async () => {
    clearTimeout(watchdog)
    if (child) {
      child.kill("SIGKILL")
      await child.exited
    }
  })
  const spawned = Bun.spawn(
    [
      process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node",
      join(import.meta.dir, "http-cleanup-lifecycle.mjs"),
    ],
    { stdout: "pipe", stderr: "pipe" },
  )
  child = spawned
  const stdout = new Response(spawned.stdout).text()
  const stderr = new Response(spawned.stderr).text()
  // Failure bound only: the test orders shutdown using native completion barriers.
  watchdog = setTimeout(() => child?.kill("SIGKILL"), 10000)
  expect(await child.exited, `${await stdout}${await stderr}`).toBe(0)
}, 15000)
