import { fail } from "node:assert"
import { Record, Schema } from "effect"
import { createHash } from "node:crypto"
import { Bundle, File } from "@mannyc1/ts-release/bundle"
import * as Homebrew from "../../../packages/catalog/src/homebrew/index.js"
import * as Scoop from "../../../packages/catalog/src/scoop/index.js"

export const cells = [
  "darwin-x64",
  "darwin-arm64",
  "linux-x64",
  "linux-arm64",
  "windows-x64",
  "windows-arm64",
] as const
export const fixture = () => {
  const bytes = cells.map((cell) => new TextEncoder().encode(`owned ${cell} archive bytes\n`))
  const files = bytes.map((value, i) =>
    Schema.decodeSync(File)({
      _tag: "OwnedFile",
      logicalName: `tool-${cells[i]}.${i < 4 ? "tar.gz" : "zip"}`,
      content: {
        bytes: value.length,
        sha256: createHash("sha256").update(value).digest("hex"),
      },
      deliveryMode: 420,
      executable: null,
      producedBy: { name: "catalog-format-fixture", version: "fixture" },
    }),
  )
  const bundle = new Bundle({ format: "ts-release/bundle/2", artifacts: files })
  const archives = Record.map(
    {
      "darwin-x64": 0,
      "darwin-arm64": 1,
      "linux-x64": 2,
      "linux-arm64": 3,
      "windows-x64": 4,
      "windows-arm64": 5,
    },
    (index, cell) => {
      const file = files[index] ?? fail(`Missing archive fixture: ${cell}`)
      return {
        url: `https://github.com/fixture/tool/releases/download/v1.2.3/${file.logicalName}`,
        file,
      }
    },
  )
  const formula = new Homebrew.Formula({
    className: "Tool",
    description: "Portable fixture CLI",
    homepage: "https://example.com/tool",
    license: "MIT",
    version: "1.2.3",
    executable: "bin/tool",
    archives: {
      "darwin-x64": archives["darwin-x64"],
      "darwin-arm64": archives["darwin-arm64"],
      "linux-x64": archives["linux-x64"],
      "linux-arm64": archives["linux-arm64"],
    },
  })
  const manifest = new Scoop.Manifest({
    version: "1.2.3",
    homepage: "https://example.com/tool",
    license: "MIT",
    executable: "bin/tool.exe",
    archives: {
      "windows-x64": archives["windows-x64"],
      "windows-arm64": archives["windows-arm64"],
    },
  })
  return { files, bytes, bundle, formula, manifest, archives }
}

// Decode only the native oracle fields consumed by these tests. The oracle itself
// continues to use Homebrew's Formula loader and version parser.
export const HomebrewOracle = Schema.Struct({
  cells: Schema.Array(
    Schema.Struct({
      os: Schema.Literals(["macos", "linux"]),
      arch: Schema.Literals(["intel", "arm"]),
      url: Schema.String,
      sha256: Schema.String,
      version: Schema.String,
      detected: Schema.Boolean,
      description: Schema.String,
      homepage: Schema.String,
      license: Schema.String,
      test_defined: Schema.Boolean,
    }),
  ),
})
