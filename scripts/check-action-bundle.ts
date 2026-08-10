// The Action is a thin Node-hosted API boundary. Its gate checks the manifest,
// rebuilds the checked-in bundle, and probes the emitted file under Node.
import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { cwd, exit } from "node:process"
import { join } from "node:path"
import { actionCommands, actionOutputs } from "../apps/ts-release-action/src/commands.js"

const root = cwd()
const manifest = readFileSync(join(root, "apps/ts-release-action/action.yml"), "utf8")
const removed = /\b(?:plan|apply|doctor|review|ledger|approval)\b/iu

try {
  if (removed.test(manifest)) throw new Error("action.yml contains an obsolete lifecycle term.")
  for (const name of ["command", "config", "prepared", "correction", ...actionOutputs]) {
    if (!manifest.includes(`  ${name}:`)) throw new Error(`action.yml omits ${name}.`)
  }
  for (const name of ["npm-token", "github-token", "plan-path", "reviewer", "scope", "through"]) {
    if (manifest.includes(`  ${name}:`)) throw new Error(`action.yml retains an obsolete input ${name}.`)
  }
  const result = spawnSync("bun", ["build", "src/index.ts", "--target=node", "--format=esm", "--outfile", "dist/index.js"], {
    cwd: join(root, "apps/ts-release-action"), encoding: "utf8", stdio: "pipe"
  })
  if (result.status !== 0) throw new Error([result.stdout, result.stderr].join("\n").trim())
  if (!existsSync(join(root, "apps/ts-release-action/dist/index.js"))) throw new Error("Action bundle was not built.")
  const probe = Bun.spawnSync(["node", join(root, "apps/ts-release-action/dist/index.js")], {
    cwd: root, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, GITHUB_WORKSPACE: root, INPUT_COMMAND: "invalid", INPUT_CONFIG: "", INPUT_PREPARED: "", INPUT_CORRECTION: "" }
  })
  const probeOutput = `${new TextDecoder().decode(probe.stdout)}\n${new TextDecoder().decode(probe.stderr)}`
  if (probe.exitCode === 0 || !probeOutput.includes("Action command must be one of")) {
    throw new Error("Node did not execute the Action command parser.")
  }
  console.log(`Action bundle exposes ${actionCommands.length} commands and ${actionOutputs.length} outputs.`)
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  exit(1)
}
