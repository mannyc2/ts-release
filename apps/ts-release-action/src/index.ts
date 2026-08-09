import * as core from "@actions/core"
import { makeReleaseApi, unsupportedExecutionHost } from "@mannyc1/ts-release"
import { NodeReleaseLayer } from "@mannyc1/ts-release/node"
import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs"
import { dirname } from "node:path"
import { runAction } from "./commands.js"

const hostRefusal = unsupportedExecutionHost(process.platform)
if (hostRefusal !== undefined) {
  core.setFailed(hostRefusal)
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
      ...(process.env.GITHUB_SHA === undefined ? {} : { commit: process.env.GITHUB_SHA }),
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
