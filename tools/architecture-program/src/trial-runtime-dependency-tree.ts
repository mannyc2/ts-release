import { constants, type Stats } from "node:fs"
import { Buffer } from "node:buffer"
import {
  lstat,
  open,
  readlink,
  readdir,
  realpath,
  type FileHandle
} from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { Effect, Schema } from "effect"
import { Sha256Hex } from "./schema/primitives.js"
import { hashCanonicalValue, sha256Bytes } from "./trial-hash.js"

export const RUNTIME_DEPENDENCY_TREE_HASH_DOMAIN =
  "ts-release/architecture-runtime-dependency-tree/v2"

const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const GitFileMode = Schema.Literals(["100644", "100755"])

export class RuntimeDependencyRegularFile extends Schema.TaggedClass<
  RuntimeDependencyRegularFile
>()("RegularFile", {
  path: Schema.String,
  mode: GitFileMode,
  byteLength: NonNegativeInt,
  bytesSha256: Sha256Hex
}) {}

export class RuntimeDependencySymbolicLink extends Schema.TaggedClass<
  RuntimeDependencySymbolicLink
>()("SymbolicLink", {
  path: Schema.String,
  target: Schema.String
}) {}

export const RuntimeDependencyTreeEntry = Schema.Union([
  RuntimeDependencyRegularFile,
  RuntimeDependencySymbolicLink
])
export type RuntimeDependencyTreeEntry = typeof RuntimeDependencyTreeEntry.Type

export interface RuntimeDependencyRootSnapshot {
  readonly root: string
  readonly realPath: string
  readonly stat: Stats
}

export class RuntimeDependencyTreeInventory extends Schema.Class<
  RuntimeDependencyTreeInventory
>("RuntimeDependencyTreeInventory")({
  entries: Schema.Array(RuntimeDependencyTreeEntry),
  treeSha256: Sha256Hex
}) {}

export interface ObservedRuntimeDependencyTree {
  readonly root: RuntimeDependencyRootSnapshot
  readonly inventory: RuntimeDependencyTreeInventory
}

export class RuntimeDependencyTreeError extends Schema.TaggedError<
  RuntimeDependencyTreeError
>()("RuntimeDependencyTreeError", {
  operation: Schema.String,
  path: Schema.String,
  reason: Schema.String,
  message: Schema.String
}) {
  constructor(operation: string, path: string, reason: string) {
    super({
      operation,
      path,
      reason,
      message: `Runtime dependency tree ${operation} failed for ${JSON.stringify(path)}: ${reason}.`
    })
  }
}

const codePointCompare = (left: string, right: string): number => {
  const leftPoints = [...left]
  const rightPoints = [...right]
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]!.codePointAt(0)! - rightPoints[index]!.codePointAt(0)!
    if (difference !== 0) return difference
  }
  return leftPoints.length - rightPoints.length
}

const fatalUtf8Decoder = new TextDecoder("utf-8", { fatal: true })

const decodeRawName = (bytes: Uint8Array, displayPath: string): string => {
  let value: string
  try {
    value = fatalUtf8Decoder.decode(bytes)
  } catch {
    return fail("scan", displayPath, "filesystem name or symbolic-link target is not valid UTF-8")
  }
  if (!Buffer.from(value, "utf8").equals(Buffer.from(bytes))) {
    fail("scan", displayPath, "filesystem text does not have one exact UTF-8 representation")
  }
  return value
}

const causeMessage = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

const fail = (operation: string, path: string, reason: string): never => {
  throw new RuntimeDependencyTreeError(operation, path, reason)
}

const sameSnapshot = (left: Stats, right: Stats): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.mode === right.mode &&
  left.nlink === right.nlink &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.rdev === right.rdev &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs

export const sameRuntimeDependencyRootSnapshot = (
  left: RuntimeDependencyRootSnapshot,
  right: RuntimeDependencyRootSnapshot
): boolean => left.root === right.root &&
  left.realPath === right.realPath &&
  sameSnapshot(left.stat, right.stat)

const isWithinOrEqual = (root: string, target: string): boolean => {
  const fromRoot = relative(root, target)
  return fromRoot === "" || (
    fromRoot !== ".." &&
    !fromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(fromRoot)
  )
}

const assertCanonicalRoot = (input: string): string => {
  if (typeof input !== "string" || input.length === 0 || !input.isWellFormed() ||
    input !== input.normalize("NFC") || input.includes("\u0000") ||
    !isAbsolute(input) || resolve(input) !== input || input === "/") {
    return fail("validate", String(input), "root must be a canonical non-root absolute NFC path")
  }
  return input
}

const assertCanonicalEntryPath = (path: string): void => {
  if (path.length === 0 || !path.isWellFormed() || path !== path.normalize("NFC") ||
    path.includes("\u0000") || path.startsWith("/") || path.includes("\\")) {
    fail("scan", path, "entry path must be a nonempty NFC slash-relative path")
  }
  const segments = path.split("/")
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    fail("scan", path, "entry path contains an empty, dot, or dot-dot segment")
  }
}

const assertContainedSymlinkTarget = (
  root: string,
  linkPath: string,
  displayPath: string,
  target: string
): void => {
  if (target.length === 0 || !target.isWellFormed() || target !== target.normalize("NFC") ||
    target.includes("\u0000")) {
    fail("scan", displayPath, "symbolic-link target must be nonempty, well-formed, and NFC")
  }
  if (isAbsolute(target)) fail("scan", displayPath, "absolute symbolic-link targets are forbidden")
  const resolvedTarget = resolve(dirname(linkPath), target)
  if (!isWithinOrEqual(root, resolvedTarget)) {
    fail("scan", displayPath, "symbolic-link target escapes the dependency root")
  }
}

