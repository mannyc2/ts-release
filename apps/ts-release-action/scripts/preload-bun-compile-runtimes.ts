import { createHash, randomUUID } from "node:crypto"
import {
  closeSync,
  constants,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync
} from "node:fs"
import { isAbsolute, join } from "node:path"
import { gunzipSync } from "node:zlib"

export interface BunCompileRuntimeSpec {
  readonly target: "bun-linux-arm64" | "bun-darwin-x64" | "bun-darwin-arm64"
  readonly cacheFile: string
  readonly sha256: string
  readonly size: number
  readonly archiveUrl: string
  readonly archiveSize: number
  readonly archiveIntegrity: `sha512-${string}`
  readonly tarSize: number
}

export const certifiedBunVersion = "1.3.14"

export const certifiedBunCompileRuntimes: ReadonlyArray<BunCompileRuntimeSpec> = [
  {
    target: "bun-linux-arm64",
    cacheFile: "bun-linux-aarch64-v1.3.14",
    sha256: "37141662ebed915a2ab89313156e455e2a1374395f5f6760d06407f49406f086",
    size: 91_801_560,
    archiveUrl: "https://registry.npmjs.org/@oven/bun-linux-aarch64/-/bun-linux-aarch64-1.3.14.tgz",
    archiveSize: 36_937_949,
    archiveIntegrity: "sha512-X5SsPZHs+iYO8R/efIcRtc7gT2Q2DgPfliCxEkx4cXBumwkw0c/EsHMNwH3EgGpCDaZ7IYVPhpCG/xBOQHEwZw==",
    tarSize: 91_805_184
  },
  {
    target: "bun-darwin-x64",
    cacheFile: "bun-darwin-x64-v1.3.14",
    sha256: "ea2f223e94bb2f4bf3050895113c3cf346438f6fa0501c8532284e063f72f7a0",
    size: 69_173_328,
    archiveUrl: "https://registry.npmjs.org/@oven/bun-darwin-x64/-/bun-darwin-x64-1.3.14.tgz",
    archiveSize: 26_809_751,
    archiveIntegrity: "sha512-FFj3QdU/OhlDyZOJ8CWfN5eWLpRlT4qjZg7lMQi7jA6GuoY5ajlO1zWLP/MuHYRSbXQUvV52RejNi8DVnAp13w==",
    tarSize: 69_177_344
  },
  {
    target: "bun-darwin-arm64",
    cacheFile: "bun-darwin-aarch64-v1.3.14",
    sha256: "e0c90ec15d33363e6b70713d56bc3b2c7585c17f40a0fe0f8fd9305901d4e233",
    size: 63_096_576,
    archiveUrl: "https://registry.npmjs.org/@oven/bun-darwin-aarch64/-/bun-darwin-aarch64-1.3.14.tgz",
    archiveSize: 24_310_637,
    archiveIntegrity: "sha512-Omj20SuiHBOUjUBIyqtkNjSUIjOtEOJwmbix/ZyFH4BaQ6OZTaaRWIR4TjHVz0yadHgli6lLTiAh1uarnvD49A==",
    tarSize: 63_100_416
  }
]

export type BunRuntimeFetch = (input: string, init: RequestInit) => Promise<Response>

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")
const sha512Integrity = (bytes: Uint8Array): string =>
  `sha512-${createHash("sha512").update(bytes).digest("base64")}`

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

const packagePlatform: Readonly<Record<BunCompileRuntimeSpec["target"], string>> = {
  "bun-linux-arm64": "linux-aarch64",
  "bun-darwin-x64": "darwin-x64",
  "bun-darwin-arm64": "darwin-aarch64"
}

const expectedCacheFile: Readonly<Record<BunCompileRuntimeSpec["target"], string>> = {
  "bun-linux-arm64": `bun-linux-aarch64-v${certifiedBunVersion}`,
  "bun-darwin-x64": `bun-darwin-x64-v${certifiedBunVersion}`,
  "bun-darwin-arm64": `bun-darwin-aarch64-v${certifiedBunVersion}`
}

const validateSpec = (runtime: BunCompileRuntimeSpec): void => {
  const platform = packagePlatform[runtime.target]
  const expectedUrl = `https://registry.npmjs.org/@oven/bun-${platform}/-/bun-${platform}-${certifiedBunVersion}.tgz`
  if (runtime.archiveUrl !== expectedUrl) {
    throw new Error(`Bun compile runtime ${runtime.target} has a non-canonical official archive URL.`)
  }
  if (runtime.cacheFile !== expectedCacheFile[runtime.target]) {
    throw new Error(`Bun compile runtime ${runtime.target} has a non-canonical cache filename.`)
  }
  if (!Number.isSafeInteger(runtime.archiveSize) || runtime.archiveSize <= 0 ||
      !Number.isSafeInteger(runtime.tarSize) || runtime.tarSize < runtime.size ||
      !Number.isSafeInteger(runtime.size) || runtime.size <= 0 ||
      !/^[a-f0-9]{64}$/u.test(runtime.sha256) ||
      !/^sha512-[A-Za-z0-9+/]{86}==$/u.test(runtime.archiveIntegrity)) {
    throw new Error(`Bun compile runtime ${runtime.target} has malformed pinned identity.`)
  }
}

