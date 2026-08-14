import { createHash } from "node:crypto"
import type { ArchiveEntry } from "./archive.js"
import { zip } from "./archive.js"
import {
  bunArtifactTargets,
  type BunArtifactTargetId
} from "../model/bun-targets.js"

export interface EmbeddedPythonWheelTarget {
  readonly id: BunArtifactTargetId
  readonly format: "elf" | "mach-o"
  readonly architecture: "x86_64" | "aarch64"
  readonly wheelTag: string
}

const wheelTags = {
  "linux-x64": "py3-none-manylinux_2_17_x86_64",
  "linux-arm64": "py3-none-manylinux_2_17_aarch64",
  "darwin-x64": "py3-none-macosx_13_0_x86_64",
  "darwin-arm64": "py3-none-macosx_13_0_arm64"
} as const satisfies Readonly<Record<BunArtifactTargetId, string>>

export const embeddedPythonWheelTargets: ReadonlyArray<EmbeddedPythonWheelTarget> = Object.freeze(
  bunArtifactTargets.map((target) => Object.freeze({
    id: target.id,
    format: target.format,
    architecture: target.architecture,
    wheelTag: wheelTags[target.id]
  }))
)

const encoder = new TextEncoder()
const bytes = (value: string): Uint8Array => encoder.encode(value)
const safeMetadata = (name: string, value: string): string => {
  if (value.length === 0 || /[\r\n\0]/u.test(value)) {
    throw new Error(`Python wheel ${name} must be a nonempty single-line value.`)
  }
  return value
}
const normalizedVersion = (version: string): string =>
  safeMetadata("version", version).replaceAll("-", "_")
const distribution = "ts_release"
const moduleName = "ts_release"
const projectName = "ts-release"
const consoleScript = "ts-release"

export const embeddedPythonWheelFilename = (
  target: EmbeddedPythonWheelTarget,
  version: string
): string => `${distribution}-${normalizedVersion(version)}-${target.wheelTag}.whl`

const launcher = `"""Launch the platform-specific ts-release executable bundled in this wheel."""

from __future__ import annotations

import os
import stat
import sys
from importlib import resources


def main() -> int:
    try:
        executable = resources.files("${moduleName}").joinpath("bin", "${consoleScript}")
        with resources.as_file(executable) as binary:
            if not binary.is_file():
                raise RuntimeError(f"Bundled ${consoleScript} executable was not found: {binary}")
            binary_path = os.fspath(binary)
            os.chmod(binary_path, os.stat(binary_path).st_mode | stat.S_IXUSR)
            os.execv(binary_path, [binary_path, *sys.argv[1:]])
    except Exception as error:
        print(f"${consoleScript} launcher error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
`

export interface EmbeddedPythonWheelInput {
  readonly target: EmbeddedPythonWheelTarget
  readonly version: string
  readonly summary: string
  readonly homepage: string
  readonly license: string
  readonly binary: Uint8Array
}

export const embeddedPythonWheelEntries = (
  input: EmbeddedPythonWheelInput
): ReadonlyArray<ArchiveEntry> => {
  const version = safeMetadata("version", input.version)
  const summary = safeMetadata("summary", input.summary)
  const homepage = safeMetadata("homepage", input.homepage)
  const license = safeMetadata("license", input.license)
  if (input.binary.length === 0) throw new Error("Python wheel executable cannot be empty.")
  const distInfo = `${distribution}-${normalizedVersion(version)}.dist-info`
  const metadata = [
    "Metadata-Version: 2.4",
    `Name: ${projectName}`,
    `Version: ${version}`,
    `Summary: ${summary}`,
    `Home-page: ${homepage}`,
    `License-Expression: ${license}`,
    "Requires-Python: >=3.9",
    "Description-Content-Type: text/plain",
    "",
    summary,
    ""
  ].join("\n")
  const entries: ArchiveEntry[] = [
    { path: `${moduleName}/__init__.py`, data: bytes(`__version__ = ${JSON.stringify(version)}\n`), mode: 0o100644 },
    { path: `${moduleName}/cli.py`, data: bytes(launcher), mode: 0o100644 },
    { path: `${moduleName}/bin/${consoleScript}`, data: input.binary, mode: 0o100755 },
    { path: `${distInfo}/METADATA`, data: bytes(metadata), mode: 0o100644 },
    {
      path: `${distInfo}/WHEEL`,
      data: bytes([
        "Wheel-Version: 1.0",
        "Generator: ts-release",
        "Root-Is-Purelib: false",
        `Tag: ${input.target.wheelTag}`,
        ""
      ].join("\n")),
      mode: 0o100644
    },
    {
      path: `${distInfo}/entry_points.txt`,
      data: bytes(`[console_scripts]\n${consoleScript} = ${moduleName}.cli:main\n`),
      mode: 0o100644
    },
    { path: `${distInfo}/top_level.txt`, data: bytes(`${moduleName}\n`), mode: 0o100644 }
  ]
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  const recordPath = `${distInfo}/RECORD`
  const record = entries.map((entry) =>
    `${entry.path},sha256=${createHash("sha256").update(entry.data).digest("base64url")},${entry.data.length}`
  )
  record.push(`${recordPath},,`)
  entries.push({ path: recordPath, data: bytes(`${record.join("\n")}\n`), mode: 0o100644 })
  return entries
}

export const buildEmbeddedPythonWheel = (input: EmbeddedPythonWheelInput): Uint8Array =>
  zip(embeddedPythonWheelEntries(input), "deflate")
