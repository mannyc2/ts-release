import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { lstatSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { gzipSync, gunzipSync } from "node:zlib"
import {
  certifiedBunCompileRuntimes,
  certifiedBunVersion,
  preloadBunCompileRuntimes,
  verifyBunCompileRuntime,
  type BunCompileRuntimeSpec,
  type BunRuntimeFetch
} from "../apps/ts-release-action/scripts/preload-bun-compile-runtimes.js"

const bytes = Buffer.from("certified runtime fixture")
const archiveBytes = await new Bun.Archive({
  "package/README.md": "fixture\n",
  "package/bin/bun": bytes,
  "package/package.json": JSON.stringify({ name: "@oven/bun-linux-aarch64", version: certifiedBunVersion })
}, { compress: "gzip" }).bytes()

const runtime: BunCompileRuntimeSpec = {
  target: "bun-linux-arm64",
  cacheFile: `bun-linux-aarch64-v${certifiedBunVersion}`,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  size: bytes.byteLength,
  archiveUrl: `https://registry.npmjs.org/@oven/bun-linux-aarch64/-/bun-linux-aarch64-${certifiedBunVersion}.tgz`,
  archiveSize: archiveBytes.byteLength,
  archiveIntegrity: `sha512-${createHash("sha512").update(archiveBytes).digest("base64")}`,
  tarSize: gunzipSync(archiveBytes).byteLength
}

const verified = {
  target: runtime.target,
  cacheFile: runtime.cacheFile,
  sha256: runtime.sha256
}

const cache = (): string => mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-runtime-cache-"))

const response = (body: BodyInit | Uint8Array, contentLength = runtime.archiveSize): Response => new Response(body as BodyInit, {
  status: 200,
  headers: {
    "content-length": String(contentLength),
    "content-type": "application/octet-stream"
  }
})

const exactFetch = (
  body: Uint8Array = archiveBytes,
  beforeResponse?: () => void,
  onCall?: () => void
): BunRuntimeFetch => (async (input, init) => {
  onCall?.()
  expect(String(input)).toBe(runtime.archiveUrl)
  expect(init?.method).toBe("GET")
  expect(init?.redirect).toBe("manual")
  expect(init?.credentials).toBe("omit")
  expect(new Headers(init?.headers)).toEqual(new Headers({
    accept: "application/octet-stream",
    "accept-encoding": "identity"
  }))
  expect(init?.signal).toBeInstanceOf(AbortSignal)
  beforeResponse?.()
  return response(body)
}) as BunRuntimeFetch

const archiveRuntime = (archive: Uint8Array): BunCompileRuntimeSpec => ({
  ...runtime,
  archiveSize: archive.byteLength,
  archiveIntegrity: `sha512-${createHash("sha512").update(archive).digest("base64")}`,
  tarSize: gunzipSync(archive).byteLength
})

const tarNameAt = (tar: Uint8Array, offset: number): string =>
  Buffer.from(tar.subarray(offset, offset + 100)).toString("ascii").replace(/\0.*$/u, "")

const tarHeaderOffset = (tar: Uint8Array, name: string): number => {
  for (let offset = 0; offset < tar.byteLength; offset += 512) {
    if (tarNameAt(tar, offset) === name) return offset
  }
  throw new Error(`fixture tar header ${name} was not found`)
}

const tarTerminatorOffset = (tar: Uint8Array): number => {
  for (let offset = 0; offset < tar.byteLength; offset += 512) {
    if (tar.subarray(offset, offset + 512).every((value) => value === 0)) return offset
  }
  throw new Error("fixture tar terminator was not found")
}

const rewriteTarChecksum = (tar: Buffer, offset: number): void => {
  tar.fill(0x20, offset + 148, offset + 156)
  let checksum = 0
  for (let index = 0; index < 512; index += 1) checksum += tar[offset + index] ?? 0
  tar.write(checksum.toString(8).padStart(6, "0"), offset + 148, 6, "ascii")
  tar[offset + 154] = 0
  tar[offset + 155] = 0x20
}

const rewriteTarName = (tar: Buffer, offset: number, name: string): void => {
  if (Buffer.byteLength(name, "ascii") > 100) throw new Error("fixture tar name is too long")
  tar.fill(0, offset, offset + 100)
  tar.write(name, offset, "ascii")
  rewriteTarChecksum(tar, offset)
}

const archiveWithTarMutation = (mutate: (tar: Buffer) => Uint8Array | void): Uint8Array => {
  const tar = Buffer.from(gunzipSync(archiveBytes))
  return gzipSync(mutate(tar) ?? tar)
}

const archiveWithExecutableType = (type: number): Uint8Array => {
  return archiveWithTarMutation((tar) => {
    const offset = tarHeaderOffset(tar, "package/bin/bun")
    tar[offset + 156] = type
    rewriteTarChecksum(tar, offset)
  })
}

test("certified Bun compile runtime coordinates are an exact ordered full tuple", () => {
  expect(certifiedBunCompileRuntimes).toEqual([
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
  ])
})

test("default and explicit certified sets request only their exact canonical archive URLs", async () => {
  const explicitUrls: string[] = []
  for (const certified of certifiedBunCompileRuntimes) {
    await expect(preloadBunCompileRuntimes({
      cacheDirectory: cache(),
      bunVersion: certifiedBunVersion,
      runtimes: [certified],
      fetch: (async (input, init) => {
        explicitUrls.push(String(input))
        expect(init.redirect).toBe("manual")
        expect(init.credentials).toBe("omit")
        throw new Error("fixture stop before response")
      }) as BunRuntimeFetch
    })).rejects.toThrow("fixture stop before response")
  }
  expect(explicitUrls).toEqual(certifiedBunCompileRuntimes.map(({ archiveUrl }) => archiveUrl))

  const defaultUrls: string[] = []
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: cache(),
    bunVersion: certifiedBunVersion,
    fetch: (async (input) => {
      defaultUrls.push(String(input))
      throw new Error("fixture stop at first default coordinate")
    }) as BunRuntimeFetch
  })).rejects.toThrow("fixture stop at first default coordinate")
  expect(defaultUrls).toEqual([
    "https://registry.npmjs.org/@oven/bun-linux-aarch64/-/bun-linux-aarch64-1.3.14.tgz"
  ])
})

