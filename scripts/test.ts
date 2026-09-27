import { realpath } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")

// Native bounded-directory tests need an explicit Node capability, also on Bun.
const selected =
  process.env.TS_RELEASE_HTTP_PEER_NODE ??
  process.env.TS_RELEASE_ACCEPTANCE_NODE ??
  Bun.which("node")
if (!selected) throw new Error("Install a supported Node runtime or set TS_RELEASE_HTTP_PEER_NODE")
const node = await realpath(selected)
// Build shared delivery outputs before tests load their installed-style entries.
// Test hooks must not delete/rebuild those outputs while other tests use them.
const delivery = Bun.spawn([process.execPath, "run", "build:delivery"], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
})
const deliveryCode = await delivery.exited
if (deliveryCode !== 0) process.exit(deliveryCode)
const child = Bun.spawn(
  [process.execPath, "test", "./test/reimplementation", ...process.argv.slice(2)],
  {
    cwd: root,
    env: { ...process.env, TS_RELEASE_HTTP_PEER_NODE: node },
    stdout: "inherit",
    stderr: "inherit",
  },
)
process.exitCode = await child.exited
