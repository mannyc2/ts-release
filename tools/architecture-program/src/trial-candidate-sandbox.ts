import { Buffer } from "node:buffer"
import { constants, type Stats } from "node:fs"
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rm,
  type FileHandle
} from "node:fs/promises"
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path"
import { Context, Effect, Layer, Schema, type Scope } from "effect"
import {
  ArchitectureCandidateManifestV2,
  candidateManifestInvariantIssues
} from "./schema/candidate-manifest.js"

export const TRIAL_CANDIDATE_SANDBOX_TEMP_ROOT = "/tmp"
const sandboxPrefix = "ts-release-candidate-"
// Linux O_PATH is intentionally used by numeric ABI value because Node does not expose it.
// It pins an inode without requiring read permission, which is necessary after chmod-000 sabotage.
const LINUX_O_PATH = 0o10000000

const SandboxOperation = Schema.Literals([
  "validate",
  "scan",
  "allocate",
  "copy",
  "cleanup"
])
type SandboxOperation = typeof SandboxOperation.Type

export class TrialCandidateSandboxError extends Schema.TaggedError<TrialCandidateSandboxError>()(
  "TrialCandidateSandboxError",
  {
    operation: SandboxOperation,
    path: Schema.String,
    reason: Schema.String,
    message: Schema.String
  }
) {
  constructor(operation: SandboxOperation, path: string, reason: string) {
    super({
      operation,
      path,
      reason,
      message: `Candidate sandbox ${operation} failed for ${JSON.stringify(path)}: ${reason}.`
    })
  }
}

export interface TrialCandidateSandboxRequest {
  readonly candidateRoot: string
  readonly manifest: ArchitectureCandidateManifestV2
}

export interface IsolatedCandidateRoot {
  readonly root: string
}

export interface TrialCandidateSandboxService {
  readonly create: (
    request: TrialCandidateSandboxRequest
  ) => Effect.Effect<IsolatedCandidateRoot, TrialCandidateSandboxError, Scope.Scope>
}

export interface TrialCandidateSandboxFileSystem {
  readonly chmod: (path: string, mode: number) => Promise<void>
  readonly lstat: (path: string | Buffer) => Promise<Stats>
  readonly mkdir: (path: string, mode: number) => Promise<void>
  readonly mkdtemp: (prefix: string) => Promise<string>
  readonly open: (path: string | Buffer, flags: number, mode?: number) => Promise<FileHandle>
  readonly readdir: (path: string | Buffer) => Promise<ReadonlyArray<Buffer>>
  readonly realpath: (path: string) => Promise<string>
  readonly rm: (path: string) => Promise<void>
}

export interface MakeTrialCandidateSandboxOptions {
  readonly tempParent?: string
  readonly fileSystem?: Partial<TrialCandidateSandboxFileSystem>
}

interface ScannedFile {
  readonly relativePath: string
  readonly absolutePath: string
  readonly stat: Stats
  readonly mode: 0o644 | 0o755
}

interface SourceSnapshot {
  readonly root: string
  readonly rootRealPath: string
  readonly directories: ReadonlyMap<string, Stats>
  readonly files: ReadonlyArray<ScannedFile>
}

interface SandboxAllocation {
  readonly root: string
  readonly stat: Stats
}

const liveFileSystem: TrialCandidateSandboxFileSystem = {
  chmod: (path, mode) => chmod(path, mode),
  lstat: (path) => lstat(path),
  mkdir: async (path, mode) => {
    await mkdir(path, { mode })
  },
  mkdtemp: (prefix) => mkdtemp(prefix),
  open: (path, flags, mode) => open(path, flags, mode),
  readdir: (path) => readdir(path, { encoding: "buffer" }),
  realpath: (path) => realpath(path),
  rm: (path) => rm(path, { recursive: true, force: false })
}

const strictOptions = { errors: "all", onExcessProperty: "error" } as const
const decodeManifestStructure = Schema.decodeUnknownSync(ArchitectureCandidateManifestV2, strictOptions)

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

const decodeRawName = (bytes: Uint8Array, path: string, operation: SandboxOperation): string => {
  let name: string
  try {
    name = fatalUtf8Decoder.decode(bytes)
  } catch {
    return fail(operation, path, "filesystem name is not valid UTF-8")
  }
  if (!Buffer.from(name, "utf8").equals(Buffer.from(bytes))) {
    fail(operation, path, "filesystem name does not have one exact UTF-8 representation")
  }
  return name
}

