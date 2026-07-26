import { describe, expect, test } from "@effect/bun-test"
import { checkArchitecture } from "../../scripts/lib/architecture.js"

describe("rewrite architecture contract", () => {
  test("freezes eight concepts and the current bounded legacy exceptions", () => {
    const report = checkArchitecture(process.cwd(), "contract")
    expect(report.concepts).toBe(8)
    expect(report.failures).toEqual([])
    expect(report.legacyExceptions).toBeGreaterThan(0)
  })

  test("unknown milestones refuse instead of weakening the DAG", () => {
    expect(() => checkArchitecture(process.cwd(), "unknown")).toThrow("Unknown architecture milestone")
  })
})
