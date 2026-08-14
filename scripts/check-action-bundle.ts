// The Action is a thin native Node launcher around the Linux/Bun boundary. Its
// gate checks the manifest, compares all three checked-in bundles to disposable
// canonical builds, and probes the exact native launcher command.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { cwd, exit } from "node:process"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { actionCommands, actionInputs, actionOutputs } from "../apps/ts-release-action/src/commands.js"
import {
  buildActionArtifactBridge,
  buildActionBundle,
  buildActionLauncher
} from "./build-action-bundle.js"

const root = cwd()
const manifest = readFileSync(join(root, "apps/ts-release-action/action.yml"), "utf8")
const removed = /\b(?:plan|apply|ship|inspect|correct|doctor|review|ledger|approval|status|prepared_path|report_path)\b/iu

try {
  if (removed.test(manifest)) throw new Error("action.yml contains an obsolete lifecycle term.")
  for (const name of [...actionInputs, ...actionOutputs]) {
    if (!manifest.includes(`  ${name}:`)) throw new Error(`action.yml omits ${name}.`)
  }
  if (!manifest.includes("  using: node24")) throw new Error("action.yml must declare the native Node 24 Action runtime.")
  if (!manifest.includes("  main: dist/launcher.cjs")) throw new Error("action.yml must execute the checked-in native launcher.")
  if (/\b(?:steps|shell|run):/u.test(manifest)) throw new Error("action.yml retains a composite shell boundary.")
  for (const name of ["correction", "npm-token", "github-token", "plan-path", "reviewer", "scope", "through"]) {
    if (manifest.includes(`  ${name}:`)) throw new Error(`action.yml retains an obsolete input ${name}.`)
  }
  const checkedBundle = join(root, "apps/ts-release-action/dist/index.js")
  const checkedLauncher = join(root, "apps/ts-release-action/dist/launcher.cjs")
  const checkedBridge = join(root, "apps/ts-release-action/dist/artifact-bridge.cjs")
  if (!existsSync(checkedBundle)) throw new Error("The checked-in Action bundle is missing.")
  if (!existsSync(checkedLauncher)) throw new Error("The checked-in Action launcher is missing.")
  if (!existsSync(checkedBridge)) throw new Error("The checked-in Action artifact bridge is missing.")
  const scratch = mkdtempSync(join(tmpdir(), "ts-release-action-bundle-"))
  try {
    const generatedBundle = join(scratch, "index.js")
    const generatedLauncher = join(scratch, "launcher.cjs")
    const generatedBridge = join(scratch, "artifact-bridge.cjs")
    await buildActionBundle(generatedBundle)
    await buildActionLauncher(generatedLauncher)
    await buildActionArtifactBridge(generatedBridge)
    const checkedBytes = readFileSync(checkedBundle)
    const generatedBytes = readFileSync(generatedBundle)
    if (checkedBytes.length !== generatedBytes.length ||
        checkedBytes.some((byte, index) => byte !== generatedBytes[index])) {
      throw new Error("The checked-in Action bundle does not match a fresh canonical build.")
    }
    const checkedLauncherBytes = readFileSync(checkedLauncher)
    const generatedLauncherBytes = readFileSync(generatedLauncher)
    if (checkedLauncherBytes.length !== generatedLauncherBytes.length ||
        checkedLauncherBytes.some((byte, index) => byte !== generatedLauncherBytes[index])) {
      throw new Error("The checked-in Action launcher does not match a fresh canonical build.")
    }
    if (checkedLauncherBytes.toString("utf8").includes(root)) {
      throw new Error("The checked-in Action launcher retains its build-workspace path.")
    }
    const checkedBridgeBytes = readFileSync(checkedBridge)
    const generatedBridgeBytes = readFileSync(generatedBridge)
    if (checkedBridgeBytes.length !== generatedBridgeBytes.length ||
        checkedBridgeBytes.some((byte, index) => byte !== generatedBridgeBytes[index])) {
      throw new Error("The checked-in Action artifact bridge does not match a fresh canonical build.")
    }
    if (checkedBridgeBytes.toString("utf8").includes(root)) {
      throw new Error("The checked-in Action artifact bridge retains its build-workspace path.")
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  const bridgeProbeRoot = mkdtempSync(join(tmpdir(), "ts-release-action-bridge-probe-"))
  try {
    const request = join(bridgeProbeRoot, "request.json")
    const response = join(bridgeProbeRoot, "response.json")
    writeFileSync(request, '{"operation":"unknown"}\n')
    const bridgeProbe = Bun.spawnSync([
      process.env.TS_RELEASE_NODE_BIN ?? "node", checkedBridge, request, response
    ], { cwd: root, stdout: "pipe", stderr: "pipe", env: process.env })
    if (bridgeProbe.exitCode === 0 || !readFileSync(response, "utf8").includes("unknown operation")) {
      throw new Error("Node did not execute the checked-in artifact bridge protocol.")
    }
  } finally {
    rmSync(bridgeProbeRoot, { recursive: true, force: true })
  }
  const probe = Bun.spawnSync([process.env.TS_RELEASE_NODE_BIN ?? "node", checkedLauncher], {
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
      ACTIONS_RUNTIME_TOKEN: "runtime-token-fixture",
      ACTIONS_RESULTS_URL: "https://results.example.invalid/",
      INPUT_COMMAND: "publish",
      INPUT_CONFIG: "",
      INPUT_PREPARED: ""
    }
  })
  const probeOutput = `${new TextDecoder().decode(probe.stdout)}\n${new TextDecoder().decode(probe.stderr)}`
  if (probe.exitCode === 0 || !probeOutput.includes("publish requires prepared")) {
    throw new Error("Node did not execute the Bun Action parser through the declared native launcher boundary.")
  }
  console.log(`Action bundle exposes ${actionCommands.length} commands and ${actionOutputs.length} outputs.`)
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  exit(1)
}
