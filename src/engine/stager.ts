import { createHash } from "node:crypto"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { artifactPathBaseName } from "../pipeline/artifact.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import {
  type ArchiveIntent,
  type BunCompileIntent,
  type Operation,
  type PyPiWheelIntent,
  type StageAction
} from "../pipeline/operation.js"
import { optionalField } from "../pipeline/optional-field.js"
import { validateWorkspaceWritePath } from "../internal/workspace-path.js"
import { renderTemplate } from "../pipeline/template.js"
import {
  type ArchiveByteEntry,
  buildTarGzArchive,
  buildZipArchive,
  bytes
} from "./archive-bytes.js"


export interface ArtifactStageContext {
  readonly root: string
  readonly identity: ReleaseIdentity
  readonly configPath?: string | undefined
}

export interface StagedArtifact {
  readonly id: string
  readonly path: string
}

export interface StagedArtifactOperationResult {
  readonly operationId: string
  readonly intentTag: string
  readonly artifacts: ReadonlyArray<StagedArtifact>
}

export class ArtifactStageError extends Schema.TaggedErrorClass<ArtifactStageError>()("ArtifactStageError", {
  operationId: Schema.NonEmptyString,
  intentTag: Schema.String,
  artifactId: Schema.optionalKey(Schema.NonEmptyString),
  path: Schema.optionalKey(Schema.String),
  reason: Schema.String,
  cause: Schema.optionalKey(Schema.Defect())
}) {}

export interface BunExecutableBuildInput {
  readonly entrypoint: string
  readonly target: Bun.Build.CompileTarget
  readonly outfile: string
  readonly minify?: boolean | undefined
}

export interface BunExecutableBuildOutput {
  readonly success: boolean
  readonly logs: ReadonlyArray<unknown>
}

export type BunExecutableBuild = (
  input: BunExecutableBuildInput
) => Promise<BunExecutableBuildOutput>

export const liveBunExecutableBuild: BunExecutableBuild = (input) =>
  Bun.build({
    entrypoints: [input.entrypoint],
    ...optionalField(input.minify, (minify) => ({ minify })),
    compile: {
      target: input.target,
      outfile: input.outfile
    }
  })

export interface ArtifactStagerShape {
  readonly stage: (
    operation: StageOperation,
    context: ArtifactStageContext
  ) => Effect.Effect<StagedArtifactOperationResult, ArtifactStageError>
}

export class ArtifactStager extends Context.Service<ArtifactStager, ArtifactStagerShape>()("ArtifactStager") {}

const logsReason = (
  logs: ReadonlyArray<unknown>,
  fallback: string
): string => {
  const reason = logs.map((log) => String(log)).join("\n").trim()
  return reason.length === 0 ? fallback : reason
}

export type StageOperation = Operation & { readonly action: StageAction }

const stageError = (
  operation: StageOperation,
  fields: {
    readonly artifactId?: string | undefined
    readonly path?: string | undefined
    readonly reason: string
    readonly cause?: unknown
  }
): ArtifactStageError =>
  ArtifactStageError.make({
    operationId: operation.id,
    intentTag: operation.action.intent._tag,
    ...optionalField(fields.artifactId, (artifactId) => ({ artifactId })),
    ...optionalField(fields.path, (path) => ({ path })),
    reason: fields.reason,
    ...optionalField(fields.cause, (cause) => ({ cause }))
  })

const stagedResult = (
  operation: StageOperation,
  intent: { readonly _tag: string; readonly outfile: string }
): StagedArtifactOperationResult =>
  ({
    operationId: operation.id,
    intentTag: intent._tag,
    artifacts: operation.action.producesArtifactIds.map((id) =>
      ({ id, path: intent.outfile }) satisfies StagedArtifact
    )
  })

const resolveStagePath = (
  path: Path.Path,
  operation: StageOperation,
  pathName: string,
  context: ArtifactStageContext,
  artifactId?: string | undefined
): Effect.Effect<string, ArtifactStageError> => {
  const result = validateWorkspaceWritePath(path, context.root, pathName, { allowAbsolute: false })
  return result._tag === "Ok"
    ? Effect.succeed(result.path)
    : Effect.fail(
      stageError(operation, {
        artifactId,
        path: pathName,
        reason: result.reason === "empty-or-parent-traversal"
          ? "Stage paths must be non-empty, relative, and must not contain parent traversal."
          : "Stage paths must resolve inside the workspace root."
      })
    )
}