const causeMessage = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

const fail = (operation: SandboxOperation, path: string, reason: string): never => {
  throw new TrialCandidateSandboxError(operation, path, reason)
}

const asSandboxError = (
  operation: SandboxOperation,
  path: string,
  cause: unknown
): TrialCandidateSandboxError => cause instanceof TrialCandidateSandboxError
  ? cause
  : new TrialCandidateSandboxError(operation, path, causeMessage(cause))

const isMissing = (cause: unknown): boolean =>
  cause instanceof Error && "code" in cause && cause.code === "ENOENT"

const sameNodeIdentity = (left: Stats, right: Stats): boolean =>
  left.dev === right.dev && left.ino === right.ino

const sameSnapshot = (left: Stats, right: Stats): boolean =>
  sameNodeIdentity(left, right) &&
  left.mode === right.mode &&
  left.nlink === right.nlink &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.rdev === right.rdev &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs

const canonicalFileMode = (stat: Stats): 0o644 | 0o755 =>
  (stat.mode & 0o111) === 0 ? 0o644 : 0o755

const isContainedPath = (root: string, target: string): boolean => {
  const fromRoot = relative(root, target)
  return fromRoot !== "" &&
    fromRoot !== ".." &&
    !fromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(fromRoot)
}

const assertCanonicalAbsolutePath = (
  path: unknown,
  label: string,
  operation: SandboxOperation
): string => {
  if (typeof path !== "string" || path.length === 0) {
    return fail(operation, String(path), `${label} must be a nonempty string`)
  }
  if (!path.isWellFormed()) fail(operation, path, `${label} contains an unpaired UTF-16 surrogate`)
  if (path !== path.normalize("NFC")) fail(operation, path, `${label} is not NFC-normalized`)
  if (path.includes("\u0000")) fail(operation, path, `${label} contains NUL`)
  if (!isAbsolute(path) || resolve(path) !== path || path === "/") {
    fail(operation, path, `${label} must be a canonical non-root absolute path`)
  }
  return path
}

const forbiddenSegmentReason = (segment: string): string | undefined => {
  const lower = segment.toLowerCase()
  if (lower === ".git") return ".git paths are forbidden"
  if (lower === "node_modules") return "node_modules paths are forbidden"
  if (lower === ".npmrc" || lower === ".netrc" || lower === ".pypirc") {
    return "ambient credential configuration files are forbidden"
  }
  if (lower === ".env" || lower.startsWith(".env.")) {
    return "ambient environment files are forbidden"
  }
  return undefined
}

const assertCanonicalRelativePath = (
  path: string,
  operation: SandboxOperation = "validate"
): void => {
  if (path.length === 0 || !path.isWellFormed() || path !== path.normalize("NFC")) {
    fail(operation, path, "path must be nonempty, well-formed, and NFC-normalized")
  }
  if (path.startsWith("/") || path.includes("\\") ||
    !/^[A-Za-z0-9._@/+~-]+$/u.test(path)) {
    fail(operation, path, "path must be a portable relative POSIX path")
  }
  const segments = path.split("/")
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    fail(operation, path, "path contains an empty, dot, or parent segment")
  }
  for (const segment of segments) {
    const reason = forbiddenSegmentReason(segment)
    if (reason !== undefined) fail(operation, path, reason)
  }
}

const assertDirectorySnapshot = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  path: string,
  expected: Stats,
  operation: SandboxOperation
): Promise<void> => {
  const observed = await fileSystem.lstat(path)
  if (observed.isSymbolicLink() || !observed.isDirectory() || !sameSnapshot(expected, observed)) {
    fail(operation, path, "source directory changed or became a symbolic link")
  }
}

const assertSourceAncestors = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  snapshot: SourceSnapshot,
  file: ScannedFile,
  operation: SandboxOperation
): Promise<void> => {
  let current = dirname(file.absolutePath)
  while (current === snapshot.root || isContainedPath(snapshot.root, current)) {
    const expected = snapshot.directories.get(current) ??
      fail(operation, current, "source directory was not in the initial snapshot")
    await assertDirectorySnapshot(fileSystem, current, expected, operation)
    if (current === snapshot.root) break
    current = dirname(current)
  }
}

const assertAllSourceDirectories = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  snapshot: SourceSnapshot,
  operation: SandboxOperation
): Promise<void> => {
  for (const [path, stat] of snapshot.directories) {
    await assertDirectorySnapshot(fileSystem, path, stat, operation)
  }
  if (await fileSystem.realpath(snapshot.root) !== snapshot.rootRealPath) {
    fail(operation, snapshot.root, "source root real path changed")
  }
}

