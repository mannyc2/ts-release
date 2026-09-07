import assert from "node:assert/strict"
import { mkdtemp, cp, readdir, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHash } from "node:crypto"

export const nativePython =
  process.env.TS_RELEASE_WAREHOUSE_PYTHON ?? "/tmp/ts-release-warehouse-native-venv/bin/python"
export const buildFixtures = async () => {
  const work = await mkdtemp(join(tmpdir(), "ts-release-python-fixtures-"))
  await cp(join(import.meta.dir, "fixture-project"), join(work, "project"), { recursive: true })
  const run = async (args: string[]) => {
    const result = Bun.spawn([nativePython, ...args], { cwd: work, stdout: "pipe", stderr: "pipe" })
    const [code, out, err] = await Promise.all([
      result.exited,
      new Response(result.stdout).text(),
      new Response(result.stderr).text(),
    ])
    assert.equal(code, 0, out + err)
  }
  await run(["-m", "build", "--no-isolation", "--outdir", "dist", "project"])
  const wheel = (await readdir(join(work, "dist"))).find((name) => name.endsWith(".whl"))!
  for (const platform of ["manylinux_2_17_x86_64", "macosx_11_0_arm64"])
    await run([
      "-m",
      "wheel",
      "tags",
      "--python-tag",
      "cp312",
      "--abi-tag",
      "cp312",
      "--platform-tag",
      platform,
      join("dist", wheel),
    ])
  const files = await Promise.all(
    (await readdir(join(work, "dist"))).sort().map(async (filename) => {
      const bytes = new Uint8Array(await readFile(join(work, "dist", filename)))
      return { filename, bytes, sha256: createHash("sha256").update(bytes).digest("hex") }
    }),
  )
  assert.equal(files.length, 4)
  return { work, files }
}
