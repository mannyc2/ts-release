import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import * as Effect from "effect/Effect"
import * as Path from "effect/Path"
import {
  ArtifactRecipeAdapter,
  ArtifactRecipeStageContext,
  ArtifactRecipeStageError,
  StagedArtifact,
  StagedArtifactRecipeResult
} from "../../../../src/artifacts/adapter.js"
import { PyPiWheelArtifactRecipe } from "../../../../src/domain/artifact.js"
import { renderReleaseTemplate } from "../../../../src/planner/normalize-release.js"

interface WheelEntry {
  readonly path: string
  readonly data: Uint8Array
  readonly mode: number
}

interface CentralDirectoryEntry extends WheelEntry {
  readonly crc32: number
  readonly offset: number
}

const encoder = new TextEncoder()

const bytes = (value: string): Uint8Array =>
  encoder.encode(value)

const concat = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }
  return output
}

const uint16 = (value: number): Uint8Array => {
  const output = new Uint8Array(2)
  new DataView(output.buffer).setUint16(0, value, true)
  return output
}

const uint32 = (value: number): Uint8Array => {
  const output = new Uint8Array(4)
  new DataView(output.buffer).setUint32(0, value, true)
  return output
}

const crcTable = (() => {
  const table: Array<number> = []
  for (let value = 0; value < 256; value += 1) {
    let crc = value
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    table.push(crc >>> 0)
  }
  return table
})()

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const sha256Digest = (data: Uint8Array): string =>
  createHash("sha256").update(data).digest("base64url")

const localFileHeader = (entry: WheelEntry, crc: number): Uint8Array => {
  const name = bytes(entry.path)
  return concat([
    uint32(0x04034b50),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(crc),
    uint32(entry.data.byteLength),
    uint32(entry.data.byteLength),
    uint16(name.byteLength),
    uint16(0),
    name
  ])
}

const centralDirectoryHeader = (entry: CentralDirectoryEntry): Uint8Array => {
  const name = bytes(entry.path)
  return concat([
    uint32(0x02014b50),
    uint16(0x0314),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(entry.crc32),
    uint32(entry.data.byteLength),
    uint32(entry.data.byteLength),
    uint16(name.byteLength),
    uint16(0),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(entry.mode << 16),
    uint32(entry.offset),
    name
  ])
}

const endOfCentralDirectory = (
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
): Uint8Array =>
  concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entryCount),
    uint16(entryCount),
    uint32(centralDirectorySize),
    uint32(centralDirectoryOffset),
    uint16(0)
  ])

const buildZip = (entries: ReadonlyArray<WheelEntry>): Uint8Array => {
  const localParts: Array<Uint8Array> = []
  const centralEntries: Array<CentralDirectoryEntry> = []
  let offset = 0

  for (const entry of entries) {
    const crc = crc32(entry.data)
    const header = localFileHeader(entry, crc)
    localParts.push(header, entry.data)
    centralEntries.push({
      ...entry,
      crc32: crc,
      offset
    })
    offset += header.byteLength + entry.data.byteLength
  }

  const centralDirectory = concat(centralEntries.map(centralDirectoryHeader))
  return concat([
    ...localParts,
    centralDirectory,
    endOfCentralDirectory(centralEntries.length, centralDirectory.byteLength, offset)
  ])
}

const hasParentTraversal = (pathName: string): boolean =>
  pathName.split(/[\\/]+/).includes("..")

