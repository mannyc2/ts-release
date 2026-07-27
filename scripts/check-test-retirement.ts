#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import { expectExactKeys, expectObject, parseStrictJson } from "./lib/strict-json.js"

const root = process.cwd()
const contract = expectObject(parseStrictJson(
  readFileSync(resolve(root, "contracts/rewrite/test-retirement.json"), "utf8")
), "test retirement")
expectExactKeys(contract, [
  "schemaVersion", "plan", "predecessorReport", "predecessorReportHash",
  "groups", "supportFiles", "fixtureRoots", "unresolved"
])
if (
  contract.schemaVersion !== "rewrite-test-retirement/v1" ||
  contract.plan !== "177" ||
  contract.unresolved !== false
) throw new Error("Test retirement identity is invalid.")

const strings = (value: unknown, label: string): ReadonlyArray<string> => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a string array.`)
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicates.`)
  return value as ReadonlyArray<string>
}
if (typeof contract.predecessorReport !== "string") throw new Error("predecessorReport is invalid.")
const report = expectObject(parseStrictJson(
  readFileSync(resolve(root, contract.predecessorReport), "utf8")
), "predecessor report")
if (report.reportHash !== contract.predecessorReportHash) {
  throw new Error("Test retirement is not bound to the certified Plan 176 report.")
}
const commands = report.commands
if (!Array.isArray(commands)) throw new Error("Plan 176 commands are absent.")
const summaryFor = (command: string) => {
  const row = commands.map((value) => expectObject(value, "command")).find((value) =>
    Array.isArray(value.argv) && value.argv.join(" ") === command)
  if (row === undefined) throw new Error(`Plan 176 omitted ${command}.`)
  return expectObject(
    expectObject(row.summary ?? null, `${command} summary`).value ?? null,
    `${command} value`
  )
}
const behavior = summaryFor("bun run test:oracle:candidate")
const fault = summaryFor("bun run test:fault-matrix")
if (
  behavior.behaviorMismatches !== 0 ||
  expectObject(fault.faultCells ?? null, "faultCells").passed !== 45 ||
  expectObject(fault.structuralControls ?? null, "structuralControls").confirmed !== 11
) throw new Error("Plan 176 did not certify the replacement behavior.")

if (typeof report.implementationCommit !== "string") {
  throw new Error("Plan 176 implementation commit is absent.")
}
const tracked = Bun.spawnSync([
  "git", "ls-tree", "-r", "--name-only", report.implementationCommit, "test"
], {
  cwd: root, stdin: "ignore", stdout: "pipe", stderr: "pipe"
})
if (tracked.exitCode !== 0) throw new Error("Unable to enumerate the incumbent test tree.")
const trackedTopLevel = tracked.stdout.toString().split("\n").filter((path) =>
  /^test\/[^/]+\.test\.ts$/u.test(path))
const groups = contract.groups
if (!Array.isArray(groups)) throw new Error("groups must be an array.")
const legacy: Array<string> = []
const replacements = new Set<string>()
for (const [index, value] of groups.entries()) {
  const group = expectObject(value, `groups[${index}]`)
  expectExactKeys(group, ["name", "legacy", "replacements"])
  if (typeof group.name !== "string") throw new Error(`groups[${index}].name is invalid.`)
  legacy.push(...strings(group.legacy, `${group.name}.legacy`))
  for (const path of strings(group.replacements, `${group.name}.replacements`)) {
    if (!existsSync(resolve(root, path))) throw new Error(`${group.name}: replacement ${path} is absent.`)
    replacements.add(path)
  }
}
const sorted = (items: ReadonlyArray<string>) => [...items].sort()
const replacementTopLevel = [...replacements].filter((path) => /^test\/[^/]+\.test\.ts$/u.test(path))
const incumbentTopLevel = trackedTopLevel.filter((path) => !replacementTopLevel.includes(path))
if (JSON.stringify(sorted(legacy)) !== JSON.stringify(sorted(incumbentTopLevel))) {
  throw new Error("Test retirement does not exactly own every legacy top-level test.")
}
const support = strings(contract.supportFiles, "supportFiles")
const fixtures = strings(contract.fixtureRoots, "fixtureRoots")
const consumed = [...legacy, ...support, ...fixtures].every((path) => !existsSync(resolve(root, path)))
process.stdout.write(encodeCanonicalJson({
  schemaVersion: "rewrite-test-retirement-report/v1",
  status: consumed ? "consumed" : "mapped",
  legacyTests: legacy.length,
  supportFiles: support.length,
  fixtureRoots: fixtures.length,
  replacements: replacements.size,
  predecessorReportHash: contract.predecessorReportHash,
  unresolved: 0
}))
