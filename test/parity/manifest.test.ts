import { describe, expect, test } from "@effect/bun-test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { caseLevels, decodeParityManifest, requiredCaseIds } from "../../scripts/lib/parity.js"

const manifest = decodeParityManifest(readFileSync(join(
  process.cwd(),
  "parity/goreleaser-v2.17.0/manifest.json"
), "utf8"))

describe("strict GoReleaser parity manifest", () => {
  test("freezes total, eligible, excluded, and informational populations", () => {
    expect(manifest.rows.filter((row) => row.population === "customization")).toHaveLength(115)
    expect(manifest.rows.filter((row) => row.population === "pro")).toHaveLength(36)
    expect(manifest.rows.filter((row) => row.population === "deprecation")).toHaveLength(40)
    expect(manifest.rows.filter((row) => row.population === "customization" && row.scope === "included")).toHaveLength(107)
    expect(manifest.rows.filter((row) =>
      row.population === "pro" && row.scope === "included")).toHaveLength(33)
    expect(manifest.populations.excluded.customization).toHaveLength(8)
    expect(manifest.populations.excluded.pro).toHaveLength(3)
    expect(manifest.externalContractFixtures.every((fixture) => fixture.readiness === "frozen")).toBeTrue()
    expect(manifest.rows.some((row) =>
      row.historicalDisposition.includes("OPEN-QUESTION") ||
      row.scopeRationale.includes("OPEN-QUESTION")
    )).toBeFalse()
  })

  test("every included row has independent cases and exactly frozen key ownership", () => {
    const included = manifest.rows.filter((row) => row.scope === "included")
    for (const row of included) {
      expect(row.requiredCases.map((item) => item.level)).toEqual([...caseLevels])
      expect(requiredCaseIds(manifest, row).length).toBeGreaterThan(caseLevels.length)
      expect(row.implementationKeys.length).toBeGreaterThan(0)
    }
    for (const owner of manifest.implementationKeyOwners) {
      expect(included.flatMap((row) => row.implementationKeys).filter((reference) =>
        reference.key === owner.key && reference.role === "owner")).toHaveLength(1)
    }
  })
})
