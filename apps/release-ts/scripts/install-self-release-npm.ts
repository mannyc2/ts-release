import { createHash } from "node:crypto"
import {
  appendFileSync, chmodSync, mkdirSync, readFileSync, renameSync, rmSync,
  realpathSync, statSync, symlinkSync, writeFileSync
} from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

export const pinnedNpmReleaseTool = {
  version: "11.11.0",
  tarballUrl: "https://registry.npmjs.org/npm/-/npm-11.11.0.tgz",
  integrity: "sha512-82gRxKrh/eY5UnNorkTFcdBQAGpgjWehkfGVqAGlJjejEtJZGGJUqjo3mbBTNbc5BTnPKGVtGPBZGhElujX5cw==",
  shasum: "db5ad0ed255e1a29cf241c4112ee81d2220a4edb"
} as const

const maximumArchiveBytes = 20 * 1024 * 1024
const exactNodeVersion = "v22.22.2"
const systemTar = "/usr/bin/tar"

const fail = (reason: string): never => { throw new Error(`Pinned npm installation refused: ${reason}`) }

const forbiddenToolEnvironment = new Set([
  "node_options",
  "node_path",
  "node_extra_ca_certs",
  "node_tls_reject_unauthorized",
  "node_use_env_proxy",
  "ssl_cert_file",
  "ssl_cert_dir",
  "openssl_conf",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "curl_ca_bundle",
  "git_ssl_cainfo",
  "bun_options",
  "ld_preload",
  "ld_library_path",
  "dyld_insert_libraries",
  "dyld_library_path",
  "dyld_framework_path",
  "git_ssh",
  "git_ssh_command",
  "git_proxy_command",
  "git_allow_protocol",
  "git_protocol_from_user"
])

export const assertNoToolTransportEnvironment = (
  environment: Readonly<Record<string, string | undefined>>
): void => {
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined || value.length === 0) continue
    const normalized = name.toLocaleLowerCase("en-US")
    if (forbiddenToolEnvironment.has(normalized) || normalized.startsWith("bun_config_") ||
        normalized.startsWith("git_")) {
      fail(`${name} must be absent before any release tool starts`)
    }
  }
}

export const verifyArchiveDigest = (
  bytes: Uint8Array,
  expected: { readonly integrity: string, readonly shasum: string }
): void => {
  if (bytes.length === 0 || bytes.length > maximumArchiveBytes || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    fail("archive is empty, oversized, or not gzip")
  }
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`
  const shasum = createHash("sha1").update(bytes).digest("hex")
  if (integrity !== expected.integrity || shasum !== expected.shasum) fail("archive digest differs from the audited npm release")
}

export const pinnedNpmToolRoot = (workspace = process.cwd()): string =>
  resolve(workspace, ".release", "tools", `npm-${pinnedNpmReleaseTool.version}`)

export const pinnedNpmArchivePath = (workspace = process.cwd()): string =>
  join(pinnedNpmToolRoot(workspace), `npm-${pinnedNpmReleaseTool.version}.tgz`)

export const pinnedNpmExecutable = (workspace = process.cwd()): string =>
  join(pinnedNpmToolRoot(workspace), "bin", "npm")

export const pinnedNpmClosedEnvironment = (
  workspace = process.cwd(),
  path = "/usr/bin:/bin"
): Readonly<Record<string, string>> => {
  const home = join(pinnedNpmToolRoot(workspace), "empty-home")
  const userConfig = join(home, "npm-userconfig")
  const globalConfig = join(home, "npm-globalconfig")
  const canonicalHome = realpathSync(home)
  if (canonicalHome !== home || !statSync(home).isDirectory() || (statSync(home).mode & 0o077) !== 0) {
    fail("private npm home is not one canonical mode-0700 directory")
  }
  for (const config of [userConfig, globalConfig]) {
    const metadata = statSync(config)
    if (realpathSync(config) !== config || !metadata.isFile() || (metadata.mode & 0o777) !== 0o600 ||
      readFileSync(config).length !== 0) {
      fail("private npm configuration is not one canonical empty mode-0600 file")
    }
  }
  return {
    HOME: home,
    LANG: "C.UTF-8",
    NPM_CONFIG_USERCONFIG: userConfig,
    NPM_CONFIG_GLOBALCONFIG: globalConfig,
    PATH: path
  }
}

export const runExactExecutable = (
  command: string,
  args: ReadonlyArray<string>,
  environment: Readonly<Record<string, string>>
): string => {
  const result = spawnSync(command, [...args], { encoding: "utf8", stdio: "pipe", env: environment })
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed`)
  return result.stdout.trim()
}

const exactToolPath = (
  environment: Readonly<Record<string, string | undefined>>,
  name: "TS_RELEASE_NODE_BIN" | "TS_RELEASE_BUN_BIN"
): string => {
  const value = environment[name]
  if (value === undefined || value.length === 0 || !isAbsolute(value)) {
    return fail(`${name} must name one absolute setup-Action output`)
  }
  const canonical = realpathSync(value)
  if (!statSync(canonical).isFile()) fail(`${name} does not resolve to one regular executable`)
  return canonical
}

export const releaseNodeExecutable = (
  environment: Readonly<Record<string, string | undefined>> = process.env
): string => exactToolPath(environment, "TS_RELEASE_NODE_BIN")

