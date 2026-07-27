import { describe, expect, test } from "bun:test"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"
import { httpProfiles } from "../../src/recipes/providers/http-profiles.js"

describe("immutable HTTP and repository profiles", () => {
  test("match every frozen request, response, commitment, and reconciliation contract", async () => {
    const fixture = await Bun.file(
      "parity/goreleaser-v2.17.0/contracts/providers/profiles.json"
    ).json()
    for (const profile of httpProfiles) {
      const frozen = fixture.profiles.find((item: any) => item.profileId === profile.profileId)
      expect(canonicalJsonHash(profile.contract)).toBe(canonicalJsonHash(frozen.contract))
      expect(profile.checkpoints).toEqual(fixture.checkpointTopology[profile.profileId])
      expect(profile.contract.redirects).toBe("disabled")
    }
  })
})