const isInsideRoot = (path: Path.Path, root: string, target: string): boolean => {
  const rootPath = path.resolve(root)
  const relative = path.relative(rootPath, target)
  return relative.length === 0 || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

const resolveRecipePath = (
  path: Path.Path,
  recipe: PyPiWheelArtifactRecipe,
  context: ArtifactRecipeStageContext,
  pathName: string
): Effect.Effect<string, ArtifactRecipeStageError> => {
  const trimmed = pathName.trim()
  if (trimmed.length === 0 || path.isAbsolute(pathName) || hasParentTraversal(pathName)) {
    return Effect.fail(
      ArtifactRecipeStageError.make({
        recipeId: recipe.id,
        recipeTag: recipe._tag,
        path: pathName,
        reason: "Recipe paths must be non-empty, relative, and must not contain parent traversal."
      })
    )
  }
  const resolved = path.resolve(context.root, pathName)
  if (!isInsideRoot(path, context.root, resolved)) {
    return Effect.fail(
      ArtifactRecipeStageError.make({
        recipeId: recipe.id,
        recipeTag: recipe._tag,
        path: pathName,
        reason: "Recipe paths must resolve inside the workspace root."
      })
    )
  }
  return Effect.succeed(resolved)
}

const distributionName = (packageName: string): string =>
  packageName.replaceAll("-", "_").replaceAll(".", "_")

const fileName = (pathName: string): string => {
  const parts = pathName.replaceAll("\\", "/").split("/")
  return parts[parts.length - 1] ?? pathName
}

const wrapperSource = (recipe: PyPiWheelArtifactRecipe): string => {
  const entries = recipe.binaries
    .map((binary) => `    (${JSON.stringify(binary.os)}, ${JSON.stringify(binary.arch)}): ${JSON.stringify(fileName(binary.wheelPath))}`)
    .join(",\n")
  return `"""Python launcher for the bundled ${recipe.consoleScript} CLI."""

from __future__ import annotations

import os
import platform
import stat
import subprocess
import sys
from importlib import resources


BINARIES = {
${entries}
}


def _platform_key() -> tuple[str, str]:
    system = sys.platform
    if system.startswith("linux"):
        os_name = "linux"
    elif system == "darwin":
        os_name = "darwin"
    elif system in ("win32", "cygwin"):
        os_name = "windows"
    else:
        raise RuntimeError(f"Unsupported operating system: {system}")

    machine = platform.machine().lower()
    if machine in ("x86_64", "amd64"):
        arch = "x64"
    elif machine in ("aarch64", "arm64"):
        arch = "arm64"
    else:
        raise RuntimeError(f"Unsupported architecture: {machine}")

    return os_name, arch


def main() -> int:
    try:
        binary_name = BINARIES[_platform_key()]
        binary = resources.files("${recipe.moduleName}").joinpath("bin", binary_name)
        if not binary.is_file():
            raise RuntimeError(f"Bundled ${recipe.consoleScript} binary was not found: {binary}")
        binary_path = os.fspath(binary)
        if os.name != "nt":
            os.chmod(binary_path, os.stat(binary_path).st_mode | stat.S_IXUSR)
        completed = subprocess.run([binary_path, *sys.argv[1:]], check=False)
        return completed.returncode
    except Exception as error:
        print(f"${recipe.consoleScript} launcher error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
`
}

const metadata = (recipe: PyPiWheelArtifactRecipe, version: string): string => `Metadata-Version: 2.1
Name: ${recipe.packageName}
Version: ${version}
Summary: ${recipe.summary}
Home-page: ${recipe.homepage}
License: ${recipe.license}
Requires-Python: ${recipe.requiresPython}
Description-Content-Type: text/plain

${recipe.summary}
`

const wheelMetadata = (recipe: PyPiWheelArtifactRecipe): string => `Wheel-Version: 1.0
Generator: ts-release
Root-Is-Purelib: false
Tag: ${recipe.wheelTag}
`

const buildEntries = Effect.fn("PyPiWheelArtifactRecipe.buildEntries")(function*(
  recipe: PyPiWheelArtifactRecipe,
  context: ArtifactRecipeStageContext
) {
  const distInfo = `${distributionName(recipe.packageName)}-${context.identity.version}.dist-info`
  const entries: Array<WheelEntry> = [
    {
      path: `${recipe.moduleName}/__init__.py`,
      data: bytes(`__version__ = "${context.identity.version}"\n`),
      mode: 0o100644
    },
    {
      path: `${recipe.moduleName}/cli.py`,
      data: bytes(wrapperSource(recipe)),
      mode: 0o100644
    },
    {
      path: `${distInfo}/METADATA`,
      data: bytes(metadata(recipe, context.identity.version)),
      mode: 0o100644
    },
    {
      path: `${distInfo}/WHEEL`,
      data: bytes(wheelMetadata(recipe)),
      mode: 0o100644
    },
    {
      path: `${distInfo}/entry_points.txt`,
      data: bytes(`[console_scripts]\n${recipe.consoleScript} = ${recipe.moduleName}.cli:main\n`),
      mode: 0o100644
    },
    {
      path: `${distInfo}/top_level.txt`,
      data: bytes(`${recipe.moduleName}\n`),
      mode: 0o100644
    }
  ]

  for (const binary of recipe.binaries) {
    const sourcePath = renderReleaseTemplate(binary.sourcePath, context.identity)
    entries.push({
      path: binary.wheelPath,
      data: yield* Effect.promise(() => readFile(join(context.root, sourcePath))),
      mode: 0o100755
    })
  }

  const recordPath = `${distInfo}/RECORD`
  const recordRows = entries
    .map((entry) => `${entry.path},sha256=${sha256Digest(entry.data)},${entry.data.byteLength}`)
  recordRows.push(`${recordPath},,`)
  entries.push({
    path: recordPath,
    data: bytes(`${recordRows.join("\n")}\n`),
    mode: 0o100644
  })

  return entries.sort((left, right) => left.path.localeCompare(right.path))
})

export const stagePyPiWheelArtifactRecipe = Effect.fn("PyPiWheelArtifactRecipe.stage")(function*(
  recipe: PyPiWheelArtifactRecipe,
  context: ArtifactRecipeStageContext
) {
  const path = yield* Path.Path
  const renderedPath = renderReleaseTemplate(recipe.path, context.identity)
  const outputPath = yield* resolveRecipePath(path, recipe, context, renderedPath)
  const entries = yield* buildEntries(recipe, context).pipe(
    Effect.mapError((cause) =>
      ArtifactRecipeStageError.make({
        recipeId: recipe.id,
        recipeTag: recipe._tag,
        path: renderedPath,
        reason: "Unable to read PyPI wheel binary input.",
        cause
      })
    )
  )
  const wheel = buildZip(entries)
  yield* Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, wheel)
    },
    catch: (cause) =>
      ArtifactRecipeStageError.make({
        recipeId: recipe.id,
        recipeTag: recipe._tag,
        artifactId: recipe.id,
        path: renderedPath,
        reason: "Unable to write PyPI wheel artifact.",
        cause
      })
  })

  return StagedArtifactRecipeResult.make({
    recipeId: recipe.id,
    recipeTag: recipe._tag,
    artifacts: [
      StagedArtifact.make({
        id: recipe.id,
        path: renderedPath
      })
    ]
  })
})

export const PyPiWheelArtifactRecipeAdapter: ArtifactRecipeAdapter<PyPiWheelArtifactRecipe> = {
  recipeTag: "PyPiWheelArtifactRecipe",
  stage: stagePyPiWheelArtifactRecipe
}
