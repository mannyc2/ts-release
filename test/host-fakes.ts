import * as BunPath from "@effect/platform-bun/BunPath"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as PlatformError from "effect/PlatformError"
import * as Schema from "effect/Schema"
import { CommandSpec } from "../src/grammar/operation.js"
import {
  CommandRunnerError,
  ReleaseCommandRunner,
  type CommandResult,
  type ReleaseCommandRunnerShape
} from "../src/host/host.js"
import {
  ApiError,
  ReleaseHttp,
  type HttpBytesResult,
  type HttpHeader,
  type HttpRequestSpec,
  type HttpResult
} from "../src/host/http.js"

export { CommandSpec, ReleaseCommandRunner, ReleaseHttp }
export { NoteAction, Operation } from "../src/grammar/operation.js"
export { ExecutionApproval } from "../src/grammar/approval.js"

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
  readonly onWriteFileString?: ((path: string, contents: string) => void) | undefined
  readonly failReadFileString?: boolean | ((path: string) => boolean) | undefined
  readonly failWriteFileString?: boolean | undefined
}

export interface TestHttpResponse {
  readonly status: number
  readonly json?: Schema.Json | undefined
  readonly bytes?: Uint8Array | undefined
  readonly responseHeaders?: ReadonlyArray<HttpHeader> | undefined
}

export interface TestReleaseHttpOptions {
  readonly responses?: ReadonlyMap<string, TestHttpResponse> | undefined
  readonly timestamps?: ReadonlyArray<string> | undefined
  readonly onRequest?: ((request: HttpRequestSpec) => void) | undefined
}

export const commandKey = (command: CommandSpec): string =>
  [command.executable, ...command.args].join("\u0000")

export const httpRequestKey = (request: HttpRequestSpec): string =>
  `${request.method}\u0000${request.url}`

export const ReleaseCommandRunnerTestLayer = (
  commandRunner: ReleaseCommandRunnerShape
): Layer.Layer<ReleaseCommandRunner> =>
  Layer.succeed(ReleaseCommandRunner)(commandRunner)

export const makeCommandRunnerLayer = (options: {
  readonly env?: ReadonlyMap<string, string>
  readonly commands?: ReadonlyMap<string, TestCommandResponse>
  readonly timestamps?: ReadonlyArray<string>
  readonly durationMillis?: number
} = {}) => {
  const env = new Map(options.env ?? [])
  const commands = new Map(options.commands ?? [])
  const timestamps = [...(options.timestamps ?? ["2026-06-16T00:00:00.000Z"])]
  let timestampIndex = 0
  const nextTimestamp = () => timestamps[timestampIndex++] ?? timestamps.at(-1) ?? "2026-06-16T00:00:00.000Z"
  return Layer.mergeAll(
    ReleaseCommandRunnerTestLayer({
      runCommand: (command) => Effect.gen(function*() {
        const missing = command.requiredEnv.filter((name) => !env.has(name))
        if (missing.length > 0) {
          return yield* Effect.fail(CommandRunnerError.make({
            operation: "runCommand",
            reason: `Missing required environment variables: ${missing.join(", ")}`
          }))
        }
        const response = commands.get(commandKey(command)) ?? { exitCode: 0, stdout: "", stderr: "" }
        return {
          command,
          ...response,
          startedAt: nextTimestamp(),
          endedAt: nextTimestamp(),
          durationMillis: options.durationMillis ?? 0
        } satisfies CommandResult
      })
    }),
    ConfigProvider.layer(ConfigProvider.fromEnv({ env: Object.fromEntries(env) }))
  )
}

const notFound = (method: string, path: string): PlatformError.PlatformError =>
  PlatformError.systemError({
    _tag: "NotFound",
    module: "FileSystem",
    method,
    pathOrDescriptor: path,
    description: "File not found"
  })

