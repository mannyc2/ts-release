import type { Stats } from "node:fs"
import { lstat, readFile, realpath } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import { Context, Effect, Layer, Schema } from "effect"
import { canonicalJsonBytes } from "./canonical-document.js"
import {
  TRIAL_PROCESS_OUTPUT_LIMIT_BYTES,
  makeTrialProcess,
  type TrialProcessClosedEnvironment,
  type TrialProcessResult
} from "./trial-process.js"
import { TrialRunContextToolchain } from "./schema/run-context.js"
import { Sha256Hex } from "./schema/primitives.js"
import { sha256Bytes } from "./trial-hash.js"

export const TRIAL_TOOLCHAIN_GIT_TIMEOUT_MILLISECONDS = 5_000
export const TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES = TRIAL_PROCESS_OUTPUT_LIMIT_BYTES
export const TRIAL_TOOLCHAIN_BUBBLEWRAP_EXECUTABLE = "/usr/bin/bwrap"

const ToolId = Schema.Literals(["bun", "typescript", "effect", "git", "bubblewrap"])
type ToolId = typeof ToolId.Type

const PackageToolId = Schema.Literals(["typescript", "effect"])
type PackageToolId = typeof PackageToolId.Type

export class TrialToolchainInputError extends Schema.TaggedError<TrialToolchainInputError>()(
  "TrialToolchainInputError",
  { field: Schema.String, reason: Schema.String, message: Schema.String }
) {
  constructor(field: string, reason: string) {
    super({ field, reason, message: `Invalid trial toolchain ${field}: ${reason}.` })
  }
}

export class TrialToolchainPackageError extends Schema.TaggedError<TrialToolchainPackageError>()(
  "TrialToolchainPackageError",
  {
    tool: PackageToolId,
    path: Schema.String,
    reason: Schema.String,
    message: Schema.String
  }
) {
  constructor(tool: PackageToolId, path: string, reason: string) {
    super({
      tool,
      path,
      reason,
      message: `Unable to inspect the installed ${tool} package at ${JSON.stringify(path)}: ${reason}.`
    })
  }
}

export class TrialToolchainProcessError extends Schema.TaggedError<TrialToolchainProcessError>()(
  "TrialToolchainProcessError",
  { executable: Schema.String, reason: Schema.String, message: Schema.String }
) {
  constructor(executable: string, reason: string) {
    super({
      executable,
      reason,
      message: `Unable to discover the trial ${executable} toolchain version: ${reason}.`
    })
  }
}

export class TrialToolchainExecutableError extends Schema.TaggedError<TrialToolchainExecutableError>()(
  "TrialToolchainExecutableError",
  {
    tool: Schema.Literals(["bun", "git", "bubblewrap"]),
    path: Schema.String,
    reason: Schema.String,
    message: Schema.String
  }
) {
  constructor(tool: "bun" | "git" | "bubblewrap", path: string, reason: string) {
    super({
      tool,
      path,
      reason,
      message: `Unable to bind the ${tool} executable at ${JSON.stringify(path)}: ${reason}.`
    })
  }
}

export class TrialToolchainVersionError extends Schema.TaggedError<TrialToolchainVersionError>()(
  "TrialToolchainVersionError",
  {
    tool: ToolId,
    source: Schema.String,
    reason: Schema.String,
    message: Schema.String
  }
) {
  constructor(tool: ToolId, source: string, reason: string) {
    super({
      tool,
      source,
      reason,
      message: `Invalid ${tool} version from ${source}: ${reason}.`
    })
  }
}

export type TrialToolchainError =
  | TrialToolchainExecutableError
  | TrialToolchainInputError
  | TrialToolchainPackageError
  | TrialToolchainProcessError
  | TrialToolchainVersionError

export interface TrialToolchainFileProbe {
  readonly read: (path: string) => Effect.Effect<Uint8Array, unknown, never>
  readonly realpath: (path: string) => Effect.Effect<string, unknown, never>
  readonly lstat: (path: string) => Effect.Effect<Stats, unknown, never>
}

