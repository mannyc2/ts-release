import { describe, expect, test } from "@effect/bun-test"
import { capabilityModules } from "../src/capabilities/registry.js"
import type { CapabilityModule } from "../src/capabilities/module.js"
import { readCapabilityEvidence, validateCapabilityTruth } from "../scripts/lib/capabilities.js"

describe("executable capability documentation", () => {
  test("installed module values own all fields and bind executable boundaries", () => {
    const report = validateCapabilityTruth(process.cwd())
    expect(report.failures).toEqual([])
    expect(report.capabilities).toBe(capabilityModules.length)
    expect(report.fields).toBeGreaterThan(60)
  })

  test("detached prose cannot repair an incomplete installed module", () => {
    const broken = capabilityModules.map((module, index) => index === 0
      ? { ...module, fields: [] }
      : module) as ReadonlyArray<CapabilityModule>
    expect(validateCapabilityTruth(process.cwd(), broken).failures.join("\n"))
      .toContain("owns no exact public config fields")
  })

  test("an extra or missing evidence id fails the exact join", () => {
    const root = process.cwd()
    const evidence = readCapabilityEvidence(root)
    const missing = { ...evidence, records: evidence.records.slice(1) }
    expect(validateCapabilityTruth(root, capabilityModules, missing).failures.join("\n")).toContain("has no evidence record")
    const extra = { ...evidence, records: [...evidence.records, { ...evidence.records[0]!, id: "not-in-runtime" }] }
    expect(validateCapabilityTruth(root, capabilityModules, extra).failures.join("\n")).toContain("has no registry entry")
  })
})
