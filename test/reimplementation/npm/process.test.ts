import { expect, test } from "bun:test"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pack } from "./fixtures.js"

test("real HTTP protocol double and SQLite survive SIGKILL after npm commit without resending", async () => {
  const root = await mkdtemp(join(tmpdir(), "npm-process-acceptance-"))
  const tarball = pack({ name: "@fixture/example", version: "1.2.3" })
  await writeFile(join(root, "package.tgz"), tarball)
  let sends = 0,
    visible = false,
    moved = false,
    document: Record<string, unknown> = {}
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (request.method === "PUT") {
        expect(new URL(request.url).pathname).toBe("/@fixture%2fexample")
        expect(request.headers.get("authorization")).toBe("Bearer credential-fixture")
        expect(request.headers.get("content-type")).toBe("application/json")
        sends++
        document = (await request.json()) as Record<string, unknown>
        return Response.json({ ok: true }, { status: 201 })
      }
      if (!visible) return new Response(null, { status: 404 })
      return Response.json({
        name: document.name,
        versions: document.versions,
        "dist-tags": { latest: moved ? "1.0.0" : "1.2.3" },
      })
    },
  })
  const run = async (mode: string) => {
    const child = Bun.spawn(
      [process.execPath, join(import.meta.dir, "process-worker.ts"), root, server.url.origin, mode],
      { stdout: "pipe", stderr: "pipe" },
    )
    const [exitCode, out, err] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    return { exitCode, out, err }
  }
  try {
    const killed = await run("kill-after-commit")
    expect(killed.exitCode).not.toBe(0)
    expect(sends).toBe(1)
    const unknown = await run("restart")
    expect(unknown.exitCode, unknown.err).toBe(0)
    expect(JSON.parse(unknown.out).report.operations[0].status).toBe("Inconclusive")
    visible = true
    const observed = await run("restart")
    expect(observed.exitCode, observed.err).toBe(0)
    expect(JSON.parse(observed.out).report.operations[0].status).toBe("Satisfied")
    moved = true
    const conflict = await run("restart")
    expect(conflict.exitCode, conflict.err).toBe(0)
    const result = JSON.parse(conflict.out)
    expect(result.report.operations[0].status).toBe("Conflict")
    expect(result.dispatches).toBe(1)
    expect(result.receipts).toBe(0)
    expect(sends).toBe(1)
  } finally {
    server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
}, 20000)
