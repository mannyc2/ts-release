import { constants, type Stats } from "node:fs"
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readlink,
  readdir,
  realpath,
  rm,
  symlink,
  type FileHandle
} from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { Context, Effect, Layer, Result, Schema } from "effect"
import { Sha256Hex, type Sha256Hex as Sha256HexType } from "./schema/primitives.js"
import {
  CompleteProcessStreamEvidence,
  ExitedProcessAttempt,
  IoFailedProcessAttempt,
  NotStartedProcessAttempt,
  OutputLimitedProcessAttempt,
  PrefixProcessStreamEvidence,
  ProcessAttemptEvidence,
  SignaledProcessAttempt,
  TimedOutProcessAttempt,
  type ProcessAttemptEvidence as ProcessAttemptEvidenceType,
  type ProcessStreamEvidence
} from "./schema/trial-result.js"
import { sha256Bytes } from "./trial-hash.js"
import {
  RuntimeDependencyTreeError,
  inventoryRuntimeDependencyTree,
  sameRuntimeDependencyRootSnapshot,
  type ObservedRuntimeDependencyTree,
  type RuntimeDependencyTreeEntry
} from "./trial-runtime-dependency-tree.js"
import {
  TrialProcessIoError,
  TrialProcessOutputLimitError,
  TrialProcessSignalError,
  TrialProcessTimeoutError,
  makeTrialProcess,
  type TrialProcessError,
  type TrialProcessResult,
  type TrialProcessService
} from "./trial-process.js"

export const TRIAL_BUBBLEWRAP_EXECUTABLE = "/usr/bin/bwrap"
export const TRIAL_SANDBOX_BUN_EXECUTABLE = "/runtime/bun"
export const TRIAL_SANDBOX_CANDIDATE_ROOT = "/candidate"
export const TRIAL_SANDBOX_NODE_MODULES = "/candidate/node_modules"
export const TRIAL_ISOLATION_FAILURE_EXIT_CODE = 125
export const TRIAL_ISOLATION_FAILURE_PREFIX = "ts-release-isolation-failure:"

const isolationSnapshotPrefix = "ts-release-isolation-snapshot-"
const LINUX_O_PATH = 0o10000000
const fixedOuterEnvironment = {
  PATH: "/usr/bin:/bin",
  LC_ALL: "C",
  LANG: "C",
  TZ: "UTC",
  NO_COLOR: "1"
} as const
const fixedSandboxEnvironment = {
  PATH: "/runtime:/usr/bin",
  LC_ALL: "C",
  LANG: "C",
  TZ: "UTC",
  NO_COLOR: "1",
  TMPDIR: "/tmp"
} as const

const AdapterMode = Schema.Literals(["case", "probe", "gate"])
export type TrialAdapterMode = typeof AdapterMode.Type

export class TrialIsolationInvalidRequestError extends Schema.TaggedError<TrialIsolationInvalidRequestError>()(
  "TrialIsolationInvalidRequestError",
  { reason: Schema.String, message: Schema.String }
) {
  constructor(reason: string) {
    super({ reason, message: `Invalid isolated trial process request: ${reason}.` })
  }
}

export class TrialIsolationUnavailableError extends Schema.TaggedError<TrialIsolationUnavailableError>()(
  "TrialIsolationUnavailableError",
  { reason: Schema.String, message: Schema.String }
) {
  constructor(reason: string) {
    super({ reason, message: `Architecture trial isolation is unavailable: ${reason}.` })
  }
}

export class TrialIsolationEstablishmentError extends Schema.TaggedError<TrialIsolationEstablishmentError>()(
  "TrialIsolationEstablishmentError",
  {
    reason: Schema.String,
    processAttempt: ExitedProcessAttempt,
    message: Schema.String
  }
) {
  constructor(reason: string, processAttempt: ExitedProcessAttempt) {
    super({
      reason,
      processAttempt,
      message: `Architecture trial isolation could not be established: ${reason}.`
    })
  }
}

/** A child attempt completed or was interrupted, then runner-owned isolation verification failed. */
export class TrialIsolationPostcheckError extends Schema.TaggedError<TrialIsolationPostcheckError>()(
  "TrialIsolationPostcheckError",
  {
    reason: Schema.String,
    processAttempt: ProcessAttemptEvidence,
    message: Schema.String
  }
) {
  constructor(reason: string, processAttempt: ProcessAttemptEvidenceType) {
    super({
      reason,
      processAttempt,
      message: `Architecture trial post-execution isolation verification failed: ${reason}.`
    })
  }
}

export type TrialIsolatedProcessError =
  | TrialIsolationEstablishmentError
  | TrialIsolationInvalidRequestError
  | TrialIsolationPostcheckError
  | TrialIsolationUnavailableError
  | TrialProcessIoError
  | TrialProcessOutputLimitError
  | TrialProcessSignalError
  | TrialProcessTimeoutError

export interface TrialIsolatedProcessRequest {
  readonly candidateRoot: string
  readonly adapterArgv: readonly [string, ...Array<string>]
  readonly stdin: Uint8Array
  readonly timeoutMilliseconds: number
  readonly expectedToolchain: TrialIsolationExpectedToolchain
}

export interface TrialIsolationExpectedToolchain {
  readonly bunVersion: string
  readonly bunExecutableSha256: Sha256HexType
  readonly bubblewrapVersion: string
  readonly bubblewrapExecutableSha256: Sha256HexType
  readonly runnerNodeModulesSha256: Sha256HexType
}

export interface TrialIsolationPreparedAuthority {
  readonly bubblewrapExecutable: string
  readonly bunExecutable: string
  readonly runnerNodeModules: string
  readonly repositoryRoot: string
  readonly expectedToolchain: TrialIsolationExpectedToolchain
}

