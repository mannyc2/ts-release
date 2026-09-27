import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

for (const window of ["acquire", "write"] as const)
  test(`content interruption joins native ${window} settlement and cleanup`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "ts-release-content-lifecycle-"))
    const child = Bun.spawn(
      [
        process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node",
        join(import.meta.dir, "content-store-lifecycle.mjs"),
        directory,
        window,
      ],
      { stdout: "ignore", stderr: "pipe" },
    )
    const stderr = new Response(child.stderr).text()
    // A process watchdog bounds a broken fixture; it is not timing evidence.
    const watchdog = setTimeout(() => {
      child.kill("SIGKILL")
    }, 5000)
    try {
      const exitCode = await child.exited
      expect(exitCode, await stderr).toBe(0)
    } finally {
      clearTimeout(watchdog)
      child.kill("SIGKILL")
      await child.exited
      await rm(directory, { recursive: true, force: true })
    }
  }, 10000)
