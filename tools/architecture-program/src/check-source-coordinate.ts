import { createHash } from "node:crypto"
import { Buffer } from "node:buffer"
import { spawn } from "node:child_process"
import { readFile, realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"
import { Effect, Schema } from "effect"
import type { SourceCoordinate } from "./schema/source-coordinate.js"

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

const contained = (root: string, target: string): boolean => {
  const pathFromRoot = relative(root, target)
  return pathFromRoot === "" ||
    (pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
      !isAbsolute(pathFromRoot))
}

const countLines = (bytes: Uint8Array): number => {
  if (bytes.length === 0) return 0
  let lines = 0
  for (const byte of bytes) if (byte === 0x0a) lines += 1
  return bytes[bytes.length - 1] === 0x0a ? lines : lines + 1
}

const readGitBlob = async (
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

const coordinateLabel = (coordinate: SourceCoordinate): string => {
  const revision = "gitRevision" in coordinate ? coordinate.gitRevision : "WORKTREE"
  return `${coordinate.repositoryId}:${revision}:${coordinate.path}`
}

export const checkSourceCoordinate = Effect.fn("SourceCoordinate.check")(
  function* (repositoryRoot: string, coordinate: SourceCoordinate) {
    const label = coordinateLabel(coordinate)
    if (coordinate.repositoryId !== "ts-release") {
      return yield* Effect.fail(new SourceCoordinateCheckError(
        label,
        `unsupported repository id ${coordinate.repositoryId}`
      ))
    }

    const bytes = yield* Effect.tryPromise({
      try: async () => {
        if ("gitRevision" in coordinate) {
          return readGitBlob(repositoryRoot, coordinate.gitRevision, coordinate.path)
        }
        const realRoot = await realpath(repositoryRoot)
        const realSourcePath = await realpath(resolve(repositoryRoot, coordinate.path))
        if (!contained(realRoot, realSourcePath)) {
          throw new Error("resolved path escapes the repository root")
        }
        const metadata = await stat(realSourcePath)
        if (!metadata.isFile()) throw new Error("resolved path is not a regular file")
        return readFile(realSourcePath)
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
