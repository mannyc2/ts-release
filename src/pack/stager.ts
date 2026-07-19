// Invariant: one typed interpreter turns each stage intent into deterministic bytes inside the workspace boundary.
import { createHash } from "node:crypto"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import launcherTemplate from "../assets/launcher.py" with { type: "text" }
import wheelTemplates from "../assets/wheel-templates.json" with { type: "json" }
import { validateWorkspaceWritePath } from "../host/workspace-path.js"
import { artifactPathBaseName } from "../grammar/artifact.js"
import type { ArchiveIntent, BunCompileIntent, Operation, PyPiWheelIntent, StageAction } from "../grammar/operation.js"
import type { ReleaseIdentity } from "../grammar/state.js"
import { renderTemplate } from "../grammar/template.js"
import { type ArchiveByteEntry, buildTarGzArchive, buildZipArchive, bytes } from "./archive-bytes.js"

export interface ArtifactStageContext {
  readonly root: string
  readonly identity: ReleaseIdentity
  readonly configPath?: string | undefined
}
export interface StagedArtifact { readonly id: string; readonly path: string }
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
export type BunExecutableBuild = (input: BunExecutableBuildInput) => Promise<{
  readonly success: boolean
  readonly logs: ReadonlyArray<unknown>
}>
export const liveBunExecutableBuild: BunExecutableBuild = (input) => Bun.build({
  entrypoints: [input.entrypoint],
  ...(input.minify === undefined ? {} : { minify: input.minify }),
  compile: { target: input.target, outfile: input.outfile }
})

export type StageOperation = Operation & { readonly action: StageAction }
export interface ArtifactStagerShape {
  readonly stage: (
    operation: StageOperation,
    context: ArtifactStageContext
  ) => Effect.Effect<StagedArtifactOperationResult, ArtifactStageError>
}
export class ArtifactStager extends Context.Service<ArtifactStager, ArtifactStagerShape>()("ArtifactStager") {}

const stageError = (
  operation: StageOperation,
  fields: {
    readonly artifactId?: string | undefined
    readonly path?: string | undefined
    readonly reason: string
    readonly cause?: unknown
  }
): ArtifactStageError => ArtifactStageError.make({
  operationId: operation.id,
  intentTag: operation.action.intent._tag,
  ...(fields.artifactId === undefined ? {} : { artifactId: fields.artifactId }),
  ...(fields.path === undefined ? {} : { path: fields.path }),
  reason: fields.reason,
  ...(fields.cause === undefined ? {} : { cause: fields.cause })
})

const staged = (operation: StageOperation, outfile: string): StagedArtifactOperationResult => ({
  operationId: operation.id,
  intentTag: operation.action.intent._tag,
  artifacts: operation.action.producesArtifactIds.map((id) => ({ id, path: outfile }))
})

const stagePath = (
  path: Path.Path,
  operation: StageOperation,
  context: ArtifactStageContext,
  pathName: string,
  artifactId?: string
): Effect.Effect<string, ArtifactStageError> => {
  const result = validateWorkspaceWritePath(path, context.root, pathName, { allowAbsolute: false })
  return result._tag === "Ok" ? Effect.succeed(result.path) : Effect.fail(stageError(operation, {
    artifactId,
    path: pathName,
    reason: result.reason === "empty-or-parent-traversal"
      ? "Stage paths must be non-empty, relative, and must not contain parent traversal."
      : "Stage paths must resolve inside the workspace root."
  }))
}

const stageBun = (
  build: BunExecutableBuild,
  path: Path.Path,
  operation: StageOperation,
  context: ArtifactStageContext,
  intent: BunCompileIntent
) => Effect.gen(function*() {
  const artifactId = operation.action.producesArtifactIds[0]
  const entrypoint = yield* stagePath(path, operation, context, intent.entry)
  const outfile = yield* stagePath(path, operation, context, intent.outfile, artifactId)
  const output = yield* Effect.tryPromise({
    try: () => build({
      entrypoint,
      target: intent.compileTarget as Bun.Build.CompileTarget,
      outfile,
      ...(intent.minify === undefined ? {} : { minify: intent.minify })
    }),
    catch: (cause) => stageError(operation, {
      artifactId,
      path: intent.outfile,
      reason: "Bun.build rejected while staging " + (artifactId ?? operation.id) + ".",
      cause
    })
  })
  if (!output.success) {
    const logs = output.logs.map(String).join("\n").trim()
    return yield* Effect.fail(stageError(operation, {
      artifactId,
      path: intent.outfile,
      reason: logs || "Bun.build failed for " + (artifactId ?? operation.id) + "."
    }))
  }
  return staged(operation, intent.outfile)
})

