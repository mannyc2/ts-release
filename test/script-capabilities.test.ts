import { describe, expect, test } from "@effect/bun-test"
import { executableCapabilities } from "../src/capabilities/registry.js"
import { readCapabilityEvidence, validateCapabilityTruth } from "../scripts/lib/capabilities.js"

describe("executable capability documentation", () => {
  test("every registry entry binds decoding, observation, and a vertical test", () => {
    const root = process.cwd()
    const report = validateCapabilityTruth(root)
    expect(report.failures).toEqual([])
    expect(report.capabilities).toBe(executableCapabilities.length)
  })

  test("a deleted adapter entrypoint fails the capability gate", () => {
    const root = process.cwd()
    const registry = executableCapabilities.map((entry, index) => index === 0 ? { ...entry, entrypoint: "src/not-a-driver.ts:missing" } : entry)
    const report = validateCapabilityTruth(root, registry)
    expect(report.failures.join("\n")).toContain("no reachable exported entrypoint")
  })

  test("an extra or missing evidence id fails the exact join", () => {
    const root = process.cwd()
    const evidence = readCapabilityEvidence(root)
    const missing = { ...evidence, records: evidence.records.slice(1) }
    expect(validateCapabilityTruth(root, executableCapabilities, missing).failures.join("\n")).toContain("has no evidence record")
    const extra = { ...evidence, records: [...evidence.records, { ...evidence.records[0]!, id: "not-in-runtime" }] }
    expect(validateCapabilityTruth(root, executableCapabilities, extra).failures.join("\n")).toContain("has no registry entry")
  })
})
