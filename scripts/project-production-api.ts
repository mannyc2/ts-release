import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const destination = join(root, "docs/refactor/architecture-program/handoff/production-api")
const check = process.argv.includes("--check")
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")
const records = []
for (const owner of ["ts-release", "npm", "pypi"]) {
  for await (const path of new Bun.Glob("**/*.d.ts").scan({
    cwd: join(root, "packages", owner, "dist"),
  })) {
    const declaration = await readFile(join(root, "packages", owner, "dist", path))
    const source = `packages/${owner}/src/${path.replace(/\.d\.ts$/, ".ts")}`
    const projected = owner === "ts-release" ? path : `${owner}/${path}`
    const output = join(destination, projected)
    if (check)
      assert.deepEqual(await readFile(output), declaration, `Stale emitted declaration: ${path}`)
    else {
      await mkdir(dirname(output), { recursive: true })
      await writeFile(output, declaration)
    }
    records.push({
      declaration: projected,
      declarationSha256: hash(declaration),
      source,
      sourceSha256: hash(await readFile(join(root, source))),
    })
  }
}
assert.ok(records.length > 0, "Build actual production before projecting its declarations")
records.sort((a, b) => a.declaration.localeCompare(b.declaration))
const names = []
for await (const name of new Bun.Glob("**/*.d.ts").scan({ cwd: destination })) names.push(name)
assert.deepEqual(
  names.sort(),
  records.map((record) => record.declaration).sort(),
  "Stale or extra production declarations must be reconciled explicitly",
)
const manifest =
  JSON.stringify(
    {
      format: "ts-release/production-api/1",
      owners: ["packages/ts-release", "packages/npm", "packages/pypi"],
      compiler: "typescript@6.0.3",
      effect: "4.0.0-beta.107",
      scope:
        "Implemented production declarations; remaining planned APIs retain their proposal owners until implemented",
      generator: "scripts/project-production-api.ts",
      records,
    },
    null,
    2,
  ) + "\n"
if (check) assert.equal(await readFile(join(destination, "emission.json"), "utf8"), manifest)
else await writeFile(join(destination, "emission.json"), manifest)
console.log(JSON.stringify({ declarations: records.length, mode: check ? "check" : "emit" }))