const scanSource = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  candidateRoot: string
): Promise<SourceSnapshot> => {
  const rootRealPath = await fileSystem.realpath(candidateRoot)
  if (rootRealPath !== candidateRoot) {
    fail("scan", candidateRoot, "source root or one of its path components is a symbolic link")
  }
  const directories = new Map<string, Stats>()
  const files: Array<ScannedFile> = []

  const visit = async (absolutePath: string, relativePath: string): Promise<void> => {
    if (relativePath !== "") assertCanonicalRelativePath(relativePath, "scan")
    const first = await fileSystem.lstat(absolutePath)
    if (first.isSymbolicLink()) fail("scan", relativePath || candidateRoot, "symbolic links are forbidden")
    if (first.isDirectory()) {
      directories.set(absolutePath, first)
      const names = [...await fileSystem.readdir(absolutePath)]
        .map((name) => decodeRawName(name, relativePath || candidateRoot, "scan"))
        .sort(codePointCompare)
      for (const name of names) {
        const childRelativePath = relativePath === "" ? name : `${relativePath}/${name}`
        await visit(join(absolutePath, name), childRelativePath)
      }
      await assertDirectorySnapshot(fileSystem, absolutePath, first, "scan")
      return
    }
    if (!first.isFile()) {
      fail("scan", relativePath, "only directories and regular files are permitted")
    }
    if (first.nlink !== 1) {
      fail("scan", relativePath, "hard-linked source files are forbidden")
    }
    files.push({
      relativePath,
      absolutePath,
      stat: first,
      mode: canonicalFileMode(first)
    })
  }

  await visit(candidateRoot, "")
  files.sort((left, right) => codePointCompare(left.relativePath, right.relativePath))
  const snapshot = { root: candidateRoot, rootRealPath, directories, files }
  await assertAllSourceDirectories(fileSystem, snapshot, "scan")
  return snapshot
}

const validateManifest = (input: unknown): ArchitectureCandidateManifestV2 => {
  let manifest: ArchitectureCandidateManifestV2
  try {
    manifest = decodeManifestStructure(input)
  } catch (cause) {
    return fail("validate", "manifest", causeMessage(cause))
  }
  const issues = candidateManifestInvariantIssues(manifest)
  if (issues.length > 0) fail("validate", "manifest", issues.join("; "))
  for (const file of manifest.files) assertCanonicalRelativePath(file.path)
  return manifest
}

const assertExactManifestFiles = (
  snapshot: SourceSnapshot,
  manifest: ArchitectureCandidateManifestV2
): void => {
  const sourcePaths = snapshot.files.map(({ relativePath }) => relativePath)
  const manifestPaths = manifest.files.map(({ path }) => path)
  if (sourcePaths.length !== manifestPaths.length ||
    sourcePaths.some((path, index) => path !== manifestPaths[index])) {
    fail(
      "scan",
      snapshot.root,
      `source files [${sourcePaths.join(", ")}] do not exactly equal manifest files ` +
        `[${manifestPaths.join(", ")}]`
    )
  }
}

const validateTempParent = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  input: string
): Promise<string> => {
  const tempParent = assertCanonicalAbsolutePath(input, "tempParent", "validate")
  const fromTempRoot = relative(TRIAL_CANDIDATE_SANDBOX_TEMP_ROOT, tempParent)
  if (fromTempRoot === ".." || fromTempRoot.startsWith(`..${sep}`) || isAbsolute(fromTempRoot)) {
    fail("validate", tempParent, `tempParent must be within ${TRIAL_CANDIDATE_SANDBOX_TEMP_ROOT}`)
  }
  const real = await fileSystem.realpath(tempParent)
  if (real !== tempParent) {
    fail("validate", tempParent, "tempParent or one of its path components is a symbolic link")
  }
  const stat = await fileSystem.lstat(tempParent)
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail("validate", tempParent, "tempParent must be a real directory")
  }
  return tempParent
}

