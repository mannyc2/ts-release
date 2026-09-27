import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createRequire, syncBuiltinESMExports } from "node:module"
import { Cause, Effect, Exit, Fiber } from "effect"

const [fixturePath, sourcePath, rootPath, cachePath] = process.argv.slice(2)
assert(
  fixturePath && sourcePath && rootPath && cachePath,
  "Expected authentic fixture and TUF paths",
)
const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"))
const bundle = fixture.attestations.find(
  (entry) => entry.predicateType === "https://slsa.dev/provenance/v1",
).bundle
const sourceData = JSON.parse(await fs.readFile(sourcePath, "utf8"))
const entered = Promise.withResolvers()
const release = Promise.withResolvers()
const directories = new Set()
const nativeMkdtemp = fs.mkdtemp
const require = createRequire(import.meta.url)
// Pinned sigstore5 delegates to this implementation. Observe its original
// Promise for teardown only; never replace its result or native trust work.
const sdk = require("sigstore/dist/sigstore.js")
const nativeVerify = sdk.verify
/** @type {Promise<unknown> | undefined} */
let issuedVerification
let verifyCalls = 0
sdk.verify = (...args) => {
  verifyCalls++
  issuedVerification = nativeVerify(...args)
  return issuedVerification
}
// tuf-js6 creates real temporary directories before downloading metadata.
// Hold delivery of the first actual mkdir completion, not the syscall itself.
fs.mkdtemp = async (...args) => {
  const directory = await nativeMkdtemp(...args)
  directories.add(directory)
  if (directories.size === 1) {
    entered.resolve()
    await release.promise
  }
  return directory
}
syncBuiltinESMExports()

let fiber
let cancellation
let nativeVerified = false
try {
  const { ProvenanceSource, makeSigstoreVerifier } = await import("@mannyc1/ts-release-npm")
  const verify = makeSigstoreVerifier({
    tufRootPath: rootPath,
    tufCachePath: cachePath,
    timeoutMilliseconds: 20000,
  })
  fiber = Effect.runFork(
    verify({
      source: new ProvenanceSource(sourceData),
      bundleBytes: Buffer.from(JSON.stringify(bundle)),
    }),
  )
  let completed
  const finished = Promise.withResolvers()
  fiber.addObserver((exit) => {
    completed = exit
    finished.resolve()
  })
  await Promise.race([
    entered.promise,
    finished.promise.then(() => {
      throw new Error("Verification ended before the actual TUF completion barrier")
    }),
  ])
  assert.equal(verifyCalls, 1)
  for (const directory of directories) assert((await fs.stat(directory)).isDirectory())
  cancellation = Effect.runFork(Fiber.interrupt(fiber))
  // Drain causal Effect work without guessing an interruption delay.
  fiber.currentDispatcher.flush()
  cancellation.currentDispatcher.flush()
  assert.equal(completed, undefined, "Interruption completed before native Sigstore settlement")
  release.resolve()
  const exit = await Effect.runPromise(Fiber.await(fiber))
  assert(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause), "Expected interruption")
  for (const directory of directories) await assert.rejects(fs.stat(directory), { code: "ENOENT" })
} finally {
  release.resolve()
  try {
    if (issuedVerification) {
      await issuedVerification
      nativeVerified = true
      for (const directory of directories)
        await assert.rejects(fs.stat(directory), { code: "ENOENT" })
    }
  } finally {
    if (cancellation) await Effect.runPromise(Fiber.await(cancellation))
    else if (fiber) await Effect.runPromise(Fiber.interrupt(fiber))
    fs.mkdtemp = nativeMkdtemp
    sdk.verify = nativeVerify
    syncBuiltinESMExports()
    console.log(
      JSON.stringify({
        runtime: process.version,
        nativeVerified,
        verifyCalls,
        removedTufDirectories: directories.size,
      }),
    )
  }
}
assert(nativeVerified, "The original native verifier must accept the authentic fixture")