export interface TrialToolchainRuntimeProbe {
  readonly bunVersion: () => unknown
  readonly bunExecutablePath: () => unknown
  readonly gitExecutablePath: (path: string) => unknown
  readonly bubblewrapExecutablePath: () => unknown
  readonly inheritedPath: () => unknown
}

export interface TrialToolchainClosedEnvironment {
  readonly PATH: string
  readonly LC_ALL: "C"
  readonly LANG: "C"
  readonly TZ: "UTC"
  readonly NO_COLOR: "1"
}

export interface TrialToolchainProcessRequest {
  readonly argv: readonly [string, "--version"]
  readonly cwd: string
  readonly closedEnvironment: TrialToolchainClosedEnvironment
  readonly timeoutMilliseconds: 5_000
  readonly outputLimitBytes: typeof TRIAL_PROCESS_OUTPUT_LIMIT_BYTES
  readonly shell: false
}

export interface TrialToolchainProcessProbe {
  readonly run: (
    request: TrialToolchainProcessRequest
  ) => Effect.Effect<TrialProcessResult, unknown, never>
}

export interface TrialToolchainProbes {
  readonly file: TrialToolchainFileProbe
  readonly process: TrialToolchainProcessProbe
  readonly runtime: TrialToolchainRuntimeProbe
}

export interface TrialToolchainService {
  readonly discoverResolved: (
    programRoot: string
  ) => Effect.Effect<ResolvedTrialToolchain, TrialToolchainError, never>
  readonly discover: (
    programRoot: string
  ) => Effect.Effect<TrialRunContextToolchain, TrialToolchainError, never>
}

export interface ResolvedTrialToolchain {
  readonly context: TrialRunContextToolchain
  readonly bunExecutablePath: string
  readonly gitExecutablePath: string
  readonly bubblewrapExecutablePath: string
  readonly packageManifests: {
    readonly typescript: ResolvedTrialPackageManifest
    readonly effect: ResolvedTrialPackageManifest
  }
}

export interface ResolvedTrialPackageManifest {
  readonly path: string
  readonly sha256: typeof Sha256Hex.Type
}

const textDecoder = new TextDecoder("utf-8", { fatal: true })
const packageVersionPattern =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const gitVersionPattern =
  /^git version ((?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*)){2}(?:\.[0-9A-Za-z-]+)*(?: \([0-9A-Za-z][0-9A-Za-z .+/_-]*\))?)\r?\n?$/u
const bubblewrapVersionPattern =
  /^bubblewrap ((?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*)){2})\n$/u

const describeCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const invalidTextReason = (value: unknown): string | undefined => {
  if (typeof value !== "string") return "must be a string"
  if (value.length === 0) return "must not be empty"
  if (value.length > 256) return "must not exceed 256 characters"
  if (!value.isWellFormed()) return "must not contain an unpaired UTF-16 surrogate"
  if (value !== value.normalize("NFC")) return "must be NFC-normalized"
  if (value.includes("\u0000")) return "must not contain NUL"
  return undefined
}

const validateProgramRoot = (value: unknown): Effect.Effect<string, TrialToolchainInputError> => {
  if (typeof value !== "string") {
    return Effect.fail(new TrialToolchainInputError("programRoot", "must be a string"))
  }
  if (value.length === 0) {
    return Effect.fail(new TrialToolchainInputError("programRoot", "must not be empty"))
  }
  if (!value.isWellFormed() || value.includes("\u0000")) {
    return Effect.fail(new TrialToolchainInputError(
      "programRoot",
      "must be well-formed text without NUL"
    ))
  }
  return Effect.succeed(resolve(value))
}

const validatePath = (value: unknown): Effect.Effect<string, TrialToolchainInputError> => {
  if (typeof value !== "string" || value.length === 0 || !value.isWellFormed() || value.includes("\u0000")) {
    return Effect.fail(new TrialToolchainInputError(
      "PATH",
      "the running process must provide a nonempty well-formed PATH without NUL"
    ))
  }
  return Effect.succeed(value)
}

const sameStat = (left: Stats, right: Stats): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.mode === right.mode &&
  left.size === right.size &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs

const bindExecutable = Effect.fn("TrialToolchain.bindExecutable")(function* (
  probes: TrialToolchainProbes,
  tool: "bun" | "git" | "bubblewrap",
  input: unknown,
  requiredLiteral?: string
) {
  if (typeof input !== "string" || input.length === 0 || !input.isWellFormed() ||
    input !== input.normalize("NFC") || input.includes("\u0000") || !isAbsolute(input)) {
    return yield* new TrialToolchainExecutableError(
      tool,
      String(input),
      "runtime discovery must return a canonical absolute NFC path without NUL"
    )
  }
  const lexicalPath = resolve(input)
  if (lexicalPath !== input) {
    return yield* new TrialToolchainExecutableError(tool, input, "path must already be canonical")
  }
  if (requiredLiteral !== undefined && lexicalPath !== requiredLiteral) {
    return yield* new TrialToolchainExecutableError(
      tool,
      input,
      `path must equal ${JSON.stringify(requiredLiteral)}`
    )
  }
  const exactPath = yield* probes.file.realpath(lexicalPath).pipe(Effect.mapError((cause) =>
    new TrialToolchainExecutableError(tool, lexicalPath, describeCause(cause))))
  if (typeof exactPath !== "string" || !isAbsolute(exactPath) || resolve(exactPath) !== exactPath) {
    return yield* new TrialToolchainExecutableError(
      tool,
      lexicalPath,
      "realpath probe did not return a canonical absolute path"
    )
  }
  if (requiredLiteral !== undefined && exactPath !== requiredLiteral) {
    return yield* new TrialToolchainExecutableError(
      tool,
      lexicalPath,
      `resolved path must equal ${JSON.stringify(requiredLiteral)}`
    )
  }
  const before = yield* probes.file.lstat(exactPath).pipe(Effect.mapError((cause) =>
    new TrialToolchainExecutableError(tool, exactPath, describeCause(cause))))
  if (!before.isFile() || before.isSymbolicLink() || (before.mode & 0o111) === 0) {
    return yield* new TrialToolchainExecutableError(
      tool,
      exactPath,
      "resolved path must be an executable regular file"
    )
  }
  const bytes = yield* probes.file.read(exactPath).pipe(Effect.mapError((cause) =>
    new TrialToolchainExecutableError(tool, exactPath, describeCause(cause))))
  if (!(bytes instanceof Uint8Array)) {
    return yield* new TrialToolchainExecutableError(tool, exactPath, "file probe did not return bytes")
  }
  const after = yield* probes.file.lstat(exactPath).pipe(Effect.mapError((cause) =>
    new TrialToolchainExecutableError(tool, exactPath, describeCause(cause))))
  if (!after.isFile() || after.isSymbolicLink() || !sameStat(before, after) ||
    after.size !== bytes.byteLength) {
    return yield* new TrialToolchainExecutableError(
      tool,
      exactPath,
      "file changed while its bytes were hashed"
    )
  }
  return { path: exactPath, sha256: sha256Bytes(bytes) }
})

const validatePackageVersion = (
  tool: "bun" | PackageToolId,
  source: string,
  value: unknown
): Effect.Effect<string, TrialToolchainVersionError> => {
  const textReason = invalidTextReason(value)
  if (textReason !== undefined) {
    return Effect.fail(new TrialToolchainVersionError(tool, source, textReason))
  }
  const version = value as string
  if (!packageVersionPattern.test(version)) {
    return Effect.fail(new TrialToolchainVersionError(
      tool,
      source,
      "must be an exact unprefixed semantic version"
    ))
  }
  return Effect.succeed(version)
}

const parsePackageVersion = Effect.fn("TrialToolchain.parseInstalledPackageVersion")(
  function* (
    tool: PackageToolId,
    path: string,
    bytes: Uint8Array
  ) {
    const text = yield* Effect.try({
      try: () => textDecoder.decode(bytes),
      catch: (cause) => new TrialToolchainPackageError(tool, path, `invalid UTF-8 (${describeCause(cause)})`)
    })
    const parsed = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: (cause) => new TrialToolchainPackageError(tool, path, `invalid JSON (${describeCause(cause)})`)
    })
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return yield* new TrialToolchainPackageError(tool, path, "package JSON must be an object")
    }
    const record = parsed as Record<string, unknown>
    if (record.name !== tool) {
      return yield* new TrialToolchainPackageError(
        tool,
        path,
        `package name must equal ${JSON.stringify(tool)}`
      )
    }
    return yield* validatePackageVersion(tool, path, record.version)
  }
)

