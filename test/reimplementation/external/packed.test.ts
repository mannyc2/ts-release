import { expect, test } from "bun:test"
import { resolve } from "node:path"

test("external packed providers compose with the installed kernel/CLI under fresh Bun/npm Node/Bun consumers", async () => {
  const child = Bun.spawn([process.execPath, "scripts/check-packed-external.ts"], {
    cwd: resolve(import.meta.dir, "../../.."),
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  expect({ exit, stderr }).toEqual({ exit: 0, stderr: "" })
  expect(JSON.parse(stdout).consumers).toBe(4)
}, 240_000)