interface EntryInput {
  readonly sourcePath: string
  readonly entryPath: string
  readonly mode: number
  readonly artifactId?: string | undefined
  readonly failureReason?: string | undefined
}

const readEntries = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  operation: StageOperation,
  context: ArtifactStageContext,
  inputs: ReadonlyArray<EntryInput>
) => Effect.forEach(inputs, (input) => Effect.gen(function*() {
  const resolved = yield* stagePath(path, operation, context, input.sourcePath, input.artifactId)
  const read = fs.readFile(resolved)
  const data = input.failureReason === undefined
    ? yield* read.pipe(Effect.catch(() => Effect.succeed(undefined)))
    : yield* read.pipe(Effect.mapError((cause) => stageError(operation, {
      artifactId: input.artifactId,
      path: input.sourcePath,
      reason: input.failureReason!,
      cause
    })))
  return data === undefined ? undefined : {
    path: input.entryPath, data, mode: input.mode
  } satisfies ArchiveByteEntry
})).pipe(Effect.map((entries) => entries.filter((entry): entry is ArchiveByteEntry => entry !== undefined)))

const wheelTemplate = (template: string, fields: Readonly<Record<string, string>>): string =>
  Object.entries(fields).reduce((rendered, [name, value]) =>
    rendered.replaceAll(`{{${name}}}`, value), template)

const wheelEntries = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  operation: StageOperation,
  context: ArtifactStageContext,
  intent: PyPiWheelIntent
) => Effect.gen(function*() {
  const version = context.identity.version
  const distInfo = intent.packageName.replaceAll("-", "_").replaceAll(".", "_") + "-" + version + ".dist-info"
  const launcherEntries = intent.binaries.map((binary) =>
    "    (" + JSON.stringify(binary.os) + ", " + JSON.stringify(binary.arch) + "): "
      + JSON.stringify(artifactPathBaseName(binary.wheelPath))).join(",\n")
  const launcher = launcherTemplate
    .replaceAll("{{consoleScript}}", intent.consoleScript)
    .replaceAll("{{moduleName}}", intent.moduleName)
    .replace("{{entries}}", launcherEntries)
  const fields = {
    version, packageName: intent.packageName, summary: intent.summary, homepage: intent.homepage,
    license: intent.license, requiresPython: intent.requiresPython, wheelTag: intent.wheelTag,
    consoleScript: intent.consoleScript, moduleName: intent.moduleName
  }
  const entries: Array<ArchiveByteEntry> = [
    { path: intent.moduleName + "/__init__.py", data: bytes(wheelTemplate(wheelTemplates.init, fields)), mode: 0o100644 },
    { path: intent.moduleName + "/cli.py", data: bytes(launcher), mode: 0o100644 },
    { path: distInfo + "/METADATA", data: bytes(wheelTemplate(wheelTemplates.metadata, fields)), mode: 0o100644 },
    { path: distInfo + "/WHEEL", data: bytes(wheelTemplate(wheelTemplates.wheel, fields)), mode: 0o100644 },
    { path: distInfo + "/entry_points.txt", data: bytes(wheelTemplate(wheelTemplates.entryPoints, fields)), mode: 0o100644 },
    { path: distInfo + "/top_level.txt", data: bytes(wheelTemplate(wheelTemplates.topLevel, fields)), mode: 0o100644 }
  ]
  entries.push(...yield* readEntries(fs, path, operation, context, intent.binaries.map((binary) => ({
    sourcePath: renderTemplate(binary.sourcePath, { identity: context.identity }),
    entryPath: binary.wheelPath,
    mode: 0o100755,
    failureReason: "Unable to read PyPI wheel binary input."
  }))))
  const recordPath = distInfo + "/RECORD"
  const rows = entries.map((entry) => entry.path + ",sha256="
    + createHash("sha256").update(entry.data).digest("base64url") + "," + entry.data.byteLength)
  rows.push(recordPath + ",,")
  entries.push({ path: recordPath, data: bytes(rows.join("\n") + "\n"), mode: 0o100644 })
  return entries.sort((left, right) => left.path.localeCompare(right.path))
})

