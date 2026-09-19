import assert from "node:assert/strict"
import { readdir, stat } from "node:fs/promises"
import { resolve, join } from "node:path"
import { pathToFileURL } from "node:url"

// Check the distribution that manifests advertise, without a migration projection.
const root = resolve(import.meta.dir, "..")
let entries = 0
for (const directory of await readdir(join(root, "packages"))) {
  const base = join(root, "packages", directory)
  const manifest = await Bun.file(join(base, "package.json")).json()
  for (const [subpath, conditions] of Object.entries(manifest.exports) as Array<
    [string, { types: string; import: string }]
  >) {
    for (const path of [conditions.types, conditions.import]) {
      assert.ok(
        path.startsWith("./dist/") && !path.includes("..", 2),
        `${manifest.name}:${subpath}`,
      )
      assert.ok((await stat(join(base, path))).isFile(), `${manifest.name}: missing ${path}`)
    }
    await import(pathToFileURL(join(base, conditions.import)).href)
    entries++
  }
  for (const path of Object.values(manifest.bin ?? {}) as string[]) {
    assert.ok((await Bun.file(join(base, path)).text()).startsWith("#!/usr/bin/env node\n"))
  }
}
assert.ok(entries > 0)
console.log(`Loaded ${entries} package entrypoints; declarations and CLI files exist.`)