const parseGitVersion = (
  stdout: Uint8Array
): Effect.Effect<string, TrialToolchainVersionError> =>
  Effect.gen(function* () {
    const text = yield* Effect.try({
      try: () => textDecoder.decode(stdout),
      catch: (cause) => new TrialToolchainVersionError(
        "git",
        "git --version stdout",
        `must be UTF-8 (${describeCause(cause)})`
      )
    })
    const match = gitVersionPattern.exec(text)
    if (match === null) {
      return yield* new TrialToolchainVersionError(
        "git",
        "git --version stdout",
        "must exactly match `git version <major>.<minor>.<patch>` with an optional recognized vendor suffix"
      )
    }
    const version = match[1]!
    const reason = invalidTextReason(version)
    if (reason !== undefined) {
      return yield* new TrialToolchainVersionError("git", "git --version stdout", reason)
    }
    return version
  })

const fixedEnvironment = (
  path: string
): TrialToolchainClosedEnvironment & TrialProcessClosedEnvironment => ({
  PATH: path,
  LC_ALL: "C",
  LANG: "C",
  TZ: "UTC",
  NO_COLOR: "1"
})

const liveFileProbe: TrialToolchainFileProbe = {
  read: (path) => Effect.tryPromise(() => readFile(path)),
  realpath: (path) => Effect.tryPromise(() => realpath(path)),
  lstat: (path) => Effect.tryPromise(() => lstat(path))
}

const liveProcessProbe: TrialToolchainProcessProbe = {
  run: (request) => {
    const path = request.closedEnvironment.PATH
    const processService = makeTrialProcess({ inheritedEnvironment: { PATH: path } })
    // Do not delegate security choices to a shell: the resolved executable, argv,
    // environment, timeout, output bound, and stdin are fixed by discovery.
    return processService.run({
      argv: request.argv,
      cwd: request.cwd,
      stdin: canonicalJsonBytes({}),
      timeoutMilliseconds: TRIAL_TOOLCHAIN_GIT_TIMEOUT_MILLISECONDS,
      closedEnvironment: fixedEnvironment(path)
    })
  }
}

const liveRuntimeProbe: TrialToolchainRuntimeProbe = {
  bunVersion: () => typeof Bun === "undefined" ? undefined : Bun.version,
  bunExecutablePath: () => typeof Bun === "undefined" ? undefined : process.execPath,
  gitExecutablePath: (path) => typeof Bun === "undefined"
    ? undefined
    : Bun.which("git", { PATH: path }),
  bubblewrapExecutablePath: () => TRIAL_TOOLCHAIN_BUBBLEWRAP_EXECUTABLE,
  inheritedPath: () => process.env.PATH
}

const liveProbes: TrialToolchainProbes = {
  file: liveFileProbe,
  process: liveProcessProbe,
  runtime: liveRuntimeProbe
}

const invokeRuntimeProbe = <A>(
  field:
    | "bunVersion"
    | "bunExecutablePath"
    | "gitExecutablePath"
    | "bubblewrapExecutablePath"
    | "inheritedPath",
  probe: () => A
): Effect.Effect<A, TrialToolchainInputError> => Effect.try({
  try: probe,
  catch: (cause) => new TrialToolchainInputError(field, `runtime probe failed (${describeCause(cause)})`)
})

const readInstalledPackageVersion = Effect.fn("TrialToolchain.readInstalledPackageVersion")(
  function* (
    probes: TrialToolchainProbes,
    programRoot: string,
    tool: PackageToolId
  ) {
    const path = resolve(programRoot, "node_modules", tool, "package.json")
    const readEffect = yield* Effect.try({
      try: () => probes.file.read(path),
      catch: (cause) => new TrialToolchainPackageError(tool, path, describeCause(cause))
    })
    const bytes = yield* readEffect.pipe(Effect.mapError((cause) =>
      new TrialToolchainPackageError(tool, path, describeCause(cause))))
    if (!(bytes instanceof Uint8Array)) {
      return yield* new TrialToolchainPackageError(tool, path, "file probe did not return bytes")
    }
    const version = yield* parsePackageVersion(tool, path, bytes)
    return { version, path, sha256: sha256Bytes(bytes) }
  }
)

