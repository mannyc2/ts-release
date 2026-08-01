import * as core from "@actions/core"
import { makeReleaseApi } from "@mannyc1/ts-release"
import { NodeReleaseLayer } from "@mannyc1/ts-release/node"
import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs"
import { dirname } from "node:path"
import { runAction } from "./commands.js"

// Windows is a supported release TARGET, not a host: the store and drivers
// assume POSIX open flags (O_NOFOLLOW) and absolute-path branding.
if (process.platform === "win32") {
  core.setFailed("ts-release runs on Linux and macOS hosts; Windows is a supported release TARGET only. Use WSL to run ts-release on Windows.")
  process.exit(1)
}

// The Action runs under node20, so it composes the Node platform layer itself
// and disposes the runtime it created.
const api = makeReleaseApi(NodeReleaseLayer)
try {
  await runAction(
    api,
    {
      workspace: process.env.GITHUB_WORKSPACE ?? process.cwd(),
      input: core.getInput,
      output: core.setOutput,
      read: (path) => readFileSync(path, "utf8"),
      write: (path, value) => {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, value)
      }
    }
  )
} catch (cause) {
  core.setOutput("status", "failed")
  core.setFailed(cause instanceof Error ? cause.message : String(cause))
} finally {
  await api.dispose()
}
