import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { syncBuiltinESMExports } from "node:module"
import { join } from "node:path"
import { Cause, Effect, Exit, Fiber } from "effect"

const [directory] = process.argv.slice(2)
assert(directory, "Expected an isolated input directory")
const path = join(directory, "notes.md")
await fs.writeFile(path, "Exact release input\n")

const entered = Promise.withResolvers()
const release = Promise.withResolvers()
const closed = Promise.withResolvers()
const nativeOpen = fs.open
let input

// Keep the actual native file and read. Only delivery of the completed read's
// result is held; this does not pretend that a syscall remained blocked.
fs.open = async (...args) => {
  const file = await nativeOpen(...args)
  if (args[0] !== path) return file
  input = file
  const read = file.readFile.bind(file)
  const close = file.close.bind(file)
  file.readFile = async (...options) => {
    const bytes = await read(...options)
    entered.resolve()
    await release.promise
    return bytes
  }
  file.close = async () => {
    try {
      await close()
    } finally {
      closed.resolve()
    }
  }
  return file
}
syncBuiltinESMExports()
// This is the source owner; compiled application compatibility is a separate check.
const { read } = await import("../../../apps/self-release/src/Model.ts")
const fiber = Effect.runFork(read(path))
let completed
fiber.addObserver((exit) => {
  completed = exit
})
let cancellation
try {
  await entered.promise
  cancellation = Effect.runFork(Fiber.interrupt(fiber))
  // Drain already queued rc.115 work causally, without a stabilization sleep.
  fiber.currentDispatcher.flush()
  cancellation.currentDispatcher.flush()
  assert.equal(completed, undefined, "Interruption completed before native read settlement")
  await input.stat()
  release.resolve()
  const exit = await Effect.runPromise(Fiber.await(fiber))
  assert(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause), "Expected interruption")
  await assert.rejects(input.stat(), { code: "EBADF" })
} finally {
  // The baseline has detached its JS continuation. Join actual native close so
  // a failing assertion cannot race directory removal or abandon the real handle.
  release.resolve()
  await closed.promise
  if (cancellation) await Effect.runPromise(Fiber.await(cancellation))
  fs.open = nativeOpen
  syncBuiltinESMExports()
}
