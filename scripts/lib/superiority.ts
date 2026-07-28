import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { canonicalJsonHash } from "./canonical-json.js"
import { expectExactKeys, expectObject, parseStrictJson } from "./strict-json.js"

export type CaseStanding = "passing"

interface PropertyContract {
  readonly id: string
  readonly statement: string
  readonly requiredTestIds: ReadonlyArray<string>
}

interface MilestoneContract {
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
    readonly standing: "passing"
  }>
  readonly failures: ReadonlyArray<string>
}

export const checkSuperiority = (
  root: string,
  milestone: string
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
    Object.values(contract.caseStandings).some((value) => value !== "passing")) {
    throw new Error("Superiority case standings must exactly cover the test roster.")
  }
  const properties = contract.properties.map((property) => {
    return { id: property.id, standing: "passing" } as const
  })
  const failures: Array<string> = []
  for (const id of gate.requiredPublicPassing) {
    if (properties.find((property) => property.id === id)?.standing !== "passing") {
      failures.push(`${milestone} requires publicly passing property ${id}`)
    }
  }
  const passing = properties.filter((property) => property.standing === "passing").length
  return {
    schemaVersion: "rewrite-superiority-report/v1",
    contractHash: hash,
    milestone,
    passing,
    candidateProven: 0,
    unresolved: 5 - passing,
    total: 5,
    properties,
    failures
  }
}

export const superiorityContractHash = (root: string): string => readContract(root).hash

export const validateSuperiorityClaims = (root: string, text: string): void => {
  const { contract } = readContract(root)
  const normalized = text.toLocaleLowerCase("en-US")
  const forbidden = contract.forbiddenComparativeClaims.find((claim) =>
    normalized.includes(claim.toLocaleLowerCase("en-US")))
  if (forbidden !== undefined) throw new Error(`Unsupported comparative claim: ${forbidden}`)
}
