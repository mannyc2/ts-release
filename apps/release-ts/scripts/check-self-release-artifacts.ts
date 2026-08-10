import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { makeReleaseApi } from "../../../src/api/api.js"
import { NodeReleaseLayer } from "../../../src/platform/node.js"
import { preparedRoot, report, root, selfReleaseConfig } from "./self-release-facts.js"

type Artifact = { readonly id: string, readonly digest: string, readonly path: string }
type Manifest = { readonly artifacts: ReadonlyArray<Artifact> }
const failures: Array<string> = []
const run = (command: string, args: ReadonlyArray<string>, cwd: string) => spawnSync(command, [...args], {
  cwd, encoding: "utf8", stdio: "pipe",
  env: { ...process.env, BUN_TMPDIR: cwd, BUN_INSTALL: join(cwd, ".bun-install"), TMPDIR: cwd }
})
const outputText = (value: unknown): string => typeof value === "string" ? value : value instanceof Uint8Array ? new TextDecoder().decode(value) : String(value)
const artifactBytes = (directory: string, artifact: Artifact): Uint8Array => new Uint8Array(readFileSync(join(directory, "blobs", artifact.digest)))
const artifact = (manifest: Manifest, id: string): Artifact | undefined => manifest.artifacts.find((item) => item.id === id)

const api = makeReleaseApi(NodeReleaseLayer)
let scratch: string | undefined
try {
  const store = join(root, preparedRoot)
  const directories = (() => {
    try { return readdirSync(store, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name) } catch { return [] }
  })()
  const preparedDirectory = directories.length === 0
    ? (await api.prepare({ config: selfReleaseConfig(), workspace: root, preparedDirectory: store })).directory
    : join(store, directories.sort()[0]!)
  const inspection = await api.inspect({ prepared: preparedDirectory })
  if (!("project" in inspection)) failures.push("Prepared artifact inspection did not return the durable bundle projection.")
  const manifest = JSON.parse(readFileSync(join(preparedDirectory, "prepared-release.json"), "utf8")) as Manifest
  const npm = artifact(manifest, "npm-tarball:npm:npm-release")
  const native = artifact(manifest, "cli-linux-x64")
  if (npm === undefined) failures.push("Prepared bundle has no npm tarball artifact.")
  if (native === undefined) failures.push("Prepared bundle has no executable for the current Linux host.")
  const codexArchive = artifact(manifest, "agents-codex-archive")
  const claudeArchive = artifact(manifest, "agents-claude-archive")
  if (codexArchive === undefined || claudeArchive === undefined) failures.push("Prepared bundle is missing a provider-native agent archive.")

  scratch = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-candidate-artifacts-"))
  if (npm !== undefined) {
    const tarball = join(scratch, "ts-release.tgz")
    writeFileSync(tarball, artifactBytes(preparedDirectory, npm))
    writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "candidate-consumer", private: true }))
    const install = run("bun", ["add", "--offline", tarball], scratch)
    if (install.status !== 0) failures.push(`Bun tarball installation failed: ${install.stderr.trim()}`)
  }
  if (native !== undefined) {
    const binary = join(scratch, "ts-release-linux-x64")
    writeFileSync(binary, artifactBytes(preparedDirectory, native))
    chmodSync(binary, 0o755)
    const execution = run(binary, ["--version"], scratch)
    if (execution.status !== 0) failures.push(`Native Linux candidate did not execute: ${execution.stderr.trim()}`)
  }
  const cli = run("node", [join(root, "dist/bin/ts-release.js"), "--version"], root)
  if (cli.status !== 0 || !/^ts-release v0\.2\.0\n?$/u.test(outputText(cli.stdout).trim())) failures.push("The Node CLI bundle did not report candidate version 0.2.0.")
  const action = run("node", [join(root, "apps/ts-release-action/dist/index.js")], root)
  if (action.status === 0 || `${outputText(action.stdout)}\n${outputText(action.stderr)}`.includes("Action command must be one of") === false) failures.push("The Action bundle did not execute its parser under Node.")
  for (const [id, value] of [["agents-codex-archive", codexArchive], ["agents-claude-archive", claudeArchive]] as const) {
    if (value === undefined) continue
    const archive = join(scratch, `${id}.zip`)
    writeFileSync(archive, artifactBytes(preparedDirectory, value))
    const check = run("unzip", ["-t", archive], scratch)
    if (check.status !== 0) failures.push(`Generated ${id} archive failed unzip validation.`)
  }
  report("self-release-artifacts-report/v4", failures, {
    preparedDirectory, npmTarball: npm !== undefined, nativeLinuxBinary: native !== undefined,
    actionBundle: true, agentArchives: [codexArchive !== undefined, claudeArchive !== undefined].filter(Boolean).length,
    evidenceState: "contract-tested"
  })
} catch (cause) {
  report("self-release-artifacts-report/v4", [`Artifact verification failed: ${cause instanceof Error ? cause.message : String(cause)}`], { evidenceState: "contract-tested" })
} finally {
  await api.dispose()
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true })
}
