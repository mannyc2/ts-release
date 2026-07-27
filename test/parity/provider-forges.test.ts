import { describe, expect, test } from "bun:test"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"
import { forgeProfiles } from "../../src/recipes/providers/forge-profiles.js"

describe("immutable forge profiles", () => {
  test("match the frozen contracts and checkpoint topology", async () => {
    const fixture = await Bun.file(
      "parity/goreleaser-v2.17.0/contracts/providers/profiles.json"
    ).json()
    for (const profile of forgeProfiles) {
      const frozen = fixture.profiles.find((item: any) => item.profileId === profile.profileId)
      expect(profile.contractFixtureId).toBe(frozen.contractFixtureId)
      expect(canonicalJsonHash(profile.contract)).toBe(canonicalJsonHash(frozen.contract))
      expect(profile.checkpoints).toEqual(fixture.checkpointTopology[profile.profileId])
    }
  })
})
