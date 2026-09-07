import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { Effect, Schema } from "effect"
import { Bundle, File } from "@mannyc1/ts-release/bundle"
import * as Homebrew from "@mannyc1/ts-release-catalog/homebrew"
import * as Scoop from "@mannyc1/ts-release-catalog/scoop"

assert.deepEqual(Object.keys(Homebrew).sort(), ["Download", "Formula", "render"])
assert.deepEqual(Object.keys(Scoop).sort(), ["Download", "Manifest", "render"])
await assert.rejects(import("@mannyc1/ts-release-catalog"), (error) =>
  ["ERR_PACKAGE_PATH_NOT_EXPORTED", "ERR_MODULE_NOT_FOUND"].includes(error.code),
)
const cells = [
  "darwin-x64",
  "darwin-arm64",
  "linux-x64",
  "linux-arm64",
  "windows-x64",
  "windows-arm64",
]
const files = cells.map((cell) => {
  const bytes = Buffer.from(`owned archive ${cell}`)
  return Schema.decodeUnknownSync(File)({
    _tag: "OwnedFile",
    logicalName: cell + ".zip",
    content: {
      bytes: String(bytes.length),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
    deliveryMode: 420,
    executable: null,
    provenance: { _tag: "IntrinsicProvenance", producer: "packed-catalog" },
  })
})
const archives = Object.fromEntries(
  cells.map((cell, i) => [
    cell,
    { url: `https://example.com/releases/v1.2.3/${cell}.zip`, file: files[i] },
  ]),
)
const bundle = new Bundle({ format: "ts-release/bundle/1", artifacts: files })
const formula = new Homebrew.Formula({
  className: "Tool",
  version: "1.2.3",
  description: "Portable tool",
  homepage: "https://example.com/tool",
  license: "MIT",
  executable: "tool",
  archives: Object.fromEntries(cells.slice(0, 4).map((cell) => [cell, archives[cell]])),
})
const manifest = new Scoop.Manifest({
  version: "1.2.3",
  homepage: "https://example.com/tool",
  license: "MIT",
  executable: "tool.exe",
  archives: Object.fromEntries(cells.slice(4).map((cell) => [cell, archives[cell]])),
})
const ruby = new TextDecoder().decode(await Effect.runPromise(Homebrew.render(formula, bundle)))
const json = JSON.parse(
  new TextDecoder().decode(await Effect.runPromise(Scoop.render(manifest, bundle))),
)
for (const cell of cells.slice(0, 4)) {
  assert.ok(ruby.includes(archives[cell].url))
  assert.ok(ruby.includes(archives[cell].file.content.sha256))
}
assert.equal(json.architecture["64bit"].hash, files[4].content.sha256)
assert.equal(json.architecture.arm64.hash, files[5].content.sha256)
await assert.rejects(Effect.runPromise(Scoop.render({ ...manifest, version: "nightly" }, bundle)))
await assert.rejects(
  Effect.runPromise(
    Homebrew.render(formula, new Bundle({ format: "ts-release/bundle/1", artifacts: [] })),
  ),
)
console.log(
  JSON.stringify({
    runtime: process.version,
    family: "catalog",
    homebrewCells: 4,
    scoopCells: 2,
    nativeInstall: false,
  }),
)