test("runtime preload downloads exact official archive bytes once and then only verifies the atomic cache file", async () => {
  const directory = cache()
  let calls = 0
  const runtimeFetch = exactFetch(archiveBytes, undefined, () => { calls += 1 })
  const options = {
    cacheDirectory: directory,
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    fetch: runtimeFetch
  }
  expect(await preloadBunCompileRuntimes(options)).toEqual([verified])
  expect(await preloadBunCompileRuntimes(options)).toEqual([verified])
  expect(calls).toBe(1)
  expect(readFileSync(join(directory, runtime.cacheFile))).toEqual(bytes)
  expect(lstatSync(join(directory, runtime.cacheFile)).mode & 0o777).toBe(0o500)
  expect(readdirSync(directory)).toEqual([runtime.cacheFile])
})

test("runtime preload rejects a same-size archive with the wrong pinned digest without leaving a cache file", async () => {
  const directory = cache()
  const wrong = new Uint8Array(archiveBytes)
  wrong[wrong.byteLength - 1] = (wrong[wrong.byteLength - 1] ?? 0) ^ 1
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: directory,
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    fetch: exactFetch(wrong)
  })).rejects.toThrow("archive has integrity")
  expect(readdirSync(directory)).toEqual([])
})

test("runtime preload rejects truncated and overlong responses before archive admission", async () => {
  for (const body of [archiveBytes.subarray(0, archiveBytes.byteLength - 1), new Uint8Array(archiveBytes.byteLength + 1)]) {
    const directory = cache()
    await expect(preloadBunCompileRuntimes({
      cacheDirectory: directory,
      bunVersion: certifiedBunVersion,
      runtimes: [runtime],
      fetch: (async () => response(body, runtime.archiveSize)) as BunRuntimeFetch
    })).rejects.toThrow(body.byteLength < runtime.archiveSize ? "archive has size" : "archive exceeds the pinned size")
    expect(readdirSync(directory)).toEqual([])
  }
})

