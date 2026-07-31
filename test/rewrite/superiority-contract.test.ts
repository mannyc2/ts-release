import { describe, expect, test } from "@effect/bun-test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  checkSuperiority,
  validateSuperiorityClaims
} from "../../scripts/lib/superiority.js"

describe("five-property superiority contract", () => {
  test("unsupported comparative claims are frozen as forbidden", () => {
    const contract = JSON.parse(readFileSync(
      join(process.cwd(), "contracts/rewrite/superiority.json"),
      "utf8"
    )) as { forbiddenComparativeClaims: ReadonlyArray<string> }
    expect(contract.forbiddenComparativeClaims).toContain("technically superior to GoReleaser")
    expect(() => validateSuperiorityClaims(
      process.cwd(),
      "technically superior to GoReleaser"
    )).toThrow("Unsupported comparative claim")
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