const allocateSandbox = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  tempParent: string
): Promise<SandboxAllocation> => {
  let root: string | undefined
  let rootIsContained = false
  try {
    root = await fileSystem.mkdtemp(join(tempParent, sandboxPrefix))
    if (dirname(root) !== tempParent || !basename(root).startsWith(sandboxPrefix)) {
      fail("allocate", root, "mkdtemp returned a path outside the approved temp parent")
    }
    rootIsContained = true
    await fileSystem.chmod(root, 0o700)
    const stat = await fileSystem.lstat(root)
    if (stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o7777) !== 0o700) {
      fail("allocate", root, "fresh sandbox root is not a canonical 0700 directory")
    }
    return { root, stat }
  } catch (cause) {
    if (root !== undefined && rootIsContained) {
      try {
        await fileSystem.rm(root)
      } catch {
        // Preserve the authoritative allocation error.
      }
    }
    throw asSandboxError("allocate", root ?? tempParent, cause)
  }
}

const cleanupSandbox = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  allocation: SandboxAllocation
): Promise<void> => {
  let observed: Stats
  try {
    observed = await fileSystem.lstat(allocation.root)
  } catch (cause) {
    if (isMissing(cause)) return
    throw asSandboxError("cleanup", allocation.root, cause)
  }
  if (observed.isSymbolicLink() || !observed.isDirectory() ||
    !sameNodeIdentity(allocation.stat, observed)) {
    fail("cleanup", allocation.root, "refusing to remove a replaced sandbox root")
  }

  const restoreOwnerDirectoryModes = async (
    path: string | Buffer,
    displayPath: string,
    expectedRoot?: Stats
  ): Promise<void> => {
    const before = await fileSystem.lstat(path)
    if (before.isSymbolicLink() || !before.isDirectory()) return
    if (expectedRoot !== undefined && !sameNodeIdentity(expectedRoot, before)) {
      fail("cleanup", displayPath, "refusing to traverse a replaced sandbox root")
    }
    if (typeof constants.O_NOFOLLOW !== "number" || typeof constants.O_DIRECTORY !== "number") {
      fail("cleanup", displayPath, "O_NOFOLLOW and O_DIRECTORY are required for cleanup")
    }
    let handle: FileHandle | undefined
    try {
      handle = await fileSystem.open(
        path,
        LINUX_O_PATH | constants.O_DIRECTORY | constants.O_NOFOLLOW
      )
      const opened = await handle.stat()
      if (!opened.isDirectory() || !sameNodeIdentity(before, opened)) {
        fail("cleanup", displayPath, "opened cleanup directory differs from the observed path")
      }
      // chmod through the pinned descriptor's procfs link, never through the attacker-chosen path.
      await fileSystem.chmod(`/proc/self/fd/${handle.fd}`, 0o700)
      const restoredHandle = await handle.stat()
      if (!restoredHandle.isDirectory() || !sameNodeIdentity(opened, restoredHandle) ||
        (restoredHandle.mode & 0o7777) !== 0o700) {
        fail("cleanup", displayPath, "directory changed while cleanup permissions were restored")
      }
    } finally {
      await handle?.close()
    }
    const restored = await fileSystem.lstat(path)
    if (restored.isSymbolicLink() || !restored.isDirectory() || !sameNodeIdentity(before, restored)) {
      fail("cleanup", displayPath, "cleanup directory path changed after no-follow restoration")
    }
    // Bun currently types `encoding: "buffer"` as Buffer[] but may return plain
    // Uint8Array instances. Normalize at the filesystem boundary before using
    // Buffer-only comparison and equality methods.
    const names = [...await fileSystem.readdir(path)]
      .map((name) => Buffer.from(name))
      .sort(Buffer.compare)
    const rawParent = Buffer.from(path)
    for (const name of names) {
      if (name.length === 0 || name.includes(0) || name.includes(0x2f) ||
        name.equals(Buffer.from(".")) || name.equals(Buffer.from(".."))) {
        fail("cleanup", displayPath, "directory returned an invalid raw entry name")
      }
      const child = Buffer.concat([rawParent, Buffer.from("/"), name])
      const childDisplay = `${displayPath}/<raw:${name.toString("hex")}>`
      const rawRootPrefix = Buffer.from(`${allocation.root}/`)
      if (child.length <= rawRootPrefix.length ||
        !child.subarray(0, rawRootPrefix.length).equals(rawRootPrefix)) {
        fail("cleanup", childDisplay, "raw directory entry escapes the validated sandbox root")
      }
      const childStat = await fileSystem.lstat(child)
      if (childStat.isSymbolicLink() || !childStat.isDirectory()) continue
      await restoreOwnerDirectoryModes(child, childDisplay)
    }
    const after = await fileSystem.lstat(path)
    if (after.isSymbolicLink() || !after.isDirectory() || !sameNodeIdentity(restored, after)) {
      fail("cleanup", displayPath, "directory changed after cleanup traversal")
    }
  }

  try {
    await restoreOwnerDirectoryModes(allocation.root, allocation.root, allocation.stat)
    await fileSystem.rm(allocation.root)
  } catch (cause) {
    throw asSandboxError("cleanup", allocation.root, cause)
  }
}