test("runtime preload reports request loss and mid-body response loss without a partial cache file", async () => {
  const requestLoss = cache()
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: requestLoss,
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    fetch: (async () => { throw new Error("connection lost") }) as BunRuntimeFetch
  })).rejects.toThrow("archive request failed: connection lost")
  expect(readdirSync(requestLoss)).toEqual([])

  const responseLoss = cache()
  const lostBody = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(archiveBytes.subarray(0, 8))
      controller.error(new Error("socket reset"))
    }
  })
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: responseLoss,
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    fetch: (async () => response(lostBody)) as BunRuntimeFetch
  })).rejects.toThrow("archive response was lost before completion")
  expect(readdirSync(responseLoss)).toEqual([])
})

test("runtime preload applies one acquisition deadline to a stalled response body", async () => {
  const directory = cache()
  const controller = new AbortController()
  const stalled = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) })
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: directory,
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    deadline: () => controller.signal,
    fetch: (async (_input, init) => {
      expect(init.signal).toBe(controller.signal)
      queueMicrotask(() => controller.abort(new Error("fixture deadline")))
      return response(stalled)
    }) as BunRuntimeFetch
  })).rejects.toThrow("acquisition deadline exceeded")
  expect(readdirSync(directory)).toEqual([])
})

test("runtime preload supplies the acquisition deadline to a stalled request before response headers", async () => {
  const directory = cache()
  const controller = new AbortController()
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: directory,
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    deadline: () => controller.signal,
    fetch: ((_input, init) => new Promise<Response>((_resolve, reject) => {
      expect(init.signal).toBe(controller.signal)
      init.signal?.addEventListener("abort", () => reject(new Error("fixture header deadline")), { once: true })
      queueMicrotask(() => controller.abort(new Error("fixture header deadline")))
    })) as BunRuntimeFetch
  })).rejects.toThrow("archive request failed: fixture header deadline")
  expect(readdirSync(directory)).toEqual([])
})

test("runtime preload rejects exact executable paths encoded as links or special entries", async () => {
  for (const type of [0x31, 0x32, 0x33]) {
    const directory = cache()
    const hostileArchive = archiveWithExecutableType(type)
    const hostileRuntime = archiveRuntime(hostileArchive)
    await expect(preloadBunCompileRuntimes({
      cacheDirectory: directory,
      bunVersion: certifiedBunVersion,
      runtimes: [hostileRuntime],
      fetch: (async () => response(hostileArchive, hostileArchive.byteLength)) as BunRuntimeFetch
    })).rejects.toThrow("is not an unlinked regular file")
    expect(readdirSync(directory)).toEqual([])
  }
})

