import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { buildAgents } from "./build.js"

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

const first = buildAgents().map((path) => bytes(path))
const second = buildAgents().map((path) => bytes(path))
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
const claude = spawnSync("claude", ["plugin", "validate", join(output, "claude", "ts-release")], { encoding: "utf8", stdio: "pipe" })
if (claude.status !== 0) fail(`Claude plugin validator failed: ${claude.stderr.trim() || claude.stdout.trim()}`)
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
console.log(JSON.stringify({ schemaVersion: "ts-release-agents-check/v1", providers: 2, archives: second.length, status: "ready" }))
