import { expect, test } from "bun:test"
import { join } from "node:path"

for (const runtime of [process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node", process.execPath]) {
  test(`bounded directory enumeration and awaited interruption: ${runtime}`, async () => {
    const child = Bun.spawn([runtime, join(import.meta.dir, "directory.mjs")], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = new Response(child.stdout).text(),
      stderr = new Response(child.stderr).text()
    const timer = setTimeout(() => child.kill("SIGKILL"), 10_000)
    try {
      const [code, output, errors] = await Promise.all([child.exited, stdout, stderr])
      expect(code, `${runtime}\n${errors}\n${output}`).toBe(0)
      expect(errors).toBe("")
      expect(JSON.parse(output)).toMatchObject({ cancellation: "child-reaped" })
    } finally {
      clearTimeout(timer)
      child.kill("SIGKILL")
      await child.exited
    }
  }, 15_000)
}
