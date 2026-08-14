import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  certifiedBunVersion,
  preloadBunCompileRuntimes,
  verifyBunCompileRuntime,
  type BunCompileRuntimeSpec,
  type BunRuntimeSpawn
} from "../apps/ts-release-action/scripts/preload-bun-compile-runtimes.js"

const bytes = Buffer.from("certified runtime fixture")
const runtime: BunCompileRuntimeSpec = {
  target: "bun-linux-arm64",
  cacheFile: `bun-linux-aarch64-v${certifiedBunVersion}`,
  sha256: createHash("sha256").update(bytes).digest("hex")
}

const cache = (): string => mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-runtime-cache-"))

test("runtime preload downloads a missing pinned file once and then only verifies it", () => {
  const directory = cache()
  let calls = 0
  const spawn: BunRuntimeSpawn = ({ argv, environment }) => {
    calls += 1
    expect(argv).toContain("--no-env-file")
    expect(argv).toContain("--no-install")
    expect(argv).toContain(runtime.target)
    expect(Object.keys(environment).sort()).toEqual([
      "BUN_INSTALL_CACHE_DIR", "LANG", "LC_ALL", "PATH", "SOURCE_DATE_EPOCH", "TZ"
    ])
    writeFileSync(join(environment.BUN_INSTALL_CACHE_DIR!, runtime.cacheFile), bytes)
    return 0
  }
  const options = {
    cacheDirectory: directory,
    bunExecutable: "/fixture/bun",
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    spawn
  }
  expect(preloadBunCompileRuntimes(options)).toEqual([runtime])
  expect(preloadBunCompileRuntimes(options)).toEqual([runtime])
  expect(calls).toBe(1)
})

test("runtime preload fails closed on wrong bytes, version, and download failure", () => {
  const wrong = cache()
  writeFileSync(join(wrong, runtime.cacheFile), "wrong")
  expect(() => verifyBunCompileRuntime(wrong, runtime)).toThrow("expected")
  expect(() => preloadBunCompileRuntimes({
    cacheDirectory: cache(),
    bunExecutable: "/fixture/bun",
    bunVersion: "1.3.13",
    runtimes: [runtime]
  })).toThrow(`requires Bun ${certifiedBunVersion}`)
  expect(() => preloadBunCompileRuntimes({
    cacheDirectory: cache(),
    bunExecutable: "/fixture/bun",
    bunVersion: certifiedBunVersion,
    runtimes: [runtime],
    spawn: () => 7
  })).toThrow("exited 7")
})

test("runtime verification canonicalizes an aliased cache ancestor", () => {
  const directory = cache()
  const aliases = cache()
  const alias = join(aliases, "cache")
  symlinkSync(directory, alias, "dir")
  writeFileSync(join(directory, runtime.cacheFile), bytes)
  expect(verifyBunCompileRuntime(alias, runtime)).toEqual(runtime)
})
