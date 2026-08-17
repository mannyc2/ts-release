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
  "--format", "json",
  "src", "apps", "scripts", "test"
], {
  cwd: repoRoot,
  encoding: "utf8",
  env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  maxBuffer: 64 * 1024 * 1024
})
const milliseconds = Math.round((Number(process.hrtime.bigint()) / 1_000_000 - started) * 100) / 100
let parsed
try {
  parsed = JSON.parse(result.stdout)
} catch (error) {
  throw new Error(`Oxlint JSON parse failed: ${error}\nstdout=${result.stdout.slice(0, 500)}\nstderr=${result.stderr.slice(0, 500)}`)
}
const diagnostics = Array.isArray(parsed) ? parsed : parsed.diagnostics ?? []
const bySeverity = {}
const byRule = {}
for (const diagnostic of diagnostics) {
  const severity = String(diagnostic.severity ?? "unknown")
  const rule = String(diagnostic.code ?? diagnostic.ruleId ?? "unknown")
  bySeverity[severity] = (bySeverity[severity] ?? 0) + 1
  byRule[rule] = (byRule[rule] ?? 0) + 1
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
  limitations: [
    "counts describe the candidate configuration, not the recommended final blocking set",
    "formatting and Effect-specific diagnostics are outside Oxlint",
    "the candidate uses only public standard rules and no private @effect/oxc package"
  ]
})}`)
