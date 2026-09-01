import {
  chmodSync, closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync
} from "node:fs"
import { basename, isAbsolute, join } from "node:path"
import { spawnSync } from "node:child_process"
import * as Effect from "effect/Effect"
import { makeReleaseApi } from "../../../src/api/api.js"
import { makeNodeReleaseLayer } from "../../../src/platform/node.js"
import { makeLocalPreparedReleaseStore } from "../../../src/release/prepared-store.js"
import { bunArtifactTargets } from "../../../src/capabilities/bun-targets.js"
import { inspectBunBinaryHeader } from "../../../scripts/lib/bun-targets.js"
import { encodeCompletePreparedReleaseRef } from "../../../src/release/prepared-ref.js"
import {
  githubSelfReleaseConfig, npmSelfReleaseConfig, preparedRoot, report, root
} from "./self-release-facts.js"

type Artifact = {
  readonly id: string
  readonly digest: { readonly hex: string }
  readonly path: string
  readonly size: number
}
type Collection = { readonly contract: { readonly id: string }, readonly members: ReadonlyArray<{ readonly key: string, readonly artifactId: string }> }
type Manifest = { readonly artifacts: ReadonlyArray<Artifact>, readonly collections: ReadonlyArray<Collection> }
const failures: Array<string> = []
const run = (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  environment: Readonly<Record<string, string>> = {}
) => spawnSync(command, [...args], {
  cwd, encoding: "utf8", stdio: "pipe",
  env: { ...process.env, ...environment }
})
const outputText = (value: unknown): string => typeof value === "string" ? value : value instanceof Uint8Array ? new TextDecoder().decode(value) : String(value)
const runWithFileStdout = (command: string, args: ReadonlyArray<string>, cwd: string, path: string) => {
  const descriptor = openSync(path, "w")
  try {
    const result = spawnSync(command, [...args], {
      cwd, encoding: "utf8", stdio: ["ignore", descriptor, "pipe"], env: { ...process.env }
    })
    return { ...result, stdout: readFileSync(path, "utf8") }
  } finally {
    closeSync(descriptor)
  }
}
const artifactBytes = (directory: string, artifact: Artifact): Uint8Array =>
  new Uint8Array(readFileSync(join(directory, "blobs", artifact.digest.hex)))
const artifact = (manifest: Manifest, id: string): Artifact | undefined => manifest.artifacts.find((item) => item.id === id)