const stageBunCompile = (
  build: BunExecutableBuild,
  path: Path.Path,
  operation: StageOperation,
  intent: BunCompileIntent,
  context: ArtifactStageContext
) =>
  Effect.gen(function*() {
    const artifactId = operation.action.producesArtifactIds[0]
    const entrypoint = yield* resolveStagePath(path, operation, intent.entry, context)
    const outfile = yield* resolveStagePath(path, operation, intent.outfile, context, artifactId)
    const output = yield* Effect.tryPromise({
      try: () =>
        build({
          entrypoint,
          target: intent.compileTarget,
          outfile,
          ...optionalField(intent.minify, (minify) => ({ minify }))
        }),
      catch: (cause) =>
        stageError(operation, {
          artifactId,
          path: intent.outfile,
          reason: `Bun.build rejected while staging ${artifactId ?? operation.id}.`,
          cause
        })
    })
    if (!output.success) {
      return yield* Effect.fail(
        stageError(operation, {
          artifactId,
          path: intent.outfile,
          reason: logsReason(output.logs, `Bun.build failed for ${artifactId ?? operation.id}.`)
        })
      )
    }
    return stagedResult(operation, intent)
  })

const sha256Digest = (data: Uint8Array): string =>
  createHash("sha256").update(data).digest("base64url")

const distributionName = (packageName: string): string =>
  packageName.replaceAll("-", "_").replaceAll(".", "_")

const wrapperSource = (intent: PyPiWheelIntent): string => {
  const entries = intent.binaries
    .map((binary) => `    (${JSON.stringify(binary.os)}, ${JSON.stringify(binary.arch)}): ${JSON.stringify(artifactPathBaseName(binary.wheelPath))}`)
    .join(",\n")
  return `"""Python launcher for the bundled ${intent.consoleScript} CLI."""

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
        binary = resources.files("${intent.moduleName}").joinpath("bin", binary_name)
        if not binary.is_file():
            raise RuntimeError(f"Bundled ${intent.consoleScript} binary was not found: {binary}")
        binary_path = os.fspath(binary)
        if os.name != "nt":
            os.chmod(binary_path, os.stat(binary_path).st_mode | stat.S_IXUSR)
        completed = subprocess.run([binary_path, *sys.argv[1:]], check=False)
        return completed.returncode
    except Exception as error:
        print(f"${intent.consoleScript} launcher error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
`
}

const metadata = (intent: PyPiWheelIntent, version: string): string => `Metadata-Version: 2.1
Name: ${intent.packageName}
Version: ${version}
Summary: ${intent.summary}
Home-page: ${intent.homepage}
License: ${intent.license}
Requires-Python: ${intent.requiresPython}
Description-Content-Type: text/plain

${intent.summary}
`

const wheelMetadata = (intent: PyPiWheelIntent): string => `Wheel-Version: 1.0
Generator: ts-release
Root-Is-Purelib: false
Tag: ${intent.wheelTag}
`

interface StageEntryInput {
  readonly sourcePath: string
  readonly entryPath: string
  readonly mode: number
  readonly artifactId?: string | undefined
  readonly failureReason?: string | undefined
}

const readStageEntries = Effect.fn("ArtifactStager.readEntries")(function*(
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  operation: StageOperation,
  context: ArtifactStageContext,
  inputs: ReadonlyArray<StageEntryInput>
) {
  const entries = yield* Effect.forEach(inputs, (input) =>
    Effect.gen(function*() {
      const resolved = yield* resolveStagePath(path, operation, input.sourcePath, context, input.artifactId)
      const failureReason = input.failureReason
      const data: Uint8Array | undefined = failureReason === undefined
        ? yield* fileSystem.readFile(resolved).pipe(
          Effect.matchEffect({ onFailure: () => Effect.succeed(undefined), onSuccess: Effect.succeed })
        )
        : yield* fileSystem.readFile(resolved).pipe(
          Effect.mapError((cause) =>
            stageError(operation, {
              artifactId: input.artifactId,
              path: input.sourcePath,
              reason: failureReason,
              cause
            })
          )
        )
      return data === undefined
        ? undefined
        : {
          path: input.entryPath,
          data,
          mode: input.mode
        } satisfies ArchiveByteEntry
    })
  )
  return entries.filter((entry): entry is ArchiveByteEntry => entry !== undefined)
})

