import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cwd, exit } from "node:process"
import { collectTypeScriptFiles } from "./lib/walk.js"

// Plan 143 Stage A.6: the enforcement the LOC metric never had.
// Budgets are ceilings and only ratchet DOWN. Raising one requires a
// plans/ entry explaining which feature paid for it.
const budgets: ReadonlyArray<readonly [directory: string, budget: number]> = [
  ["src", 6138],
  ["src/config", 211],
  ["src/resolve", 302],
  ["src/grammar", 796],
  ["src/features", 1629],
  ["src/pack", 500],
  ["src/github", 267],
  ["src/run", 804],
  ["src/engine", 281],
  ["src/render", 405],
  ["src/doctor", 260],
  ["src/host", 417],
  ["src/api", 216],
  ["src/types", 13],
  ["apps/release-ts/src", 586],
  ["apps/ts-release-action/src", 500],
  ["test", 8748],
  ["scripts", 2273],
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