const storeDirectory = join(root, preparedRoot)
const store = makeLocalPreparedReleaseStore(storeDirectory)
const api = makeReleaseApi(makeNodeReleaseLayer(store))
let scratch: string | undefined
try {
  const githubPrepared = await api.prepare({ config: githubSelfReleaseConfig(), workspace: root })
  const npmPrepared = await api.prepare({ config: npmSelfReleaseConfig(), workspace: root })
  const bundle = await Effect.runPromise(store.load(githubPrepared))
  const npmBundle = await Effect.runPromise(store.load(npmPrepared))
  const preparedDirectory = bundle.directory
  const npmPreparedDirectory = npmBundle.directory
  const [githubInspection, npmInspection] = await Promise.all([
    api.inspect({ prepared: githubPrepared }),
    api.inspect({ prepared: npmPrepared })
  ])
  if (!("project" in githubInspection) || !("project" in npmInspection)) {
    failures.push("Both prepared artifact inspections must return durable bundle projections.")
  }
  if (bundle.manifest.source.commit.toString() !== npmBundle.manifest.source.commit.toString() ||
      bundle.manifest.source.tree.toString() !== npmBundle.manifest.source.tree.toString() ||
      bundle.manifest.project.version.toString() !== npmBundle.manifest.project.version.toString()) {
    failures.push("The GitHub and npm prepared bundles do not bind the same exact source and version.")
  }
  const manifest = JSON.parse(readFileSync(join(preparedDirectory, "prepared-release.json"), "utf8")) as Manifest
  const npmManifest = JSON.parse(readFileSync(join(npmPreparedDirectory, "prepared-release.json"), "utf8")) as Manifest
  const npmPublication = npmBundle.manifest.publications.find((publication) =>
    publication._tag === "PreparedNpmPublication")
  const npm = npmPublication === undefined ? undefined : artifact(npmManifest, npmPublication.artifactId.toString())
  const native = artifact(manifest, "cli-linux-x64")
  if (npm === undefined) failures.push("Prepared bundle has no npm tarball artifact.")
  if (native === undefined) failures.push("Prepared bundle has no executable for the current Linux host.")
  const agentCollection = manifest.collections.find((collection) => collection.contract.id === "agents")
  const expectedAgentKeys = ["ts-release-claude.zip", "ts-release-codex.zip"]
  const agentMembers = agentCollection?.members ?? []
  if (agentMembers.map((member) => member.key).join(",") !== expectedAgentKeys.join(",")) {
    failures.push("Prepared bundle agent collection does not contain exactly the provider-native archives.")
  }
  const agentArchives = agentMembers.map((member) => ({ member, artifact: artifact(manifest, member.artifactId) }))
  if (agentArchives.some((entry) => entry.artifact === undefined)) failures.push("Prepared agent collection references a missing artifact.")

  scratch = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-candidate-artifacts-"))
  const targetMeasurements = bunArtifactTargets.map((target) => {
    const executable = artifact(manifest, `cli-${target.id}`)
    const tarGz = artifact(manifest, `cli-${target.id}-tar-gz`)
    const zip = artifact(manifest, `cli-${target.id}-zip`)
    if (executable === undefined || tarGz === undefined || zip === undefined) {
      failures.push(`Prepared bundle is missing the per-target executable/archive set for ${target.id}.`)
      return { target: target.id, executableBytes: 0, tarGzBytes: 0, zipBytes: 0 }
    }
    const executableBytes = artifactBytes(preparedDirectory, executable)
    try {
      const identity = inspectBunBinaryHeader(executableBytes.subarray(0, 4096))
      if (identity.format !== target.format || identity.architecture !== target.architecture) {
        failures.push(`${target.id} executable is ${identity.format}/${identity.architecture}, expected ${target.format}/${target.architecture}.`)
      }
    } catch (cause) {
      failures.push(`${target.id} executable header is invalid: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
    const expectedMember = basename(executable.path)
    for (const [format, archiveValue, args] of [
      ["tar.gz", tarGz, ["-tzf"]],
      ["zip", zip, ["-Z1"]]
    ] as const) {
      const archivePath = join(scratch!, `${target.id}.${format === "zip" ? "zip" : "tar.gz"}`)
      writeFileSync(archivePath, artifactBytes(preparedDirectory, archiveValue))
      const listed = format === "zip"
        ? run("unzip", [...args, archivePath], scratch!)
        : run("tar", [...args, archivePath], scratch!)
      if (listed.status !== 0 || outputText(listed.stdout).trim() !== expectedMember) {
        failures.push(`${target.id} ${format} archive does not contain exactly ${expectedMember}.`)
      }
    }
    return {
      target: target.id,
      executableBytes: executable.size,
      tarGzBytes: tarGz.size,
      zipBytes: zip.size
    }
  })
  if (npm !== undefined) {
    const tarball = join(scratch, "ts-release.tgz")
    writeFileSync(tarball, artifactBytes(npmPreparedDirectory, npm))
    writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "candidate-consumer", private: true }))
    const install = run("bun", ["add", "--offline", tarball], scratch)
    if (install.status !== 0) failures.push(`Bun tarball installation failed: ${install.stderr.trim()}`)
  }
  if (native !== undefined) {
    const binary = join(scratch, "ts-release-linux-x64")
    writeFileSync(binary, artifactBytes(preparedDirectory, native))
    chmodSync(binary, 0o755)
    const execution = run(binary, ["--version"], scratch)
    const expectedVersion = `ts-release v${bundle.manifest.project.version.toString()}`
    if (execution.status !== 0 || outputText(execution.stdout).trim() !== expectedVersion) {
      failures.push(
        `Native Linux candidate did not report ${expectedVersion}: status=${String(execution.status)} ` +
        `stdout=${JSON.stringify(outputText(execution.stdout).trim())} ` +
        `stderr=${JSON.stringify(outputText(execution.stderr).trim())}.`
      )
    }
  }
  const nodeCommand = process.env.TS_RELEASE_NODE_BIN ?? "node"
  const nodeIdentity = run(nodeCommand, ["-p", "process.execPath"], root)
  const nodeExecutable = outputText(nodeIdentity.stdout).trim()
  if (nodeIdentity.status !== 0 || !isAbsolute(nodeExecutable)) {
    failures.push(
      `The native Node executable could not be resolved: status=${String(nodeIdentity.status)} ` +
      `stdout=${JSON.stringify(nodeExecutable)} stderr=${JSON.stringify(outputText(nodeIdentity.stderr).trim())}.`
    )
  }
  const cli = runWithFileStdout(
    nodeCommand,
    [join(root, "dist/bin/ts-release.js"), "--version"],
    root,
    join(scratch, "node-cli.stdout")
  )
  const expectedCliVersion = `ts-release v${bundle.manifest.project.version.toString()}`
  if (cli.status !== 0 || outputText(cli.stdout).trim() !== expectedCliVersion) {
    failures.push(
      `The Node CLI bundle did not report candidate version ${bundle.manifest.project.version}: status=${String(cli.status)} ` +
      `stdout=${JSON.stringify(outputText(cli.stdout).trim())} stderr=${JSON.stringify(outputText(cli.stderr).trim())}.`
    )
  }
  const candidateCommit = bundle.manifest.source.commit.toString()
  const action = run("bun", [join(root, "apps/ts-release-action/dist/index.js")], root, {
    GITHUB_WORKSPACE: root,
    GITHUB_REPOSITORY: "mannyc2/ts-release",
    GITHUB_WORKFLOW_REF: "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/candidate",
    GITHUB_WORKFLOW_SHA: candidateCommit,
    GITHUB_RUN_ID: "1",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_SHA: candidateCommit,
    INPUT_COMMAND: "invalid",
    TS_RELEASE_ACTION_NODE: nodeExecutable,
    TS_RELEASE_ARTIFACT_BRIDGE: join(root, "apps/ts-release-action/dist/artifact-bridge.cjs")
  })
  if (action.status === 0 || `${outputText(action.stdout)}\n${outputText(action.stderr)}`.includes("Action command must be one of") === false) failures.push("The Action bundle did not execute its exact Linux/Bun parser command.")
  for (const { member, artifact: value } of agentArchives) {
    if (value === undefined) continue
    const archive = join(scratch, member.key)
    writeFileSync(archive, artifactBytes(preparedDirectory, value))
    const check = run("unzip", ["-t", archive], scratch)
    if (check.status !== 0) failures.push(`Generated ${member.key} archive failed unzip validation.`)
  }
  report("self-release-artifacts-report/v4", failures, {
    preparedReferences: {
      github: encodeCompletePreparedReleaseRef(githubPrepared),
      npm: encodeCompletePreparedReleaseRef(npmPrepared)
    },
    npmTarball: npm !== undefined, nativeLinuxBinary: native !== undefined,
    actionBundle: true, agentArchives: agentArchives.filter((entry) => entry.artifact !== undefined).length,
    artifactCount: manifest.artifacts.length,
    totalArtifactBytes: manifest.artifacts.reduce((total, item) => total + item.size, 0),
    uniqueBlobBytes: [...new Map(manifest.artifacts.map((item) => [item.digest.hex, item.size])).values()]
      .reduce((total, size) => total + size, 0),
    targetMeasurements,
    totalExecutableBytes: targetMeasurements.reduce((total, item) => total + item.executableBytes, 0),
    totalTarGzBytes: targetMeasurements.reduce((total, item) => total + item.tarGzBytes, 0),
    totalZipBytes: targetMeasurements.reduce((total, item) => total + item.zipBytes, 0),
    totalArchiveBytes: targetMeasurements.reduce((total, item) => total + item.tarGzBytes + item.zipBytes, 0),
    evidenceState: "contract-tested"
  })
} catch (cause) {
  report("self-release-artifacts-report/v4", [`Artifact verification failed: ${cause instanceof Error ? cause.message : String(cause)}`], { evidenceState: "contract-tested" })
} finally {
  await api.dispose()
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true })
}