const readStableSourceFile = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  snapshot: SourceSnapshot,
  file: ScannedFile
): Promise<Uint8Array> => {
  await assertSourceAncestors(fileSystem, snapshot, file, "copy")
  const pathStat = await fileSystem.lstat(file.absolutePath)
  if (pathStat.isSymbolicLink() || !pathStat.isFile() || !sameSnapshot(file.stat, pathStat)) {
    fail("copy", file.relativePath, "source file changed after the initial snapshot")
  }

  const noFollow = constants.O_NOFOLLOW
  if (typeof noFollow !== "number") fail("copy", file.relativePath, "O_NOFOLLOW is unavailable")
  let handle: FileHandle | undefined
  let bytes: Uint8Array
  try {
    handle = await fileSystem.open(file.absolutePath, constants.O_RDONLY | noFollow)
    const before = await handle.stat()
    if (!before.isFile() || !sameSnapshot(file.stat, before)) {
      fail("copy", file.relativePath, "opened source is not the snapshotted regular file")
    }
    bytes = new Uint8Array(await handle.readFile())
    const after = await handle.stat()
    if (!after.isFile() || !sameSnapshot(before, after) || after.size !== bytes.byteLength) {
      fail("copy", file.relativePath, "source file changed while it was read")
    }
  } finally {
    await handle?.close()
  }

  const finalStat = await fileSystem.lstat(file.absolutePath)
  if (finalStat.isSymbolicLink() || !finalStat.isFile() || !sameSnapshot(file.stat, finalStat)) {
    fail("copy", file.relativePath, "source path was replaced while it was read")
  }
  await assertSourceAncestors(fileSystem, snapshot, file, "copy")
  return bytes
}

const assertDestinationDirectory = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  path: string,
  expected: Stats
): Promise<void> => {
  const observed = await fileSystem.lstat(path)
  if (observed.isSymbolicLink() || !observed.isDirectory() ||
    !sameNodeIdentity(expected, observed) || (observed.mode & 0o7777) !== 0o700) {
    fail("copy", path, "destination directory changed, escaped, or has a noncanonical mode")
  }
}

const ensureDestinationParent = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  allocation: SandboxAllocation,
  relativePath: string,
  directories: Map<string, Stats>
): Promise<string> => {
  const segments = relativePath.split("/")
  segments.pop()
  let current = allocation.root
  let relativeDirectory = ""
  for (const segment of segments) {
    const currentStat = directories.get(current) ??
      fail("copy", current, "destination parent was not created by this sandbox")
    await assertDestinationDirectory(fileSystem, current, currentStat)
    relativeDirectory = relativeDirectory === "" ? segment : `${relativeDirectory}/${segment}`
    const next = resolve(allocation.root, relativeDirectory)
    if (!isContainedPath(allocation.root, next)) fail("copy", relativePath, "destination parent escapes sandbox root")
    const known = directories.get(next)
    if (known !== undefined) {
      await assertDestinationDirectory(fileSystem, next, known)
      current = next
      continue
    }
    await fileSystem.mkdir(next, 0o700)
    await fileSystem.chmod(next, 0o700)
    const created = await fileSystem.lstat(next)
    if (created.isSymbolicLink() || !created.isDirectory() || (created.mode & 0o7777) !== 0o700) {
      fail("copy", next, "created destination parent is not a canonical 0700 directory")
    }
    directories.set(next, created)
    current = next
  }
  return current
}

