#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import { expectExactKeys, expectObject, parseStrictJson } from "./lib/strict-json.js"

const root = process.cwd()
const consumed = !existsSync(resolve(root, "src/features"))
const contract = expectObject(parseStrictJson(readFileSync(
  resolve(root, "contracts/rewrite/deletion-map.json"),
  "utf8"
)), "deletion map")
expectExactKeys(contract, [
  "schemaVersion", "plan", "candidateRoster", "baselineParity", "groups", "entries"
])
if (contract.schemaVersion !== "rewrite-deletion-map/v1" || contract.plan !== "176") {
  throw new Error("Deletion map identity is invalid.")
}

const strings = (value: unknown, name: string): ReadonlyArray<string> => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${name} must be a string array.`)
  }
  const result = value as ReadonlyArray<string>
  if (new Set(result).size !== result.length) throw new Error(`${name} contains duplicates.`)
  return result
}
const exactSet = (
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
  name: string
): void => {
  const left = [...actual].sort()
  const right = [...expected].sort()
  if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(`${name} is not total.`)
}

const roster = strings(contract.candidateRoster, "candidateRoster")
if (roster.length !== 11) throw new Error("Candidate roster must contain eleven current fixtures.")
const baseline = strings(contract.baselineParity, "baselineParity")
if (
  baseline.filter((id) => id.startsWith("C")).length !== 50 ||
  baseline.filter((id) => id.startsWith("P")).length !== 9
) throw new Error("Baseline parity must contain 50 customization and 9 Pro rows.")

const groups = expectObject(contract.groups!, "groups")
const groupNames = ["build", "process", "catalog", "package-publish", "forge"]
exactSet(Object.keys(groups), groupNames, "deletion groups")
const groupCases = new Set<string>()
const groupParity = new Set<string>()
for (const name of groupNames) {
  const group = expectObject(groups[name]!, `groups.${name}`)
  expectExactKeys(group, ["candidateOwner", "candidateCaseIds", "parityRows"])
  const owner = typeof group.candidateOwner === "string" && consumed
    ? group.candidateOwner
        .replace("src/rewrite/current/lower-", "src/recipes/current-")
    : group.candidateOwner
  if (typeof owner !== "string" || !existsSync(resolve(root, owner))) {
    throw new Error(`${name}: candidate owner is absent.`)
  }
  for (const id of strings(group.candidateCaseIds, `${name}.candidateCaseIds`)) {
    if (!roster.includes(id)) throw new Error(`${name}: unknown candidate case ${id}.`)
    groupCases.add(id)
  }
  for (const id of strings(group.parityRows, `${name}.parityRows`)) {
    if (!baseline.includes(id)) throw new Error(`${name}: unknown parity row ${id}.`)
    groupParity.add(id)
  }
}
exactSet([...groupCases], roster, "group candidate roster")
exactSet([...groupParity], baseline, "group parity roster")

const oracle = expectObject(parseStrictJson(readFileSync(
  resolve(root, "contracts/rewrite/oracle.json"),
  "utf8"
)), "oracle")
const oracleSurfaces = new Set((oracle.sourceSurfaces as ReadonlyArray<{ readonly path: string }>)
  .map((surface) => surface.path))
const tracked = Bun.spawnSync(["git", "ls-files", "src/features"], {
  cwd: root, stdin: "ignore", stdout: "pipe", stderr: "pipe"
})
if (tracked.exitCode !== 0) throw new Error("Unable to enumerate incumbent feature files.")
const trackedFeatureFiles = tracked.stdout.toString().trim().split("\n").filter(Boolean)
const oracleFeatureFiles = [...oracleSurfaces].filter((path) => path.startsWith("src/features/"))
const entries = contract.entries
if (!Array.isArray(entries)) throw new Error("entries must be an array.")
const mappedPaths: Array<string> = []
const assertionIds = new Set<string>()
for (const [index, value] of entries.entries()) {
  const entry = expectObject(value, `entries[${index}]`)
  expectExactKeys(entry, [
    "path", "symbols", "currentOracleAssertionIds", "focusedTests", "candidateGroup",
    "requiredCandidateResult", "plan177DeletionGroup", "unresolved"
  ])
  if (
    typeof entry.path !== "string" ||
    !(consumed ? oracleFeatureFiles : trackedFeatureFiles).includes(entry.path)
  ) {
    throw new Error(`entries[${index}] names an unknown incumbent file.`)
  }
  mappedPaths.push(entry.path)
  if (!oracleSurfaces.has(entry.path)) throw new Error(`${entry.path}: absent from current oracle.`)
  const symbols = strings(entry.symbols, `${entry.path}.symbols`)
  if (!consumed) {
    const source = readFileSync(resolve(root, entry.path), "utf8")
    const exported = [...source.matchAll(
      /^export\s+(?:class|const|type|interface)\s+([A-Za-z0-9_]+)/gmu
    )].flatMap((match) => match[1] === undefined ? [] : [match[1]])
    exactSet(symbols, [...new Set(exported)], `${entry.path} symbols`)
  } else if (existsSync(resolve(root, entry.path))) {
    throw new Error(`${entry.path}: deletion-map entry was not consumed.`)
  }
  for (const assertion of strings(
    entry.currentOracleAssertionIds,
    `${entry.path}.currentOracleAssertionIds`
  )) {
    if (assertionIds.has(assertion)) throw new Error(`Duplicate current assertion ${assertion}.`)
    assertionIds.add(assertion)
  }
  for (const test of strings(entry.focusedTests, `${entry.path}.focusedTests`)) {
    if (!consumed && !existsSync(resolve(root, test))) {
      throw new Error(`${entry.path}: missing focused test ${test}.`)
    }
  }
  if (typeof entry.candidateGroup !== "string" || !groupNames.includes(entry.candidateGroup)) {
    throw new Error(`${entry.path}: invalid candidate group.`)
  }
  if (
    entry.requiredCandidateResult !== "behavior-equal-or-stronger" ||
    typeof entry.plan177DeletionGroup !== "string" ||
    !entry.plan177DeletionGroup.startsWith("features-") ||
    entry.unresolved !== false
  ) throw new Error(`${entry.path}: unresolved or invalid deletion contract.`)
}
exactSet(mappedPaths, consumed ? oracleFeatureFiles : trackedFeatureFiles, "incumbent feature ownership")

process.stdout.write(encodeCanonicalJson({
  schemaVersion: "rewrite-deletion-map-report/v1",
  status: consumed ? "consumed" : "candidate-proven",
  consumed,
  files: mappedPaths.length,
  symbols: entries.reduce((total, value) =>
    total + strings(expectObject(value, "entry").symbols, "entry.symbols").length, 0),
  assertions: assertionIds.size,
  candidateCases: groupCases.size,
  parity: {
    customization: baseline.filter((id) => id.startsWith("C")).length,
    pro: baseline.filter((id) => id.startsWith("P")).length
  },
  unresolved: 0
}))