export interface TrialIsolatedProcessService {
  readonly run: (
    request: TrialIsolatedProcessRequest
  ) => Effect.Effect<TrialProcessResult, TrialIsolatedProcessError>
}

export interface MakeTrialIsolatedProcessOptions {
  readonly trialProcess?: TrialProcessService
  /** One immutable authority retained from runner preflight. Omission fails closed. */
  readonly preparedAuthority?: TrialIsolationPreparedAuthority
  readonly trustedTempParent?: string
}

export interface ValidatedTrialIsolationPaths {
  readonly bubblewrapExecutable: string
  readonly bunExecutable: string
  readonly runnerNodeModules: string
  readonly repositoryRoot: string
  readonly candidateRoot: string
}

const ToolchainVersion = Schema.NonEmptyString.check(
  Schema.makeFilter((value: string) => value.isWellFormed() ? undefined : "must be well-formed"),
  Schema.makeFilter((value: string) => value === value.normalize("NFC") ? undefined : "must be NFC")
)
const TrialIsolationExpectedToolchainSchema = Schema.Struct({
  bunVersion: ToolchainVersion,
  bunExecutableSha256: Sha256Hex,
  bubblewrapVersion: ToolchainVersion,
  bubblewrapExecutableSha256: Sha256Hex,
  runnerNodeModulesSha256: Sha256Hex
})
const decodeExpectedToolchain = Schema.decodeUnknownSync(
  TrialIsolationExpectedToolchainSchema,
  { errors: "all", onExcessProperty: "error" }
)

const causeMessage = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

const invalid = (reason: string): never => {
  throw new TrialIsolationInvalidRequestError(reason)
}

const assertCanonicalAbsolutePath = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) invalid(`${label} must be a nonempty string`)
  const path = value as string
  if (!path.isWellFormed()) invalid(`${label} must not contain an unpaired UTF-16 surrogate`)
  if (path !== path.normalize("NFC")) invalid(`${label} must be NFC-normalized`)
  if (path.includes("\u0000")) invalid(`${label} must not contain NUL`)
  if (!isAbsolute(path) || resolve(path) !== path || path === "/") {
    invalid(`${label} must be a canonical non-root absolute path`)
  }
  return path
}

const isWithin = (parent: string, child: string): boolean => {
  const fromParent = relative(parent, child)
  return fromParent !== "" &&
    fromParent !== ".." &&
    !fromParent.startsWith(`..${sep}`) &&
    !isAbsolute(fromParent)
}

const assertRegularExecutable = (stat: Stats, label: string): void => {
  if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & constants.X_OK) === 0) {
    invalid(`${label} must be a real executable regular file`)
  }
}

const assertDirectory = (stat: Stats, label: string): void => {
  if (stat.isSymbolicLink() || !stat.isDirectory()) invalid(`${label} must be a real directory`)
}

const sameFileSnapshot = (left: Stats, right: Stats): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.mode === right.mode &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs

const validateAdapterArgv = (
  input: readonly [string, ...Array<string>]
): readonly ["bun", "run", "trial-adapter.ts", TrialAdapterMode] => {
  if (!Array.isArray(input) || input.length !== 4 ||
    input[0] !== "bun" || input[1] !== "run" || input[2] !== "trial-adapter.ts" ||
    (input[3] !== "case" && input[3] !== "probe" && input[3] !== "gate")) {
    return invalid(
      "adapterArgv must exactly equal bun run trial-adapter.ts followed by case, probe, or gate"
    )
  }
  return ["bun", "run", "trial-adapter.ts", input[3]]
}

const validateRequestStructure = (request: TrialIsolatedProcessRequest): {
  readonly candidateRoot: string
  readonly adapterArgv: readonly ["bun", "run", "trial-adapter.ts", TrialAdapterMode]
  readonly stdin: Uint8Array
  readonly timeoutMilliseconds: number
  readonly expectedToolchain: TrialIsolationExpectedToolchain
} => {
  if (typeof request !== "object" || request === null) invalid("request must be an object")
  const candidateRoot = assertCanonicalAbsolutePath(request.candidateRoot, "candidateRoot")
  const adapterArgv = validateAdapterArgv(request.adapterArgv)
  if (!(request.stdin instanceof Uint8Array)) invalid("stdin must be a Uint8Array")
  if (!Number.isSafeInteger(request.timeoutMilliseconds) || request.timeoutMilliseconds <= 0) {
    invalid("timeoutMilliseconds must be a positive safe integer")
  }
  const expectedToolchain = (() => {
    try {
      return decodeExpectedToolchain(request.expectedToolchain)
    } catch (cause) {
      return invalid(`expectedToolchain is invalid (${causeMessage(cause)})`)
    }
  })()
  return {
    candidateRoot,
    adapterArgv,
    stdin: Uint8Array.from(request.stdin),
    timeoutMilliseconds: request.timeoutMilliseconds,
    expectedToolchain
  }
}

const readStableNoFollowFile = async (
  path: string,
  expected: Stats,
  label: string
): Promise<Uint8Array> => {
  if (typeof constants.O_NOFOLLOW !== "number") invalid("O_NOFOLLOW is unavailable")
  let handle: FileHandle | undefined
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const opened = await handle.stat()
    if (!opened.isFile() || !sameFileSnapshot(expected, opened)) {
      invalid(`${label} opened inode differs from its no-follow path snapshot`)
    }
    const bytes = new Uint8Array(await handle.readFile())
    const after = await handle.stat()
    if (!after.isFile() || !sameFileSnapshot(opened, after) || after.size !== bytes.byteLength) {
      invalid(`${label} changed while its bytes were read`)
    }
    const pathAfter = await lstat(path)
    if (pathAfter.isSymbolicLink() || !pathAfter.isFile() ||
      !sameFileSnapshot(after, pathAfter)) {
      invalid(`${label} path changed while its bytes were read`)
    }
    return bytes
  } finally {
    await handle?.close()
  }
}