export const releaseBunExecutable = (
  environment: Readonly<Record<string, string | undefined>> = process.env
): string => exactToolPath(environment, "TS_RELEASE_BUN_BIN")

export const reauthenticatePinnedNpm = (
  workspace = process.cwd(),
  nodePath = releaseNodeExecutable()
): string => {
  const toolRoot = pinnedNpmToolRoot(workspace)
  const archive = pinnedNpmArchivePath(workspace)
  const bytes = new Uint8Array(readFileSync(archive))
  verifyArchiveDigest(bytes, pinnedNpmReleaseTool)
  const packageRoot = join(toolRoot, "package")
  const toolBin = join(toolRoot, "bin")
  rmSync(packageRoot, { recursive: true, force: true })
  rmSync(toolBin, { recursive: true, force: true })
  const extraction = spawnSync(systemTar, ["-xzf", archive, "-C", toolRoot, "--no-same-owner"], {
    encoding: "utf8",
    stdio: "pipe",
    env: { LANG: "C.UTF-8", PATH: "/usr/bin:/bin" }
  })
  if (extraction.status !== 0) fail("audited archive extraction failed")
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
    readonly name?: string
    readonly version?: string
    readonly bin?: Readonly<Record<string, string>>
  }
  if (manifest.name !== "npm" || manifest.version !== pinnedNpmReleaseTool.version ||
      manifest.bin?.npm !== "bin/npm-cli.js" || manifest.bin.npx !== "bin/npx-cli.js") {
    fail("extracted npm package identity is not exact")
  }
  mkdirSync(toolBin, { recursive: true })
  symlinkSync("../package/bin/npm-cli.js", pinnedNpmExecutable(workspace))
  const executable = pinnedNpmExecutable(workspace)
  const metadata = statSync(executable)
  if (!metadata.isFile() || (metadata.mode & 0o111) === 0) fail("extracted npm launcher is not executable")
  const privateHome = join(toolRoot, "empty-home")
  rmSync(privateHome, { recursive: true, force: true })
  mkdirSync(privateHome, { recursive: true, mode: 0o700 })
  writeFileSync(join(privateHome, "npm-userconfig"), "", { mode: 0o600, flag: "wx" })
  writeFileSync(join(privateHome, "npm-globalconfig"), "", { mode: 0o600, flag: "wx" })
  const closedEnvironment = pinnedNpmClosedEnvironment(
    workspace,
    `${dirname(nodePath)}:/usr/bin:/bin`
  )
  if (runExactExecutable(nodePath, ["--version"], closedEnvironment) !== exactNodeVersion) fail(`Node is not exact ${exactNodeVersion}`)
  if (runExactExecutable(executable, ["--version"], closedEnvironment) !== pinnedNpmReleaseTool.version) fail("extracted npm CLI reports a different version")
  return dirname(executable)
}

const fetchArchive = async (): Promise<Uint8Array> => {
  const response = await fetch(pinnedNpmReleaseTool.tarballUrl, {
    headers: { accept: "application/octet-stream" },
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok || response.url !== pinnedNpmReleaseTool.tarballUrl || response.headers.has("location")) {
    fail("registry did not return the exact terminal npm tarball response")
  }
  const declaredText = response.headers.get("content-length")
  if (declaredText !== null) {
    const declared = Number(declaredText)
    if (!Number.isSafeInteger(declared) || declared <= 0 || declared > maximumArchiveBytes) fail("registry returned an invalid npm tarball length")
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (declaredText !== null && bytes.length !== Number(declaredText)) fail("registry npm tarball response was truncated")
  verifyArchiveDigest(bytes, pinnedNpmReleaseTool)
  return bytes
}

const main = async (): Promise<void> => {
  assertNoToolTransportEnvironment(process.env)
  const nodePath = releaseNodeExecutable()
  const bunPath = releaseBunExecutable()
  const identityEnvironment = { HOME: pinnedNpmToolRoot(), LANG: "C.UTF-8", PATH: "/usr/bin:/bin" }
  if (runExactExecutable(nodePath, ["--version"], identityEnvironment) !== exactNodeVersion ||
      runExactExecutable(bunPath, ["--version"], identityEnvironment) !== "1.3.14") {
    fail("setup-Action tool outputs do not identify exact Node 22.22.2 and Bun 1.3.14")
  }
  const githubPath = process.env.GITHUB_PATH
  if (githubPath === undefined || githubPath.length === 0) return fail("GITHUB_PATH is unavailable")
  const toolRoot = pinnedNpmToolRoot()
  const staging = `${toolRoot}.staging`
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  try {
    const bytes = await fetchArchive()
    const stagedArchive = join(staging, `npm-${pinnedNpmReleaseTool.version}.tgz`)
    writeFileSync(stagedArchive, bytes, { mode: 0o400 })
    rmSync(toolRoot, { recursive: true, force: true })
    renameSync(staging, toolRoot)
    chmodSync(pinnedNpmArchivePath(), 0o400)
    const bin = reauthenticatePinnedNpm(process.cwd(), nodePath)
    appendFileSync(githubPath, `${bin}\n`, { encoding: "utf8" })
    console.log(JSON.stringify({
      schemaVersion: "ts-release/pinned-npm-tool/v1",
      status: "installed",
      version: pinnedNpmReleaseTool.version,
      integrity: pinnedNpmReleaseTool.integrity,
      shasum: pinnedNpmReleaseTool.shasum
    }))
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

if (import.meta.main) await main()
