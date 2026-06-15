import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdir, stat as fsStat } from "node:fs/promises"
import { dirname, isAbsolute, resolve } from "node:path"
import { ChecksumAlgorithm } from "../domain/artifact.js"
import { CommandSpec } from "../domain/operation.js"
import { CommandResult, FileInfo, HostError, ReleaseHost } from "./host.js"

export type * from "../types/effect-internal.js"

const formatUnknown = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

export interface BunReleaseHostOptions {
  readonly root?: string | undefined
}

const checksumName = (algorithm: ChecksumAlgorithm): string =>
  algorithm === "sha256" ? "SHA-256" : "SHA-512"

const toHex = (bytes: Uint8Array): string => {
  let output = ""
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, "0")
  }
  return output
}

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> => {
  if (stream === null) {
    return ""
  }
  return await new Response(stream).text()
}

const inheritedEnvNames = [
  "PATH",
  "HOME",
  "USERPROFILE",
  "SystemRoot",
  "TEMP",
  "TMP"
]

const commandEnv = (command: CommandSpec): Record<string, string> => {
  const names = new Set([
    ...inheritedEnvNames,
    ...command.requiredEnv,
    ...command.redactedEnv
  ])
  const env: Record<string, string> = {}
  for (const name of names) {
    const value = Bun.env[name]
    if (value !== undefined) {
      env[name] = value
    }
  }
  return env
}

const validateEnv = (command: CommandSpec): Effect.Effect<void, HostError> =>
  Effect.sync(() => {
    const missing: Array<string> = []
    for (const name of command.requiredEnv) {
      if (Bun.env[name] === undefined) {
        missing.push(name)
      }
    }
    return missing
  }).pipe(
    Effect.flatMap((missing) =>
      missing.length === 0
        ? Effect.void
        : Effect.fail(
          HostError.make({
            operation: "runCommand",
            reason: `Missing required environment variables: ${missing.join(", ")}`
          })
        )
    )
  )

export const makeBunReleaseHostLayer = (options: BunReleaseHostOptions = {}): Layer.Layer<ReleaseHost> => {
  const hostPath = (path: string): string =>
    options.root === undefined || isAbsolute(path) ? path : resolve(options.root, path)

  const commandCwd = (command: CommandSpec): string | undefined =>
    command.cwd === undefined
      ? options.root
      : hostPath(command.cwd)

  return Layer.succeed(ReleaseHost)({
    readFileString: (path) =>
      Effect.tryPromise({
        try: () => Bun.file(hostPath(path)).text(),
        catch: (cause) =>
          HostError.make({
            operation: "readFileString",
            path,
            reason: formatUnknown(cause)
          })
      }),

    writeFileString: (path, contents) =>
      Effect.tryPromise({
        try: async () => {
          const targetPath = hostPath(path)
          await mkdir(dirname(targetPath), { recursive: true })
          await Bun.write(targetPath, contents)
        },
        catch: (cause) =>
          HostError.make({
            operation: "writeFileString",
            path,
            reason: formatUnknown(cause)
          })
      }),

    stat: (path) =>
      Effect.tryPromise({
        try: async () => {
          const info = await fsStat(hostPath(path))
          return FileInfo.make({
            path,
            sizeBytes: Number(info.size),
            kind: info.isDirectory() ? "directory" : info.isFile() ? "file" : "other"
          })
        },
        catch: (cause) =>
          HostError.make({
            operation: "stat",
            path,
            reason: formatUnknown(cause)
          })
      }),

    hashFile: (path, algorithm) =>
      Effect.tryPromise({
        try: async () => {
          const targetPath = hostPath(path)
          const info = await fsStat(targetPath)
          if (!info.isFile()) {
            throw new Error("Only file artifacts can be hashed")
          }
          const buffer = await Bun.file(targetPath).arrayBuffer()
          const hash = await crypto.subtle.digest(checksumName(algorithm), buffer)
          return toHex(new Uint8Array(hash))
        },
        catch: (cause) =>
          HostError.make({
            operation: "hashFile",
            path,
            reason: formatUnknown(cause)
          })
      }),

    readEnv: (name) => Effect.sync(() => Bun.env[name]),

    runCommand: (command) =>
      Effect.gen(function*() {
        yield* validateEnv(command)
        const startedAt = new Date().toISOString()
        const started = performance.now()
        return yield* Effect.tryPromise({
          try: async () => {
            const cwd = commandCwd(command)
            const subprocess = Bun.spawn([command.executable, ...command.args], {
              ...(cwd === undefined ? {} : { cwd }),
              env: commandEnv(command),
              stdout: "pipe",
              stderr: "pipe"
            })
            const stdoutPromise = streamText(subprocess.stdout)
            const stderrPromise = streamText(subprocess.stderr)
            const exitCode = await subprocess.exited
            const stdout = await stdoutPromise
            const stderr = await stderrPromise
            const endedAt = new Date().toISOString()
            return CommandResult.make({
              command,
              exitCode,
              stdout,
              stderr,
              startedAt,
              endedAt,
              durationMillis: Math.round(performance.now() - started)
            })
          },
          catch: (cause) =>
            HostError.make({
              operation: "runCommand",
              reason: formatUnknown(cause)
            })
        })
      }),

    now: Effect.sync(() => new Date().toISOString())
  })
}

export const BunReleaseHostLayer: Layer.Layer<ReleaseHost> = makeBunReleaseHostLayer()
