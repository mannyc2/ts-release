import assert from "node:assert/strict"
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { Effect } from "effect"
import { fileContentOwner, nodeDirectoryReader } from "../../../packages/ts-release/dist/Node.js"

const node = process.env.TS_RELEASE_HTTP_PEER_NODE
assert(node, "Select the native Node executable explicitly")
const root = await mkdtemp("/tmp/ts-release-directory-")
const read = nodeDirectoryReader(node)
let checks = 0
const check = (condition) => {
  assert(condition)
  checks++
}
const rejected = async (effect) => {
  await assert.rejects(Effect.runPromise(effect), { _tag: "AdoptionError" })
  checks++
}
try {
  const empty = join(root, "empty"),
    small = join(root, "small")
  await mkdir(empty)
  await mkdir(small)
  for (const name of ["a", "b", "c"]) await writeFile(join(small, name), "")
  check((await Effect.runPromise(read(empty, 0))).length === 0)
  for (const bound of [0, 1, 2]) await rejected(read(small, bound))
  for (const bound of [3, 4, 300_000]) {
    const names = await Effect.runPromise(read(small, bound))
    check(Object.isFrozen(names))
    check([...names].sort().join(",") === "a,b,c")
  }
  for (const bound of [-1, 0.5, NaN, Infinity, 300_001]) await rejected(read(small, bound))
  await rejected(read(join(small, "a"), 3))
  await rejected(read(join(root, "missing"), 3))
  await rejected(read("relative", 3))
  await rejected(nodeDirectoryReader("node")(small, 3))
  const previous = process.env.NODE_OPTIONS
  process.env.NODE_OPTIONS = "--require=/must-not-read-ambient-configuration"
  try {
    check((await Effect.runPromise(read(small, 3))).length === 3)
  } finally {
    if (previous === undefined) delete process.env.NODE_OPTIONS
    else process.env.NODE_OPTIONS = previous
  }
  if (process.versions.bun) {
    await rejected(fileContentOwner(join(root, "objects")).readDirectoryBounded(small, 3))
    check(
      (
        await Effect.runPromise(
          fileContentOwner(join(root, "objects"), read).readDirectoryBounded(small, 3),
        )
      ).length === 3,
    )
  }
  // A selected tool that stops responding must be reaped before interruption
  // settles, including when the caller runs in Bun.
  const tool = join(root, "blocked-node"),
    marker = join(root, "pid")
  await writeFile(tool, `#!/bin/sh\necho $$ > '${marker}'\nexec /bin/sleep 30\n`)
  await chmod(tool, 0o755)
  const controller = new AbortController()
  const outcome = Effect.runPromise(nodeDirectoryReader(tool)(small, 3), {
    signal: controller.signal,
  }).then(
    () => "unexpected-success",
    () => "interrupted",
  )
  let pid
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      const candidate = Number(await readFile(marker, "utf8"))
      if (Number.isSafeInteger(candidate) && candidate > 0) {
        pid = candidate
        break
      }
    } catch {}
    await delay(10)
  }
  assert(pid, "Native child started")
  const before = Date.now()
  controller.abort()
  check((await outcome) === "interrupted")
  check(Date.now() - before < 2000)
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" })
  checks++
  console.log(
    JSON.stringify({
      runtime: process.version,
      bun: process.versions.bun ?? null,
      checks,
      explicitNode: node,
      cancellation: "child-reaped",
    }),
  )
} finally {
  await rm(root, { recursive: true, force: true })
}