const validatePaths = async (
  input: {
    readonly bubblewrapExecutable: string
    readonly bunExecutable: string
    readonly runnerNodeModules: string
    readonly repositoryRoot: string
    readonly candidateRoot: string
  },
  expectedToolchain: TrialIsolationExpectedToolchain
): Promise<ValidatedTrialIsolationPaths> => {
  const paths = {
    bubblewrapExecutable: assertCanonicalAbsolutePath(
      input.bubblewrapExecutable,
      "bubblewrapExecutable"
    ),
    bunExecutable: assertCanonicalAbsolutePath(input.bunExecutable, "bunExecutable"),
    runnerNodeModules: assertCanonicalAbsolutePath(input.runnerNodeModules, "runnerNodeModules"),
    repositoryRoot: assertCanonicalAbsolutePath(input.repositoryRoot, "repositoryRoot"),
    candidateRoot: assertCanonicalAbsolutePath(input.candidateRoot, "candidateRoot")
  }

  const [bubblewrapReal, bunReal, nodeModulesReal, repositoryReal, candidateReal] =
    await Promise.all([
      realpath(paths.bubblewrapExecutable),
      realpath(paths.bunExecutable),
      realpath(paths.runnerNodeModules),
      realpath(paths.repositoryRoot),
      realpath(paths.candidateRoot)
    ])
  if (bubblewrapReal !== paths.bubblewrapExecutable) {
    invalid("bubblewrapExecutable must not be reached through a symbolic link")
  }
  if (bunReal !== paths.bunExecutable) invalid("bunExecutable must be a fully resolved real path")
  if (nodeModulesReal !== paths.runnerNodeModules) {
    invalid("runnerNodeModules must not be reached through a symbolic link")
  }
  if (repositoryReal !== paths.repositoryRoot) {
    invalid("repositoryRoot must not be reached through a symbolic link")
  }
  if (candidateReal !== paths.candidateRoot) {
    invalid("candidateRoot must not be reached through a symbolic link")
  }

  const [bubblewrapStat, bunStat, nodeModulesStat, repositoryStat, candidateStat] =
    await Promise.all([
      lstat(paths.bubblewrapExecutable),
      lstat(paths.bunExecutable),
      lstat(paths.runnerNodeModules),
      lstat(paths.repositoryRoot),
      lstat(paths.candidateRoot)
    ])
  assertRegularExecutable(bubblewrapStat, "bubblewrapExecutable")
  assertRegularExecutable(bunStat, "bunExecutable")
  assertDirectory(nodeModulesStat, "runnerNodeModules")
  assertDirectory(repositoryStat, "repositoryRoot")
  assertDirectory(candidateStat, "candidateRoot")

  const [bubblewrapBytes, bunBytes] = await Promise.all([
    readStableNoFollowFile(paths.bubblewrapExecutable, bubblewrapStat, "bubblewrapExecutable"),
    readStableNoFollowFile(paths.bunExecutable, bunStat, "bunExecutable")
  ])
  if (sha256Bytes(bubblewrapBytes) !== expectedToolchain.bubblewrapExecutableSha256) {
    invalid("bubblewrapExecutable bytes do not equal the run-context digest")
  }
  if (sha256Bytes(bunBytes) !== expectedToolchain.bunExecutableSha256) {
    invalid("bunExecutable bytes do not equal the run-context digest")
  }

  if (paths.bubblewrapExecutable !== TRIAL_BUBBLEWRAP_EXECUTABLE) {
    invalid(`bubblewrapExecutable must equal ${TRIAL_BUBBLEWRAP_EXECUTABLE}`)
  }
  if (paths.candidateRoot === paths.repositoryRoot || isWithin(paths.repositoryRoot, paths.candidateRoot)) {
    invalid("candidateRoot must not be the repository root or contained by it")
  }
  if (paths.runnerNodeModules === paths.candidateRoot ||
    isWithin(paths.candidateRoot, paths.runnerNodeModules)) {
    invalid("runnerNodeModules must be outside candidateRoot")
  }
  return paths
}

interface IsolationSnapshotAllocation {
  readonly root: string
  readonly stat: Stats
}

interface PreparedIsolationSnapshot {
  readonly paths: ValidatedTrialIsolationPaths
  readonly bunStat: Stats
  readonly dependencyRootStat: Stats
}

interface PinnedIsolationSnapshot {
  readonly rootHandle: FileHandle
  readonly bunHandle: FileHandle
  readonly dependencyRootHandle: FileHandle
  readonly rootStat: Stats
  readonly bunStat: Stats
  readonly dependencyRootStat: Stats
}

const expectedToolchainEqual = (
  left: TrialIsolationExpectedToolchain,
  right: TrialIsolationExpectedToolchain
): boolean => left.bunVersion === right.bunVersion &&
  left.bunExecutableSha256 === right.bunExecutableSha256 &&
  left.bubblewrapVersion === right.bubblewrapVersion &&
  left.bubblewrapExecutableSha256 === right.bubblewrapExecutableSha256 &&
  left.runnerNodeModulesSha256 === right.runnerNodeModulesSha256

const allocateIsolationSnapshot = async (
  trustedTempParentInput: string
): Promise<IsolationSnapshotAllocation> => {
  const trustedTempParent = assertCanonicalAbsolutePath(
    trustedTempParentInput,
    "trustedTempParent"
  )
  const parentReal = await realpath(trustedTempParent)
  const parentStat = await lstat(trustedTempParent)
  if (parentReal !== trustedTempParent || parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    invalid("trustedTempParent must be a fully resolved real directory")
  }
  const root = await mkdtemp(join(trustedTempParent, isolationSnapshotPrefix))
  if (dirname(root) !== trustedTempParent) {
    invalid("snapshot mkdtemp returned a path outside trustedTempParent")
  }
  await chmod(root, 0o700)
  const stat = await lstat(root)
  if (stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o7777) !== 0o700) {
    invalid("fresh isolation snapshot root is not a real 0700 directory")
  }
  return { root, stat }
}

