import { describe, expect, test } from "bun:test"

describe("provider fixture linkage", () => {
  test("every owned external contract id resolves once", async () => {
    const manifest = await Bun.file("parity/goreleaser-v2.17.0/manifest.json").json()
    const fixture = await Bun.file(
      "parity/goreleaser-v2.17.0/contracts/providers/profiles.json"
    ).json()
    const providerRows = manifest.rows.filter((row: any) => row.family === "providers")
    const external = new Map(fixture.profiles.map((profile: any) =>
      [profile.contractFixtureId, profile.profileId]
    ))
    expect(external.size).toBe(fixture.profiles.length)
    for (const row of providerRows) {
      for (const id of row.contractFixtureIds) {
        if (id === "contract.forge.github-release/v1") continue
        expect(external.has(id)).toBeTrue()
      }
      expect(row.configFixtureIds).toEqual([`config.${row.id}.v1`])
    }
  })
})
