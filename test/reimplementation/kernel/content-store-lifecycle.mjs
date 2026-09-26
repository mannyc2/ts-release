import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { syncBuiltinESMExports } from "node:module"
import { dirname } from "node:path"
import { Cause, Effect, Exit, Fiber } from "effect"

const [directory, window] = process.argv.slice(2)
if (!directory || (window !== "acquire" && window !== "write"))
  throw new Error("Expected content directory and acquisition/write window")

const entered = Promise.withResolvers()
const release = Promise.withResolvers()
const unlinked = Promise.withResolvers()
const nativeOpen = fs.open
const nativeUnlink = fs.unlink
let temporary
let output

// This isolated process retains real native handles and operations. Only delivery
// of one exclusive output's open/write completion is held; no runtime test port
// or replacement filesystem is added to the content owner.
fs.open = async (...args) => {
  const file = await nativeOpen(...args)
  if (typeof args[0] !== "string" || dirname(args[0]) !== directory || args[1] !== "wx") return file
  temporary = args[0]
  output = file
  if (window === "acquire") {
    entered.resolve()
    await release.promise
  } else {
    const write = file.writeFile.bind(file)
    file.writeFile = (...input) => {
      const issuedWrite = write(...input)
      entered.resolve()
      return Promise.all([issuedWrite, release.promise]).then(() => undefined)
    }
  }
  return file
}
// The original detached workflow has no fiber to join after cancellation. Its
// final native unlink is the teardown barrier, so a red test cannot race rm.
fs.unlink = async (path) => {
  try {
    await nativeUnlink(path)
  } finally {
    if (path === temporary) unlinked.resolve()
  }
}
syncBuiltinESMExports()
const { fileContentOwner } = await import("../../../packages/ts-release/dist/Node.js")
const fiber = Effect.runFork(fileContentOwner(directory).putOwned(new Uint8Array([1, 2, 3])))
let completed
fiber.addObserver((exit) => {
  completed = exit
})
let cancellation
try {
  await entered.promise
  cancellation = Effect.runFork(Fiber.interrupt(fiber))
  // rc.115 exposes dispatcher.flush for causal native-boundary inspection.
  // Drain already queued Effect work without releasing native completion or
  // guessing how many milliseconds interruption takes.
  fiber.currentDispatcher.flush()
  cancellation.currentDispatcher.flush()
  assert.equal(completed, undefined, `${window}: interruption completed before native settlement`)
  await output.stat()
  release.resolve()
  const exit = await Effect.runPromise(Fiber.await(fiber))
  assert(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause), "Expected interruption")
  await assert.rejects(output.stat(), { code: "EBADF" })
  assert.deepEqual(await fs.readdir(directory), [], "Cancelled content must not be installed")
} finally {
  release.resolve()
  await unlinked.promise
  if (cancellation) await Effect.runPromise(Fiber.await(cancellation))
  fs.open = nativeOpen
  fs.unlink = nativeUnlink
  syncBuiltinESMExports()
}
