import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Independent native service oracle: the child machine has no access to these
// counters. Its output cannot manufacture the observed request count or URL.
for (const candidate of ["M1", "M2"] as const) for (const replaceNativeParent of [false, true]) {
  test(`${candidate}: native dependency ID survives restart; replacement=${replaceNativeParent}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "release-native-dependency-"))
    let id = 41
    const mutations: string[] = []
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
      const url = new URL(request.url)
      if (request.method === "GET") return Response.json({ id, tag: "v1.0.0" })
      mutations.push(url.pathname)
      return Response.json({ id, tag: "v1.0.0", ...(await request.json()) }, { status: 201 })
    } })
    const invoke = async (stage: string) => {
      const child = Bun.spawn([process.execPath, join(import.meta.dir, "dependency-worker.ts"),
        `http://127.0.0.1:${server.port}`, directory, candidate, stage], { stdout: "pipe", stderr: "pipe", cwd: tmpdir() })
      const [exit, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      return { exit, output, error }
    }
    try {
      const first = await invoke("create")
      expect(first.error).toBe("")
      expect(first.exit).toBe(0)
      expect(mutations).toEqual(["/releases"])
      if (replaceNativeParent) id = 99
      const second = await invoke("resume")
      if (replaceNativeParent) {
        expect(second.exit).not.toBe(0)
        expect(second.error).toContain("Observed release ID differs")
        expect(mutations).toEqual(["/releases"])
      } else {
        expect(second.error).toBe("")
        expect(second.exit).toBe(0)
        expect(mutations).toEqual(["/releases", "/releases/41/assets"])
        expect(JSON.parse(second.output).operations.every((operation: { status: string }) => operation.status === "Satisfied")).toBe(true)
      }
    } finally { server.stop(true); await rm(directory, { recursive: true, force: true }) }
  }, 20_000)
}
