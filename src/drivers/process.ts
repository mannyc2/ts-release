import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { createHash } from "node:crypto"
import {
  accessSync,
  chmodSync,
  constants,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, isAbsolute, join, resolve } from "node:path"
import { readEnvironment, readOptionalEnv } from "./environment.js"
import { redactOutput } from "./redact.js"
import { networkIsolationHelperSource } from "./seccomp-helper-source.js"
import { failure } from "./utils.js"
import { DriverError } from "./errors.js"

export interface NetworkIsolationIdentity {
  readonly protocol: "ts-release-seccomp-network-deny/v1"
  readonly helperSha256: string
  readonly librarySha256: string
  readonly bunVersion: string
  readonly bunSha256: string
  readonly kernel: string
  readonly architecture: string
  readonly deniedSyscalls: ReadonlyArray<string>
}

export interface ExecutableIdentity {
  readonly protocol: "ts-release-executable/v1"
  readonly command: string
  readonly sha256: string
}

export interface BunCompileRuntimeIdentity {
  readonly protocol: "ts-release-bun-compile-runtime/v1"
  readonly target: "bun-linux-x64" | "bun-linux-arm64" | "bun-darwin-x64" | "bun-darwin-arm64"
  readonly bunVersion: string
  readonly source: "executing-bun" | "host-cache-private-copy"
  readonly cacheFile: string
  readonly sha256: string
}

const helperDigest = createHash("sha256").update(networkIsolationHelperSource).digest("hex")

export type CommandOutcome = {
  readonly exitCode: number, readonly stdout: string, readonly stderr: string,
  /** Present for the production process driver; protocol doubles may omit it. */
  readonly tool?: ExecutableIdentity,
  readonly networkIsolation?: NetworkIsolationIdentity,
  readonly bunCompileRuntime?: BunCompileRuntimeIdentity
}
export type RunCommand = (command: {
  readonly argv: ReadonlyArray<string>, readonly cwd: string,
  readonly environmentNames: ReadonlyArray<string>,
  /** Generic commands require the fail-closed Linux/libseccomp filter;
   * certified local-only tools additionally carry their own offline switch. */
  readonly network: "deny" | "offline-cli"
}) => Effect.Effect<CommandOutcome, DriverError>

const collect = (stream: Stream.Stream<Uint8Array, unknown>) =>
  Stream.mkString(Stream.decodeText(stream))

const executableIdentity = (command: string, cwd: string, path: string | undefined): ExecutableIdentity => {
  const candidates = command.includes("/")
    ? [isAbsolute(command) ? command : resolve(cwd, command)]
    : (path ?? "").split(delimiter).filter((entry) => entry.length > 0).map((entry) => resolve(entry, command))
  const executable = candidates.find((candidate) => {
    try {
      accessSync(candidate, constants.X_OK)
      return statSync(candidate).isFile()
    } catch {
      return false
    }
  })
  if (executable === undefined) throw new Error(`Executable ${command} is unavailable in the closed PATH.`)
  const canonical = realpathSync(executable)
  return {
    protocol: "ts-release-executable/v1",
    command,
    sha256: createHash("sha256").update(readFileSync(canonical)).digest("hex")
  }
}

const isDigest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
const offlineBunInstallArgv = [
  "bun",
  "install",
  "--offline",
  "--frozen-lockfile",
  "--ignore-scripts",
  "--no-save",
  "--linker=hoisted"
] as const
const isOfflineBunInstall = (command: Parameters<RunCommand>[0]): boolean =>
  command.network === "offline-cli" && command.argv.length === offlineBunInstallArgv.length &&
  command.argv.every((value, index) => value === offlineBunInstallArgv[index])

const readBunCacheDirectory = Effect.fn("readBunCacheDirectory")(function*() {
  const configured = yield* readOptionalEnv("BUN_INSTALL_CACHE_DIR")
  const home = configured === undefined ? yield* readOptionalEnv("HOME") : undefined
  const candidate = configured ?? (home === undefined ? undefined : join(home, ".bun", "install", "cache"))
  if (candidate === undefined || candidate.length === 0) {
    return yield* Effect.fail(failure(
      "Certified Bun cache access requires BUN_INSTALL_CACHE_DIR or HOME so the host cache can be located."
    ))
  }
  return yield* Effect.try({
    try: () => {
      if (!isAbsolute(candidate)) throw new Error("the cache path is not absolute")
      const canonical = realpathSync(candidate)
      if (!statSync(canonical).isDirectory()) throw new Error("the cache path is not a directory")
      return canonical
    },
    catch: (cause) => failure(`The offline Bun install cache is unavailable: ${String(cause)}`)
  })
})

