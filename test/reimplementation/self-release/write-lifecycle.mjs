import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { syncBuiltinESMExports } from "node:module"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { Cause, Effect, Exit, Fiber } from "effect"

const [directory] = process.argv.slice(2)
assert(directory, "Expected an isolated preparation directory")
const candidateDirectory = join(directory, "candidate")
const bundlePath = join(candidateDirectory, "bundle.json")
const planPath = join(candidateDirectory, "plan.json")
const notesFile = join(directory, "notes.md")
await fs.writeFile(notesFile, "Exact retained release notes\n")

const entered = Promise.withResolvers()
const release = Promise.withResolvers()
const nativeWriteFile = fs.writeFile
/** @type {Promise<void> | undefined} */
let issuedWrite
let bundleBytes
let bundleWrites = 0
let planWrites = 0
// Execute the real write with its original bytes/options. Hold delivery only
// after it completes; this does not pretend that a syscall remains blocked.
fs.writeFile = (...args) => {
  if (args[0] === planPath) planWrites++
  if (args[0] !== bundlePath) return nativeWriteFile(...args)
  assert(args[1] instanceof Uint8Array, "Expected the encoded Bundle bytes")
  bundleBytes = Buffer.from(args[1])
  bundleWrites++
  issuedWrite = nativeWriteFile(...args).then(async () => {
    entered.resolve()
    await release.promise
  })
  return issuedWrite
}
syncBuiltinESMExports()

let fiber
let cancellation
let completed
let pendingBeforeRelease = false
let nativeWriteJoined = false
try {
  // Use the compiled production application, built once by the coordinator.
  const { prepareRelease } = await import("../../../apps/self-release/dist/prepare.js")
  fiber = Effect.runFork(
    prepareRelease({
      candidateDirectory,
      repository: { owner: "release-fixture", name: "example" },
      source: { commit: "a".repeat(40), tree: "b".repeat(40) },
      version: "1.2.3",
      title: "Example 1.2.3",
      notesFile,
      packages: [
        {
          archiveFile: fileURLToPath(
            new URL("../npm/fixtures/native-package.tgz", import.meta.url),
          ),
          publicName: "example.tgz",
        },
      ],
      npm: { authorization: { _tag: "TokenAuthorization", principal: "npm-publisher" } },
    }),
  )
  const finished = Promise.withResolvers()
  fiber.addObserver((exit) => {
    completed = exit
    finished.resolve()
  })
  await Promise.race([
    entered.promise,
    finished.promise.then(() => {
      throw new Error("Preparation ended before its real Bundle write completion barrier")
    }),
  ])
  assert.equal(bundleWrites, 1)
  assert.deepEqual(await fs.readFile(bundlePath), bundleBytes)
  cancellation = Effect.runFork(Fiber.interrupt(fiber))
  // Drain causal rc.115 work without guessing an interruption delay.
  fiber.currentDispatcher.flush()
  cancellation.currentDispatcher.flush()
  pendingBeforeRelease = completed === undefined
  assert(pendingBeforeRelease, "Interruption completed before native Bundle write settlement")
  release.resolve()
  const exit = await Effect.runPromise(Fiber.await(fiber))
  assert(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause), "Expected interruption")
  assert.equal(planWrites, 0, "Interrupted preparation must not start the Plan write")
  await assert.rejects(fs.stat(planPath), { code: "ENOENT" })
  assert.deepEqual(await fs.readFile(bundlePath), bundleBytes)
} finally {
  // Join the real write's held delivery even when baseline interruption has
  // already completed. Directory removal belongs to the parent after child exit.
  release.resolve()
  try {
    if (issuedWrite) {
      await issuedWrite
      nativeWriteJoined = true
    }
  } finally {
    if (cancellation) await Effect.runPromise(Fiber.await(cancellation))
    else if (fiber) await Effect.runPromise(Fiber.interrupt(fiber))
    fs.writeFile = nativeWriteFile
    syncBuiltinESMExports()
    console.log(
      JSON.stringify({
        runtime: process.version,
        bundleWrites,
        planWrites,
        pendingBeforeRelease,
        nativeWriteJoined,
      }),
    )
  }
}
