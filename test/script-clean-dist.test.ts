import { describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

describe("script clean-dist", () => {
  test("removes dist from a disposable workspace", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "ts-release-clean-dist-"))
    const dist = join(workspace, "dist")
    try {
      await mkdir(dist, { recursive: true })
      await writeFile(join(dist, "keep.txt"), "temporary build output\n")

      const subprocess = Bun.spawn([
        "bun",
        join(process.cwd(), "scripts", "clean-dist.ts")
      ], {
        cwd: workspace,
        stdout: "pipe",
        stderr: "pipe"
      })
      const stdout = await streamText(subprocess.stdout)
      const stderr = await streamText(subprocess.stderr)
      const exitCode = await subprocess.exited

      expect({ exitCode, stdout, stderr }).toMatchObject({ exitCode: 0 })
      await expect(stat(dist)).rejects.toThrow()
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })
})