const cleanupIsolationSnapshot = async (allocation: IsolationSnapshotAllocation): Promise<void> => {
  let observed: Stats
  try {
    observed = await lstat(allocation.root)
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") return
    throw cause
  }
  if (observed.isSymbolicLink() || !observed.isDirectory() ||
    observed.dev !== allocation.stat.dev || observed.ino !== allocation.stat.ino) {
    throw new Error("refusing to clean a replaced isolation snapshot root")
  }
  const restore = async (path: string): Promise<void> => {
    const before = await lstat(path)
    if (before.isSymbolicLink() || !before.isDirectory()) return
    await chmod(path, 0o700)
    const names = await readdir(path)
    for (const name of names) {
      const child = join(path, name)
      const childStat = await lstat(child)
      if (!childStat.isSymbolicLink() && childStat.isDirectory()) await restore(child)
    }
  }
  await restore(allocation.root)
  const finalRoot = await lstat(allocation.root)
  if (finalRoot.isSymbolicLink() || !finalRoot.isDirectory() ||
    finalRoot.dev !== allocation.stat.dev || finalRoot.ino !== allocation.stat.ino) {
    throw new Error("isolation snapshot root changed before cleanup")
  }
  await rm(allocation.root, { recursive: true, force: false })
}

const canonicalMode = (entry: RuntimeDependencyTreeEntry): number =>
  entry._tag === "RegularFile" && entry.mode === "100755" ? 0o755 : 0o644

const assertSnapshotDirectory = async (path: string): Promise<void> => {
  const stat = await lstat(path)
  if (stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o7777) !== 0o755) {
    invalid(`snapshot directory ${JSON.stringify(path)} is not a real 0755 directory`)
  }
}

const ensureSnapshotParent = async (
  root: string,
  entryPath: string,
  directories: Set<string>
): Promise<string> => {
  const segments = entryPath.split("/")
  segments.pop()
  let current = root
  for (const segment of segments) {
    const next = join(current, segment)
    if (!directories.has(next)) {
      await mkdir(next, { mode: 0o755 })
      await chmod(next, 0o755)
      directories.add(next)
    }
    await assertSnapshotDirectory(next)
    current = next
  }
  return current
}

const copyRegularDependency = async (
  sourceRoot: string,
  destinationRoot: string,
  entry: Extract<RuntimeDependencyTreeEntry, { readonly _tag: "RegularFile" }>,
  directories: Set<string>
): Promise<void> => {
  const source = join(sourceRoot, entry.path)
  const first = await lstat(source)
  if (first.isSymbolicLink() || !first.isFile()) {
    invalid(`runtime dependency ${entry.path} ceased to be a regular file`)
  }
  const bytes = await readStableNoFollowFile(source, first, `runtime dependency ${entry.path}`)
  if (sha256Bytes(bytes) !== entry.bytesSha256 || bytes.byteLength !== entry.byteLength ||
    ((first.mode & 0o111) === 0 ? "100644" : "100755") !== entry.mode) {
    invalid(`runtime dependency ${entry.path} differs from its v2 inventory entry`)
  }
  const parent = await ensureSnapshotParent(destinationRoot, entry.path, directories)
  const destination = join(destinationRoot, entry.path)
  if (dirname(destination) !== parent) invalid(`runtime dependency ${entry.path} escaped its parent`)
  let handle: FileHandle | undefined
  try {
    handle = await open(
      destination,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      canonicalMode(entry)
    )
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.chmod(canonicalMode(entry))
    const written = await handle.stat()
    if (!written.isFile() || written.size !== bytes.byteLength ||
      (written.mode & 0o7777) !== canonicalMode(entry)) {
      invalid(`runtime dependency snapshot ${entry.path} has wrong type, size, or mode`)
    }
  } finally {
    await handle?.close()
  }
}

const fatalUtf8Decoder = new TextDecoder("utf-8", { fatal: true })

const copySymbolicDependency = async (
  sourceRoot: string,
  destinationRoot: string,
  entry: Extract<RuntimeDependencyTreeEntry, { readonly _tag: "SymbolicLink" }>,
  directories: Set<string>
): Promise<void> => {
  const source = join(sourceRoot, entry.path)
  const first = await lstat(source)
  if (!first.isSymbolicLink()) invalid(`runtime dependency ${entry.path} ceased to be a symlink`)
  const rawTarget = await readlink(source, { encoding: "buffer" })
  let target: string
  try {
    target = fatalUtf8Decoder.decode(rawTarget)
  } catch {
    return invalid(`runtime dependency ${entry.path} target ceased to be valid UTF-8`)
  }
  const second = await lstat(source)
  if (!second.isSymbolicLink() || !sameFileSnapshot(first, second) || target !== entry.target) {
    invalid(`runtime dependency ${entry.path} changed after its v2 inventory`)
  }
  const parent = await ensureSnapshotParent(destinationRoot, entry.path, directories)
  const destination = join(destinationRoot, entry.path)
  if (dirname(destination) !== parent) invalid(`runtime dependency ${entry.path} escaped its parent`)
  await symlink(entry.target, destination)
  const created = await lstat(destination)
  if (!created.isSymbolicLink()) invalid(`runtime dependency snapshot ${entry.path} is not a symlink`)
}

