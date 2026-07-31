import { describe, expect, test } from "bun:test"
import { supplyLocalProfiles } from "../../src/recipes/supply-chain/local-profiles.js"
import { localToolOutcome, preflightTool } from "../../src/recipes/packages/tool.js"

describe("local supply-chain tool profiles", () => {
  test("match the lock and require supported host/version plus validated outputs", async () => {
    const fixture = await Bun.file("test/fixtures/parity/contracts/supply-chain/profiles.json").json()
    for (const profile of supplyLocalProfiles) {
      expect(profile.contract).toEqual(
        fixture.profiles.find((item: any) => item.profileId === profile.profileId).contract)
      const version = profile.contract.executable.supportedRange
        .match(/[0-9]+(?:\.[0-9]+){1,2}/u)![0]
      expect(preflightTool(profile, profile.contract.hosts[0]!, version)).toBe("ready")
      expect(profile.contract.invocation.authenticationClass).toBe("none")
    }
    expect(localToolOutcome(0, 1, 1, true)).toBe("materialized")
    expect(localToolOutcome(0, 1, 0, true)).toBe("output-mismatch")
  })
})