const compileRuntimeFiles = {
  "bun-linux-arm64": (version: string) => `bun-linux-aarch64-v${version}`,
  "bun-darwin-x64": (version: string) => `bun-darwin-x64-v${version}`,
  "bun-darwin-arm64": (version: string) => `bun-darwin-aarch64-v${version}`
} as const

type CertifiedBunCompileTarget = BunCompileRuntimeIdentity["target"]
const certifiedBunCompileTargets = new Set<CertifiedBunCompileTarget>([
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-darwin-x64",
  "bun-darwin-arm64"
])

const certifiedBunCompileTarget = (command: Parameters<RunCommand>[0]): CertifiedBunCompileTarget | undefined => {
  const argv = command.argv
  if (command.network !== "deny" || (argv.length !== 8 && argv.length !== 9) ||
      argv[0] !== "bun" || argv[1] !== "build" || argv[2]?.startsWith("-") !== false ||
      argv[3] !== "--compile" || argv[4] !== "--target" || argv[6] !== "--outfile" ||
      argv[7]?.startsWith("-") !== false || (argv.length === 9 && argv[8] !== "--minify")) return undefined
  return certifiedBunCompileTargets.has(argv[5] as CertifiedBunCompileTarget)
    ? argv[5] as CertifiedBunCompileTarget
    : undefined
}

const resolveBunCompileRuntime = Effect.fn("resolveBunCompileRuntime")(function*(
  target: CertifiedBunCompileTarget,
  tool: ExecutableIdentity
) {
  const bunVersion = process.versions.bun
  if (bunVersion === undefined || bunVersion.length === 0) {
    return yield* Effect.fail(failure("Certified Bun compilation requires a Bun parent runtime."))
  }
  if (target === "bun-linux-x64") {
    return {
      sourcePath: undefined,
      identity: {
        protocol: "ts-release-bun-compile-runtime/v1",
        target,
        bunVersion,
        source: "executing-bun",
        cacheFile: "executing-bun",
        sha256: tool.sha256
      } satisfies BunCompileRuntimeIdentity
    }
  }
  const cache = yield* readBunCacheDirectory()
  const cacheFile = compileRuntimeFiles[target](bunVersion)
  return yield* Effect.try({
    try: () => {
      const sourcePath = join(cache, cacheFile)
      if (lstatSync(sourcePath).isSymbolicLink() || !lstatSync(sourcePath).isFile() ||
          realpathSync(sourcePath) !== sourcePath) {
        throw new Error("the target runtime is not a canonical regular file")
      }
      return {
        sourcePath,
        identity: {
          protocol: "ts-release-bun-compile-runtime/v1",
          target,
          bunVersion,
          source: "host-cache-private-copy",
          cacheFile,
          sha256: createHash("sha256").update(readFileSync(sourcePath)).digest("hex")
        } satisfies BunCompileRuntimeIdentity
      }
    },
    catch: (cause) => failure(`The certified Bun compile runtime is unavailable: ${String(cause)}`)
  })
})

const parseIsolationIdentity = (path: string): NetworkIsolationIdentity => {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("isolation identity is not an object")
  const item = value as Record<string, unknown>
  if (item.protocol !== "ts-release-seccomp-network-deny/v1" || item.helperSha256 !== helperDigest ||
      !isDigest(item.helperSha256) || !isDigest(item.librarySha256) || !isDigest(item.bunSha256) ||
      typeof item.bunVersion !== "string" || item.bunVersion.length === 0 || typeof item.kernel !== "string" ||
      item.kernel.length === 0 || typeof item.architecture !== "string" || item.architecture.length === 0 ||
      !Array.isArray(item.deniedSyscalls) || item.deniedSyscalls.some((name) => typeof name !== "string")) {
    throw new Error("isolation identity is malformed or disagrees with the embedded helper")
  }
  return item as unknown as NetworkIsolationIdentity
}