const copyBunExecutable = async (
  source: string,
  destination: string,
  expectedSha256: Sha256HexType
): Promise<Stats> => {
  const first = await lstat(source)
  assertRegularExecutable(first, "bunExecutable")
  const bytes = await readStableNoFollowFile(source, first, "bunExecutable")
  if (sha256Bytes(bytes) !== expectedSha256) {
    invalid("Bun executable changed after preflight and before private snapshotting")
  }
  let handle: FileHandle | undefined
  try {
    handle = await open(
      destination,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o555
    )
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.chmod(0o555)
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size !== bytes.byteLength || (stat.mode & 0o7777) !== 0o555) {
      invalid("private Bun snapshot has wrong type, size, or mode")
    }
    return stat
  } finally {
    await handle?.close()
  }
}

const prepareIsolationSnapshot = async (
  sourcePaths: ValidatedTrialIsolationPaths,
  sourceTree: ObservedRuntimeDependencyTree,
  allocation: IsolationSnapshotAllocation,
  expectedToolchain: TrialIsolationExpectedToolchain
): Promise<PreparedIsolationSnapshot> => {
  const bunExecutable = join(allocation.root, "bun")
  const runnerNodeModules = join(allocation.root, "node_modules")
  const bunStat = await copyBunExecutable(
    sourcePaths.bunExecutable,
    bunExecutable,
    // validatePaths already checked this binding; the second check closes its copy gap.
    expectedToolchain.bunExecutableSha256
  )
  await mkdir(runnerNodeModules, { mode: 0o755 })
  await chmod(runnerNodeModules, 0o755)
  const directories = new Set<string>([runnerNodeModules])
  for (const entry of sourceTree.inventory.entries) {
    if (entry._tag === "RegularFile") {
      await copyRegularDependency(
        sourcePaths.runnerNodeModules,
        runnerNodeModules,
        entry,
        directories
      )
    } else {
      await copySymbolicDependency(
        sourcePaths.runnerNodeModules,
        runnerNodeModules,
        entry,
        directories
      )
    }
  }
  for (const directory of directories) await assertSnapshotDirectory(directory)
  await chmod(allocation.root, 0o500)
  const dependencyRootStat = await lstat(runnerNodeModules)
  return {
    paths: {
      ...sourcePaths,
      bunExecutable,
      runnerNodeModules
    },
    bunStat,
    dependencyRootStat
  }
}

const pinIsolationSnapshot = async (
  allocation: IsolationSnapshotAllocation,
  snapshot: PreparedIsolationSnapshot
): Promise<PinnedIsolationSnapshot> => {
  let rootHandle: FileHandle | undefined
  let bunHandle: FileHandle | undefined
  let dependencyRootHandle: FileHandle | undefined
  try {
    rootHandle = await open(
      allocation.root,
      LINUX_O_PATH | constants.O_DIRECTORY | constants.O_NOFOLLOW
    )
    bunHandle = await open(snapshot.paths.bunExecutable, constants.O_RDONLY | constants.O_NOFOLLOW)
    dependencyRootHandle = await open(
      snapshot.paths.runnerNodeModules,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
    )
    const [rootStat, bunStat, dependencyRootStat] = await Promise.all([
      rootHandle.stat(),
      bunHandle.stat(),
      dependencyRootHandle.stat()
    ])
    if (!rootStat.isDirectory() || rootStat.dev !== allocation.stat.dev ||
      rootStat.ino !== allocation.stat.ino || !sameFileSnapshot(snapshot.bunStat, bunStat) ||
      !sameFileSnapshot(snapshot.dependencyRootStat, dependencyRootStat)) {
      invalid("private isolation snapshot changed before it was pinned")
    }
    return { rootHandle, bunHandle, dependencyRootHandle, rootStat, bunStat, dependencyRootStat }
  } catch (cause) {
    await Promise.allSettled([rootHandle?.close(), bunHandle?.close(), dependencyRootHandle?.close()])
    throw cause
  }
}

const closePinnedIsolationSnapshot = async (snapshot: PinnedIsolationSnapshot): Promise<void> => {
  await Promise.all([
    snapshot.rootHandle.close(),
    snapshot.bunHandle.close(),
    snapshot.dependencyRootHandle.close()
  ])
}

const assertPinnedIsolationSnapshot = async (
  allocation: IsolationSnapshotAllocation,
  snapshot: PreparedIsolationSnapshot,
  pinned: PinnedIsolationSnapshot
): Promise<void> => {
  const [rootPath, bunPath, dependencyPath, rootFd, bunFd, dependencyFd] = await Promise.all([
    lstat(allocation.root),
    lstat(snapshot.paths.bunExecutable),
    lstat(snapshot.paths.runnerNodeModules),
    pinned.rootHandle.stat(),
    pinned.bunHandle.stat(),
    pinned.dependencyRootHandle.stat()
  ])
  if (!rootPath.isDirectory() || rootPath.isSymbolicLink() ||
    rootPath.dev !== pinned.rootStat.dev || rootPath.ino !== pinned.rootStat.ino ||
    !sameFileSnapshot(pinned.rootStat, rootFd) ||
    bunPath.isSymbolicLink() || !bunPath.isFile() ||
    !sameFileSnapshot(pinned.bunStat, bunPath) || !sameFileSnapshot(pinned.bunStat, bunFd) ||
    dependencyPath.isSymbolicLink() || !dependencyPath.isDirectory() ||
    !sameFileSnapshot(pinned.dependencyRootStat, dependencyPath) ||
    !sameFileSnapshot(pinned.dependencyRootStat, dependencyFd)) {
    invalid("private isolation snapshot path or pinned inode changed")
  }
}

