import { realpath } from "node:fs/promises"

// Native bounded-directory tests need an explicit Node capability, also on Bun.
const selected =
  process.env.TS_RELEASE_HTTP_PEER_NODE ??
  process.env.TS_RELEASE_ACCEPTANCE_NODE ??
  Bun.which("node")
if (!selected) throw new Error("Install a supported Node runtime or set TS_RELEASE_HTTP_PEER_NODE")
const node = await realpath(selected)
const child = Bun.spawn(
  [process.execPath, "test", "./test/reimplementation", ...process.argv.slice(2)],
  {
    env: { ...process.env, TS_RELEASE_HTTP_PEER_NODE: node },
    stdout: "inherit",
    stderr: "inherit",
  },
)
process.exitCode = await child.exited
