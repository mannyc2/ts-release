import { createHash } from "node:crypto"
import { Buffer } from "node:buffer"
import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { dirname, isAbsolute, resolve } from "node:path"
import { Effect, Schema } from "effect"
import { canonicalJsonBytes } from "./canonical-document.js"
import type { Sha256Hex } from "./schema/primitives.js"
import type { SourceCoordinate } from "./schema/source-coordinate.js"
import {
  makeTrialProcess,
  type TrialProcessService
} from "./trial-process.js"
import { sha256Bytes } from "./trial-hash.js"
import { readStableContainedRegularFile } from "./stable-contained-file.js"

export const SOURCE_COORDINATE_GIT_TIMEOUT_MILLISECONDS = 30_000

export interface SourceCoordinateGitAuthority {
  readonly executablePath: string
  readonly executableSha256: Sha256Hex
  readonly process: TrialProcessService
}

export const makeSourceCoordinateGitAuthority = (
  executablePath: string,
  executableSha256: Sha256Hex
): SourceCoordinateGitAuthority => ({
  executablePath,
  executableSha256,
  process: makeTrialProcess({
    inheritedEnvironment: { PATH: dirname(executablePath) }
  })
})

export class SourceCoordinateCheckError extends Schema.TaggedError<SourceCoordinateCheckError>()(
  "SourceCoordinateCheckError",
  {
    coordinate: Schema.String,
    reason: Schema.String,
    message: Schema.String
  }
) {
  constructor(coordinate: string, sourceCause: unknown) {
    const reason = sourceCause instanceof Error ? sourceCause.message : String(sourceCause)
    super({ coordinate, reason, message: `${coordinate}: ${reason}` })
  }
}

const countLines = (bytes: Uint8Array): number => {
  if (bytes.length === 0) return 0
  let lines = 0
  for (const byte of bytes) if (byte === 0x0a) lines += 1
  return bytes[bytes.length - 1] === 0x0a ? lines : lines + 1
}

const readAmbientGitBlob = async (
  repositoryRoot: string,
  revision: string,
  path: string
): Promise<Uint8Array> => new Promise((resolvePromise, rejectPromise) => {
  const child = spawn(
    "git",
    ["-C", repositoryRoot, "cat-file", "blob", `${revision}:${path}`],
    { stdio: ["ignore", "pipe", "pipe"] }
  )
  const stdout: Array<Buffer> = []
  const stderr: Array<Buffer> = []
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk))
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk))
  child.once("error", rejectPromise)
  child.once("close", (exitCode) => {
    if (exitCode !== 0) {
      rejectPromise(new Error(
        `git cat-file exited ${String(exitCode)}: ${Buffer.concat(stderr).toString("utf8").trim()}`
      ))
      return
    }
    resolvePromise(new Uint8Array(Buffer.concat(stdout)))
  })
})

const verifyBoundGitExecutable = Effect.fn("SourceCoordinate.verifyBoundGitExecutable")(
  function* (authority: SourceCoordinateGitAuthority, coordinate: string) {
    if (!isAbsolute(authority.executablePath) ||
      resolve(authority.executablePath) !== authority.executablePath) {
      return yield* new SourceCoordinateCheckError(
        coordinate,
        "bound Git executable path must be canonical and absolute"
      )
    }
    const bytes = yield* Effect.tryPromise({
      try: () => readFile(authority.executablePath),
      catch: (cause) => new SourceCoordinateCheckError(coordinate, cause)
    })
    const actualSha256 = sha256Bytes(bytes)
    if (actualSha256 !== authority.executableSha256) {
      return yield* new SourceCoordinateCheckError(
        coordinate,
        `bound Git executable sha256 mismatch (expected ${authority.executableSha256}, ` +
          `received ${actualSha256})`
      )
    }
  }
)