const verifierProgram = (
  paths: ValidatedTrialIsolationPaths,
  expectedToolchain: TrialIsolationExpectedToolchain
): string => {
  const expectedEnvironment = JSON.stringify(fixedSandboxEnvironment)
  const forbiddenHostPaths = JSON.stringify([
    "/home",
    "/root",
    "/etc",
    paths.repositoryRoot,
    paths.candidateRoot,
    paths.runnerNodeModules,
    paths.bunExecutable
  ])
  const candidateArgv = JSON.stringify([
    TRIAL_SANDBOX_BUN_EXECUTABLE,
    "run",
    "trial-adapter.ts",
    "__TRIAL_ADAPTER_MODE__"
  ])
  return [
    'const fs = require("node:fs");',
    `const failurePrefix = ${JSON.stringify(TRIAL_ISOLATION_FAILURE_PREFIX)};`,
    "const fail = (reason) => { process.stderr.write(failurePrefix + reason + \"\\n\"); process.exit(125); };",
    `const expectedEnvironment = ${expectedEnvironment};`,
    `if (Bun.version !== ${JSON.stringify(expectedToolchain.bunVersion)}) fail("bun-version");`,
    "const actualEnvironment = Object.fromEntries(Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b)));",
    "const expectedEntries = Object.entries(expectedEnvironment).sort(([a], [b]) => a.localeCompare(b));",
    "if (JSON.stringify(Object.entries(actualEnvironment)) !== JSON.stringify(expectedEntries)) fail(\"environment\");",
    `for (const path of ${forbiddenHostPaths}) if (fs.existsSync(path)) fail(\"host-path:\" + path);`,
    "const writeProbe = (path, shouldSucceed) => { let succeeded = false; try { fs.writeFileSync(path, \"probe\\n\", { flag: \"wx\" }); fs.unlinkSync(path); succeeded = true; } catch {} if (succeeded !== shouldSucceed) fail(\"write-policy:\" + path); };",
    "writeProbe(\"/candidate/.trial-isolation-write-probe\", true);",
    "writeProbe(\"/tmp/.trial-isolation-write-probe\", true);",
    "writeProbe(\"/candidate/node_modules/.trial-isolation-write-probe\", false);",
    "writeProbe(\"/usr/.trial-isolation-write-probe\", false);",
    "writeProbe(\"/.trial-isolation-write-probe\", false);",
    "const route = fs.readFileSync(\"/proc/net/route\", \"utf8\").trim().split(/\\n/u).slice(1).filter(Boolean);",
    "if (route.length !== 0) fail(\"network-route\");",
    `const argv = ${candidateArgv};`,
    'argv[3] = "__TRIAL_ADAPTER_MODE__";',
    "process.execve(argv[0], argv, expectedEnvironment);",
    "fail(\"execve-returned\");"
  ].join("\n")
}

/**
 * Produces the complete, reviewable bubblewrap invocation. Only the candidate copy is writable;
 * the runner dependency tree and Bun executable are mounted read-only, and no host root is bound.
 */
export const buildTrialIsolationArgv = (
  paths: ValidatedTrialIsolationPaths,
  mode: TrialAdapterMode,
  expectedToolchain: TrialIsolationExpectedToolchain
): readonly [string, ...Array<string>] => {
  const verifier = verifierProgram(paths, expectedToolchain)
    .replaceAll("__TRIAL_ADAPTER_MODE__", mode)
  return [
    paths.bubblewrapExecutable,
    "--unshare-all",
    "--disable-userns",
    "--assert-userns-disabled",
    "--new-session",
    "--die-with-parent",
    "--cap-drop",
    "ALL",
    "--hostname",
    "architecture-trial",
    "--clearenv",
    "--setenv", "PATH", fixedSandboxEnvironment.PATH,
    "--setenv", "LC_ALL", fixedSandboxEnvironment.LC_ALL,
    "--setenv", "LANG", fixedSandboxEnvironment.LANG,
    "--setenv", "TZ", fixedSandboxEnvironment.TZ,
    "--setenv", "NO_COLOR", fixedSandboxEnvironment.NO_COLOR,
    "--setenv", "TMPDIR", fixedSandboxEnvironment.TMPDIR,
    "--ro-bind", "/usr", "/usr",
    "--symlink", "usr/bin", "/bin",
    "--symlink", "usr/lib", "/lib",
    "--symlink", "usr/lib64", "/lib64",
    "--dev", "/dev",
    "--proc", "/proc",
    "--tmpfs", "/tmp",
    "--dir", "/runtime",
    "--bind", paths.candidateRoot, TRIAL_SANDBOX_CANDIDATE_ROOT,
    "--ro-bind", paths.runnerNodeModules, TRIAL_SANDBOX_NODE_MODULES,
    "--ro-bind", paths.bunExecutable, TRIAL_SANDBOX_BUN_EXECUTABLE,
    "--chdir", TRIAL_SANDBOX_CANDIDATE_ROOT,
    "--",
    TRIAL_SANDBOX_BUN_EXECUTABLE,
    "--eval",
    verifier
  ]
}

const isolationFailureReason = (result: TrialProcessResult): string | undefined => {
  let stderr: string
  try {
    stderr = new TextDecoder("utf-8", { fatal: true }).decode(result.stderr)
  } catch {
    return undefined
  }
  if (result.exitCode === TRIAL_ISOLATION_FAILURE_EXIT_CODE &&
    stderr.startsWith(TRIAL_ISOLATION_FAILURE_PREFIX)) {
    return stderr.trim()
  }
  if (result.exitCode !== 0 && stderr.startsWith("bwrap:")) return stderr.trim()
  return undefined
}