const writeDestinationFile = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  allocation: SandboxAllocation,
  file: ScannedFile,
  bytes: Uint8Array,
  directories: Map<string, Stats>
): Promise<void> => {
  const parent = await ensureDestinationParent(fileSystem, allocation, file.relativePath, directories)
  const parentStat = directories.get(parent) ??
    fail("copy", parent, "destination parent identity is unavailable")
  await assertDestinationDirectory(fileSystem, parent, parentStat)

  const target = resolve(allocation.root, file.relativePath)
  if (!isContainedPath(allocation.root, target) || dirname(target) !== parent) {
    fail("copy", file.relativePath, "destination file escapes sandbox root")
  }
  const noFollow = constants.O_NOFOLLOW
  if (typeof noFollow !== "number") fail("copy", file.relativePath, "O_NOFOLLOW is unavailable")
  let handle: FileHandle | undefined
  try {
    handle = await fileSystem.open(
      target,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow,
      file.mode
    )
    await handle.writeFile(bytes)
    await handle.chmod(file.mode)
    const written = await handle.stat()
    if (!written.isFile() || written.size !== bytes.byteLength ||
      (written.mode & 0o7777) !== file.mode) {
      fail("copy", file.relativePath, "destination file has the wrong type, size, or canonical mode")
    }
  } finally {
    await handle?.close()
  }
  const finalStat = await fileSystem.lstat(target)
  if (finalStat.isSymbolicLink() || !finalStat.isFile() ||
    finalStat.size !== bytes.byteLength || (finalStat.mode & 0o7777) !== file.mode) {
    fail("copy", file.relativePath, "destination path changed after it was written")
  }
  await assertDestinationDirectory(fileSystem, parent, parentStat)
}

const copySnapshot = async (
  fileSystem: TrialCandidateSandboxFileSystem,
  snapshot: SourceSnapshot,
  allocation: SandboxAllocation
): Promise<void> => {
  const destinationDirectories = new Map<string, Stats>([[allocation.root, allocation.stat]])
  for (const file of snapshot.files) {
    const bytes = await readStableSourceFile(fileSystem, snapshot, file)
    await writeDestinationFile(fileSystem, allocation, file, bytes, destinationDirectories)
  }
  await assertAllSourceDirectories(fileSystem, snapshot, "copy")
  await assertDestinationDirectory(fileSystem, allocation.root, allocation.stat)
}

export const makeTrialCandidateSandbox = (
  options: MakeTrialCandidateSandboxOptions = {}
): TrialCandidateSandboxService => {
  const tempParentInput = options.tempParent ?? TRIAL_CANDIDATE_SANDBOX_TEMP_ROOT
  const fileSystem: TrialCandidateSandboxFileSystem = {
    ...liveFileSystem,
    ...options.fileSystem
  }

  const create = Effect.fn("TrialCandidateSandbox.create")(function* (
    request: TrialCandidateSandboxRequest
  ) {
    const prepared = yield* Effect.tryPromise({
      try: async () => {
        if (typeof request !== "object" || request === null) {
          return fail("validate", "request", "request must be an object")
        }
        const candidateRoot = assertCanonicalAbsolutePath(
          request.candidateRoot,
          "candidateRoot",
          "validate"
        )
        const manifest = validateManifest(request.manifest)
        const tempParent = await validateTempParent(fileSystem, tempParentInput)
        if (tempParent === candidateRoot || isContainedPath(candidateRoot, tempParent)) {
          fail("validate", tempParent, "tempParent must not be the candidate root or inside it")
        }
        const snapshot = await scanSource(fileSystem, candidateRoot)
        assertExactManifestFiles(snapshot, manifest)
        return { snapshot, tempParent }
      },
      catch: (cause) => asSandboxError("validate", request?.candidateRoot ?? "request", cause)
    })

    const allocation = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => allocateSandbox(fileSystem, prepared.tempParent),
        catch: (cause) => asSandboxError("allocate", prepared.tempParent, cause)
      }),
      (allocated) => Effect.tryPromise({
        try: () => cleanupSandbox(fileSystem, allocated),
        catch: (cause) => asSandboxError("cleanup", allocated.root, cause)
      }).pipe(Effect.orDie)
    )

    yield* Effect.tryPromise({
      try: () => copySnapshot(fileSystem, prepared.snapshot, allocation),
      catch: (cause) => asSandboxError("copy", allocation.root, cause)
    })
    return { root: allocation.root }
  })
  return { create }
}

export class TrialCandidateSandbox extends Context.Service<
  TrialCandidateSandbox,
  TrialCandidateSandboxService
>()("@ts-release/architecture-program/TrialCandidateSandbox") {
  static readonly layer = Layer.sync(TrialCandidateSandbox, () => makeTrialCandidateSandbox())
}

export const makeTrialCandidateSandboxLayer = (options: MakeTrialCandidateSandboxOptions = {}) =>
  Layer.sync(TrialCandidateSandbox, () => makeTrialCandidateSandbox(options))

export const TrialCandidateSandboxLive = TrialCandidateSandbox.layer
