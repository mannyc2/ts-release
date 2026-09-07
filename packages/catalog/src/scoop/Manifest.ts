import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { File, type Bundle } from "@mannyc1/ts-release/bundle"
import { Text, Url, Executable, decode, downloads, renderBytes } from "../Shared.js"

export class Download extends Schema.Class<Download>("Scoop.Download")({
  url: Url.check(Schema.makeFilter((value) => !value.includes("$"))),
  file: File,
}) {}
export class Manifest extends Schema.Class<Manifest>("Scoop.Manifest")({
  version: Text.check(
    Schema.isPattern(/^[\w.\-+]+$/u),
    Schema.makeFilter((value) => value.toLowerCase() !== "nightly"),
  ),
  homepage: Url,
  license: Text,
  // Native Scoop shims embed paths in PowerShell, cmd and shell source.
  executable: Executable.check(Schema.isPattern(/^[\p{L}\p{N}\p{M}._ /-]+$/u)),
  archives: Schema.Struct({ "windows-x64": Download, "windows-arm64": Download }),
}) {}
export const render = Effect.fn("Scoop.render")((input: Manifest, bundle: Bundle) =>
  renderBytes(() => {
    const value = decode(Manifest, input)
    downloads(bundle, value.archives)
    return (
      JSON.stringify(
        {
          version: value.version,
          homepage: value.homepage,
          license: value.license,
          architecture: Object.fromEntries(
            (["x64", "arm64"] as const).map((arch) => {
              const download = value.archives[`windows-${arch}`]
              return [
                arch === "x64" ? "64bit" : "arm64",
                { url: download.url, hash: download.file.content.sha256 },
              ]
            }),
          ),
          bin: value.executable,
        },
        null,
        2,
      ) + "\n"
    )
  }),
)
