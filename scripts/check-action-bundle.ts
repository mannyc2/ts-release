// The Action is a thin native Node launcher around the Linux/Bun boundary. Its
// gate checks both manifests, compares all four checked-in bundles to disposable
// canonical builds, and probes the exact native launcher command.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { cwd, exit } from "node:process"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { actionCommands, actionInputs, actionOutputs } from "../apps/ts-release-action/src/commands.js"
import { unsupportedExecutionHost } from "../src/platform/host-support.js"
import {
  buildActionArtifactBridge,
  buildActionBundle,
  buildActionLauncher,
  buildActionReportRetainer
} from "./build-action-bundle.js"

const root = cwd()
const exactNode = process.env.TS_RELEASE_NODE_BIN ?? Bun.which("node") ?? ""
const exactBun = process.env.TS_RELEASE_BUN_BIN ?? process.execPath
const manifest = readFileSync(join(root, "apps/ts-release-action/action.yml"), "utf8")
const retainerManifest = readFileSync(join(root, "apps/ts-release-action/report-retainer/action.yml"), "utf8")
const removed = /\b(?:plan|apply|ship|correct|doctor|review|ledger|approval|status|prepared_path|report_path)\b/iu

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
  if (!retainerManifest.includes("  using: node24") ||
      !retainerManifest.includes("  main: dist/index.cjs") ||
      /\b(?:steps|shell|run):/u.test(retainerManifest)) {
    throw new Error("The private report retainer must be one native Node 24 Action.")
  }
  for (const name of ["kind", "candidate-sha", "prepared"]) {
    if (!retainerManifest.includes(`  ${name}:`)) throw new Error(`Report-retainer action.yml omits ${name}.`)
  }
  for (const name of ["artifact-name", "artifact-id", "artifact-digest", "report-sha256"]) {
    if (!retainerManifest.includes(`  ${name}:`)) throw new Error(`Report-retainer action.yml omits ${name}.`)
  }
  const checkedBundle = join(root, "apps/ts-release-action/dist/index.js")
  const checkedLauncher = join(root, "apps/ts-release-action/dist/launcher.cjs")
  const checkedBridge = join(root, "apps/ts-release-action/dist/artifact-bridge.cjs")
  const checkedRetainer = join(root, "apps/ts-release-action/report-retainer/dist/index.cjs")
  if (!existsSync(checkedBundle)) throw new Error("The checked-in Action bundle is missing.")
  if (!existsSync(checkedLauncher)) throw new Error("The checked-in Action launcher is missing.")
  if (!existsSync(checkedBridge)) throw new Error("The checked-in Action artifact bridge is missing.")
  if (!existsSync(checkedRetainer)) throw new Error("The checked-in Action report retainer is missing.")
  const scratch = mkdtempSync(join(tmpdir(), "ts-release-action-bundle-"))
  try {
    const generatedBundle = join(scratch, "index.js")
    const generatedLauncher = join(scratch, "launcher.cjs")
    const generatedBridge = join(scratch, "artifact-bridge.cjs")
    const generatedRetainer = join(scratch, "report-retainer.cjs")
    await buildActionBundle(generatedBundle)
    await buildActionLauncher(generatedLauncher)
    await buildActionArtifactBridge(generatedBridge)
    await buildActionReportRetainer(generatedRetainer)
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
    const checkedRetainerBytes = readFileSync(checkedRetainer)
    const generatedRetainerBytes = readFileSync(generatedRetainer)
    if (checkedRetainerBytes.length !== generatedRetainerBytes.length ||
        checkedRetainerBytes.some((byte, index) => byte !== generatedRetainerBytes[index])) {
      throw new Error("The checked-in Action report retainer does not match a fresh canonical build.")
    }
    if (checkedRetainerBytes.toString("utf8").includes(root)) {
      throw new Error("The checked-in Action report retainer retains its build-workspace path.")
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
      exactNode, checkedBridge, request, response
    ], { cwd: root, stdout: "pipe", stderr: "pipe", env: process.env })
    if (bridgeProbe.exitCode === 0 || !readFileSync(response, "utf8").includes("unknown operation")) {
      throw new Error("Node did not execute the checked-in artifact bridge protocol.")
    }
  } finally {
    rmSync(bridgeProbeRoot, { recursive: true, force: true })
  }
  const retainerProbe = Bun.spawnSync([exactNode, checkedRetainer], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      INPUT_KIND: "unknown",
      INPUT_CANDIDATE_SHA: "c".repeat(40),
      INPUT_PREPARED: ""
    }
  })
  const retainerProbeOutput = `${new TextDecoder().decode(retainerProbe.stdout)}\n${new TextDecoder().decode(retainerProbe.stderr)}`
  if (retainerProbe.exitCode === 0 ||
      !retainerProbeOutput.includes("Private self-release report retention failed closed") ||
      retainerProbeOutput.includes("unknown report kind")) {
    throw new Error("Node did not execute the private report retainer through its generic fail-closed boundary.")
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
      TS_RELEASE_NODE_BIN: exactNode,
      TS_RELEASE_BUN_BIN: exactBun,
      INPUT_CONFIG: "",
      INPUT_PREPARED: ""
    }
  })
  const probeOutput = `${new TextDecoder().decode(probe.stdout)}\n${new TextDecoder().decode(probe.stderr)}`
  const expectedProbeDiagnostic = unsupportedExecutionHost(process.platform) ?? "publish requires prepared"
  if (probe.exitCode === 0 || !probeOutput.includes(expectedProbeDiagnostic)) {
    throw new Error("Node did not execute the Bun Action entry through the declared native launcher boundary.")
  }
  console.log(`Action bundle exposes ${actionCommands.length} commands and ${actionOutputs.length} outputs.`)
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : String(cause))
  exit(1)
}
