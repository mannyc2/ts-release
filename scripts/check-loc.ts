import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cwd, exit } from "node:process"
import { collectTypeScriptFiles } from "./lib/walk.js"

// This physical-line ratchet complements the semantic Product/Oracle ruler.
// The semantic report remains authoritative for milestone and role ceilings.
const budgets: ReadonlyArray<readonly [directory: string, budget: number]> = [
  ["src", 4500],
  ["src/model", 800],
  ["src/recipes", 1000],
  ["src/config", 60],
  ["src/plan", 275],
  ["src/drivers", 650],
  ["src/apply", 1250],
  ["src/view", 25],
  ["src/api", 450],
  ["apps/release-ts/src", 250],
  ["apps/ts-release-action/src", 200],
  ["test", 800],
  ["scripts", 2200],
  ["apps/release-ts/scripts", 220] // read-only self-release policy checks
]

const root = cwd()
const rewriteScripts = new Set([
  "check-architecture.ts", "check-cutover.ts", "check-deletion-map.ts",
  "check-parity.ts", "check-rewrite-plan.ts", "check-source-budget.ts",
  "check-superiority.ts", "run-claim-cases.ts", "run-driver-conformance.ts",
  "run-fault-matrix.ts", "run-oracle.ts"
])

const directoryLines = (directory: string): number => {
  const path = join(root, directory)
  if (!existsSync(path)) {
    return 0
  }
  return collectTypeScriptFiles(path).filter((file) => {
    if (directory === "src" && file.startsWith(join(path, "rewrite"))) return false
    if (directory === "test" && file.startsWith(join(path, "rewrite"))) return false
    if (directory !== "scripts") return true
    const relative = file.slice(path.length + 1)
    return !rewriteScripts.has(relative) &&
      !relative.startsWith("lib/architecture.") &&
      !relative.startsWith("lib/canonical-json.") &&
      !relative.startsWith("lib/claim-cases.") &&
      !relative.startsWith("lib/parity.") &&
      !relative.startsWith("lib/repository-snapshot.") &&
      !relative.startsWith("lib/source-budget.") &&
      !relative.startsWith("lib/strict-json.") &&
      !relative.startsWith("lib/superiority.")
  })
    .reduce((sum, file) => sum + readFileSync(file, "utf8").split("\n").length, 0)
}

const failures: Array<string> = []
for (const [directory, budget] of budgets) {
  const actual = directoryLines(directory)
  const status = actual > budget ? "OVER" : "ok"
  console.log(`${status.padEnd(4)} ${directory}: ${actual} / ${budget}`)
  if (actual > budget) {
    failures.push(`${directory} is ${actual - budget} lines over its ${budget}-line budget.`)
  }
}

if (failures.length > 0) {
  console.error("LOC budget check failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  exit(1)
}
