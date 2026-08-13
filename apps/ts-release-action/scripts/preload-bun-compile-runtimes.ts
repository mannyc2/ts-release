import { createHash } from "node:crypto"
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { isAbsolute, join } from "node:path"
import { spawnSync } from "node:child_process"

export interface BunCompileRuntimeSpec {
  readonly target: "bun-linux-arm64" | "bun-darwin-x64" | "bun-darwin-arm64"
  readonly cacheFile: string
  readonly sha256: string
}

export const certifiedBunVersion = "1.3.14"

export const certifiedBunCompileRuntimes: ReadonlyArray<BunCompileRuntimeSpec> = [
  {
    target: "bun-linux-arm64",
    cacheFile: "bun-linux-aarch64-v1.3.14",
    sha256: "37141662ebed915a2ab89313156e455e2a1374395f5f6760d06407f49406f086"
  },
  {
    target: "bun-darwin-x64",
    cacheFile: "bun-darwin-x64-v1.3.14",
    sha256: "ea2f223e94bb2f4bf3050895113c3cf346438f6fa0501c8532284e063f72f7a0"
  },
  {
    target: "bun-darwin-arm64",
    cacheFile: "bun-darwin-aarch64-v1.3.14",
    sha256: "e0c90ec15d33363e6b70713d56bc3b2c7585c17f40a0fe0f8fd9305901d4e233"
  }
]

export interface BunRuntimeSpawnInput {
  readonly executable: string
  readonly argv: ReadonlyArray<string>
  readonly environment: Readonly<Record<string, string>>
}

export type BunRuntimeSpawn = (input: BunRuntimeSpawnInput) => number

const defaultSpawn: BunRuntimeSpawn = ({ executable, argv, environment }) => {
  const result = spawnSync(executable, [...argv], {
    env: { ...environment },
    stdio: "inherit"
  })
  if (result.error !== undefined) throw result.error
  return result.status ?? -1
}

const digest = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex")

const pathPresent = (path: string): boolean => {
  try {
    lstatSync(path)
    return true
  } catch (cause) {
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT") return false
    throw cause
  }
}

const canonicalCache = (value: string): string => {
  if (!isAbsolute(value)) throw new Error("Bun compile runtime cache path must be absolute.")
  mkdirSync(value, { recursive: true, mode: 0o700 })
  const canonical = realpathSync(value)
  if (!lstatSync(canonical).isDirectory()) throw new Error("Bun compile runtime cache must be a real directory.")
  return canonical
}

export const verifyBunCompileRuntime = (
  cacheDirectory: string,
  runtime: BunCompileRuntimeSpec
): { readonly target: BunCompileRuntimeSpec["target"], readonly cacheFile: string, readonly sha256: string } => {
  const path = join(cacheDirectory, runtime.cacheFile)
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isFile() || realpathSync(path) !== path) {
    throw new Error(`Bun compile runtime ${runtime.cacheFile} is not a canonical regular file.`)
  }
  const actual = digest(path)
  if (actual !== runtime.sha256) {
    throw new Error(`Bun compile runtime ${runtime.cacheFile} has SHA-256 ${actual}, expected ${runtime.sha256}.`)
  }
  return { target: runtime.target, cacheFile: runtime.cacheFile, sha256: actual }
}

export interface PreloadBunCompileRuntimesOptions {
  readonly cacheDirectory: string
  readonly bunExecutable: string
  readonly bunVersion: string
  readonly runtimes?: ReadonlyArray<BunCompileRuntimeSpec>
  readonly spawn?: BunRuntimeSpawn
}

export const preloadBunCompileRuntimes = (
  options: PreloadBunCompileRuntimesOptions
): ReadonlyArray<{ readonly target: BunCompileRuntimeSpec["target"], readonly cacheFile: string, readonly sha256: string }> => {
  if (options.bunVersion !== certifiedBunVersion) {
    throw new Error(`Bun compile runtime preload requires Bun ${certifiedBunVersion}, received ${options.bunVersion}.`)
  }
  const cacheDirectory = canonicalCache(options.cacheDirectory)
  const runtimes = options.runtimes ?? certifiedBunCompileRuntimes
  const spawn = options.spawn ?? defaultSpawn
  const temporary = mkdtempSync(join(tmpdir(), "ts-release-bun-runtime-preload-"))
  try {
    const entry = join(temporary, "entry.ts")
    writeFileSync(entry, "process.stdout.write(\"ts-release compile runtime preload\\n\")\n", { mode: 0o600, flag: "wx" })
    return runtimes.map((runtime) => {
      const cached = join(cacheDirectory, runtime.cacheFile)
      if (!pathPresent(cached)) {
        const output = join(temporary, runtime.target)
        const exitCode = spawn({
          executable: options.bunExecutable,
          argv: [
            "--no-env-file", "--no-install", "build", entry, "--compile",
            "--target", runtime.target, "--outfile", output
          ],
          environment: {
            PATH: process.env.PATH ?? "",
            BUN_INSTALL_CACHE_DIR: cacheDirectory,
            TZ: "UTC",
            LC_ALL: "C",
            LANG: "C",
            SOURCE_DATE_EPOCH: "0"
          }
        })
        if (exitCode !== 0) {
          throw new Error(`Bun compile runtime preload for ${runtime.target} exited ${exitCode}.`)
        }
      }
      return verifyBunCompileRuntime(cacheDirectory, runtime)
    })
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

const selectedCache = (): string => {
  const configured = process.env.BUN_INSTALL_CACHE_DIR?.trim()
  if (configured !== undefined && configured.length > 0) return configured
  const home = process.env.HOME?.trim()
  if (home === undefined || home.length === 0) {
    throw new Error("Bun compile runtime preload requires BUN_INSTALL_CACHE_DIR or HOME.")
  }
  return join(home, ".bun", "install", "cache")
}

if (import.meta.main) {
  const bunVersion = process.versions.bun
  if (bunVersion === undefined) throw new Error("Bun compile runtime preload must execute under Bun.")
  const runtimes = preloadBunCompileRuntimes({
    cacheDirectory: selectedCache(),
    bunExecutable: process.execPath,
    bunVersion
  })
  console.log(JSON.stringify({
    schemaVersion: "ts-release-bun-runtime-preload/v1",
    bunVersion,
    runtimes
  }))
}
