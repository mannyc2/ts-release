import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { parseStrictJson } from "./strict-json.js"

const REQUIRED = [
  ".codex-plugin/plugin.json", ".claude-plugin/plugin.json", "README.md", "LICENSE",
  "evals/cases.json", "skills/release/SKILL.md",
  "skills/release/references/configuration.md", "skills/release/references/staged-workflow.md",
  "skills/release/references/target-selection.md", "skills/release/references/recovery.md",
  "skills/release/references/verification.md"
]
const RESERVED_MARKETPLACE_NAMES = [
  "claude-code-marketplace", "claude-code-plugins", "claude-plugins-official", "claude-plugins-community",
  "claude-community", "anthropic-marketplace", "anthropic-plugins", "agent-skills", "anthropic-agent-skills",
  "knowledge-work-plugins", "life-sciences", "claude-for-legal", "claude-for-financial-services",
  "financial-services-plugins", "first-party-plugins", "healthcare"
]
const CASE_KEYS = [
  "id", "kind", "prompt", "expectedPhases", "expectedActions", "forbiddenActions", "requiredResultFields"
]
const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9]{20,}/u, /gho_[A-Za-z0-9]{20,}/u, /xox[abps]-[A-Za-z0-9-]{10,}/u,
  /AKIA[0-9A-Z]{16}/u, /npm_[A-Za-z0-9]{30,}/u, /-----BEGIN [A-Z ]*PRIVATE KEY/u
]
const THIRD_PARTY_INSTALLERS = [/npx +skills +add/iu, /smithery +(install|add)/iu, /skills\.sh\/install/iu]
const INTERFACE_LIMITS: ReadonlyArray<readonly [field: string, limit: number]> = [
  ["displayName", 80], ["shortDescription", 240], ["longDescription", 4000], ["developerName", 120]
]

export interface SkillPluginReport {
  readonly schemaVersion: "ts-release-skill-plugin/v1"
  readonly status: "ready" | "broken"
  readonly version: string
  readonly files: number
  readonly evals: { readonly positive: number; readonly negative: number }
  readonly problems: ReadonlyArray<string>
}

