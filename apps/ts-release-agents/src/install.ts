import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync
} from "node:fs"
import { join, sep } from "node:path"
import { spawnSync } from "node:child_process"

export type AgentProvider = "codex" | "claude"

export interface InstalledAgentArchive {
  readonly provider: AgentProvider
  /** Disposable stand-in for the user's home directory. */
  readonly userRoot: string
  /** Provider-native cache owner below the disposable user root. */
  readonly providerRoot: string
  readonly packageRoot: string
  readonly version: string
  readonly entries: ReadonlyArray<string>
}

const fail = (reason: string): never => { throw new Error(reason) }

const archiveEntries = (archive: string): ReadonlyArray<string> => {
  const listed = spawnSync("unzip", ["-Z1", archive], { encoding: "utf8", stdio: "pipe" })
  if (listed.status !== 0) {
    fail(`Could not inspect agent archive ${archive}: ${listed.stderr.trim() || listed.stdout.trim()}`)
  }
  const entries = listed.stdout.split("\n").filter((entry) => entry.length > 0)
  if (entries.length === 0) fail(`Agent archive ${archive} is empty.`)
  if (new Set(entries).size !== entries.length) fail(`Agent archive ${archive} contains duplicate paths.`)
  for (const entry of entries) {
    const segments = entry.split("/")
    if (
      !entry.startsWith("ts-release/") ||
      entry.startsWith("/") ||
      entry.includes("\\") ||
      entry.includes("\0") ||
      segments.some((segment) => segment === "" || segment === "." || segment === "..")
    ) fail(`Agent archive ${archive} contains unsafe path ${JSON.stringify(entry)}.`)
  }
  return entries
}

const verifyContainedTree = (directory: string): void => {
  const root = realpathSync(directory)
  const prefix = `${root}${sep}`
  const visit = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry)
      const status = lstatSync(path)
      if (status.isSymbolicLink()) fail(`Installed agent package contains a symlink: ${path}`)
      if (!status.isDirectory() && !status.isFile()) fail(`Installed agent package contains a special file: ${path}`)
      const canonical = realpathSync(path)
      if (canonical !== root && !canonical.startsWith(prefix)) fail(`Installed agent path escapes its package: ${path}`)
      if (status.isDirectory()) visit(path)
    }
  }
  visit(directory)
}

/**
 * Installs one generated archive into a disposable provider-owned plugin
 * directory. This performs local ZIP inspection and extraction only.
 */
export const installAgentArchive = (
  provider: AgentProvider,
  archive: string,
  userRoot: string
): InstalledAgentArchive => {
  const entries = archiveEntries(archive)
  mkdirSync(userRoot, { recursive: true, mode: 0o700 })
  const stage = mkdtempSync(join(userRoot, `.ts-release-${provider}-stage-`))
  try {
    const extracted = spawnSync("unzip", ["-qq", archive, "-d", stage], {
      encoding: "utf8",
      stdio: "pipe"
    })
    if (extracted.status !== 0) {
      fail(`Could not install ${provider} agent archive: ${extracted.stderr.trim() || extracted.stdout.trim()}`)
    }
    const stagedPackage = join(stage, "ts-release")
    if (!existsSync(stagedPackage) || !lstatSync(stagedPackage).isDirectory()) {
      fail(`Installed ${provider} package root is missing.`)
    }
    verifyContainedTree(stagedPackage)
    const native = provider === "codex" ? ".codex-plugin" : ".claude-plugin"
    const manifestPath = join(stagedPackage, native, "plugin.json")
    if (!existsSync(manifestPath)) fail(`Installed ${provider} native manifest is missing.`)
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"))
    const version = typeof manifest === "object" && manifest !== null &&
        "version" in manifest && typeof manifest.version === "string"
      ? manifest.version
      : fail(`Installed ${provider} native manifest version is missing.`)
    if (!/^[0-9A-Za-z][0-9A-Za-z._+-]*$/u.test(version)) {
      fail(`Installed ${provider} native manifest version is not a safe cache key.`)
    }
    const providerRoot = join(
      userRoot,
      provider === "codex" ? ".codex" : ".claude",
      "plugins",
      "cache",
      "local-archive",
      "ts-release"
    )
    const packageRoot = join(providerRoot, version)
    if (existsSync(packageRoot)) fail(`Disposable ${provider} package root already exists: ${packageRoot}`)
    mkdirSync(providerRoot, { recursive: true, mode: 0o700 })
    renameSync(stagedPackage, packageRoot)
    verifyContainedTree(packageRoot)
    return { provider, userRoot, providerRoot, packageRoot, version, entries }
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}
