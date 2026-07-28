import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { encodeCanonicalJson, sha256Hex, type JsonValue } from "./canonical-json.js"
import { expectExactKeys, expectObject, parseStrictJson } from "./strict-json.js"

const CONTRACT_PATH = "contracts/rewrite/audit.json"

interface AuditContract {
  readonly schemaVersion: "rewrite-audit-contract/v1"
  readonly expectedExit: number
  readonly package: string
  readonly affectedRange: string
  readonly severity: string
  readonly vulnerabilities: number
  readonly advisoryIds: ReadonlyArray<string>
}

export interface AuditSummary {
  readonly schemaVersion: "rewrite-audit-report/v1"
  readonly status: "known-transitive-advisory"
  readonly auditExit: number
  readonly package: string
  readonly affectedRange: string
  readonly severity: string
  readonly vulnerabilities: number
  readonly advisoryIds: ReadonlyArray<string>
  readonly stdoutHash: string
  readonly stderrHash: string
}

const readContract = (root: string): AuditContract => {
  const value = expectObject(parseStrictJson(
    readFileSync(resolve(root, CONTRACT_PATH), "utf8")
  ), "audit contract")
  expectExactKeys(value, [
    "schemaVersion", "expectedExit", "package", "affectedRange",
    "severity", "vulnerabilities", "advisoryIds"
  ])
  if (value.schemaVersion !== "rewrite-audit-contract/v1") {
    throw new Error("Unknown audit contract.")
  }
  return value as unknown as AuditContract
}

const exact = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())

export const validateAuditSummary = (root: string, value: JsonValue): AuditSummary => {
  const contract = readContract(root)
  const report = expectObject(value, "audit summary")
  expectExactKeys(report, [
    "schemaVersion", "status", "auditExit", "package", "affectedRange",
    "severity", "vulnerabilities", "advisoryIds", "stdoutHash", "stderrHash"
  ])
  const advisories = report.advisoryIds
  if (
    report.schemaVersion !== "rewrite-audit-report/v1" ||
    report.status !== "known-transitive-advisory" ||
    report.auditExit !== contract.expectedExit ||
    report.package !== contract.package ||
    report.affectedRange !== contract.affectedRange ||
    report.severity !== contract.severity ||
    report.vulnerabilities !== contract.vulnerabilities ||
    !Array.isArray(advisories) ||
    advisories.some((id) => typeof id !== "string") ||
    !exact(advisories as ReadonlyArray<string>, contract.advisoryIds) ||
    typeof report.stdoutHash !== "string" ||
    typeof report.stderrHash !== "string"
  ) throw new Error("Dependency audit differs from the frozen advisory contract.")
  return report as unknown as AuditSummary
}

export const runAudit = (root: string): AuditSummary => {
  const contract = readContract(root)
  const result = Bun.spawnSync(["bun", "audit"], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" }
  })
  const stdout = result.stdout.toString()
  const stderr = result.stderr.toString()
  const combined = `${stdout}\n${stderr}`
  const advisoryIds = [...new Set(combined.match(/GHSA-[a-z0-9-]+/gu) ?? [])].sort()
  const summary: AuditSummary = {
    schemaVersion: "rewrite-audit-report/v1",
    status: "known-transitive-advisory",
    auditExit: result.exitCode,
    package: contract.package,
    affectedRange: contract.affectedRange,
    severity: contract.severity,
    vulnerabilities: contract.vulnerabilities,
    advisoryIds,
    stdoutHash: sha256Hex(stdout),
    stderrHash: sha256Hex(stderr)
  }
  if (
    !combined.includes(`${contract.package}  ${contract.affectedRange}`) ||
    !combined.includes(`${contract.vulnerabilities} vulnerabilities (${contract.vulnerabilities} ${contract.severity})`)
  ) throw new Error("Dependency audit output shape differs from the frozen contract.")
  return validateAuditSummary(root, JSON.parse(encodeCanonicalJson(summary)) as JsonValue)
}
