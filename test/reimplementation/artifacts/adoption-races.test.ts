import { expect, test } from "bun:test"
import { join } from "node:path"

for (const runtime of [process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node", process.execPath]) {
  test(`native adoption and restoration races preserve owned content and competing outputs: ${runtime}`, async () => {
    const child = Bun.spawn([runtime, join(import.meta.dir, "adoption-races.mjs")], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = new Response(child.stdout).text(),
      stderr = new Response(child.stderr).text()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        child.exited,
        new Promise<"timeout">((resolve) => {
          timer = setTimeout(() => resolve("timeout"), 4000)
        }),
      ])
      expect(result).toBe(0)
      expect(await stderr).toBe("")
      const evidence = JSON.parse(await stdout)
      expect(
        evidence.cells.map((cell: { kind: string; status: string }) => [cell.kind, cell.status]),
      ).toEqual([
        ["fifo", "AdoptionError"],
        ["symlink", "AdoptionError"],
        ["restore-destination", "AdoptionError"],
      ])
    } finally {
      clearTimeout(timer)
      child.kill("SIGKILL")
      await child.exited
    }
  }, 10_000)
}