const wrapPath = (directory: string | undefined, pathName: string): string =>
  directory === undefined ? pathName : directory.replace(/\/+$/, "") + "/" + pathName.replace(/^\/+/, "")
const glob = (pattern: string): RegExp => new RegExp("^" + pattern.split("*")
  .map((part) => part.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&")).join(".*") + "$")

const archiveEntries = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  operation: StageOperation,
  context: ArtifactStageContext,
  intent: ArchiveIntent
) => Effect.gen(function*() {
  const workspaceEntries = yield* fs.readDirectory(context.root, { recursive: true }).pipe(
    Effect.catch(() => Effect.succeed([]))
  )
  const files = new Set<string>()
  for (const pattern of intent.files) {
    const matches = pattern.includes("*") ? glob(pattern) : undefined
    for (const entry of workspaceEntries) {
      const name = entry.replaceAll("\\", "/")
      if (matches?.test(name) ?? name === pattern) files.add(name)
    }
  }
  const artifactEntries = yield* readEntries(fs, path, operation, context, intent.artifacts.map((artifact) => ({
    sourcePath: artifact.sourcePath,
    entryPath: wrapPath(intent.wrapDirectory, artifact.archivePath),
    mode: 0o100755,
    artifactId: artifact.artifactId,
    failureReason: "Unable to read archive artifact input."
  })))
  const fileEntries = yield* readEntries(fs, path, operation, context, [...files].sort().map((fileName) => ({
    sourcePath: fileName,
    entryPath: wrapPath(intent.wrapDirectory, fileName),
    mode: 0o100644
  })))
  return [...artifactEntries, ...fileEntries].sort((left, right) => left.path.localeCompare(right.path))
})

const writeOutput = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  operation: StageOperation,
  context: ArtifactStageContext,
  data: Uint8Array,
  label: "PyPI wheel" | "archive"
) => Effect.gen(function*() {
  const outfile = operation.action.intent.outfile
  const artifactId = operation.action.producesArtifactIds[0]
  const outputPath = yield* stagePath(path, operation, context, outfile, artifactId)
  yield* fs.makeDirectory(path.dirname(outputPath), { recursive: true }).pipe(
    Effect.mapError((cause) => stageError(operation, {
      path: outfile, reason: "Unable to create " + label + " output directory.", cause
    }))
  )
  yield* fs.writeFile(outputPath, data).pipe(Effect.mapError((cause) => stageError(operation, {
    artifactId, path: outfile, reason: "Unable to write " + label + " artifact.", cause
  })))
  return staged(operation, outfile)
})

export const makeArtifactStagerLayer = (
  build: BunExecutableBuild = liveBunExecutableBuild
): Layer.Layer<ArtifactStager, never, FileSystem.FileSystem | Path.Path> => Layer.effect(ArtifactStager)(
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    return {
      stage: Effect.fn("ArtifactStager.stage")(function*(operation, context) {
        const intent = operation.action.intent
        if (intent._tag === "bun-compile") return yield* stageBun(build, path, operation, context, intent)
        if (intent._tag === "pypi-wheel") {
          return yield* writeOutput(
            fs, path, operation, context, buildZipArchive(yield* wheelEntries(fs, path, operation, context, intent)), "PyPI wheel"
          )
        }
        const data = yield* archiveEntries(fs, path, operation, context, intent)
        const archive = yield* Effect.try({
          try: () => intent.format === "zip" ? buildZipArchive(data) : buildTarGzArchive(data),
          catch: (cause) => stageError(operation, {
            path: intent.outfile, reason: "Unable to create " + intent.format + " archive bytes.", cause
          })
        })
        return yield* writeOutput(fs, path, operation, context, archive, "archive")
      })
    }
  })
)

export const UnsupportedArtifactStagerLayer: Layer.Layer<ArtifactStager> = Layer.succeed(ArtifactStager)({
  stage: (operation) => Effect.fail(stageError(operation, {
    reason: "Artifact staging is not supported by this runtime."
  }))
})
