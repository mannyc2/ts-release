// The Action is a thin Linux/Bun composite boundary. Its gate checks the
// manifest, compares the checked-in bundle to a disposable canonical build,
// and probes the exact command the composite step executes.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { cwd, exit } from "node:process"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { actionCommands, actionInputs, actionOutputs } from "../apps/ts-release-action/src/commands.js"
import { buildActionBundle } from "./build-action-bundle.js"

const root = cwd()
const manifest = readFileSync(join(root, "apps/ts-release-action/action.yml"), "utf8")
const removed = /\b(?:plan|apply|ship|inspect|correct|doctor|review|ledger|approval|status|prepared_path|report_path)\b/iu

try {
  if (removed.test(manifest)) throw new Error("action.yml contains an obsolete lifecycle term.")
  for (const name of [...actionInputs, ...actionOutputs]) {
    if (!manifest.includes(`  ${name}:`)) throw new Error(`action.yml omits ${name}.`)
  }
  if (!manifest.includes("  using: composite")) throw new Error("action.yml must declare the certified composite runtime.")
  if (!manifest.includes('run: bun "$GITHUB_ACTION_PATH/dist/index.js"')) {
    throw new Error("action.yml must execute the checked-in bundle through Bun.")
  }
  for (const name of actionOutputs) {
    if (!manifest.includes(`value: \${{ steps.execute.outputs.${name} }}`)) {
      throw new Error(`action.yml does not forward ${name} from the execution step.`)
    }
  }
  for (const name of actionInputs) {
    const environmentName = `INPUT_${name.toUpperCase().replaceAll("-", "_")}`
    if (!manifest.includes(`${environmentName}: \${{ inputs.${name} }}`)) {
      throw new Error(`action.yml does not bind ${name} to ${environmentName}.`)
    }
  }
  for (const name of ["correction", "npm-token", "github-token", "plan-path", "reviewer", "scope", "through"]) {
    if (manifest.includes(`  ${name}:`)) throw new Error(`action.yml retains an obsolete input ${name}.`)
  }
  const checkedBundle = join(root, "apps/ts-release-action/dist/index.js")
  if (!existsSync(checkedBundle)) throw new Error("The checked-in Action bundle is missing.")
  const scratch = mkdtempSync(join(tmpdir(), "ts-release-action-bundle-"))
  try {
    const generatedBundle = join(scratch, "index.js")
    await buildActionBundle(generatedBundle)
    const checkedBytes = readFileSync(checkedBundle)
    const generatedBytes = readFileSync(generatedBundle)
    if (checkedBytes.length !== generatedBytes.length ||
        checkedBytes.some((byte, index) => byte !== generatedBytes[index])) {
      throw new Error("The checked-in Action bundle does not match a fresh canonical build.")
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  const probe = Bun.spawnSync(["bun", checkedBundle], {
    cwd: root, stdout: "pipe", stderr: "pipe",
    env: {
      ...process.env,
      GITHUB_WORKSPACE: root,
      GITHUB_REPOSITORY: "owner/repository",
      GITHUB_WORKFLOW_REF: "owner/repository/.github/workflows/release.yml@refs/heads/main",
      GITHUB_WORKFLOW_SHA: "d".repeat(40),
      GITHUB_RUN_ID: "123",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_SHA: "c".repeat(40),
      INPUT_COMMAND: "invalid",
      INPUT_CONFIG: "",
      INPUT_PREPARED: ""
    }
  })
  const probeOutput = `${new TextDecoder().decode(probe.stdout)}\n${new TextDecoder().decode(probe.stderr)}`
  if (probe.exitCode === 0 || !probeOutput.includes("Action command must be one of")) {
    throw new Error("Bun did not execute the Action command parser through the declared runtime boundary.")
  }
  console.log(`Action bundle exposes ${actionCommands.length} commands and ${actionOutputs.length} outputs.`)
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  exit(1)
}
