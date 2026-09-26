import { expect, test } from "bun:test"
import { join } from "node:path"

for (const runtime of [process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node", process.execPath]) {
  test(`content ownership settles native IO and cleans resources before interruption: ${runtime}`, async () => {
    const child = Bun.spawn([runtime, join(import.meta.dir, "content-store-lifecycle.mjs")], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = new Response(child.stdout).text(),
      stderr = new Response(child.stderr).text()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const code = await Promise.race([
        child.exited,
        new Promise<"timeout">((resolve) => {
          timer = setTimeout(() => resolve("timeout"), 5000)
        }),
      ])
      expect(code).toBe(0)
      expect(await stderr).toBe("")
      const evidence = JSON.parse(await stdout)
      expect(
        evidence.cells.map((cell: { kind: string; status: string }) => [cell.kind, cell.status]),
      ).toEqual([
        ["acquire", "Interrupted"],
        ["write", "Interrupted"],
        ["close", "Interrupted"],
        ["read", "Interrupted"],
        ["verify", "Interrupted"],
        ["copy", "Interrupted"],
        ["failure", "AdoptionError"],
        ["close-failure", "AdoptionError"],
      ])
      expect(evidence.snapshot).toBe(true)
    } finally {
      clearTimeout(timer)
      child.kill("SIGKILL")
      await child.exited
    }
  }, 10_000)
}