const discoverGitVersion = Effect.fn("TrialToolchain.discoverGitVersion")(
  function* (
    probes: TrialToolchainProbes,
    programRoot: string,
    path: string,
    gitExecutablePath: string
  ) {
    const request: TrialToolchainProcessRequest = {
      argv: [gitExecutablePath, "--version"],
      cwd: programRoot,
      closedEnvironment: fixedEnvironment(path),
      timeoutMilliseconds: TRIAL_TOOLCHAIN_GIT_TIMEOUT_MILLISECONDS,
      outputLimitBytes: TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES,
      shell: false
    }
    const runEffect = yield* Effect.try({
      try: () => probes.process.run(request),
      catch: (cause) => new TrialToolchainProcessError("git", describeCause(cause))
    })
    const result = yield* runEffect.pipe(Effect.mapError((cause) =>
      new TrialToolchainProcessError("git", describeCause(cause))))
    if (typeof result !== "object" || result === null ||
      !Number.isSafeInteger(result.exitCode) ||
      !(result.stdout instanceof Uint8Array) ||
      !(result.stderr instanceof Uint8Array)) {
      return yield* new TrialToolchainProcessError("git", "process probe returned a malformed result")
    }
    if (result.stdout.byteLength > TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES) {
      return yield* new TrialToolchainProcessError(
        "git",
        `stdout exceeded ${TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES} bytes`
      )
    }
    if (result.stderr.byteLength > TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES) {
      return yield* new TrialToolchainProcessError(
        "git",
        `stderr exceeded ${TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES} bytes`
      )
    }
    if (result.exitCode !== 0) {
      return yield* new TrialToolchainProcessError(
        "git",
        `git --version exited with code ${result.exitCode}`
      )
    }
    if (result.stderr.byteLength !== 0) {
      return yield* new TrialToolchainProcessError(
        "git",
        `git --version wrote ${result.stderr.byteLength} bytes to stderr`
      )
    }
    return yield* parseGitVersion(result.stdout)
  }
)

const discoverBubblewrapVersion = Effect.fn("TrialToolchain.discoverBubblewrapVersion")(
  function* (
    probes: TrialToolchainProbes,
    programRoot: string,
    path: string,
    bubblewrapExecutablePath: string
  ) {
    const request: TrialToolchainProcessRequest = {
      argv: [bubblewrapExecutablePath, "--version"],
      cwd: programRoot,
      closedEnvironment: fixedEnvironment(path),
      timeoutMilliseconds: TRIAL_TOOLCHAIN_GIT_TIMEOUT_MILLISECONDS,
      outputLimitBytes: TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES,
      shell: false
    }
    const runEffect = yield* Effect.try({
      try: () => probes.process.run(request),
      catch: (cause) => new TrialToolchainProcessError("bubblewrap", describeCause(cause))
    })
    const result = yield* runEffect.pipe(Effect.mapError((cause) =>
      new TrialToolchainProcessError("bubblewrap", describeCause(cause))))
    if (typeof result !== "object" || result === null ||
      !Number.isSafeInteger(result.exitCode) ||
      !(result.stdout instanceof Uint8Array) ||
      !(result.stderr instanceof Uint8Array)) {
      return yield* new TrialToolchainProcessError(
        "bubblewrap",
        "process probe returned a malformed result"
      )
    }
    if (result.stdout.byteLength > TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES ||
      result.stderr.byteLength > TRIAL_TOOLCHAIN_GIT_OUTPUT_LIMIT_BYTES) {
      return yield* new TrialToolchainProcessError("bubblewrap", "version output exceeded byte bound")
    }
    if (result.exitCode !== 0 || result.stderr.byteLength !== 0) {
      return yield* new TrialToolchainProcessError(
        "bubblewrap",
        `version probe exited ${result.exitCode} with ${result.stderr.byteLength} stderr bytes`
      )
    }
    let text: string
    try {
      text = textDecoder.decode(result.stdout)
    } catch (cause) {
      return yield* new TrialToolchainVersionError(
        "bubblewrap",
        "bubblewrap --version stdout",
        `must be UTF-8 (${describeCause(cause)})`
      )
    }
    const match = bubblewrapVersionPattern.exec(text)
    if (match === null) {
      return yield* new TrialToolchainVersionError(
        "bubblewrap",
        "bubblewrap --version stdout",
        "must exactly match `bubblewrap <major>.<minor>.<patch>` followed by LF"
      )
    }
    return match[1]!
  }
)