const verifyRuntimePath = (path: string, runtime: BunCompileRuntimeSpec): void => {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isFile() || realpathSync(path) !== path) {
    throw new Error(`Bun compile runtime ${runtime.cacheFile} is not a canonical regular file.`)
  }
  if (stat.size !== runtime.size) {
    throw new Error(`Bun compile runtime ${runtime.cacheFile} has size ${stat.size}, expected ${runtime.size}.`)
  }
  const actual = sha256(readFileSync(path))
  if (actual !== runtime.sha256) {
    throw new Error(`Bun compile runtime ${runtime.cacheFile} has SHA-256 ${actual}, expected ${runtime.sha256}.`)
  }
}

export const verifyBunCompileRuntime = (
  cacheDirectory: string,
  runtime: BunCompileRuntimeSpec
): { readonly target: BunCompileRuntimeSpec["target"], readonly cacheFile: string, readonly sha256: string } => {
  validateSpec(runtime)
  const path = join(realpathSync(cacheDirectory), runtime.cacheFile)
  verifyRuntimePath(path, runtime)
  return { target: runtime.target, cacheFile: runtime.cacheFile, sha256: runtime.sha256 }
}

const readExactBody = async (
  response: Response,
  runtime: BunCompileRuntimeSpec,
  deadline: AbortSignal
): Promise<Uint8Array> => {
  if (response.body === null) throw new Error(`Bun compile runtime ${runtime.target} archive response has no body.`)
  const declaredLength = response.headers.get("content-length")
  if (declaredLength !== null && declaredLength !== String(runtime.archiveSize)) {
    throw new Error(`Bun compile runtime ${runtime.target} archive Content-Length is not the pinned size.`)
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  let removeAbortListener = (): void => {}
  const aborted = new Promise<never>((_resolve, reject) => {
    const onAbort = (): void => reject(new Error(`Bun compile runtime ${runtime.target} acquisition deadline exceeded.`))
    if (deadline.aborted) {
      onAbort()
    } else {
      deadline.addEventListener("abort", onAbort, { once: true })
      removeAbortListener = () => deadline.removeEventListener("abort", onAbort)
    }
  })
  try {
    while (true) {
      let done: boolean
      let value: Uint8Array | undefined
      try {
        const chunk = await Promise.race([reader.read(), aborted])
        done = chunk.done
        value = chunk.value
      } catch (cause) {
        void reader.cancel().catch(() => {})
        throw new Error(
          `Bun compile runtime ${runtime.target} archive response was lost before completion: ${cause instanceof Error ? cause.message : String(cause)}`
        )
      }
      if (done) break
      if (!(value instanceof Uint8Array)) {
        throw new Error(`Bun compile runtime ${runtime.target} archive returned a non-byte chunk.`)
      }
      length += value.byteLength
      if (length > runtime.archiveSize) {
        void reader.cancel().catch(() => {})
        throw new Error(`Bun compile runtime ${runtime.target} archive exceeds the pinned size.`)
      }
      chunks.push(value)
    }
  } finally {
    removeAbortListener()
  }
  if (length !== runtime.archiveSize) {
    throw new Error(`Bun compile runtime ${runtime.target} archive has size ${length}, expected ${runtime.archiveSize}.`)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

const tarFieldString = (field: Uint8Array, description: string): string => {
  const end = field.indexOf(0)
  const selected = end === -1 ? field : field.subarray(0, end)
  if (end !== -1 && !allZero(field.subarray(end))) {
    throw new Error(`Bun compile runtime archive ${description} has nonzero string padding.`)
  }
  if ([...selected].some((value) => value < 0x20 || value > 0x7e)) {
    throw new Error(`Bun compile runtime archive ${description} is not canonical ASCII.`)
  }
  return Buffer.from(selected).toString("ascii")
}

const tarFieldOctal = (field: Uint8Array, description: string): number => {
  if ([...field].some((value) => value !== 0 && value !== 0x20 && (value < 0x30 || value > 0x37))) {
    throw new Error(`Bun compile runtime archive ${description} has non-octal bytes.`)
  }
  const value = Buffer.from(field).toString("ascii").replace(/[\0 ]+$/u, "").trimStart()
  if (!/^[0-7]+$/u.test(value)) throw new Error(`Bun compile runtime archive ${description} is not canonical octal.`)
  const parsed = Number.parseInt(value, 8)
  if (!Number.isSafeInteger(parsed)) throw new Error(`Bun compile runtime archive ${description} is out of range.`)
  return parsed
}

const tarHeaderChecksum = (header: Uint8Array): number => {
  let checksum = 0
  for (let index = 0; index < header.byteLength; index += 1) {
    checksum += index >= 148 && index < 156 ? 0x20 : (header[index] ?? 0)
  }
  return checksum
}

const allZero = (bytes: Uint8Array): boolean => bytes.every((value) => value === 0)

const extractRuntimeFromTar = (archiveBytes: Uint8Array, runtime: BunCompileRuntimeSpec): Uint8Array => {
  let tarBytes: Uint8Array
  try {
    tarBytes = gunzipSync(archiveBytes, { maxOutputLength: runtime.tarSize })
  } catch (cause) {
    throw new Error(
      `Bun compile runtime ${runtime.target} archive decompression failed: ${cause instanceof Error ? cause.message : String(cause)}`
    )
  }
  if (tarBytes.byteLength !== runtime.tarSize || tarBytes.byteLength % 512 !== 0) {
    throw new Error(`Bun compile runtime ${runtime.target} tar size disagrees with its pinned identity.`)
  }
  const files = new Map<string, Uint8Array>()
  let offset = 0
  let terminated = false
  while (offset < tarBytes.byteLength) {
    const header = tarBytes.subarray(offset, offset + 512)
    if (header.byteLength !== 512) throw new Error(`Bun compile runtime ${runtime.target} tar header is truncated.`)
    if (allZero(header)) {
      const remainder = tarBytes.subarray(offset)
      if (remainder.byteLength < 1_024 || !allZero(remainder)) {
        throw new Error(`Bun compile runtime ${runtime.target} tar terminator is malformed.`)
      }
      terminated = true
      break
    }
    const checksum = tarFieldOctal(header.subarray(148, 156), "checksum")
    if (checksum !== tarHeaderChecksum(header)) {
      throw new Error(`Bun compile runtime ${runtime.target} tar header checksum is invalid.`)
    }
    const name = tarFieldString(header.subarray(0, 100), "path")
    const prefix = tarFieldString(header.subarray(345, 500), "path prefix")
    const path = prefix.length === 0 ? name : `${prefix}/${name}`
    const magic = tarFieldString(header.subarray(257, 263), "ustar magic")
    const version = tarFieldString(header.subarray(263, 265), "ustar version")
    if (magic !== "ustar" || version !== "00") {
      throw new Error(`Bun compile runtime ${runtime.target} tar header is not canonical ustar.`)
    }
    const type = header[156] ?? 0
    const linkName = tarFieldString(header.subarray(157, 257), "link target")
    if ((type !== 0 && type !== 0x30) || linkName.length !== 0) {
      throw new Error(`Bun compile runtime ${runtime.target} tar entry ${path} is not an unlinked regular file.`)
    }
    if (files.has(path)) throw new Error(`Bun compile runtime ${runtime.target} tar repeats entry ${path}.`)
    const size = tarFieldOctal(header.subarray(124, 136), "entry size")
    const dataStart = offset + 512
    const dataEnd = dataStart + size
    const next = dataStart + Math.ceil(size / 512) * 512
    if (!Number.isSafeInteger(dataEnd) || next > tarBytes.byteLength ||
        !allZero(tarBytes.subarray(dataEnd, next))) {
      throw new Error(`Bun compile runtime ${runtime.target} tar entry ${path} is truncated or has nonzero padding.`)
    }
    files.set(path, tarBytes.subarray(dataStart, dataEnd))
    offset = next
  }
  if (!terminated) throw new Error(`Bun compile runtime ${runtime.target} tar has no terminal zero blocks.`)
  const expectedFiles = ["package/README.md", "package/bin/bun", "package/package.json"]
  const actualFiles = [...files.keys()].sort()
  if (actualFiles.length !== expectedFiles.length || actualFiles.some((value, index) => value !== expectedFiles[index])) {
    throw new Error(`Bun compile runtime ${runtime.target} archive has an unexpected file set.`)
  }
  const executable = files.get("package/bin/bun")
  if (executable === undefined || executable.byteLength !== runtime.size || sha256(executable) !== runtime.sha256) {
    throw new Error(`Bun compile runtime ${runtime.target} archive executable disagrees with its pinned identity.`)
  }
  return executable
}

const downloadRuntime = async (
  runtime: BunCompileRuntimeSpec,
  runtimeFetch: BunRuntimeFetch,
  deadlineFactory: () => AbortSignal
): Promise<Uint8Array> => {
  const deadline = deadlineFactory()
  const response = await runtimeFetch(runtime.archiveUrl, {
    method: "GET",
    redirect: "manual",
    credentials: "omit",
    headers: {
      accept: "application/octet-stream",
      "accept-encoding": "identity"
    },
    signal: deadline
  }).catch((cause: unknown) => {
    throw new Error(
      `Bun compile runtime ${runtime.target} archive request failed: ${cause instanceof Error ? cause.message : String(cause)}`
    )
  })
  if (response.status !== 200 || response.redirected) {
    throw new Error(`Bun compile runtime ${runtime.target} archive returned status ${response.status}; redirects are forbidden.`)
  }
  if (response.headers.get("content-type") !== "application/octet-stream" ||
      response.headers.get("content-encoding") !== null) {
    throw new Error(`Bun compile runtime ${runtime.target} archive returned an unsupported representation.`)
  }
  const archiveBytes = await readExactBody(response, runtime, deadline)
  const actualIntegrity = sha512Integrity(archiveBytes)
  if (actualIntegrity !== runtime.archiveIntegrity) {
    throw new Error(
      `Bun compile runtime ${runtime.target} archive has integrity ${actualIntegrity}, expected ${runtime.archiveIntegrity}.`
    )
  }
  return extractRuntimeFromTar(archiveBytes, runtime)
}

const fsyncDirectory = (directory: string): void => {
  const descriptor = openSync(directory, constants.O_RDONLY)
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

const installRuntime = (cacheDirectory: string, runtime: BunCompileRuntimeSpec, bytes: Uint8Array): void => {
  const target = join(cacheDirectory, runtime.cacheFile)
  const temporary = join(cacheDirectory, `.ts-release-${runtime.cacheFile}-${randomUUID()}.tmp`)
  let descriptor: number | undefined
  try {
    descriptor = openSync(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o500
    )
    writeFileSync(descriptor, bytes)
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    verifyRuntimePath(temporary, runtime)
    try {
      linkSync(temporary, target)
    } catch (cause) {
      if (!(typeof cause === "object" && cause !== null && "code" in cause && cause.code === "EEXIST")) throw cause
      try {
        verifyRuntimePath(target, runtime)
      } catch (conflict) {
        throw new Error(
          `Bun compile runtime ${runtime.cacheFile} cache conflict: ${conflict instanceof Error ? conflict.message : String(conflict)}`
        )
      }
    }
    unlinkSync(temporary)
    fsyncDirectory(cacheDirectory)
    verifyRuntimePath(target, runtime)
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (pathPresent(temporary)) unlinkSync(temporary)
  }
}

export interface PreloadBunCompileRuntimesOptions {
  readonly cacheDirectory: string
  readonly bunVersion: string
  readonly runtimes?: ReadonlyArray<BunCompileRuntimeSpec>
  readonly fetch?: BunRuntimeFetch
  readonly deadline?: () => AbortSignal
}

export const preloadBunCompileRuntimes = async (
  options: PreloadBunCompileRuntimesOptions
): Promise<ReadonlyArray<{ readonly target: BunCompileRuntimeSpec["target"], readonly cacheFile: string, readonly sha256: string }>> => {
  if (options.bunVersion !== certifiedBunVersion) {
    throw new Error(`Bun compile runtime preload requires Bun ${certifiedBunVersion}, received ${options.bunVersion}.`)
  }
  const cacheDirectory = canonicalCache(options.cacheDirectory)
  const runtimes = options.runtimes ?? certifiedBunCompileRuntimes
  const runtimeFetch = options.fetch ?? fetch
  const deadline = options.deadline ?? (() => AbortSignal.timeout(120_000))
  const verified = []
  for (const runtime of runtimes) {
    validateSpec(runtime)
    const cached = join(cacheDirectory, runtime.cacheFile)
    if (!pathPresent(cached)) {
      const bytes = await downloadRuntime(runtime, runtimeFetch, deadline)
      installRuntime(cacheDirectory, runtime, bytes)
    }
    verified.push(verifyBunCompileRuntime(cacheDirectory, runtime))
  }
  return verified
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
  const runtimes = await preloadBunCompileRuntimes({
    cacheDirectory: selectedCache(),
    bunVersion
  })
  console.log(JSON.stringify({
    schemaVersion: "ts-release-bun-runtime-preload/v1",
    bunVersion,
    runtimes
  }))
}