const verifyBubblewrapVersion = Effect.fn("TrialIsolatedProcess.verifyBubblewrapVersion")(
  function* (
    trialProcess: TrialProcessService,
    paths: ValidatedTrialIsolationPaths,
    expected: TrialIsolationExpectedToolchain
  ) {
    const result = yield* trialProcess.run({
      argv: [paths.bubblewrapExecutable, "--version"],
      cwd: paths.candidateRoot,
      stdin: new TextEncoder().encode("{}\n"),
      timeoutMilliseconds: 5_000,
      closedEnvironment: fixedOuterEnvironment
    }).pipe(Effect.mapError((error) =>
      new TrialIsolationUnavailableError(`bubblewrap version probe failed: ${error.message}`)))
    let stdout: string
    let stderr: string
    try {
      stdout = new TextDecoder("utf-8", { fatal: true }).decode(result.stdout)
      stderr = new TextDecoder("utf-8", { fatal: true }).decode(result.stderr)
    } catch {
      yield* new TrialIsolationUnavailableError("bubblewrap version output was not valid UTF-8")
      return
    }
    if (result.exitCode !== 0 || stderr !== "" ||
      stdout !== `bubblewrap ${expected.bubblewrapVersion}\n`) {
      yield* new TrialIsolationUnavailableError(
        "bubblewrap version output does not equal the run-context version binding"
      )
    }
  }
)

const mapTrialProcessError = (error: TrialProcessError): TrialIsolatedProcessError => {
  if (error instanceof TrialProcessIoError ||
    error instanceof TrialProcessTimeoutError ||
    error instanceof TrialProcessSignalError ||
    error instanceof TrialProcessOutputLimitError) return error
  return new TrialIsolationUnavailableError(`${error._tag}: ${error.message}`)
}

const completeStreamEvidence = (bytes: Uint8Array): CompleteProcessStreamEvidence =>
  new CompleteProcessStreamEvidence({
    byteLength: bytes.byteLength,
    sha256: sha256Bytes(bytes)
  })

const streamEvidenceFromCapture = (
  capture: TrialProcessIoError["stdout"]
): ProcessStreamEvidence => capture.completeness === "Complete"
  ? new CompleteProcessStreamEvidence({
    byteLength: capture.byteLength,
    sha256: capture.sha256
  })
  : new PrefixProcessStreamEvidence({
    byteLength: capture.byteLength,
    sha256: capture.sha256
  })

const processAttemptFromTrialResult = (
  result: TrialProcessResult
): ExitedProcessAttempt => new ExitedProcessAttempt({
  exitCode: result.exitCode,
  stdout: completeStreamEvidence(result.stdout),
  stderr: completeStreamEvidence(result.stderr)
})

const processAttemptFromTrialError = (
  error: TrialProcessError
): ProcessAttemptEvidenceType => {
  if (error instanceof TrialProcessIoError) {
    return new IoFailedProcessAttempt({
      operation: error.operation,
      stdout: streamEvidenceFromCapture(error.stdout),
      stderr: streamEvidenceFromCapture(error.stderr)
    })
  }
  if (error instanceof TrialProcessTimeoutError) {
    return new TimedOutProcessAttempt({
      timeoutMilliseconds: error.timeoutMilliseconds,
      stdout: streamEvidenceFromCapture(error.stdout),
      stderr: streamEvidenceFromCapture(error.stderr)
    })
  }
  if (error instanceof TrialProcessSignalError) {
    return new SignaledProcessAttempt({
      signal: error.signal,
      stdout: streamEvidenceFromCapture(error.stdout),
      stderr: streamEvidenceFromCapture(error.stderr)
    })
  }
  if (error instanceof TrialProcessOutputLimitError) {
    return new OutputLimitedProcessAttempt({
      stream: error.stream,
      limitBytes: error.limitBytes,
      observedBytes: error.observedBytes,
      stdout: streamEvidenceFromCapture(error.stdout),
      stderr: streamEvidenceFromCapture(error.stderr)
    })
  }
  return new NotStartedProcessAttempt({
    executable: error._tag === "TrialProcessSpawnError" ? error.executable : null
  })
}

const processAttemptFromTrialOutcome = (
  process: Result.Result<TrialProcessResult, TrialProcessError>
): ProcessAttemptEvidenceType => Result.isSuccess(process)
  ? processAttemptFromTrialResult(process.success)
  : processAttemptFromTrialError(process.failure)

