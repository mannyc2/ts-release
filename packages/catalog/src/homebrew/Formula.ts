import { Effect, Schema } from "effect"
import { File, type Bundle } from "@mannyc1/ts-release/bundle"
import { Text, Url, Executable, decode, downloads, renderBytes } from "../Shared.js"

export class Download extends Schema.Class<Download>("Homebrew.Download")({
  url: Url,
  file: File,
}) {}
export class Formula extends Schema.Class<Formula>("Homebrew.Formula")({
  className: Text.check(
    Schema.isPattern(/^[A-Z][A-Za-z0-9]*$/u),
    Schema.makeFilter((value) => value !== "BEGIN" && value !== "END"),
  ),
  description: Text,
  homepage: Url,
  license: Text,
  version: Text,
  executable: Executable,
  archives: Schema.Struct({
    "darwin-x64": Download,
    "darwin-arm64": Download,
    "linux-x64": Download,
    "linux-arm64": Download,
  }),
}) {}
// Ruby double-quoted strings interpolate #{}, #@ and #$; JSON quoting alone is unsafe.
const ruby = (value: string) => JSON.stringify(value).replace(/#(?=[{@$])/gu, "\\#")
export const render = Effect.fn("Homebrew.render")((input: Formula, bundle: Bundle) =>
  renderBytes(() => {
    const value = decode(Formula, input)
    downloads(bundle, value.archives)
    const lines = [
      `class ${value.className} < Formula`,
      `  desc ${ruby(value.description)}`,
      `  homepage ${ruby(value.homepage)}`,
      `  license ${ruby(value.license)}`,
    ]
    for (const os of ["darwin", "linux"] as const) {
      lines.push("", `  on_${os === "darwin" ? "macos" : "linux"} do`)
      for (const arch of ["arm64", "x64"] as const) {
        const download = value.archives[`${os}-${arch}`]
        lines.push(
          `    on_${arch === "arm64" ? "arm" : "intel"} do`,
          `      url ${ruby(download.url)}`,
          `      sha256 ${ruby(download.file.content.sha256)}`,
          "    end",
        )
      }
      lines.push("  end")
    }
    lines.push(
      "",
      `  version ${ruby(value.version)} if version.to_s != ${ruby(value.version)}`,
      "",
      "  def install",
      `    bin.install ${ruby(value.executable)}`,
      "  end",
      "",
      "  test do",
      `    assert_predicate bin/${ruby(value.executable.split("/").at(-1)!)}, :executable?`,
      "  end",
      "end",
      "",
    )
    return lines.join("\n")
  }),
)
