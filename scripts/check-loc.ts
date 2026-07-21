import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cwd, exit } from "node:process"
import { collectTypeScriptFiles } from "./lib/walk.js"

// Plan 143 Stage A.6: the enforcement the LOC metric never had.
// Budgets are ceilings and only ratchet DOWN. Raising one requires a
// plans/ entry explaining which feature paid for it.
const budgets: ReadonlyArray<readonly [directory: string, budget: number]> = [
  ["src", 6616], // raised by plan 168 (fingerprinted continuation and published-asset verification)
  ["src/config", 229], // raised by plan 163 (four project metadata fields)
  ["src/resolve", 307], // raised by plan 163 (wheel family + metadata merge)
  ["src/grammar", 881], // raised by plan 168 (published-asset verification action)
  ["src/features", 1778], // ratcheted by plan 167 (unbound operations and direct typed npm access)
  ["src/pack", 500],
  ["src/github", 267],
  ["src/run", 1033], // raised by plan 168 (continuation plus published-asset download and evidence)
  ["src/engine", 281],
  ["src/render", 409], // raised by plan 168 (published-asset operation detail)
  ["src/doctor", 256], // ratcheted by plan 166 (operation requirements derive from operation data)
  ["src/host", 459], // raised by plan 168 (typed binary HTTP response seam)
  ["src/api", 195],
  ["src/types", 13],
  ["apps/release-ts/src", 594], // raised by plan 168 (continue and published flags)
  ["apps/ts-release-action/src", 492], // raised by plan 168 (continue/published inputs and dispatch)
  ["test", 10514], // raised by plan 168 (continuation matrix and published verification boundaries)
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