export const makeTrialIsolatedProcess = (
  options: MakeTrialIsolatedProcessOptions = {}
): TrialIsolatedProcessService => {
  const trialProcess = options.trialProcess ?? makeTrialProcess()
  const preparedAuthority = options.preparedAuthority === undefined
    ? undefined
    : {
      bubblewrapExecutable: options.preparedAuthority.bubblewrapExecutable,
      bunExecutable: options.preparedAuthority.bunExecutable,
      runnerNodeModules: options.preparedAuthority.runnerNodeModules,
      repositoryRoot: options.preparedAuthority.repositoryRoot,
      expectedToolchain: { ...options.preparedAuthority.expectedToolchain }
    }
  const trustedTempParent = options.trustedTempParent ?? "/tmp"

  const runScoped = Effect.fn("TrialIsolatedProcess.run.scoped")(function* (
    request: TrialIsolatedProcessRequest
  ) {
    const validated = yield* Effect.try({
      try: () => validateRequestStructure(request),
      catch: (cause) => cause instanceof TrialIsolationInvalidRequestError
        ? cause
        : new TrialIsolationInvalidRequestError(causeMessage(cause))
    })
    if (preparedAuthority === undefined) {
      yield* new TrialIsolationUnavailableError(
        "runner preflight did not provide one immutable isolation authority"
      )
    }
    let authorityExpected: TrialIsolationExpectedToolchain
    try {
      authorityExpected = decodeExpectedToolchain(preparedAuthority!.expectedToolchain)
    } catch (cause) {
      yield* new TrialIsolationUnavailableError(
        `runner preflight isolation authority is invalid: ${causeMessage(cause)}`
      )
      return undefined as never
    }
    if (!expectedToolchainEqual(validated.expectedToolchain, authorityExpected)) {
      yield* new TrialIsolationInvalidRequestError(
        "request bindings do not equal the constructor-frozen preflight authority"
      )
    }
    const paths = yield* Effect.tryPromise({
      try: () => validatePaths({
        bubblewrapExecutable: preparedAuthority!.bubblewrapExecutable,
        bunExecutable: preparedAuthority!.bunExecutable,
        runnerNodeModules: preparedAuthority!.runnerNodeModules,
        repositoryRoot: preparedAuthority!.repositoryRoot,
        candidateRoot: validated.candidateRoot
      }, authorityExpected),
      catch: (cause) => cause instanceof TrialIsolationInvalidRequestError
        ? cause
        : new TrialIsolationUnavailableError(causeMessage(cause))
    })
    yield* verifyBubblewrapVersion(trialProcess, paths, authorityExpected)

    const sourceTreeBefore = yield* inventoryRuntimeDependencyTree(paths.runnerNodeModules).pipe(
      Effect.mapError((cause) => new TrialIsolationUnavailableError(cause.message))
    )
    if (sourceTreeBefore.inventory.treeSha256 !== authorityExpected.runnerNodeModulesSha256) {
      yield* new TrialIsolationUnavailableError(
        "runner node_modules tree does not equal the run-context v2 digest"
      )
    }

    const allocation = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => allocateIsolationSnapshot(trustedTempParent),
        catch: (cause) => cause instanceof TrialIsolationInvalidRequestError
          ? cause
          : new TrialIsolationUnavailableError(causeMessage(cause))
      }),
      (allocated) => Effect.tryPromise({
        try: () => cleanupIsolationSnapshot(allocated),
        catch: (cause) => new TrialIsolationUnavailableError(causeMessage(cause))
      }).pipe(Effect.orDie)
    )
    const snapshot = yield* Effect.tryPromise({
      try: () => prepareIsolationSnapshot(paths, sourceTreeBefore, allocation, authorityExpected),
      catch: (cause) => cause instanceof TrialIsolationInvalidRequestError
        ? new TrialIsolationUnavailableError(cause.reason)
        : new TrialIsolationUnavailableError(causeMessage(cause))
    })
    const [sourceTreeAfter, snapshotTree] = yield* Effect.all([
      inventoryRuntimeDependencyTree(paths.runnerNodeModules),
      inventoryRuntimeDependencyTree(snapshot.paths.runnerNodeModules)
    ]).pipe(Effect.mapError((cause: RuntimeDependencyTreeError) =>
      new TrialIsolationUnavailableError(cause.message)))
    if (!sameRuntimeDependencyRootSnapshot(sourceTreeBefore.root, sourceTreeAfter.root) ||
      sourceTreeAfter.inventory.treeSha256 !== authorityExpected.runnerNodeModulesSha256 ||
      snapshotTree.inventory.treeSha256 !== authorityExpected.runnerNodeModulesSha256 ||
      JSON.stringify(sourceTreeAfter.inventory.entries) !==
        JSON.stringify(snapshotTree.inventory.entries)) {
      yield* new TrialIsolationUnavailableError(
        "runtime dependency source or invocation-private snapshot changed during copying"
      )
    }

    const pinned = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => pinIsolationSnapshot(allocation, snapshot),
        catch: (cause) => new TrialIsolationUnavailableError(causeMessage(cause))
      }),
      (value) => Effect.promise(() => closePinnedIsolationSnapshot(value))
    )
    yield* Effect.tryPromise({
      try: () => assertPinnedIsolationSnapshot(allocation, snapshot, pinned),
      catch: (cause) => new TrialIsolationUnavailableError(causeMessage(cause))
    })
    const argv = buildTrialIsolationArgv(
      snapshot.paths,
      validated.adapterArgv[3],
      authorityExpected
    )
    const process = yield* Effect.result(trialProcess.run({
      argv,
      cwd: validated.candidateRoot,
      stdin: validated.stdin,
      timeoutMilliseconds: validated.timeoutMilliseconds,
      closedEnvironment: fixedOuterEnvironment
    }))
    const processAttempt = processAttemptFromTrialOutcome(process)
    yield* Effect.tryPromise({
      try: () => assertPinnedIsolationSnapshot(allocation, snapshot, pinned),
      catch: (cause) => new TrialIsolationPostcheckError(causeMessage(cause), processAttempt)
    })
    const snapshotTreeAfter = yield* inventoryRuntimeDependencyTree(
      snapshot.paths.runnerNodeModules
    ).pipe(Effect.mapError((cause) =>
      new TrialIsolationPostcheckError(cause.message, processAttempt)))
    if (snapshotTreeAfter.inventory.treeSha256 !== authorityExpected.runnerNodeModulesSha256 ||
      JSON.stringify(snapshotTree.inventory.entries) !==
        JSON.stringify(snapshotTreeAfter.inventory.entries)) {
      yield* new TrialIsolationPostcheckError(
        "invocation-private runtime dependency snapshot changed during candidate execution",
        processAttempt
      )
    }
    if (Result.isFailure(process)) return yield* mapTrialProcessError(process.failure)
    const result = process.success
    const failure = isolationFailureReason(result)
    if (failure !== undefined) {
      yield* new TrialIsolationEstablishmentError(
        failure,
        processAttemptFromTrialResult(result)
      )
    }
    return result
  })
  const run = Effect.fn("TrialIsolatedProcess.run")(
    (request: TrialIsolatedProcessRequest) => Effect.scoped(runScoped(request))
  )
  return { run }
}

export class TrialIsolatedProcess extends Context.Service<
  TrialIsolatedProcess,
  TrialIsolatedProcessService
>()("@ts-release/architecture-program/TrialIsolatedProcess") {
  static readonly layer = Layer.sync(TrialIsolatedProcess, () => makeTrialIsolatedProcess())
}

export const makeTrialIsolatedProcessLayer = (options: MakeTrialIsolatedProcessOptions = {}) =>
  Layer.sync(TrialIsolatedProcess, () => makeTrialIsolatedProcess(options))

export const TrialIsolatedProcessLive = TrialIsolatedProcess.layer