const buildEntries = Effect.fn("ArtifactStager.pypiWheel.entries")(function*(
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  operation: StageOperation,
  intent: PyPiWheelIntent,
  context: ArtifactStageContext
) {
  const distInfo = `${distributionName(intent.packageName)}-${context.identity.version}.dist-info`
  const entries: Array<ArchiveByteEntry> = [
    {
      path: `${intent.moduleName}/__init__.py`,
      data: bytes(`__version__ = "${context.identity.version}"\n`),
      mode: 0o100644
    },
    {
      path: `${intent.moduleName}/cli.py`,
      data: bytes(wrapperSource(intent)),
      mode: 0o100644
    },
    {
      path: `${distInfo}/METADATA`,
      data: bytes(metadata(intent, context.identity.version)),
      mode: 0o100644
    },
    {
      path: `${distInfo}/WHEEL`,
      data: bytes(wheelMetadata(intent)),
      mode: 0o100644
    },
    {
      path: `${distInfo}/entry_points.txt`,
      data: bytes(`[console_scripts]\n${intent.consoleScript} = ${intent.moduleName}.cli:main\n`),
      mode: 0o100644
    },
    {
      path: `${distInfo}/top_level.txt`,
      data: bytes(`${intent.moduleName}\n`),
      mode: 0o100644
    }
  ]

  entries.push(...yield* readStageEntries(
    fileSystem,
    path,
    operation,
    context,
    intent.binaries.map((binary) => ({
      sourcePath: renderTemplate(binary.sourcePath, { identity: context.identity }),
      entryPath: binary.wheelPath,
      mode: 0o100755,
      failureReason: "Unable to read PyPI wheel binary input."
    }))
  ))

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

const stagePyPiWheel = (
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  operation: StageOperation,
  intent: PyPiWheelIntent,
  context: ArtifactStageContext
) =>
  Effect.gen(function*() {
    const artifactId = operation.action.producesArtifactIds[0]
    const outputPath = yield* resolveStagePath(path, operation, intent.outfile, context, artifactId)
    const entries = yield* buildEntries(fileSystem, path, operation, intent, context)
    const wheel = buildZipArchive(entries)
    yield* fileSystem.makeDirectory(path.dirname(outputPath), { recursive: true }).pipe(
      Effect.mapError((cause) =>
        stageError(operation, {
          path: intent.outfile,
          reason: "Unable to create PyPI wheel output directory.",
          cause
        })
      )
    )
    yield* fileSystem.writeFile(outputPath, wheel).pipe(
      Effect.mapError((cause) =>
        stageError(operation, {
          artifactId,
          path: intent.outfile,
          reason: "Unable to write PyPI wheel artifact.",
          cause
        })
      )
    )
    return stagedResult(operation, intent)
  })

const archiveEntryPath = (wrapDirectory: string | undefined, pathName: string): string =>
  wrapDirectory === undefined
    ? pathName
    : `${wrapDirectory.replace(/\/+$/, "")}/${pathName.replace(/^\/+/, "")}`

const globRegex = (pattern: string): RegExp =>
  new RegExp(`^${pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*")}$`)

const fileMatchesPattern = (fileName: string, pattern: string): boolean =>
  pattern.includes("*")
    ? globRegex(pattern).test(fileName)
    : fileName === pattern

const archiveFileEntries = Effect.fn("ArtifactStager.archive.files")(function*(
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  operation: StageOperation,
  intent: ArchiveIntent,
  context: ArtifactStageContext
) {
  const entries = yield* fileSystem.readDirectory(context.root, { recursive: true }).pipe(
    Effect.matchEffect({
      onFailure: () => Effect.succeed([]),
      onSuccess: (value) => Effect.succeed(value)
    })
  )
  const matched = new Set<string>()
  for (const pattern of intent.files) {
    for (const entry of entries) {
      const fileName = entry.replaceAll("\\", "/")
      if (fileMatchesPattern(fileName, pattern)) {
        matched.add(fileName)
      }
    }
  }

  return yield* readStageEntries(
    fileSystem,
    path,
    operation,
    context,
    [...matched].sort().map((fileName) => ({
      sourcePath: fileName,
      entryPath: archiveEntryPath(intent.wrapDirectory, fileName),
      mode: 0o100644
    }))
  )
})

const archiveArtifactEntries = Effect.fn("ArtifactStager.archive.artifacts")(function*(
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  operation: StageOperation,
  intent: ArchiveIntent,
  context: ArtifactStageContext
) {
  return yield* readStageEntries(
    fileSystem,
    path,
    operation,
    context,
    intent.artifacts.map((artifact) => ({
      sourcePath: artifact.sourcePath,
      entryPath: archiveEntryPath(intent.wrapDirectory, artifact.archivePath),
      mode: 0o100755,
      artifactId: artifact.artifactId,
      failureReason: "Unable to read archive artifact input."
    }))
  )
})

const archiveBytes = (
  operation: StageOperation,
  intent: ArchiveIntent,
  entries: ReadonlyArray<ArchiveByteEntry>
): Effect.Effect<Uint8Array, ArtifactStageError> =>
  Effect.try({
    try: () => intent.format === "zip" ? buildZipArchive(entries) : buildTarGzArchive(entries),
    catch: (cause) =>
      stageError(operation, {
        path: intent.outfile,
        reason: `Unable to create ${intent.format} archive bytes.`,
        cause
      })
  })

const stageArchive = (
  fileSystem: FileSystem.FileSystem,
  path: Path.Path,
  operation: StageOperation,
  intent: ArchiveIntent,
  context: ArtifactStageContext
) =>
  Effect.gen(function*() {
    const artifactId = operation.action.producesArtifactIds[0]
    const outputPath = yield* resolveStagePath(path, operation, intent.outfile, context, artifactId)
    const artifactEntries = yield* archiveArtifactEntries(fileSystem, path, operation, intent, context)
    const fileEntries = yield* archiveFileEntries(fileSystem, path, operation, intent, context)
    const archive = yield* archiveBytes(
      operation,
      intent,
      [...artifactEntries, ...fileEntries].sort((left, right) => left.path.localeCompare(right.path))
    )
    yield* fileSystem.makeDirectory(path.dirname(outputPath), { recursive: true }).pipe(
      Effect.mapError((cause) =>
        stageError(operation, {
          path: intent.outfile,
          reason: "Unable to create archive output directory.",
          cause
        })
      )
    )
    yield* fileSystem.writeFile(outputPath, archive).pipe(
      Effect.mapError((cause) =>
        stageError(operation, {
          artifactId,
          path: intent.outfile,
          reason: "Unable to write archive artifact.",
          cause
        })
      )
    )
    return stagedResult(operation, intent)
  })

export const makeArtifactStagerLayer = (
  build: BunExecutableBuild = liveBunExecutableBuild
): Layer.Layer<ArtifactStager, never, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(ArtifactStager)(
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      return {
        stage: Effect.fn("ArtifactStager.stage")(function*(operation, context) {
          switch (operation.action.intent._tag) {
            case "bun-compile":
              return yield* stageBunCompile(build, path, operation, operation.action.intent, context)
            case "pypi-wheel":
              return yield* stagePyPiWheel(fileSystem, path, operation, operation.action.intent, context)
            case "archive":
              return yield* stageArchive(fileSystem, path, operation, operation.action.intent, context)
          }
        })
      }
    })
  )

export const stageArtifactOperation = Effect.fn("ArtifactStager.stage")(function*(
  operation: StageOperation,
  context: ArtifactStageContext
) {
  const stager = yield* ArtifactStager
  return yield* stager.stage(operation, context)
})

export const stageArtifactOperations = Effect.fn("ArtifactStager.stageAll")(function*(
  operations: ReadonlyArray<StageOperation>,
  context: ArtifactStageContext
) {
  const results = []
  for (const operation of operations) {
    results.push(yield* stageArtifactOperation(operation, context))
  }
  return results
})

export const UnsupportedArtifactStagerLayer: Layer.Layer<ArtifactStager> = Layer.succeed(ArtifactStager)({
  stage: (operation) =>
    Effect.fail(
      stageError(operation, {
        reason: "Artifact staging is not supported by this runtime."
      })
    )
})

export const LiveArtifactStagerLayer: Layer.Layer<
  ArtifactStager,
  never,
  FileSystem.FileSystem | Path.Path
> = makeArtifactStagerLayer()
