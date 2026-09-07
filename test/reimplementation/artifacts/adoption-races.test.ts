import { expect, test } from "bun:test"
import { join } from "node:path"

for (const runtime of [process.env.TS_RELEASE_HTTP_PEER_NODE ?? "node", process.execPath]) {
  test(`native source/snapshot FIFO and symlink races reject and close: ${runtime}`, async () => {
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
      expect(evidence.cells).toHaveLength(4)
      expect(
        evidence.cells.every(
          (cell: { status: string; retainedSnapshots: number }) =>
            cell.status === "TreeVerificationFailed" && cell.retainedSnapshots === 0,
        ),
      ).toBe(true)
    } finally {
      clearTimeout(timer)
      child.kill("SIGKILL")
      await child.exited
    }
  }, 10_000)
}
