import { describe, expect, test } from "bun:test"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"

const contractPath = "test/fixtures/parity/contracts/supply-chain/profiles.json"
const lockPath = "contracts/rewrite/profile-locks/supply-chain.json"
const required = [
  "supply.local-container-build.v1", "supply.local-sbom.v1",
  "supply.local-detached-sign.v1", "supply.registry-image.v1",
  "supply.registry-manifest.v1", "supply.registry-signature.v1",
  "supply.credentialed-artifact-sign.v1", "supply.quill-notarization.v1",
  "supply.apple-native-notarization.v1", "supply.remote-attestation.v1"
]

describe("frozen supply-chain profile contracts", () => {
  test("locks complete maintainer decisions before product implementation", async () => {
    const fixture = await Bun.file(contractPath).json()
    const lock = await Bun.file(lockPath).json()
    expect(fixture.schemaVersion).toBe("supply-chain-profile-contracts/v1")
    expect(fixture.profiles.map((profile: any) => profile.profileId)).toEqual(required)
    expect(lock.fixture).toBe(contractPath)
    expect(lock.fixtureHash).toBe(canonicalJsonHash(fixture))
    expect(lock.configFixture).toBe("test/fixtures/parity/configs/supply-chain/configs.json")
    expect(lock.configFixtureHash).toBe(canonicalJsonHash(await Bun.file(lock.configFixture).json()))
    expect(Object.keys(lock.profiles)).toEqual(required)
    for (const profile of fixture.profiles) {
      expect(profile.provenance).toBe("maintainer-product-decision")
      expect(profile.decisionId).toBe("maintainer.supply-chain.2026-07-27")
      expect(profile.contractHash).toBe(canonicalJsonHash(profile.contract))
      expect(lock.profiles[profile.profileId]).toBe(profile.contractHash)
      expect(profile.contract.hosts.length).toBeGreaterThan(0)
      expect(profile.contract.inputSelectors.length).toBeGreaterThan(0)
      expect(profile.contract.outputs.length).toBeGreaterThan(0)
      if (profile.contract.kind === "local-tool") {
        expect(profile.contract.invocation.authenticationClass).toBe("none")
        expect(profile.contract.invocation.authorityClass).toBe("local-only")
        expect(profile.contract.invocation.environmentNames).toEqual([])
        expect(profile.contract.remoteMutation).toBeFalse()
      } else {
        expect(profile.contract.kind).toBe("supply-chain-publish")
        expect(profile.contract.checkpoints.length).toBeGreaterThan(0)
        expect(new Set(Object.values(profile.contract.commitmentClassifier))).toEqual(
          new Set(["DefinitelyCommitted", "DefinitelyNotCommitted", "PossiblyCommitted", "Unclassifiable"])
        )
        expect(profile.contract.reconciliation.outcomes).toEqual([
          "MatchingCommit", "ProvenAbsent", "Inconclusive"
        ])
      }
    }
  })
})