const readBoundGitBlob = Effect.fn("SourceCoordinate.readBoundGitBlob")(
  function* (
    repositoryRoot: string,
    revision: string,
    path: string,
    coordinate: string,
    authority: SourceCoordinateGitAuthority
  ) {
    yield* verifyBoundGitExecutable(authority, coordinate)
    const result = yield* authority.process.run({
      argv: [
        authority.executablePath,
        "-C",
        repositoryRoot,
        "cat-file",
        "blob",
        `${revision}:${path}`
      ],
      cwd: repositoryRoot,
      stdin: canonicalJsonBytes({}),
      timeoutMilliseconds: SOURCE_COORDINATE_GIT_TIMEOUT_MILLISECONDS,
      closedEnvironment: {
        PATH: dirname(authority.executablePath),
        LC_ALL: "C",
        LANG: "C",
        TZ: "UTC",
        NO_COLOR: "1"
      },
      environmentProfile: "git-measurement"
    }).pipe(Effect.mapError((cause) => new SourceCoordinateCheckError(coordinate, cause)))
    if (typeof result !== "object" || result === null ||
      !Number.isSafeInteger(result.exitCode) ||
      !(result.stdout instanceof Uint8Array) ||
      !(result.stderr instanceof Uint8Array)) {
      return yield* new SourceCoordinateCheckError(
        coordinate,
        "bound Git process returned a malformed result"
      )
    }
    if (result.exitCode !== 0) {
      return yield* new SourceCoordinateCheckError(
        coordinate,
        `bound Git cat-file exited ${result.exitCode}`
      )
    }
    if (result.stderr.byteLength !== 0) {
      return yield* new SourceCoordinateCheckError(
        coordinate,
        `bound Git cat-file wrote ${result.stderr.byteLength} stderr bytes`
      )
    }
    yield* verifyBoundGitExecutable(authority, coordinate)
    return result.stdout
  }
)

const coordinateLabel = (coordinate: SourceCoordinate): string => {
  const revision = "gitRevision" in coordinate ? coordinate.gitRevision : "WORKTREE"
  return `${coordinate.repositoryId}:${revision}:${coordinate.path}`
}

export const checkSourceCoordinate = Effect.fn("SourceCoordinate.check")(
  function* (
    repositoryRoot: string,
    coordinate: SourceCoordinate,
    gitAuthority?: SourceCoordinateGitAuthority
  ) {
    const label = coordinateLabel(coordinate)
    if (coordinate.repositoryId !== "ts-release") {
      return yield* Effect.fail(new SourceCoordinateCheckError(
        label,
        `unsupported repository id ${coordinate.repositoryId}`
      ))
    }

    const bytes = "gitRevision" in coordinate && gitAuthority !== undefined
      ? yield* readBoundGitBlob(
        repositoryRoot,
        coordinate.gitRevision,
        coordinate.path,
        label,
        gitAuthority
      )
      : yield* Effect.tryPromise({
        try: async () => {
          if ("gitRevision" in coordinate) {
            return readAmbientGitBlob(repositoryRoot, coordinate.gitRevision, coordinate.path)
          }
          return readStableContainedRegularFile(repositoryRoot, coordinate.path)
        },
        catch: (cause) => new SourceCoordinateCheckError(label, cause)
      })

    const actualSha256 = createHash("sha256").update(bytes).digest("hex")
    if (actualSha256 !== coordinate.sha256) {
      return yield* Effect.fail(new SourceCoordinateCheckError(
        label,
        `sha256 mismatch (expected ${coordinate.sha256}, received ${actualSha256})`
      ))
    }

    if ("startLine" in coordinate) {
      const actualLineCount = countLines(bytes)
      if (coordinate.startLine > coordinate.endLine) {
        return yield* Effect.fail(new SourceCoordinateCheckError(
          label,
          `line range ${coordinate.startLine}-${coordinate.endLine} is reversed`
        ))
      }
      if (coordinate.endLine > actualLineCount) {
        return yield* Effect.fail(new SourceCoordinateCheckError(
          label,
          `line range ends at ${coordinate.endLine}, but the file has ${actualLineCount} lines`
        ))
      }
    }
  }
)
