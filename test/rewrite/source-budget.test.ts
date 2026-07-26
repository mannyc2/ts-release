import { describe, expect, test } from "@effect/bun-test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"
import { expectObject, parseStrictJson } from "../../scripts/lib/strict-json.js"
import {
  countSemanticLines,
  countSourceTree
} from "../../scripts/lib/source-budget.js"

describe("semantic source ruler", () => {
  test("freezes exact M0 product and opening Oracle counts with zero warnings", async () => {
    const report = await countSourceTree(process.cwd(), "M0")
    expect(report.totals.product).toBe(8031)
    expect(report.openingOracle).toBe(14441)
    expect(report.totals.oracle).toBeLessThanOrEqual(18000)
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

  test("M0 history is a hash-linked root and marginal ceilings are immutable", () => {
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
  })
})
