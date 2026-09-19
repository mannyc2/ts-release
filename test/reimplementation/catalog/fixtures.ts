import { Schema } from "effect"
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
    Schema.decodeUnknownSync(File)({
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
  const archives = Object.fromEntries(
    cells.map((cell, i) => [
      cell,
      {
        url: `https://github.com/fixture/tool/releases/download/v1.2.3/${files[i]!.logicalName}`,
        file: files[i]!,
      },
    ]),
  ) as Record<(typeof cells)[number], Homebrew.Download>
  const formula = new Homebrew.Formula({
    className: "Tool",
    description: "Portable fixture CLI",
    homepage: "https://example.com/tool",
    license: "MIT",
    version: "1.2.3",
    executable: "bin/tool",
    archives: Object.fromEntries(
      cells.slice(0, 4).map((cell) => [cell, archives[cell]]),
    ) as Homebrew.Formula["archives"],
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
