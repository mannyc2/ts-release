import { createHash } from "node:crypto"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, dirname, isAbsolute, join } from "node:path"
import { tarGz } from "../../src/drivers/archive.js"

const decoder = new TextDecoder()
const encoder = new TextEncoder()

const packages = [
  { id: "q-core", packageName: "effect-build" },
  { id: "a-bun", packageName: "effect-build-bun" },
  { id: "z-deno", packageName: "effect-build-deno" },
  { id: "b-esbuild", packageName: "effect-build-esbuild" },
  { id: "y-node-sea", packageName: "effect-build-node-sea" }
] as const

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")

const run = (
  argv: ReadonlyArray<string>,
  cwd: string,
  environment: Readonly<Record<string, string | undefined>>
): string => {
  const result = Bun.spawnSync([...argv], { cwd, env: environment, stdout: "pipe", stderr: "pipe" })
  const stdout = decoder.decode(result.stdout)
  const stderr = decoder.decode(result.stderr)
  if (result.exitCode !== 0) {
    throw new Error([`${argv.join(" ")} exited ${result.exitCode}.`, stdout.trim(), stderr.trim()]
      .filter((line) => line.length > 0).join("\n"))
  }
  return stdout
}

const git = (
  workspace: string,
  executable: string,
  environment: Readonly<Record<string, string | undefined>>,
  ...argv: string[]
): string => run([executable, ...argv], workspace, environment).trim()

const tarball = (packageName: string): Uint8Array => tarGz([
  {
    path: "package/package.json",
    data: encoder.encode(JSON.stringify({
      name: packageName,
      version: "0.3.0",
      type: "module",
      ...(packageName === "effect-build"
        ? { peerDependencies: { effect: "4.0.0-rc.108" } }
        : { dependencies: { "effect-build": "0.3.0" } })
    })),
    mode: 0o644
  },
  {
    path: "package/index.js",
    data: encoder.encode(`export const packageName = ${JSON.stringify(packageName)}\n`),
    mode: 0o644
  }
])

const fakeArtifactBridge = (): string => [
  '"use strict"',
  'const { appendFileSync, cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } = require("node:fs")',
  'const { join } = require("node:path")',
  'const requestPath = process.argv[2]',
  'const responsePath = process.argv[3]',
  'const store = process.env.TS_RELEASE_FAKE_ARTIFACT_ROOT',
  'const events = process.env.TS_RELEASE_FAKE_ARTIFACT_EVENTS',
  'const write = (value) => writeFileSync(responsePath, `${JSON.stringify(value)}\\n`)',
  'try {',
  '  if (!requestPath || !responsePath || !store || !events) throw new Error("fake bridge is missing its closed fixture boundary")',
  '  const request = JSON.parse(readFileSync(requestPath, "utf8"))',
  '  if (typeof request.name !== "string" || !/^[A-Za-z0-9._:-]+$/.test(request.name)) throw new Error("unsafe fake artifact name")',
  '  const artifact = join(store, request.name)',
  '  if (request.operation === "upload") {',
  '    rmSync(artifact, { recursive: true, force: true })',
  '    mkdirSync(store, { recursive: true })',
  '    cpSync(request.rootDirectory, artifact, { recursive: true })',
  '    appendFileSync(events, `upload:${request.name}\\n`)',
  '    write({ ok: true, output: { id: 35, digest: "a".repeat(64) } })',
  '  } else if (request.operation === "download") {',
  '    mkdirSync(request.destination, { recursive: true })',
  '    for (const entry of readdirSync(artifact)) cpSync(join(artifact, entry), join(request.destination, entry), { recursive: true })',
  '    appendFileSync(events, `download:${request.name}\\n`)',
  '    write({ ok: true, output: { path: request.destination, digestMismatch: false } })',
  '  } else {',
  '    throw new Error("unknown fake bridge operation")',
  '  }',
  '} catch (cause) {',
  '  write({ ok: false, error: cause instanceof Error ? cause.message : String(cause) })',
  '  process.exitCode = 1',
  '}'
].join("\n")

const output = (contents: string, name: string): string => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  const match = new RegExp(`(?:^|\\n)${escaped}<<([^\\n]+)\\n([\\s\\S]*?)\\n\\1(?:\\n|$)`, "u").exec(contents)
  if (match?.[2] === undefined) throw new Error(`Bundled Action did not emit ${name}.`)
  return match[2]
}

