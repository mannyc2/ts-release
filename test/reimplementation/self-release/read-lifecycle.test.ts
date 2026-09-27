import { expect, onTestFinished, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("self-release interruption joins its real file read and close", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ts-release-read-lifecycle-"))
  let child: ReturnType<typeof Bun.spawn> | undefined
  let watchdog: ReturnType<typeof setTimeout> | undefined
  onTestFinished(async () => {
    clearTimeout(watchdog)
    if (child) {
      child.kill("SIGKILL")
      await child.exited
    }
    await rm(directory, { recursive: true, force: true })
  })
  const spawned = Bun.spawn(
    [
      process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node",
      "--experimental-strip-types",
      join(import.meta.dir, "read-lifecycle.mjs"),
      directory,
    ],
    { stdout: "ignore", stderr: "pipe" },
  )
  child = spawned
  const stderr = new Response(spawned.stderr).text()
  // This process watchdog bounds fixture failure; elapsed time is not evidence.
  watchdog = setTimeout(() => {
    child?.kill("SIGKILL")
  }, 5000)
  expect(await child.exited, await stderr).toBe(0)
}, 10000)
