import { describe, expect, test } from "bun:test"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"
import { announcementHttpProfiles } from "../../src/recipes/announcement-profiles.js"

describe("immutable HTTP-like announcement profiles", () => {
  test("match all thirteen frozen contracts", async () => {
    const frozen = await Bun.file(
      "parity/goreleaser-v2.17.0/contracts/announce/profiles.json"
    ).json()
    expect(announcementHttpProfiles).toHaveLength(13)
    for (const profile of announcementHttpProfiles) {
      const contract = frozen.profiles.find((item: any) => item.profileId === profile.profileId)
      expect(canonicalJsonHash(profile.contract)).toBe(canonicalJsonHash(contract.contract))
      expect(profile.contract.redirects).toBe("disabled")
      expect(profile.contract.reconciliation.supported).toBeFalse()
    }
  })
})