export const makeTrialToolchain = (
  probes: TrialToolchainProbes = liveProbes
): TrialToolchainService => {
  const discoverResolved = Effect.fn("TrialToolchain.discoverResolved")(function* (
    programRoot: string
  ) {
    const exactProgramRoot = yield* validateProgramRoot(programRoot)
    const bunVersionValue = yield* invokeRuntimeProbe("bunVersion", probes.runtime.bunVersion)
    const inheritedPathValue = yield* invokeRuntimeProbe("inheritedPath", probes.runtime.inheritedPath)
    const bun = yield* validatePackageVersion("bun", "running Bun runtime", bunVersionValue)
    const path = yield* validatePath(inheritedPathValue)
    const bunExecutableValue = yield* invokeRuntimeProbe(
      "bunExecutablePath",
      probes.runtime.bunExecutablePath
    )
    const gitExecutableValue = yield* invokeRuntimeProbe(
      "gitExecutablePath",
      () => probes.runtime.gitExecutablePath(path)
    )
    const bubblewrapExecutableValue = yield* invokeRuntimeProbe(
      "bubblewrapExecutablePath",
      probes.runtime.bubblewrapExecutablePath
    )
    const bunExecutable = yield* bindExecutable(probes, "bun", bunExecutableValue)
    const gitExecutable = yield* bindExecutable(probes, "git", gitExecutableValue)
    const bubblewrapExecutable = yield* bindExecutable(
      probes,
      "bubblewrap",
      bubblewrapExecutableValue,
      TRIAL_TOOLCHAIN_BUBBLEWRAP_EXECUTABLE
    )
    const typescriptPackage = yield* readInstalledPackageVersion(
      probes,
      exactProgramRoot,
      "typescript"
    )
    const effectPackage = yield* readInstalledPackageVersion(probes, exactProgramRoot, "effect")
    const git = yield* discoverGitVersion(
      probes,
      exactProgramRoot,
      path,
      gitExecutable.path
    )
    const bubblewrapVersion = yield* discoverBubblewrapVersion(
      probes,
      exactProgramRoot,
      path,
      bubblewrapExecutable.path
    )
    return {
      context: new TrialRunContextToolchain({
        bun,
        bunExecutableSha256: bunExecutable.sha256,
        typescript: typescriptPackage.version,
        effect: effectPackage.version,
        git,
        gitExecutableSha256: gitExecutable.sha256,
        bubblewrapVersion,
        bubblewrapExecutableSha256: bubblewrapExecutable.sha256
      }),
      bunExecutablePath: bunExecutable.path,
      gitExecutablePath: gitExecutable.path,
      bubblewrapExecutablePath: bubblewrapExecutable.path,
      packageManifests: {
        typescript: {
          path: typescriptPackage.path,
          sha256: typescriptPackage.sha256
        },
        effect: {
          path: effectPackage.path,
          sha256: effectPackage.sha256
        }
      }
    }
  })
  const discover = Effect.fn("TrialToolchain.discover")(function* (programRoot: string) {
    return (yield* discoverResolved(programRoot)).context
  })
  return { discover, discoverResolved }
}

export class TrialToolchain extends Context.Service<TrialToolchain, TrialToolchainService>()(
  "@ts-release/architecture-program/TrialToolchain"
) {
  static readonly layer = Layer.sync(TrialToolchain, () => makeTrialToolchain())
}

export const TrialToolchainLive = TrialToolchain.layer