const equal = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

interface PreparedArtifactJson {
  readonly id: string
  readonly blob: { readonly hex: string }
}

interface PreparedPublicationJson {
  readonly _tag: string
  readonly id: string
  readonly packageName?: string
  readonly assets?: ReadonlyArray<{
    readonly artifactId: string
    readonly name: string
    readonly mediaType: string
  }>
}

interface PreparedReleaseJson {
  readonly artifacts: ReadonlyArray<PreparedArtifactJson>
  readonly publications: ReadonlyArray<PreparedPublicationJson>
  readonly provenance: { readonly execution: { readonly npmPack: string } }
}

export interface PrepackedActionConsumerReport {
  readonly platform: "native-linux" | "local-linux-boundary-simulation"
  readonly preparedDigest: string
  readonly actionBundleSha256: string
  readonly publicationOrder: ReadonlyArray<string>
  readonly blobCount: number
  readonly npmPack: "not-used"
}

/**
 * Exercise the checked, self-contained Action bundle from a fresh external Git
 * workspace. On non-Linux development hosts only the platform string is
 * preloaded to reach the same prepacked-only code path; CI executes it natively
 * on Linux and is the distributable qualification receipt.
 */
export const checkPrepackedActionConsumer = (input: {
  readonly actionBundle: string
  readonly nodeExecutable?: string
}): PrepackedActionConsumerReport => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-prepacked-action-")))
  try {
    const actionDirectory = join(scratch, "action")
    const actionBundle = join(actionDirectory, "index.js")
    const workspace = join(scratch, "consumer")
    const candidate = join(workspace, ".release", "candidate")
    const artifacts = join(scratch, "artifacts")
    const events = join(scratch, "artifact-events.txt")
    const outputFile = join(scratch, "github-output.txt")
    const summaryFile = join(scratch, "github-summary.txt")
    const home = join(scratch, "home")
    const temporary = join(scratch, "tmp")
    const fakeBridge = join(scratch, "artifact-bridge.cjs")
    const sentinelBin = join(scratch, "sentinel-bin")
    const npmMarker = join(scratch, "npm-invoked")
    const platformPreload = join(scratch, "linux-platform-preload.ts")
    mkdirSync(actionDirectory)
    mkdirSync(workspace, { recursive: true })
    mkdirSync(artifacts)
    mkdirSync(sentinelBin)
    mkdirSync(home)
    mkdirSync(temporary)
    writeFileSync(events, "")
    writeFileSync(outputFile, "")
    writeFileSync(summaryFile, "")
    writeFileSync(fakeBridge, fakeArtifactBridge())
    const checkedActionBytes = new Uint8Array(readFileSync(input.actionBundle))
    writeFileSync(actionBundle, checkedActionBytes)
    const copiedActionBytes = new Uint8Array(readFileSync(actionBundle))
    if (!equal(checkedActionBytes, copiedActionBytes) || existsSync(join(actionDirectory, "node_modules"))) {
      throw new Error("External Action consumer did not receive one exact dependency-free checked bundle.")
    }
    writeFileSync(join(sentinelBin, "npm"), `#!/bin/sh\nprintf invoked > ${JSON.stringify(npmMarker)}\nexit 97\n`)
    chmodSync(join(sentinelBin, "npm"), 0o755)
    writeFileSync(platformPreload, 'Object.defineProperty(process, "platform", { value: "linux" })\n')

    const nodeExecutable = input.nodeExecutable ?? Bun.which("node")
    const gitExecutable = Bun.which("git")
    if (nodeExecutable === null || nodeExecutable === undefined || !isAbsolute(nodeExecutable)) {
      throw new Error("The bundled Action consumer requires one selected absolute Node executable.")
    }
    if (gitExecutable === null || !isAbsolute(gitExecutable)) {
      throw new Error("The bundled Action consumer requires one selected absolute Git executable.")
    }
    const selectedNode = realpathSync(nodeExecutable)
    const selectedGit = realpathSync(gitExecutable)
    const controlledPath = [...new Set([
      sentinelBin,
      dirname(process.execPath),
      dirname(selectedNode),
      dirname(selectedGit),
      "/usr/bin",
      "/bin"
    ])].join(delimiter)
    const fixtureEnvironment = {
      CI: "true",
      PATH: controlledPath,
      HOME: home,
      TMPDIR: temporary,
      LANG: "C",
      LC_ALL: "C",
      TZ: "UTC",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      NPM_CONFIG_USERCONFIG: "/dev/null"
    } as const

    const subjects = packages.map((subject) => {
      const bytes = tarball(subject.packageName)
      const relativePath = `.release/candidate/${subject.packageName}.tgz`
      return { ...subject, bytes, path: relativePath, digest: sha256(bytes) }
    })
    writeFileSync(join(workspace, "package.json"), `${JSON.stringify({
      name: "effect-build",
      version: "0.3.0",
      repository: "https://github.com/owner/repository.git"
    }, null, 2)}\n`)
    writeFileSync(join(workspace, "release.config.json"), `${JSON.stringify({
      project: {
        name: "effect-build",
        packageName: "effect-build",
        version: "0.3.0",
        tag: "v0.3.0",
        repository: "owner/repository"
      },
      publish: {
        prepackedNpm: subjects.map((subject) => ({
          id: subject.id,
          path: subject.path,
          packageName: subject.packageName,
          version: "0.3.0",
          sha256: subject.digest,
          registry: "https://registry.npmjs.org/",
          distTag: "latest",
          access: "public",
          authentication: { strategy: "token", credential: "NPM_TOKEN" },
          provenance: "disabled"
        })),
        github: {
          repository: "owner/repository",
          tokenEnv: "GITHUB_TOKEN",
          draft: false,
          prerelease: false,
          body: "exact five-package candidate",
          ids: subjects.map((subject) => `prepacked-npm:${subject.id}`)
        }
      }
    }, null, 2)}\n`)
    writeFileSync(join(workspace, ".gitignore"), "/.release/\n")
    git(workspace, selectedGit, fixtureEnvironment, "init", "-q")
    git(workspace, selectedGit, fixtureEnvironment, "config", "user.email", "fixture@example.test")
    git(workspace, selectedGit, fixtureEnvironment, "config", "user.name", "fixture")
    git(workspace, selectedGit, fixtureEnvironment, "add", ".")
    git(workspace, selectedGit, fixtureEnvironment, "commit", "-qm", "exact prepacked candidate")
    const commit = git(workspace, selectedGit, fixtureEnvironment, "rev-parse", "HEAD")
    mkdirSync(candidate, { recursive: true })
    for (const subject of subjects) writeFileSync(join(workspace, subject.path), subject.bytes)
    if (git(workspace, selectedGit, fixtureEnvironment, "status", "--porcelain").length !== 0) {
      throw new Error("External Action consumer is dirty after generating ignored candidate tarballs.")
    }
    const nativeLinux = process.platform === "linux"
    const action = Bun.spawnSync([
      process.execPath,
      "--no-env-file",
      "--no-install",
      ...(nativeLinux ? [] : ["--preload", platformPreload]),
      actionBundle
    ], {
      cwd: workspace,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...fixtureEnvironment,
        GITHUB_ACTIONS: "true",
        GITHUB_WORKSPACE: workspace,
        GITHUB_REPOSITORY: "owner/repository",
        GITHUB_WORKFLOW_REF: "owner/repository/.github/workflows/release.yml@refs/heads/main",
        GITHUB_WORKFLOW_SHA: commit,
        GITHUB_RUN_ID: "35",
        GITHUB_RUN_ATTEMPT: "1",
        GITHUB_SHA: commit,
        GITHUB_OUTPUT: outputFile,
        GITHUB_STEP_SUMMARY: summaryFile,
        ACTIONS_RUNTIME_TOKEN: "runtime-token-fixture",
        ACTIONS_RESULTS_URL: "https://results.example.invalid/",
        INPUT_COMMAND: "prepare",
        INPUT_CONFIG: "release.config.json",
        INPUT_PREPARED: "",
        TS_RELEASE_ACTION_NODE: selectedNode,
        TS_RELEASE_ARTIFACT_BRIDGE: fakeBridge,
        TS_RELEASE_FAKE_ARTIFACT_ROOT: artifacts,
        TS_RELEASE_FAKE_ARTIFACT_EVENTS: events
      }
    })
    if (action.exitCode !== 0) {
      throw new Error([
        `Checked bundled Action exited ${action.exitCode}.`,
        decoder.decode(action.stdout).trim(),
        decoder.decode(action.stderr).trim()
      ].filter((line) => line.length > 0).join("\n"))
    }
    if (existsSync(npmMarker)) throw new Error("Prepacked Action preparation invoked npm pack.")
    const outputs = readFileSync(outputFile, "utf8")
    const prepared = output(outputs, "prepared-ref")
    if (output(outputs, "report-ref") !== ".release/ts-release/action-report.json") {
      throw new Error("Bundled Action emitted a non-canonical report reference.")
    }
    const reference = /\/artifacts\/([^#]+)#sha256-([a-f0-9]{64})$/u.exec(prepared)
    if (reference?.[1] === undefined || reference[2] === undefined) {
      throw new Error("Bundled Action emitted a non-canonical prepared reference.")
    }
    const artifactName = reference[1]
    const preparedDigest = reference[2]
    const artifactRoot = join(artifacts, artifactName)
    const bundleRoot = join(artifactRoot, preparedDigest)
    const manifest = JSON.parse(readFileSync(join(bundleRoot, "prepared-release.json"), "utf8")) as PreparedReleaseJson
    const expectedOrder = [...packages.map((subject) => `npm:${subject.id}`), "github:github-release"]
    const publicationOrder = manifest.publications.map((publication) => publication.id)
    if (JSON.stringify(publicationOrder) !== JSON.stringify(expectedOrder)) {
      throw new Error(`Bundled Action changed authored publication order: ${publicationOrder.join(", ")}.`)
    }
    const github = manifest.publications.at(-1)
    const expectedAssets = subjects.map((subject) => ({
      artifactId: `prepacked-npm:${subject.id}`,
      name: `${subject.packageName}.tgz`,
      mediaType: "application/gzip"
    }))
    const assetTuples = (github?.assets ?? []).map((asset) => [asset.artifactId, asset.name, asset.mediaType])
    const expectedAssetTuples = expectedAssets.map((asset) => [asset.artifactId, asset.name, asset.mediaType])
    if (github?._tag !== "PreparedGitHubPublication" ||
        JSON.stringify(assetTuples) !== JSON.stringify(expectedAssetTuples)) {
      throw new Error(
        `Bundled Action GitHub publication did not retain the same five tarball artifacts and names in order: ${JSON.stringify(github?.assets)}.`
      )
    }
    if (manifest.provenance.execution.npmPack !== "not-used") {
      throw new Error("Bundled Action did not preserve the no-repack execution receipt.")
    }
    const artifactById = new Map(manifest.artifacts.map((artifact) => [artifact.id, artifact]))
    for (const subject of subjects) {
      const artifact = artifactById.get(`prepacked-npm:${subject.id}`)
      if (artifact === undefined || artifact.blob.hex !== subject.digest) {
        throw new Error(`Bundled Action changed ${subject.packageName} artifact identity.`)
      }
      const stored = new Uint8Array(readFileSync(join(bundleRoot, "blobs", artifact.blob.hex)))
      if (!equal(stored, subject.bytes)) throw new Error(`Bundled Action changed ${subject.packageName} tarball bytes.`)
    }
    const blobs = readdirSync(join(bundleRoot, "blobs"))
    if (blobs.length !== packages.length || new Set(blobs).size !== packages.length) {
      throw new Error("Bundled Action did not persist exactly five distinct candidate blobs.")
    }
    const artifactEvents = readFileSync(events, "utf8").trim().split("\n")
    if (artifactEvents.length !== 2 || artifactEvents[0] !== `upload:${artifactName}` ||
        artifactEvents[1] !== `download:${artifactName}`) {
      throw new Error(`Bundled Action store did not upload then re-observe exact bytes: ${artifactEvents.join(", ")}.`)
    }
    const report = JSON.parse(readFileSync(join(workspace, ".release/ts-release/action-report.json"), "utf8")) as {
      readonly command?: string
      readonly status?: string
      readonly prepared?: string
    }
    if (report.command !== "prepare" || report.status !== "complete" || report.prepared !== prepared) {
      throw new Error("Bundled Action did not report one complete durable preparation.")
    }
    return {
      platform: nativeLinux ? "native-linux" : "local-linux-boundary-simulation",
      preparedDigest,
      actionBundleSha256: sha256(checkedActionBytes),
      publicationOrder,
      blobCount: blobs.length,
      npmPack: "not-used"
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}
