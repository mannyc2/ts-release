import { describe, expect, test } from "@effect/bun-test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"
import { expectObject, parseStrictJson } from "../../scripts/lib/strict-json.js"
import {
  countSemanticLines,
  countSourceTree,
  verifySourceHistory
} from "../../scripts/lib/source-budget.js"

describe("semantic source ruler", () => {
  test("retains M0 history while enforcing the current PORT ceilings", async () => {
    const report = await countSourceTree(process.cwd(), "PORT")
    expect(report.totals.product).toBeLessThanOrEqual(11031)
    expect(report.openingOracle).toBe(14441)
    expect(report.totals.oracle).toBeLessThanOrEqual(21500)
    expect(report.temporarySlices["candidate-current-surface"]).toBeLessThanOrEqual(900)
    expect(report.publicBridges).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.files.every((file) =>
      ["product", "oracle", "tooling", "examples"].includes(file.lane))).toBe(true)
  })

  test("normalizes comments, blank lines, and counted language syntax", () => {
    expect(countSemanticLines("fixture.ts", "// comment\nconst x = 1\n\n/* block */\nconst y = 2\n")).toBe(2)
    expect(countSemanticLines("fixture.py", "# comment\nx = 1\n\n")).toBe(1)
    expect(countSemanticLines("fixture.json", "{\n  \"x\": 1\n}\n")).toBe(3)
  })

  test("unknown source milestones are fatal", async () => {
    await expect(countSourceTree(process.cwd(), "MISSING")).rejects.toThrow("Unknown source milestone")
  })

  test("M0 history is a hash-linked root and marginal ceilings are explicit", () => {
    const history = expectObject(parseStrictJson(readFileSync(join(
      process.cwd(),
      "contracts/rewrite/source-history/m0.json"
    ), "utf8")), "M0 history")
    const { reportHash, ...body } = history
    expect(history.priorReportHash).toBe(null)
    expect(history.implementationKey).toBe(null)
    expect(history.product).toBe(8031)
    expect(reportHash).toBe(canonicalJsonHash(body))
    const policy = expectObject(parseStrictJson(readFileSync(join(
      process.cwd(),
      "contracts/rewrite/source-budget.json"
    ), "utf8")), "source policy")
    expect(policy.marginalKeyCeilings).toEqual({ median: 30, p90: 60, maximum: 150 })
    expect(policy.marginalFamilyCeilings).toEqual({
      distributed: { median: 55, p90: 110, maximum: 150 }
    })
    expect(policy.familyBanks).toMatchObject({ shared: 150, changelog: 100, announce: 450 })
  })

  test("enforces the M6-anchored distributed wave and recorded marginal sample", async () => {
    const report = await countSourceTree(process.cwd(), "PARITY", ["distributed"])
    expect(report.totals.product).toBeGreaterThanOrEqual(4670)
    expect(report.familySummary.distributed).toEqual({
      productDelta: 348,
      productBank: 350,
      marginal: {
        count: 8,
        median: 52,
        p90: 106,
        maximum: 106,
        ceilings: { median: 55, p90: 110, maximum: 150 }
      }
    })
    expect(report.waveSummary).toEqual({
      name: "distributed",
      productCeiling: 5550,
      oracleDelta: 485,
      oracleBank: 700,
      oracleCeiling: 20200
    })
    expect(report.warnings).toEqual([])
    const history = await verifySourceHistory(process.cwd())
    expect(history.filter((entry) => entry.family === "distributed")).toHaveLength(8)
    expect(history.filter((entry) => entry.family === "packages")).toHaveLength(0)
  })
})
