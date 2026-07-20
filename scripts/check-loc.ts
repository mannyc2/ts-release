import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cwd, exit } from "node:process"
import { collectTypeScriptFiles } from "./lib/walk.js"

// Plan 143 Stage A.6: the enforcement the LOC metric never had.
// Budgets are ceilings and only ratchet DOWN. Raising one requires a
// plans/ entry explaining which feature paid for it.
const budgets: ReadonlyArray<readonly [directory: string, budget: number]> = [
  ["src", 6174], // raised by plan 160 (root retry config)
  ["src/config", 225], // raised by plan 160 (root retry config)
  ["src/resolve", 302],
  ["src/grammar", 825], // raised by plan 159 (hooks feature)
  ["src/features", 1668], // raised by plan 159 (hooks feature)
  ["src/pack", 500],
  ["src/github", 267],
  ["src/run", 810], // raised by plan 159 (hooks feature)
  ["src/engine", 281],
  ["src/render", 405],
  ["src/doctor", 262], // raised by plan 159 (hooks feature)
  ["src/host", 417],
  ["src/api", 195],
  ["src/types", 13],
  ["apps/release-ts/src", 586],
  ["apps/ts-release-action/src", 502], // raised by plan 162 (failed-build evidence upload)
  ["test", 9356], // raised by plan 162 (build evidence + retry regressions)
  ["scripts", 2276], // raised by plan 159 (hooks feature)
  ["apps/release-ts/scripts", 882]
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