const regularFileMode = (stat: Stats): "100644" | "100755" =>
  (stat.mode & 0o111) === 0 ? "100644" : "100755"

const readStableRegularFile = async (
  path: string,
  displayPath: string,
  expected: Stats
): Promise<Uint8Array> => {
  if (typeof constants.O_NOFOLLOW !== "number") {
    fail("scan", displayPath, "O_NOFOLLOW is required")
  }
  let handle: FileHandle | undefined
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const opened = await handle.stat()
    if (!opened.isFile() || !sameSnapshot(expected, opened)) {
      fail("scan", displayPath, "opened file differs from the lstat snapshot")
    }
    const bytes = new Uint8Array(await handle.readFile())
    const after = await handle.stat()
    if (!after.isFile() || !sameSnapshot(opened, after) || after.size !== bytes.byteLength) {
      fail("scan", displayPath, "regular file changed while its bytes were read")
    }
    return bytes
  } finally {
    await handle?.close()
  }
}

const entryHashValue = (entry: RuntimeDependencyTreeEntry) => entry._tag === "RegularFile"
  ? {
    _tag: entry._tag,
    path: entry.path,
    mode: entry.mode,
    byteLength: entry.byteLength,
    bytesSha256: entry.bytesSha256
  }
  : { _tag: entry._tag, path: entry.path, target: entry.target }

export const runtimeDependencyTreeSha256 = (
  entries: ReadonlyArray<RuntimeDependencyTreeEntry>
) => hashCanonicalValue(RUNTIME_DEPENDENCY_TREE_HASH_DOMAIN, entries.map(entryHashValue))

const inventoryPromise = async (inputRoot: string): Promise<ObservedRuntimeDependencyTree> => {
  const root = assertCanonicalRoot(inputRoot)
  const rootRealPath = await realpath(root)
  if (rootRealPath !== root) {
    fail("validate", root, "root or one of its path components is a symbolic link")
  }
  const rootStat = await lstat(root)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    fail("validate", root, "root must be a real directory")
  }
  const entries: Array<RuntimeDependencyTreeEntry> = []

  const visit = async (absolutePath: string, segments: ReadonlyArray<string>): Promise<void> => {
    const displayPath = segments.join("/")
    if (displayPath !== "") assertCanonicalEntryPath(displayPath)
    const first = await lstat(absolutePath)
    if (first.isSymbolicLink()) {
      const rawTarget = await readlink(absolutePath, { encoding: "buffer" })
      const target = decodeRawName(rawTarget, displayPath)
      const second = await lstat(absolutePath)
      if (!second.isSymbolicLink() || !sameSnapshot(first, second)) {
        fail("scan", displayPath, "symbolic link changed while its target was read")
      }
      assertContainedSymlinkTarget(root, absolutePath, displayPath, target)
      entries.push(new RuntimeDependencySymbolicLink({ path: displayPath, target }))
      return
    }
    if (first.isDirectory()) {
      const names = [...await readdir(absolutePath, { encoding: "buffer" })]
        .map((rawName) => decodeRawName(rawName, displayPath || root))
        .sort(codePointCompare)
      if (segments.length > 0 && names.length === 0) {
        fail("scan", displayPath, "empty directories are forbidden because they are not hash entries")
      }
      for (const name of names) await visit(join(absolutePath, name), [...segments, name])
      const second = await lstat(absolutePath)
      if (!second.isDirectory() || second.isSymbolicLink() || !sameSnapshot(first, second)) {
        fail("scan", displayPath || root, "directory changed while it was traversed")
      }
      return
    }
    if (!first.isFile()) {
      fail("scan", displayPath, "only regular files, symbolic links, and directories are permitted")
    }
    const bytes = await readStableRegularFile(absolutePath, displayPath, first)
    const finalStat = await lstat(absolutePath)
    if (!finalStat.isFile() || finalStat.isSymbolicLink() || !sameSnapshot(first, finalStat)) {
      fail("scan", displayPath, "regular-file path changed while it was observed")
    }
    entries.push(new RuntimeDependencyRegularFile({
      path: displayPath,
      mode: regularFileMode(first),
      byteLength: bytes.byteLength,
      bytesSha256: sha256Bytes(bytes)
    }))
  }

  await visit(root, [])
  entries.sort((left, right) => codePointCompare(left.path, right.path))
  const finalRootRealPath = await realpath(root)
  const finalRootStat = await lstat(root)
  if (finalRootRealPath !== rootRealPath || finalRootStat.isSymbolicLink() ||
    !finalRootStat.isDirectory() || !sameSnapshot(rootStat, finalRootStat)) {
    fail("scan", root, "dependency root changed while it was inventoried")
  }
  return {
    root: { root, realPath: rootRealPath, stat: rootStat },
    inventory: new RuntimeDependencyTreeInventory({
      entries,
      treeSha256: runtimeDependencyTreeSha256(entries)
    })
  }
}

export const inventoryRuntimeDependencyTree = Effect.fn(
  "trialRuntimeDependencyTree.inventory"
)(function* (root: string) {
  return yield* Effect.tryPromise({
    try: () => inventoryPromise(root),
    catch: (cause) => cause instanceof RuntimeDependencyTreeError
      ? cause
      : new RuntimeDependencyTreeError("scan", root, causeMessage(cause))
  })
})