test("runtime preload strictly rejects malformed tar structure and metadata", async () => {
  const cases: ReadonlyArray<{
    readonly name: string
    readonly archive: () => Uint8Array
    readonly message: string
  }> = [
    {
      name: "malformed terminal blocks",
      archive: () => archiveWithTarMutation((tar) => {
        const terminator = tarTerminatorOffset(tar)
        tar[terminator + 512] = 1
      }),
      message: "tar terminator is malformed"
    },
    {
      name: "invalid header checksum",
      archive: () => archiveWithTarMutation((tar) => {
        const offset = tarHeaderOffset(tar, "package/README.md")
        tar[offset] = (tar[offset] ?? 0) ^ 1
      }),
      message: "tar header checksum is invalid"
    },
    {
      name: "invalid ustar identity",
      archive: () => archiveWithTarMutation((tar) => {
        const offset = tarHeaderOffset(tar, "package/README.md")
        tar[offset + 257] = 0x78
        rewriteTarChecksum(tar, offset)
      }),
      message: "tar header is not canonical ustar"
    },
    {
      name: "duplicate member",
      archive: () => archiveWithTarMutation((tar) => {
        rewriteTarName(tar, tarHeaderOffset(tar, "package/README.md"), "package/package.json")
      }),
      message: "tar repeats entry package/package.json"
    },
    {
      name: "unexpected member",
      archive: () => archiveWithTarMutation((tar) => {
        rewriteTarName(tar, tarHeaderOffset(tar, "package/README.md"), "package/NOTICE.txt")
      }),
      message: "archive has an unexpected file set"
    },
    {
      name: "truncated entry data",
      archive: () => archiveWithTarMutation((tar) =>
        tar.subarray(0, tarHeaderOffset(tar, "package/bin/bun") + 512)),
      message: "is truncated or has nonzero padding"
    },
    {
      name: "nonzero entry padding",
      archive: () => archiveWithTarMutation((tar) => {
        const offset = tarHeaderOffset(tar, "package/README.md")
        const size = Number.parseInt(Buffer.from(tar.subarray(offset + 124, offset + 136))
          .toString("ascii").replace(/[\0 ]+$/u, ""), 8)
        tar[offset + 512 + size] = 1
      }),
      message: "is truncated or has nonzero padding"
    }
  ]

  for (const fixture of cases) {
    const directory = cache()
    const hostileArchive = fixture.archive()
    const hostileRuntime = archiveRuntime(hostileArchive)
    await expect(preloadBunCompileRuntimes({
      cacheDirectory: directory,
      bunVersion: certifiedBunVersion,
      runtimes: [hostileRuntime],
      fetch: (async () => response(hostileArchive, hostileArchive.byteLength)) as BunRuntimeFetch
    }), fixture.name).rejects.toThrow(fixture.message)
    expect(readdirSync(directory), fixture.name).toEqual([])
  }
})

test("runtime preload never overwrites a partial, linked, or conflicting cache entry", async () => {
  const partial = cache()
  const partialPath = join(partial, runtime.cacheFile)
  writeFileSync(partialPath, bytes.subarray(0, 4))
  let partialFetches = 0
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: partial,
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    fetch: exactFetch(archiveBytes, undefined, () => { partialFetches += 1 })
  })).rejects.toThrow("has size")
  expect(partialFetches).toBe(0)
  expect(readFileSync(partialPath)).toEqual(bytes.subarray(0, 4))

  const linked = cache()
  const external = join(cache(), "runtime")
  writeFileSync(external, bytes)
  symlinkSync(external, join(linked, runtime.cacheFile))
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: linked,
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    fetch: exactFetch()
  })).rejects.toThrow("not a canonical regular file")

  const conflict = cache()
  const conflictPath = join(conflict, runtime.cacheFile)
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: conflict,
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    fetch: exactFetch(archiveBytes, () => { writeFileSync(conflictPath, "conflict") })
  })).rejects.toThrow("cache conflict")
  expect(readFileSync(conflictPath, "utf8")).toBe("conflict")
  expect(readdirSync(conflict)).toEqual([runtime.cacheFile])
})

test("runtime preload rejects redirects, representation drift, and a wrong Bun version", async () => {
  const redirected = new Response(null, {
    status: 302,
    headers: { location: "https://example.invalid/runtime" }
  })
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: cache(),
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    fetch: (async () => redirected) as BunRuntimeFetch
  })).rejects.toThrow("redirects are forbidden")
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: cache(),
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    fetch: (async () => new Response(archiveBytes, {
      status: 200,
      headers: { "content-type": "text/plain", "content-length": String(archiveBytes.byteLength) }
    })) as BunRuntimeFetch
  })).rejects.toThrow("unsupported representation")
  await expect(preloadBunCompileRuntimes({
    cacheDirectory: cache(),
    bunVersion: "1.3.13",
    runtimes: [runtime],
    fetch: exactFetch()
  })).rejects.toThrow(`requires Bun ${certifiedBunVersion}`)
})

test("runtime verification canonicalizes an aliased cache ancestor", () => {
  const directory = cache()
  const aliases = cache()
  const alias = join(aliases, "cache")
  symlinkSync(directory, alias, "dir")
  writeFileSync(join(directory, runtime.cacheFile), bytes)
  expect(verifyBunCompileRuntime(alias, runtime)).toEqual(verified)
})
