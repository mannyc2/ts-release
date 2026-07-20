import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cwd, exit } from "node:process"
import { collectTypeScriptFiles } from "./lib/walk.js"

// Plan 143 Stage A.6: the enforcement the LOC metric never had.
// Budgets are ceilings and only ratchet DOWN. Raising one requires a
// plans/ entry explaining which feature paid for it.
const budgets: ReadonlyArray<readonly [directory: string, budget: number]> = [
  ["src", 6279], // raised by plan 167 (strict templates, total joins, and unbound operation input types)
  ["src/config", 229], // raised by plan 163 (four project metadata fields)
  ["src/resolve", 307], // raised by plan 163 (wheel family + metadata merge)
  ["src/grammar", 862], // raised by plan 167 (strict templates and single-stamp planner input type)
  ["src/features", 1779], // ratcheted by plan 167 (feature operations remain unbound until planning)
  ["src/pack", 500],
  ["src/github", 267],
  ["src/run", 810], // raised by plan 159 (hooks feature)
  ["src/engine", 281],
  ["src/render", 405],
  ["src/doctor", 256], // ratcheted by plan 166 (operation requirements derive from operation data)
  ["src/host", 417],
  ["src/api", 195],
  ["src/types", 13],
  ["apps/release-ts/src", 588], // raised by plan 163 (family-aware init template patch)
  ["apps/ts-release-action/src", 486], // ratcheted by plan 166 (removed the dead runtime input and rejection path)
  ["test", 9663], // raised by plan 167 (strict argv, stale joins, and unbound planner regressions)
  ["scripts", 2276], // raised by plan 159 (hooks feature)
  ["apps/release-ts/scripts", 826] // ratcheted by plan 166 (shared guard facts and script infrastructure)
]

const root = cwd()

const directoryLines = (directory: string): number => {
  const path = join(root, directory)
  if (!existsSync(path)) {
    return 0
  }
  return collectTypeScriptFiles(path)
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
