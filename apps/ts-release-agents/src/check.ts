import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { buildAgents } from "./build.js"
import { installAgentArchive } from "./install.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const output = join(root, ".release", "agents")
const app = join(root, "apps", "ts-release-agents")
const fail = (reason: string): never => { throw new Error(reason) }
const bytes = (path: string): Uint8Array => new Uint8Array(readFileSync(path))
const same = (left: Uint8Array, right: Uint8Array): boolean => left.length === right.length && left.every((byte, index) => byte === right[index])
const json = (path: string): Record<string, unknown> => {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${path} must be an object.`)
  return value as Record<string, unknown>
}
const rootVersion = String((json(join(root, "package.json")).version ?? ""))
const generatedFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? generatedFiles(path) : [path]
})
const containsFiles = (directory: string): boolean => readdirSync(directory, { withFileTypes: true }).some((entry) => {
  return entry.isDirectory() ? containsFiles(join(directory, entry.name)) : true
})
const commandFailure = (result: ReturnType<typeof spawnSync>): string => {
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : ""
  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : ""
  return stderr || stdout || result.error?.message || "unknown command failure"
}

const firstPaths = buildAgents()
const first = firstPaths.map((path) => bytes(path))
const secondPaths = buildAgents()
const second = secondPaths.map((path) => bytes(path))
if (first.length !== second.length || first.some((value, index) => !same(value, second[index]!))) fail("Agent archives are not deterministic.")
for (const provider of ["codex", "claude"] as const) {
  const packageRoot = join(output, provider, "ts-release")
  const manifestPath = join(packageRoot, provider === "codex" ? ".codex-plugin" : ".claude-plugin", "plugin.json")
  if (!existsSync(manifestPath)) fail(`Generated ${provider} manifest is missing.`)
  if (json(manifestPath).version !== rootVersion) fail(`Generated ${provider} manifest version diverges from the root package.`)
  if (!existsSync(join(packageRoot, "skills", "release", "SKILL.md"))) fail(`Generated ${provider} skill is missing.`)
}
const codex = json(join(output, "codex", "ts-release", ".codex-plugin", "plugin.json"))
if (codex.skills !== "./skills/") fail("Codex manifest must point to ./skills/.")
const evals = json(join(app, "evals", "cases.json"))
if (!Array.isArray(evals.cases) || evals.cases.length < 6) fail("Agent eval coverage is incomplete.")
for (const path of generatedFiles(join(output, "codex", "ts-release"))) {
  const text = readFileSync(path, "utf8")
  if (/npm_[A-Z0-9_]{6,}/u.test(text)) fail(`Generated agent content resembles a raw secret: ${path}`)
  if (text.includes("../")) fail(`Generated agent content contains parent traversal: ${path}`)
}
for (const forbidden of [".agents", ".claude-plugin", ".codex-plugin", "ts-release-plugin"]) {
  if (existsSync(join(root, forbidden)) && containsFiles(join(root, forbidden))) fail(`Obsolete root agent owner remains: ${forbidden}`)
}
for (const path of ["SKILL.md", join("skills", "release", "SKILL.md")]) {
  if (existsSync(join(root, path))) fail(`Root canonical agent owner remains: ${path}`)
}
const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", stdio: "pipe" })
if (tracked.status !== 0) fail(`Could not inspect tracked agent owners: ${commandFailure(tracked)}`)
const trackedFiles = tracked.stdout.split("\0").filter((path) => path.length > 0)
const canonicalRootOwners = trackedFiles.filter((path) =>
  path === ".codex-plugin/plugin.json" ||
  path === ".claude-plugin/plugin.json" ||
  path === "skills/release/SKILL.md" ||
  path === "SKILL.md" ||
  path.startsWith("ts-release-plugin/"))
if (canonicalRootOwners.length !== 0) fail(`Tracked root canonical agent owners remain: ${canonicalRootOwners.join(", ")}`)
const skillOwners = trackedFiles.filter((path) => path.endsWith("/skills/release/SKILL.md"))
if (skillOwners.length !== 1 || skillOwners[0] !== "apps/ts-release-agents/skills/release/SKILL.md") {
  fail(`Agent skill source ownership diverged: ${skillOwners.join(", ") || "none"}`)
}

const disposableRoot = mkdtempSync(join(tmpdir(), "ts-release-agent-installs-"))
let installed = 0
const providerLayouts: string[] = []
try {
  for (const provider of ["codex", "claude"] as const) {
    const archive = secondPaths.find((path) => path.endsWith(`ts-release-${provider}.zip`)) ??
      fail(`Generated ${provider} archive is missing.`)
    const installation = installAgentArchive(provider, archive, disposableRoot)
    const native = provider === "codex" ? ".codex-plugin" : ".claude-plugin"
    const manifest = join(installation.packageRoot, native, "plugin.json")
    if (!existsSync(manifest)) fail(`Installed ${provider} native manifest is missing.`)
    if (!existsSync(join(installation.packageRoot, "skills", "release", "SKILL.md"))) {
      fail(`Installed ${provider} skill is missing.`)
    }
    if (provider === "codex" && json(manifest).skills !== "./skills/") {
      fail("Installed Codex manifest must point to ./skills/.")
    }
    if (provider === "claude") {
      const validated = spawnSync("claude", ["plugin", "validate", "--strict", installation.packageRoot], {
        encoding: "utf8",
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: join(disposableRoot, ".claude")
        },
        stdio: "pipe"
      })
      if (validated.status !== 0) {
        fail(`Installed Claude plugin validator failed: ${commandFailure(validated)}`)
      }
    }
    providerLayouts.push(relative(disposableRoot, installation.packageRoot).replaceAll("\\", "/"))
    installed += 1
  }
} finally {
  rmSync(disposableRoot, { recursive: true, force: true })
}

console.log(JSON.stringify({
  schemaVersion: "ts-release-agents-check/v2",
  providers: 2,
  archives: second.length,
  disposableInstalls: installed,
  providerLayouts,
  claudeValidation: "strict",
  rootCanonicalOwners: canonicalRootOwners.length,
  status: "ready"
}))
