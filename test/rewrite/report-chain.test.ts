import { describe, expect, test } from "@effect/bun-test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"
import { repositorySnapshotHash } from "../../scripts/lib/repository-snapshot.js"
import { parseRewritePlanCli } from "../../scripts/check-rewrite-plan.js"
import {
  expectObject,
  parseStrictJson
} from "../../scripts/lib/strict-json.js"

const root = process.cwd()
const reportPath = join(root, "contracts/rewrite/reports/plan-173.json")

describe("rewrite report chain", () => {
  test("freezes the nonnumeric order and each exact predecessor", () => {
    const gates = expectObject(parseStrictJson(readFileSync(
      join(root, "contracts/rewrite/plan-gates.json"),
      "utf8"
    )), "plan gates")
    expect(gates.order).toEqual([
      "173", "174", "175", "176", "177", "183",
      "178", "179", "180", "181", "182", "184"
    ])
    const plans = gates.plans as Readonly<Record<string, { predecessor: string | null }>>
    let prior: string | null = null
    for (const id of gates.order as ReadonlyArray<string>) {
      expect(plans[id]?.predecessor).toBe(prior)
      prior = id
    }
  })

  test("CLI rejects unknown, duplicate, conflicting, and predecessor injection options", () => {
    expect(() => parseRewritePlanCli(["--wat"])).toThrow("Unknown")
    expect(() => parseRewritePlanCli(["--plan", "173", "--plan", "174"])).toThrow("Duplicate")
    expect(() => parseRewritePlanCli([
      "--plan", "173", "--check", "--write-report", "x"
    ])).toThrow("conflict")
    expect(() => parseRewritePlanCli(["--plan", "173", "--predecessor", "172"])).toThrow("Unknown")
    expect(parseRewritePlanCli(["--plan", "173", "--check"]).plan).toBe("173")
  })

  test("report paths are excluded from repository snapshots", () => {
    const before = repositorySnapshotHash(root)
    const temporary = join(root, "contracts/rewrite/reports/.snapshot-test.json")
    mkdirSync(dirname(temporary), { recursive: true })
    writeFileSync(temporary, "{\"temporary\":true}\n")
    try {
      expect(repositorySnapshotHash(root)).toBe(before)
    } finally {
      rmSync(temporary)
    }
  })

  test("recorded reports bind every field through one canonical hash", () => {
    if (!existsSync(reportPath)) {
      expect(existsSync(reportPath)).toBe(false)
      return
    }
    const report = expectObject(parseStrictJson(readFileSync(reportPath, "utf8")), "report")
    const { reportHash, ...body } = report
    expect(reportHash).toBe(canonicalJsonHash(body))
    for (const key of [
      "implementationTree",
      "commandVectorHash",
      "contractHashes",
      "inputSnapshotHash",
      "outputSnapshotHash",
      "caseResults",
      "zeroSecretScan"
    ]) {
      expect(canonicalJsonHash({ ...body, [key]: "tampered" })).not.toBe(reportHash)
    }
  })
})
