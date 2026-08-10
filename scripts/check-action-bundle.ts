// The Action is a thin Node-hosted release entrypoint. Its gate checks the
// manifest and rebuilds the checked-in bundle; it does not publish anything.
import { existsSync, readFileSync } from "node:fs"
import { cwd, exit } from "node:process"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { actionCommands, actionOutputs } from "../apps/ts-release-action/src/commands.js"

const root = cwd()
const manifest = readFileSync(join(root, "apps/ts-release-action/action.yml"), "utf8")
const removed = /\b(?:plan|apply|doctor|review|ledger|approval)\b/iu

try {
  if (removed.test(manifest)) throw new Error("action.yml contains an obsolete lifecycle term.")
  const result = spawnSync("bun", ["build", "src/index.ts", "--target=node", "--format=esm", "--outfile", "dist/index.js"], {
    cwd: join(root, "apps/ts-release-action"), encoding: "utf8", stdio: "pipe"
  })
  if (result.status !== 0) throw new Error([result.stdout, result.stderr].join("\n").trim())
  if (!existsSync(join(root, "apps/ts-release-action/dist/index.js"))) throw new Error("Action bundle was not built.")
  for (const name of [...actionCommands, ...actionOutputs]) if (!manifest.includes(name)) {
    throw new Error(`action.yml omits ${name}.`)
  }
  console.log("Action bundle exposes one automatic release command.")
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  exit(1)
}
