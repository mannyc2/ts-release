import * as ConfigProvider from "effect/ConfigProvider"
import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as PlatformError from "effect/PlatformError"
import { CommandSpec } from "../domain/operation.js"
import { CommandResult, CommandRunnerError, ReleaseCommandRunner } from "./host.js"

export type * from "../types/effect-internal.js"

export interface TestCommandResponse {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export interface TestCommandRunnerOptions {
  readonly files?: ReadonlyMap<string, string> | undefined
  readonly directories?: ReadonlySet<string> | undefined
  readonly env?: ReadonlyMap<string, string> | undefined
  readonly commands?: ReadonlyMap<string, TestCommandResponse> | undefined
  readonly timestamps?: ReadonlyArray<string> | undefined
  readonly pathLayer?: Layer.Layer<Path.Path> | undefined
}

export const commandKey = (command: CommandSpec): string =>
  [command.executable, ...command.args].join("\u0000")

const notFound = (method: string, path: string): PlatformError.PlatformError =>
  PlatformError.systemError({
    _tag: "NotFound",
    module: "FileSystem",
    method,
    pathOrDescriptor: path,
    description: "File not found"
  })

const fileInfo = (sizeBytes: number): FileSystem.File.Info => ({
  type: "File",
  mtime: Option.none(),
  atime: Option.none(),
  birthtime: Option.none(),
  dev: 0,
  ino: Option.none(),
  mode: 0,
  nlink: Option.none(),
  uid: Option.none(),
  gid: Option.none(),
  rdev: Option.none(),
  size: FileSystem.Size(sizeBytes),
  blksize: Option.none(),
  blocks: Option.none()
})

const directoryInfo: FileSystem.File.Info = {
  type: "Directory",
  mtime: Option.none(),
  atime: Option.none(),
  birthtime: Option.none(),
  dev: 0,
  ino: Option.none(),
  mode: 0,
  nlink: Option.none(),
  uid: Option.none(),
  gid: Option.none(),
  rdev: Option.none(),
  size: FileSystem.Size(0),
  blksize: Option.none(),
  blocks: Option.none()
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const normalizedSeparators = (path: string): string =>
  path.replaceAll("\\", "/")

const addVariant = (variants: Set<string>, path: string): void => {
  variants.add(path)
  variants.add(normalizedSeparators(path))
}

const addRelativePathVariants = (variants: Set<string>, cwd: string, path: string): void => {
  const normalizedCwd = normalizedSeparators(cwd)
  const normalizedPath = normalizedSeparators(path)
  if (normalizedPath === normalizedCwd) {
    variants.add(".")
    return
  }
  const cwdPrefix = `${normalizedCwd}/`
  if (normalizedPath.startsWith(cwdPrefix)) {
    variants.add(normalizedPath.slice(cwdPrefix.length))
  }
}

const pathVariants = (path: string): ReadonlyArray<string> => {
  const variants = new Set<string>()
  addVariant(variants, path)
  const cwd = globalThis.process?.cwd()
  if (cwd === undefined) {
    return [...variants]
  }
  if (path === cwd) {
    variants.add(".")
  }
  addRelativePathVariants(variants, cwd, path)
  return [...variants]
}

const getFixtureFile = (files: ReadonlyMap<string, string>, path: string): string | undefined => {
  for (const variant of pathVariants(path)) {
    const contents = files.get(variant)
    if (contents !== undefined) {
      return contents
    }
  }
  return undefined
}

const hasFixtureDirectory = (directories: ReadonlySet<string>, path: string): boolean => {
  for (const variant of pathVariants(path)) {
    if (directories.has(variant)) {
      return true
    }
  }
  return false
}

const fixtureDirectoryEntries = (
  files: ReadonlyMap<string, string>,
  directories: ReadonlySet<string>,
  path: string
): Array<string> | undefined => {
  const entries = new Set<string>()
  let found = false
  for (const variant of pathVariants(path)) {
    const normalizedDirectory = normalizedSeparators(variant).replace(/\/$/, "")
    if (directories.has(variant) || directories.has(normalizedDirectory)) {
      found = true
    }
    const prefix = normalizedDirectory === "." ? "" : `${normalizedDirectory}/`
    for (const filePath of files.keys()) {
      const normalizedFile = normalizedSeparators(filePath)
      if (!normalizedFile.startsWith(prefix)) {
        continue
      }
      const remainder = prefix.length === 0 ? normalizedFile : normalizedFile.slice(prefix.length)
      const entry = remainder.split("/")[0]
      if (entry !== undefined && entry.length > 0 && remainder !== normalizedFile) {
        entries.add(entry)
        found = true
      }
      if (entry !== undefined && entry.length > 0 && prefix.length === 0) {
        entries.add(entry)
        found = true
      }
    }
    for (const directoryPath of directories) {
      const normalizedChild = normalizedSeparators(directoryPath)
      if (!normalizedChild.startsWith(prefix) || normalizedChild === normalizedDirectory) {
        continue
      }
      const remainder = prefix.length === 0 ? normalizedChild : normalizedChild.slice(prefix.length)
      const entry = remainder.split("/")[0]
      if (entry !== undefined && entry.length > 0) {
        entries.add(entry)
        found = true
      }
    }
  }
  return found ? [...entries].sort() : undefined
}

export const makeTestCommandRunnerLayer = (
  options: TestCommandRunnerOptions = {}
) => {
  const files = new Map(options.files ?? [])
  const directories = new Set(options.directories ?? [])
  const env = new Map(options.env ?? [])
  const commands = new Map(options.commands ?? [])
  const timestamps = [...(options.timestamps ?? ["2026-06-16T00:00:00.000Z"])]
  let timestampIndex = 0

  const nextTimestamp = (): string => {
    const value = timestamps[timestampIndex] ?? timestamps[timestamps.length - 1] ?? "2026-06-16T00:00:00.000Z"
    timestampIndex += 1
    return value
  }

  const envRecord: Record<string, string> = {}
  for (const [name, value] of env) {
    envRecord[name] = value
  }

  return Layer.mergeAll(
    FileSystem.layerNoop({
      stat: (path) =>
        Effect.sync(() => {
          const contents = getFixtureFile(files, path)
          if (contents !== undefined) {
            return fileInfo(textEncoder.encode(contents).byteLength)
          }
          if (hasFixtureDirectory(directories, path)) {
            return directoryInfo
          }
          return undefined
        }).pipe(
          Effect.flatMap((info) =>
            info === undefined
              ? Effect.fail(notFound("stat", path))
              : Effect.succeed(info)
          )
        ),

      readFile: (path) =>
        Effect.sync(() => getFixtureFile(files, path)).pipe(
          Effect.flatMap((contents) =>
            contents === undefined
              ? Effect.fail(notFound("readFile", path))
              : Effect.succeed(textEncoder.encode(contents))
          )
        ),

      readFileString: (path) =>
        Effect.sync(() => getFixtureFile(files, path)).pipe(
          Effect.flatMap((contents) =>
            contents === undefined
              ? Effect.fail(notFound("readFileString", path))
              : Effect.succeed(contents)
          )
        ),

      readDirectory: (path) =>
        Effect.sync(() => fixtureDirectoryEntries(files, directories, path)).pipe(
          Effect.flatMap((entries) =>
            entries === undefined
              ? Effect.fail(notFound("readDirectory", path))
              : Effect.succeed(entries)
          )
        ),

      makeDirectory: (path) =>
        Effect.sync(() => {
          directories.add(path)
        }),

      writeFile: (path, data) =>
        Effect.sync(() => {
          files.set(path, textDecoder.decode(data))
        }),

      writeFileString: (path, data) =>
        Effect.sync(() => {
          files.set(path, data)
        })
    }),
    options.pathLayer ?? Path.layer,
    Layer.succeed(Crypto.Crypto)(
      Crypto.make({
        randomBytes: (size) => new Uint8Array(size),
        digest: (_algorithm, data) => Effect.succeed(data)
      })
    ),
    Layer.succeed(ReleaseCommandRunner)({
      runCommand: (command) =>
        Effect.gen(function*() {
          const missing: Array<string> = []
          for (const name of command.requiredEnv) {
            if (!env.has(name)) {
              missing.push(name)
            }
          }
          if (missing.length > 0) {
            return yield* Effect.fail(
              CommandRunnerError.make({
                operation: "runCommand",
                reason: `Missing required environment variables: ${missing.join(", ")}`
              })
            )
          }
          const startedAt = nextTimestamp()
          const endedAt = nextTimestamp()
          const response = commands.get(commandKey(command)) ?? {
            exitCode: 0,
            stdout: "",
            stderr: ""
          }
          return CommandResult.make({
            command,
            exitCode: response.exitCode,
            stdout: response.stdout,
            stderr: response.stderr,
            startedAt,
            endedAt,
            durationMillis: 0
          })
        })
    }),
    ConfigProvider.layer(ConfigProvider.fromEnv({ env: envRecord }))
  )
}
