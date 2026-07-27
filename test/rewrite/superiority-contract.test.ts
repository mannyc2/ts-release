import { describe, expect, test } from "@effect/bun-test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { checkSuperiority } from "../../scripts/lib/superiority.js"

describe("five-property superiority contract", () => {
  test("contract mode derives zero passing and five unresolved", () => {
    const report = checkSuperiority(process.cwd(), "contract")
    expect(report).toMatchObject({
      passing: 0,
      candidateProven: 0,
      unresolved: 5,
      total: 5,
      failures: []
    })
    expect(report.properties).toHaveLength(5)
  })

  test("unsupported comparative claims are frozen as forbidden", () => {
    const contract = JSON.parse(readFileSync(
      join(process.cwd(), "contracts/rewrite/superiority.json"),
      "utf8"
    )) as { forbiddenComparativeClaims: ReadonlyArray<string> }
    expect(contract.forbiddenComparativeClaims).toContain("technically superior to GoReleaser")
  })

  test("public cutover remains green after distributed promotion", () => {
    expect(checkSuperiority(process.cwd(), "runner")).toMatchObject({
      passing: 5,
      candidateProven: 0,
      unresolved: 0,
      failures: []
    })
    expect(checkSuperiority(process.cwd(), "cutover").failures).toHaveLength(0)
  })

  test("distributed execution promotes portable split and merge", () => {
    const report = checkSuperiority(process.cwd(), "distributed")
    expect(report.passing).toBe(5)
    expect(report.unresolved).toBe(0)
    expect(report.failures).toEqual([])
  })

  test("PARITY requires all five public properties", () => {
    expect(checkSuperiority(process.cwd(), "PARITY")).toMatchObject({
      passing: 5,
      candidateProven: 0,
      unresolved: 0,
      failures: []
    })
  })
})
