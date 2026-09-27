import { expect, onTestFinished, test } from "bun:test"
import { join } from "node:path"

test("native Sigstore signing joins rejection delivery and keeps its token private", async () => {
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
      join(import.meta.dir, "signing-lifecycle.mjs"),
    ],
    { stdout: "pipe", stderr: "pipe" },
  )
  child = spawned
  const stdout = new Response(spawned.stdout).text()
  const stderr = new Response(spawned.stderr).text()
  // A process watchdog bounds fixture failure; elapsed time is not evidence.
  watchdog = setTimeout(() => {
    child?.kill("SIGKILL")
  }, 10000)
  expect(await child.exited, `${await stdout}${await stderr}`).toBe(0)
}, 15000)