const permissionDenied = (method: string, path: string): PlatformError.PlatformError =>
  PlatformError.systemError({
    _tag: "PermissionDenied",
    module: "FileSystem",
    method,
    pathOrDescriptor: path,
    description: "Operation not permitted"
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
  const normalized = normalizedSeparators(path)
  variants.add(normalized)
  if (normalized.startsWith("./")) {
    variants.add(normalized.replace(/^\.\/+/, ""))
  }
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

  return Layer.mergeAll(
    FileSystem.layerNoop({
      exists: (path) => Effect.sync(() =>
        getFixtureFile(files, path) !== undefined || hasFixtureDirectory(directories, path)),

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
        Effect.sync(() => typeof options.failReadFileString === "function"
          ? options.failReadFileString(path)
          : options.failReadFileString === true).pipe(
          Effect.flatMap((fail) => fail
            ? Effect.fail(permissionDenied("readFileString", path))
            : Effect.succeed(getFixtureFile(files, path))),
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
          options.onWriteFileString?.(path, data)
        }).pipe(
          Effect.flatMap(() =>
            options.failWriteFileString === true
              ? Effect.fail(permissionDenied("writeFileString", path))
              : Effect.sync(() => {
                files.set(path, data)
              })
          )
        )
    }),
    options.pathLayer ?? BunPath.layer,
    Layer.succeed(Crypto.Crypto)(
      Crypto.make({
        randomBytes: (size) => new Uint8Array(size),
        digest: (_algorithm, data) => Effect.succeed(data)
      })
    ),
    makeCommandRunnerLayer({
      ...(options.env === undefined ? {} : { env: options.env }),
      ...(options.commands === undefined ? {} : { commands: options.commands }),
      ...(options.timestamps === undefined ? {} : { timestamps: options.timestamps })
    })
  )
}

export const makeTestReleaseHttpLayer = (
  options: TestReleaseHttpOptions = {}
): Layer.Layer<ReleaseHttp> => {
  const responses = new Map(options.responses ?? [])
  const timestamps = [...(options.timestamps ?? ["2026-06-16T00:00:00.000Z"])]
  let timestampIndex = 0

  const nextTimestamp = (): string => {
    const value = timestamps[timestampIndex] ?? timestamps[timestamps.length - 1] ?? "2026-06-16T00:00:00.000Z"
    timestampIndex += 1
    return value
  }

  return Layer.succeed(ReleaseHttp)({
    runJson: (request) =>
      Effect.gen(function*() {
        options.onRequest?.(request)
        const startedAt = nextTimestamp()
        const response = responses.get(httpRequestKey(request))
        if (response === undefined) {
          return yield* Effect.fail(
            ApiError.make({
              operation: "runJson",
              url: request.url,
              reason: "No test HTTP response configured"
            })
          )
        }
        if (response.json === undefined) return yield* Effect.fail(ApiError.make({
          operation: "runJson",
          url: request.url,
          reason: "Test HTTP response has no JSON body"
        }))
        const endedAt = nextTimestamp()
        return {
          request,
          status: response.status,
          json: response.json,
          responseHeaders: response.responseHeaders === undefined ? [] : [...response.responseHeaders],
          startedAt,
          endedAt,
          durationMillis: 0
        } satisfies HttpResult
      }),
    runBytes: (request) =>
      Effect.gen(function*() {
        options.onRequest?.(request)
        const startedAt = nextTimestamp()
        const response = responses.get(httpRequestKey(request))
        if (response === undefined) return yield* Effect.fail(ApiError.make({
          operation: "runBytes",
          url: request.url,
          reason: "No test HTTP response configured"
        }))
        if (response.bytes === undefined) return yield* Effect.fail(ApiError.make({
          operation: "runBytes",
          url: request.url,
          reason: "Test HTTP response has no byte body"
        }))
        return {
          request,
          status: response.status,
          bytes: response.bytes,
          responseHeaders: response.responseHeaders === undefined ? [] : [...response.responseHeaders],
          startedAt,
          endedAt: nextTimestamp(),
          durationMillis: 0
        } satisfies HttpBytesResult
      })
  })
}
