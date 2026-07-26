import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { canonicalJsonHash } from "./canonical-json.js"
import { expectExactKeys, expectObject, parseStrictJson } from "./strict-json.js"

export type CaseStanding = "candidate-pending" | "candidate-proven" | "passing"

interface PropertyContract {
  readonly id: string
  readonly statement: string
  readonly requiredTestIds: ReadonlyArray<string>
}

interface MilestoneContract {
  readonly requiredCandidateProven: ReadonlyArray<string>
  readonly requiredPublicPassing: ReadonlyArray<string>
}

interface SuperiorityContract {
  readonly schemaVersion: "rewrite-superiority/v1"
  readonly caseStandings: Readonly<Record<string, CaseStanding>>
  readonly properties: ReadonlyArray<PropertyContract>
  readonly milestones: Readonly<Record<string, MilestoneContract>>
  readonly forbiddenComparativeClaims: ReadonlyArray<string>
}

const CONTRACT_PATH = "contracts/rewrite/superiority.json"

const readContract = (root: string): {
  readonly contract: SuperiorityContract
  readonly hash: string
} => {
  const parsed = expectObject(
    parseStrictJson(readFileSync(resolve(root, CONTRACT_PATH), "utf8")),
    "superiority contract"
  )
  expectExactKeys(parsed, [
    "schemaVersion",
    "caseStandings",
    "properties",
    "milestones",
    "forbiddenComparativeClaims"
  ])
  if (parsed.schemaVersion !== "rewrite-superiority/v1") {
    throw new Error("Unknown superiority schemaVersion.")
  }
  return {
    contract: parsed as unknown as SuperiorityContract,
    hash: canonicalJsonHash(parsed)
  }
}

export interface SuperiorityReport {
  readonly schemaVersion: "rewrite-superiority-report/v1"
  readonly contractHash: string
  readonly milestone: string
  readonly passing: number
  readonly candidateProven: number
  readonly unresolved: number
  readonly total: 5
  readonly properties: ReadonlyArray<{
    readonly id: string
    readonly standing: "candidate-pending" | "candidate-proven" | "passing"
  }>
  readonly failures: ReadonlyArray<string>
}

export const checkSuperiority = (
  root: string,
  milestone: string,
  standings: Readonly<Record<string, CaseStanding>> = {}
): SuperiorityReport => {
  const { contract, hash } = readContract(root)
  const gate = contract.milestones[milestone]
  if (gate === undefined) throw new Error(`Unknown superiority milestone: ${milestone}`)
  if (contract.properties.length !== 5) throw new Error("Exactly five properties are required.")
  const ids = contract.properties.map((property) => property.id)
  if (new Set(ids).size !== ids.length) throw new Error("Superiority property ids must be unique.")
  const testIds = contract.properties.flatMap((property) => property.requiredTestIds)
  if (testIds.some((id) => id.length === 0) || new Set(testIds).size !== testIds.length) {
    throw new Error("Superiority test ids must be nonempty and unique.")
  }
  if (Object.keys(contract.caseStandings).sort().join(",") !== [...testIds].sort().join(",") ||
    Object.values(contract.caseStandings).some((value) =>
      !["candidate-pending", "candidate-proven", "passing"].includes(value))) {
    throw new Error("Superiority case standings must exactly cover the test roster.")
  }
  const effective = Object.keys(standings).length > 0 || milestone === "contract"
    ? standings : contract.caseStandings
  const properties = contract.properties.map((property) => {
    const results = property.requiredTestIds.map((id) => effective[id] ?? "candidate-pending")
    const standing = results.every((value) => value === "passing")
      ? "passing"
      : results.every((value) => value === "passing" || value === "candidate-proven")
      ? "candidate-proven"
      : "candidate-pending"
    return { id: property.id, standing } as const
  })
  const failures: Array<string> = []
  for (const id of gate.requiredCandidateProven) {
    const standing = properties.find((property) => property.id === id)?.standing
    if (standing !== "candidate-proven" && standing !== "passing") {
      failures.push(`${milestone} requires candidate-proven property ${id}`)
    }
  }
  for (const id of gate.requiredPublicPassing) {
    if (properties.find((property) => property.id === id)?.standing !== "passing") {
      failures.push(`${milestone} requires publicly passing property ${id}`)
    }
  }
  const passing = properties.filter((property) => property.standing === "passing").length
  const candidateProven = properties.filter((property) => property.standing === "candidate-proven").length
  return {
    schemaVersion: "rewrite-superiority-report/v1",
    contractHash: hash,
    milestone,
    passing,
    candidateProven,
    unresolved: 5 - passing - candidateProven,
    total: 5,
    properties,
    failures
  }
}

export const superiorityContractHash = (root: string): string => readContract(root).hash