// Spawning is the capability that differs across hosts, so it arrives as a
// service. The runner is built once per live layer and closes over the
// spawner, keeping DriverCatalog method requirements at never.
export const makeRunCommand: Effect.Effect<RunCommand, never, ChildProcessSpawner> =
  Effect.gen(function*() {
    const spawner = yield* ChildProcessSpawner
    return (command) => Effect.gen(function*() {
      const baseEnvironment = yield* readEnvironment(command.environmentNames)
      const env = isOfflineBunInstall(command)
        ? {
          ...Object.fromEntries(Object.entries(baseEnvironment).filter(([name]) => name !== "HOME")),
          BUN_INSTALL_CACHE_DIR: yield* readBunCacheDirectory()
        }
        : baseEnvironment
      const executable = command.network === "deny" ? "bun" : command.argv[0]!
      const tool = yield* Effect.try({
        try: () => executableIdentity(executable, command.cwd, env.PATH),
        catch: (cause) => failure(String(cause))
      })
      const compileTarget = certifiedBunCompileTarget(command)
      const compileRuntime = compileTarget === undefined
        ? undefined
        : yield* resolveBunCompileRuntime(compileTarget, tool)
      const compileResources = compileRuntime === undefined
        ? undefined
        : yield* Effect.acquireRelease(
          Effect.sync(() => {
            const directory = mkdtempSync(join(tmpdir(), "ts-release-bun-runtime-"))
            const cache = join(directory, "cache")
            mkdirSync(cache, { mode: 0o700 })
            if (compileRuntime.sourcePath !== undefined) {
              copyFileSync(compileRuntime.sourcePath, join(cache, compileRuntime.identity.cacheFile))
              chmodSync(join(cache, compileRuntime.identity.cacheFile), 0o500)
            }
            chmodSync(cache, 0o500)
            return { directory, cache }
          }),
          ({ cache, directory }) => Effect.sync(() => {
            chmodSync(cache, 0o700)
            rmSync(directory, { recursive: true, force: true })
          })
        )
      const isolationResources = command.network === "deny"
        ? yield* Effect.acquireRelease(
          Effect.sync(() => {
            const directory = mkdtempSync(join(tmpdir(), "ts-release-seccomp-"))
            const helper = join(directory, "network-deny.mjs")
            const identity = join(directory, "identity.json")
            writeFileSync(helper, networkIsolationHelperSource, { mode: 0o500 })
            return { directory, helper, identity }
          }),
          ({ directory }) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
        )
        : undefined
      const argv = command.network === "deny"
        ? ["--no-env-file", "--no-install", isolationResources!.helper, ...command.argv]
        : [...command.argv.slice(1)]
      const commandEnvironment = compileResources === undefined
        ? env
        : { ...env, BUN_INSTALL_CACHE_DIR: compileResources.cache }
      const handle = yield* spawner.spawn(ChildProcess.make(
        executable,
        argv,
        {
          cwd: command.cwd,
          env: isolationResources === undefined ? commandEnvironment : {
            ...commandEnvironment,
            TS_RELEASE_NETWORK_IDENTITY_FILE: isolationResources.identity,
            TS_RELEASE_NETWORK_HELPER_SHA256: helperDigest,
            TS_RELEASE_NETWORK_LIBRARY: "libseccomp.so.2"
          },
          stdin: "ignore", stdout: "pipe", stderr: "pipe"
        }
      ))
      const output = yield* Effect.all({
        stdout: collect(handle.stdout),
        stderr: collect(handle.stderr),
        exitCode: handle.exitCode
      }, { concurrency: "unbounded" })
      // Redaction lives here, where the env values are in hand: every
      // consumer of child output (Exec failures, publisher stdout/stderr)
      // is covered at the source and no driver can forget.
      const networkIsolation = isolationResources === undefined
        ? undefined
        : yield* Effect.try({
          try: () => parseIsolationIdentity(isolationResources.identity),
          catch: (cause) => failure(String(cause))
        })
      if (networkIsolation !== undefined && networkIsolation.bunSha256 !== tool.sha256) {
        return yield* Effect.fail(failure("The Bun executable changed between parent resolution and the isolation helper."))
      }
      if (compileResources !== undefined && compileRuntime !== undefined) yield* Effect.try({
        try: () => {
          const entries = readdirSync(compileResources.cache)
          const expected = compileRuntime.sourcePath === undefined ? [] : [compileRuntime.identity.cacheFile]
          if (entries.length !== expected.length || entries.some((entry, index) => entry !== expected[index])) {
            throw new Error("the private runtime cache changed shape")
          }
          if (expected[0] !== undefined) {
            const runtime = join(compileResources.cache, expected[0])
            if (lstatSync(runtime).isSymbolicLink() || !lstatSync(runtime).isFile() ||
                createHash("sha256").update(readFileSync(runtime)).digest("hex") !== compileRuntime.identity.sha256) {
              throw new Error("the private runtime cache changed bytes or type")
            }
          }
        },
        catch: (cause) => failure(`Certified Bun compilation did not preserve its private runtime cache: ${String(cause)}`)
      })
      return {
        stdout: redactOutput(output.stdout, commandEnvironment),
        stderr: redactOutput(output.stderr, commandEnvironment),
        exitCode: Number(output.exitCode),
        tool,
        ...(networkIsolation === undefined ? {} : { networkIsolation }),
        ...(compileRuntime === undefined ? {} : { bunCompileRuntime: compileRuntime.identity })
      }
    }).pipe(
      Effect.scoped,
      Effect.mapError((cause) => cause instanceof DriverError ? cause : failure(String(cause)))
    )
  })
