import { describe, expect, test } from "bun:test"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"

const fixturePath = "parity/goreleaser-v2.17.0/contracts/providers/profiles.json"
const required = [
  "forge.gitlab-release/v1", "forge.gitea-release/v1", "forge.gitlab-catalog-pr/v1",
  "forge.gitea-catalog-pr/v1", "forge.milestone-close/v1", "object.s3-put/v1",
  "object.gcs-put/v1", "object.azure-blob-put/v1", "http.generic-upload/v1",
  "repository.artifactory-upload/v1", "repository.cloudsmith-upload/v1",
  "repository.gemfury-upload/v1", "registry.dockerhub-description/v1",
  "registry.npm-publish/v1"
]

describe("frozen provider contracts", () => {
  test("are complete product decisions with immutable hashes", async () => {
    const fixture = await Bun.file(fixturePath).json()
    const lock = await Bun.file("contracts/rewrite/profile-locks/providers.json").json()
    expect(fixture.schemaVersion).toBe("provider-profile-contracts/v1")
    expect(fixture.profiles.map((profile: any) => profile.profileId)).toEqual(required)
    expect(Object.keys(fixture.checkpointTopology)).toEqual(required)
    expect(lock.fixtureHash).toBe(canonicalJsonHash(fixture))
    expect(lock.configFixtureHash).toBe(canonicalJsonHash(
      await Bun.file(lock.configFixture).json()
    ))
    for (const profile of fixture.profiles) {
      expect(profile.provenance).toBe("maintainer-product-decision")
      expect(lock.profiles[profile.profileId]).toBe(canonicalJsonHash(profile.contract))
      expect(profile.contract.targetCoordinates.length).toBeGreaterThan(0)
      expect(fixture.checkpointTopology[profile.profileId].length).toBeGreaterThan(0)
      expect(profile.contract.request.reconciliationKeyLocation).toBeString()
      expect(new Set(Object.values(profile.contract.classification))).toEqual(new Set([
        "DefinitelyNotCommitted", "DefinitelyCommitted", "PossiblyCommitted", "Unclassifiable"
      ]))
      expect(profile.contract.redirects).toBe("disabled")
      expect(profile.contract.redaction).toContain("authorization")
      expect(profile.contract.reconciliation.supported
        ? ["GET", "HEAD"].includes(profile.contract.reconciliation.method)
        : profile.contract.reconciliation.method === "NONE").toBeTrue()
    }
  })
})
