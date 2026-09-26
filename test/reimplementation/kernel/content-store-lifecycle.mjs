import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import { syncBuiltinESMExports } from "node:module"
import { join } from "node:path"
import { Cause, Effect, Exit } from "effect"

// Instrument real file handles in this isolated process. The gates hold an
// already-issued native operation so cancellation and release ordering is exact.
const originalOpen = fs.open
const root = await fs.mkdtemp("/tmp/ts-release-content-lifecycle-")
let active
fs.open = async (...args) => {
  const file = await originalOpen(...args)
  const scenario = active
  if (!scenario || !String(args[0]).startsWith(root)) return file
  scenario.opened++
  const output = args[1] === "wx"
  const close = file.close.bind(file)
  file.close = async () => {
    if (output && scenario.kind === "close") {
      scenario.started()
      await scenario.gate
    }
    await close()
    scenario.closed++
    if (output && scenario.kind === "close-failure")
      throw new Error("sensitive native close failure")
  }
  if (output && scenario.kind === "acquire") {
    scenario.started()
    await scenario.gate
  }
  if (output && ["write", "failure"].includes(scenario.kind)) {
    const write = file.writeFile.bind(file)
    file.writeFile = async (...input) => {
      if (scenario.kind === "failure") throw new Error("sensitive native failure")
      scenario.started()
      await scenario.gate
      await write(...input)
      scenario.writes++
    }
  }
  if (!output && ["read", "verify", "copy"].includes(scenario.kind)) {
    const read = file.read.bind(file)
    file.read = async (...input) => {
      const result = await read(...input)
      scenario.started()
      await scenario.gate
      scenario.reads++
      return result
    }
  }
  return file
}
syncBuiltinESMExports()
if (process.versions.bun) {
  const { mock } = await import("bun:test")
  mock.module("node:fs/promises", () => ({ ...fs }))
}
const { fileContentOwner } = await import("../../../packages/ts-release/dist/Node.js")
const cells = []
try {
  const bytes = new Uint8Array(128 * 1024).fill(42)
  const expected = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }
  const source = join(root, "source")
  await fs.writeFile(source, bytes)
  for (const kind of [
    "acquire",
    "write",
    "close",
    "read",
    "verify",
    "copy",
    "failure",
    "close-failure",
  ]) {
    const directory = join(root, kind)
    const owner = fileContentOwner(directory)
    active = undefined
    if (["read", "verify"].includes(kind)) await Effect.runPromise(owner.putOwned(bytes))
    let entered, release
    const started = new Promise((resolve) => {
      entered = resolve
    })
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const scenario = (active = {
      kind,
      started: entered,
      gate,
      opened: 0,
      closed: 0,
      reads: 0,
      writes: 0,
    })
    const controller = new AbortController()
    const effect =
      kind === "read"
        ? owner.read(expected)
        : kind === "verify"
          ? owner.verify(expected)
          : kind === "copy"
            ? owner.putFileOwned({ ...expected, path: source })
            : owner.putOwned(bytes)
    let completed = false
    const pending = Effect.runPromiseExit(effect, { signal: controller.signal }).then((exit) => {
      completed = true
      return exit
    })
    const failing = kind === "failure" || kind === "close-failure"
    if (!failing) {
      await started
      controller.abort()
      // An interrupted workflow must remain alive while native IO still owns
      // its handle. This catches the old detached Promise implementation.
      await new Promise((resolve) => setTimeout(resolve, 20))
      assert.equal(completed, false, `${kind}: interruption returned before native IO settled`)
      assert.equal(scenario.closed, 0, `${kind}: handle closed during native IO`)
      release()
    }
    const exit = await pending
    assert(Exit.isFailure(exit), `${kind}: unexpected success`)
    if (failing) {
      assert.equal(Cause.hasInterrupts(exit.cause), false)
      const error = await Effect.runPromise(Effect.flip(Effect.failCause(exit.cause)))
      assert.equal(error._tag, "AdoptionError")
      assert(!error.message.includes("sensitive"))
    } else
      assert(Cause.hasInterrupts(exit.cause), `${kind}: cancellation changed into a typed failure`)
    assert.equal(scenario.closed, scenario.opened, `${kind}: an owned handle leaked`)
    assert(scenario.opened > 0)
    assert.deepEqual(
      await fs.readdir(directory),
      ["read", "verify"].includes(kind) ? [expected.sha256] : [],
    )
    const settled = { ...scenario }
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(scenario.closed, settled.closed)
    assert.equal(scenario.reads, settled.reads)
    assert.equal(scenario.writes, settled.writes)
    active = undefined
    const recovered = await Effect.runPromise(owner.putOwned(bytes))
    assert.deepEqual(await Effect.runPromise(owner.read(recovered)), bytes)
    cells.push({
      kind,
      status: failing ? "AdoptionError" : "Interrupted",
      opened: scenario.opened,
      closed: scenario.closed,
    })
  }
  // A caller's mutable buffer is captured before deferred execution and reused
  // without exposing either read-back buffers or the original input to storage.
  const owner = fileContentOwner(join(root, "snapshot"))
  const input = new Uint8Array([1, 2, 3])
  const pending = owner.putOwned(input)
  input.fill(9)
  const content = await Effect.runPromise(pending)
  const firstRead = await Effect.runPromise(owner.read(content))
  firstRead.fill(8)
  assert.deepEqual(await Effect.runPromise(owner.read(content)), new Uint8Array([1, 2, 3]))
  assert.deepEqual(await Effect.runPromise(pending), content)
  console.log(JSON.stringify({ cells, snapshot: true }))
} finally {
  active = undefined
  fs.open = originalOpen
  syncBuiltinESMExports()
  await fs.rm(root, { recursive: true, force: true })
}
