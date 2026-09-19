import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect } from "effect"
import { loadBundle, renderSha256Sums, verifySha256Sums } from "@mannyc1/ts-release/bundle"
import { fileContentOwner } from "@mannyc1/ts-release/node"

const root = process.argv[2]
assert(root)
const owner = fileContentOwner(join(root, "objects"))
const publication = JSON.parse(await readFile(join(root, "publication.json"), "utf8"))
const bundle = await Effect.runPromise(
  loadBundle(owner, await Effect.runPromise(owner.read(publication.finalBundleContent))),
)
const delivery = join(root, "delivery")
await mkdir(delivery)
const native = (tool, args) =>
  execFileSync(tool, args, { cwd: delivery, encoding: "utf8", timeout: 30_000 })
let checks = 0
for (const file of bundle.artifacts) {
  if (file._tag !== "OwnedFile") continue
  const bytes = await Effect.runPromise(owner.read(file.content))
  await writeFile(join(delivery, file.logicalName), bytes)
  if (file.logicalName.endsWith(".tar.gz")) {
    const tree = bundle.artifacts.find(
      (item) =>
        item._tag === "OwnedTree" &&
        file.logicalName.includes(item.logicalName.endsWith("arm64") ? "arm64" : "x64"),
    )
    assert(tree)
    const files = tree.entries.filter((entry) => entry.kind === "file")
    assert.deepEqual(
      native("/usr/bin/tar", ["-tzf", file.logicalName]).trim().split("\n").sort(),
      files.map((entry) => entry.path).sort(),
    )
    checks++
    for (const entry of files) {
      const extracted = execFileSync("/usr/bin/tar", [
        "-xOzf",
        join(delivery, file.logicalName),
        entry.path,
      ])
      assert.deepEqual(
        new Uint8Array(extracted),
        await Effect.runPromise(owner.read({ bytes: entry.bytes, sha256: entry.sha256 })),
      )
      checks++
    }
  } else {
    assert.equal(file.logicalName, "bun-linux-x64")
    await chmod(join(delivery, file.logicalName), file.deliveryMode)
    assert.equal(
      native(join(delivery, file.logicalName), ["--version"]),
      "ts-release producer fixture 1.0.0\n",
    )
    checks++
  }
}
const selected = bundle.artifacts
  .filter((item) => item._tag === "OwnedFile")
  .map((file) => ({ file, publicName: file.logicalName }))
const sums = await Effect.runPromise(renderSha256Sums(bundle, selected))
await writeFile(join(delivery, "SHA256SUMS"), sums)
await Effect.runPromise(verifySha256Sums(bundle, selected, sums, owner.verify))
assert.equal(
  native("/usr/bin/sha256sum", ["--check", "--strict", "SHA256SUMS"]).trim().split("\n").length,
  3,
)
checks++
console.log(JSON.stringify({ root, checks, files: 3, trees: 2 }))
