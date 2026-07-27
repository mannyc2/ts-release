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

  test("public cutover promotes four proven properties", () => {
    expect(checkSuperiority(process.cwd(), "runner")).toMatchObject({
      passing: 4,
      candidateProven: 0,
      unresolved: 1,
      failures: []
    })
    expect(checkSuperiority(process.cwd(), "cutover").failures).toHaveLength(0)
  })
})