const record = (value: unknown, problems: Array<string>, label: string): Record<string, unknown> => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  problems.push(`${label} is not a JSON object.`)
  return {}
}
const walk = (root: string, directory: string, collect: Array<string>): void => {
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const relative = directory === "" ? entry.name : `${directory}/${entry.name}`
    if (entry.isDirectory()) walk(root, relative, collect)
    else collect.push(relative)
  }
}
const readJson = (path: string, problems: Array<string>): Record<string, unknown> => {
  if (!existsSync(path)) {
    problems.push(`${path} is absent.`)
    return {}
  }
  try {
    return record(parseStrictJson(readFileSync(path, "utf8")), problems, path)
  } catch (cause) {
    problems.push(`${path} is not strict JSON: ${String(cause)}`)
    return {}
  }
}
const checkManifests = (
  root: string, pluginRoot: string, version: string, problems: Array<string>
): void => {
  const codex = readJson(join(pluginRoot, ".codex-plugin/plugin.json"), problems)
  const claude = readJson(join(pluginRoot, ".claude-plugin/plugin.json"), problems)
  for (const [label, manifest] of [["codex", codex], ["claude", claude]] as const) {
    if (manifest.name !== "ts-release") problems.push(`${label} manifest name must be ts-release.`)
    if (manifest.version !== version) problems.push(`${label} manifest version must equal root ${version}.`)
    if (manifest.license !== "MIT") problems.push(`${label} manifest license must be MIT.`)
    for (const key of ["mcpServers", "apps", "hooks", "agents", "commands", "monitors"]) {
      if (key in manifest) problems.push(`${label} manifest must not declare ${key}.`)
    }
  }
  if (codex.description !== claude.description) problems.push("Manifest descriptions must be identical.")
  if (codex.repository !== claude.repository) problems.push("Manifest repositories must be identical.")
  if (codex.skills !== "./skills/") problems.push("Codex manifest skills must point at ./skills/.")
  const surface = record(codex.interface, problems, "codex interface")
  for (const [field, limit] of INTERFACE_LIMITS) {
    const value = surface[field]
    if (typeof value !== "string" || value.length === 0 || value.length > limit) {
      problems.push(`codex interface ${field} must be a nonempty string of at most ${limit} characters.`)
    }
  }
  if ("screenshots" in surface) problems.push("codex interface must not declare screenshots.")
  const prompts = Array.isArray(surface.defaultPrompt) ? surface.defaultPrompt : []
  if (prompts.length > 3 || prompts.some((item) => typeof item !== "string" || item.length > 512)) {
    problems.push("codex defaultPrompt allows at most three strings of 512 characters.")
  }
  if ("interface" in claude || "skills" in claude) {
    problems.push("Claude manifest must stay native and minimal (no interface/skills keys).")
  }
  const catalogVersions = [
    ["OpenAI", readJson(join(root, ".agents/plugins/marketplace.json"), problems)],
    ["Claude", readJson(join(root, ".claude-plugin/marketplace.json"), problems)]
  ] as const
  for (const [label, marketplace] of catalogVersions) {
    const name = String(marketplace.name ?? "")
    if (name !== "mannyc2-ts-release") problems.push(`${label} marketplace name must be mannyc2-ts-release.`)
    if (RESERVED_MARKETPLACE_NAMES.includes(name) || /anthropic|official/iu.test(name)) {
      problems.push(`${label} marketplace name is reserved or impersonating.`)
    }
    const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : []
    const entry = record(plugins[0], problems, `${label} marketplace plugin entry`)
    if (plugins.length !== 1 || entry.name !== "ts-release") {
      problems.push(`${label} marketplace must list exactly the ts-release plugin.`)
    }
    if (entry.version !== version) problems.push(`${label} marketplace entry version must equal ${version}.`)
    const source = entry.source
    const path = typeof source === "string" ? source : record(source, problems, `${label} source`).path
    if (path !== "./ts-release-plugin") {
      problems.push(`${label} marketplace source must be ./ts-release-plugin.`)
    }
  }
}
const checkContent = (pluginRoot: string, files: ReadonlyArray<string>, problems: Array<string>): void => {
  const skill = readFileSync(join(pluginRoot, "skills/release/SKILL.md"), "utf8")
  if (!/^---\nname: release\n/u.test(skill)) problems.push("SKILL.md frontmatter must open with name: release.")
  if (!/\ndescription: >-\n|description: .+/u.test(skill)) problems.push("SKILL.md needs a description.")
  for (const reference of REQUIRED.filter((path) => path.includes("references/"))) {
    if (!skill.includes(reference.replace("skills/release/", ""))) {
      problems.push(`SKILL.md must route to ${reference}.`)
    }
  }
  for (const path of files) {
    if (/\.(sh|bash|ts|js|mjs|cjs|py)$/u.test(path)) problems.push(`Executable component is forbidden: ${path}`)
    const text = readFileSync(join(pluginRoot, path), "utf8")
    if (/\]\((?:\.\.\/|\/)/u.test(text)) problems.push(`${path} links outside the plugin root.`)
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(text)) problems.push(`${path} contains a secret-like value.`)
    }
    for (const pattern of THIRD_PARTY_INSTALLERS) {
      if (pattern.test(text)) problems.push(`${path} contains a third-party installer instruction.`)
    }
  }
}
const checkEvals = (pluginRoot: string, problems: Array<string>): { positive: number; negative: number } => {
  const document = readJson(join(pluginRoot, "evals/cases.json"), problems)
  const cases = Array.isArray(document.cases) ? document.cases : []
  const counts = { positive: 0, negative: 0 }
  const seen = new Set<string>()
  for (const item of cases) {
    const value = record(item, problems, "eval case")
    if (Object.keys(value).sort().join(",") !== [...CASE_KEYS].sort().join(",")) {
      problems.push(`Eval case ${String(value.id)} must have exactly the keys ${CASE_KEYS.join(", ")}.`)
    }
    if (seen.has(String(value.id))) problems.push(`Duplicate eval id ${String(value.id)}.`)
    seen.add(String(value.id))
    if (value.kind === "positive") counts.positive += 1
    else if (value.kind === "negative") counts.negative += 1
    else problems.push(`Eval case ${String(value.id)} kind must be positive or negative.`)
  }
  if (counts.positive !== 5 || counts.negative !== 3) {
    problems.push(`Evals must hold exactly five positive and three negative cases, not ${counts.positive}/${counts.negative}.`)
  }
  return counts
}
export const checkSkillPlugin = (root: string): SkillPluginReport => {
  const problems: Array<string> = []
  const pluginRoot = join(root, "ts-release-plugin")
  const rootPackage = readJson(join(root, "package.json"), problems)
  const selfRelease = readJson(join(root, "apps/release-ts/release.config.json"), problems)
  const version = String(rootPackage.version ?? "")
  const project = record(selfRelease.project, problems, "self-release project")
  if (project.version !== version) {
    problems.push(`Self-release config version must equal root ${version}.`)
  }
  const files: Array<string> = []
  if (existsSync(pluginRoot)) walk(pluginRoot, "", files)
  else problems.push("ts-release-plugin/ is absent.")
  for (const required of REQUIRED) {
    if (!files.includes(required)) problems.push(`Required plugin file is absent: ${required}`)
  }
  if (files.length > 0) {
    checkManifests(root, pluginRoot, version, problems)
    if (files.includes("skills/release/SKILL.md")) checkContent(pluginRoot, files, problems)
  }
  const counts = files.includes("evals/cases.json")
    ? checkEvals(pluginRoot, problems)
    : { positive: 0, negative: 0 }
  return {
    schemaVersion: "ts-release-skill-plugin/v1",
    status: problems.length === 0 ? "ready" : "broken",
    version,
    files: files.length,
    evals: counts,
    problems
  }
}
