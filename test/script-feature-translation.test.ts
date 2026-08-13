import { describe, expect, test } from "bun:test"
import { validateFeatureTranslation } from "../scripts/lib/feature-translation.js"
import { validateFieldEffectWitnesses } from "../scripts/lib/field-effect-witnesses.js"
import { authoredConfigPropertyPaths } from "../scripts/lib/config-fields.js"

describe("Plan 207 feature-family ownership", () => {
  test("every historical path belongs to its exact schema family", () => {
    const report = validateFeatureTranslation(process.cwd())
    expect(report.failures).toEqual([])
    expect(report.paths).toBe(260)
    expect(report.families).toBe(44)
  })

  test("every accepted field has one executable mutation witness", () => {
    const report = validateFieldEffectWitnesses()
    expect(report.failures).toEqual([])
    expect(report.fields).toBe(authoredConfigPropertyPaths().length)
    expect(report.witnesses).toBeGreaterThan(70)
    expect(report.invariantGroups).toBeGreaterThan(5)
    // $schema is authoring-only; six trust-boundary literals admit one exact
    // value and are instead proven by negative strict-decode witnesses.
    expect(report.resolvedDeltas).toBe(report.witnesses - 7)
    expect(report.graphDeltas).toBeGreaterThan(50)
    expect(report.preparedBasisDeltas).toBeGreaterThan(40)
  })
})
