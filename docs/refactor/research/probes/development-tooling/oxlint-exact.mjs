import { spawnSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "../../../../..")
const config = join(here, "oxlint.json")
const started = Number(process.hrtime.bigint()) / 1_000_000
const result = spawnSync("bun", [
  "x", "--bun", "oxlint@1.76.0",
  "--config", config,
  "--format", "agent",
  "src", "apps", "scripts", "test"
], {
  cwd: repoRoot,
  encoding: "utf8",
  env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  maxBuffer: 64 * 1024 * 1024
})
const milliseconds = Math.round((Number(process.hrtime.bigint()) / 1_000_000 - started) * 100) / 100
const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(Boolean)
const diagnostics = []
for (const line of lines) {
  const match = line.match(/^(.+?):(\d+):(\d+):\s+(error|warning)\s+([^:]+):/i)
  if (match) diagnostics.push({ file: match[1], line: Number(match[2]), column: Number(match[3]), severity: match[4].toLowerCase(), rule: match[5] })
}
const bySeverity = {}
const byRule = {}
for (const diagnostic of diagnostics) {
  bySeverity[diagnostic.severity] = (bySeverity[diagnostic.severity] ?? 0) + 1
  byRule[diagnostic.rule] = (byRule[diagnostic.rule] ?? 0) + 1
}
const topRules = Object.entries(byRule)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 20)
  .map(([rule, count]) => ({ rule, count }))
console.log(`OXLINT_EXACT_RESULT=${JSON.stringify({
  status: "observed",
  version: "1.76.0",
  processStatus: result.status,
  milliseconds,
  diagnostics: diagnostics.length,
  bySeverity,
  topRules,
  unparsedLines: lines.length - diagnostics.length,
  limitations: [
    "counts describe the candidate configuration, not the recommended final blocking set",
    "the agent format is counted line-by-line; summary or non-diagnostic lines are reported separately",
    "formatting and Effect-specific diagnostics are outside Oxlint",
    "the candidate uses only public standard rules and no private @effect/oxc package"
  ]
})}`)
