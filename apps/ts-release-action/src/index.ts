import * as core from "@actions/core"
import {
  apply,
  plan,
  reviewExecution
} from "@mannyc1/ts-release"
import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs"
import { dirname } from "node:path"
import { runAction } from "./commands.js"

try {
  await runAction(
    { plan, reviewExecution, apply },
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
}
