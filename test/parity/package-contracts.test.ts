import { describe, expect, test } from "bun:test"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"

const contractPath = "test/fixtures/parity/contracts/packages/profiles.json"
const lockPath = "contracts/rewrite/profile-locks/packages.json"
const required = [
  "package.node-sea.v1", "package.uv-build.v1", "package.poetry-build.v1",
  "package.universal-macho.v1", "package.nfpm.v1", "package.makeself.v1",
  "package.macos-app.v1", "package.source-rpm.v1", "package.dmg.v1",
  "package.macos-pkg.v1", "package.msi.v1", "package.nsis.v1",
  "package.snap-build.v1", "package.flatpak-build.v1", "package.chocolatey-pack.v1",
  "package.store-snap.v1", "package.store-chocolatey.v1"
]

describe("frozen package profile contracts", () => {
  test("locks every complete maintainer decision before product implementation", async () => {
    const fixture = await Bun.file(contractPath).json()
    const lock = await Bun.file(lockPath).json()
    expect(fixture.schemaVersion).toBe("package-profile-contracts/v1")
    expect(fixture.profiles.map((profile: any) => profile.profileId)).toEqual(required)
    expect(lock.fixture).toBe(contractPath)
    expect(lock.fixtureHash).toBe(canonicalJsonHash(fixture))
    expect(Object.keys(lock.profiles)).toEqual(required)
    for (const profile of fixture.profiles) {
      expect(profile.provenance).toBe("maintainer-product-decision")
      expect(profile.decisionId).toStartWith("plan-179-2026-07-27-")
      expect(profile.contractHash).toBe(canonicalJsonHash(profile.contract))
      expect(lock.profiles[profile.profileId]).toBe(profile.contractHash)
      expect(profile.contract.hosts.length).toBeGreaterThan(0)
      expect(profile.contract.executable.name).toBeString()
      expect(profile.contract.executable.versionProbe.length).toBeGreaterThan(0)
      expect(profile.contract.executable.supportedRange).toBeString()
      expect(profile.contract.invocation.cwd).toBeString()
      expect(profile.contract.invocation.stdin).toBeString()
      expect(profile.contract.inputSelectors.length).toBeGreaterThan(0)
      expect(profile.contract.validationOperation).toBeString()
      if (profile.contract.kind === "local-tool") {
        expect(profile.contract.invocation.authenticationClass).toBe("none")
        expect(profile.contract.invocation.authorityClass).toBe("local-only")
        expect(profile.contract.remoteMutation).toBeFalse()
        expect(profile.contract.outputs.length).toBeGreaterThan(0)
        expect(profile.contract.success).toBe("exit-zero-and-all-declared-outputs-valid")
      } else {
        expect(profile.contract.kind).toBe("package-store")
        expect(profile.contract.request.endpoint).toStartWith("https://")
        expect(profile.contract.checkpoints.length).toBeGreaterThan(0)
        expect(Object.values(profile.contract.commitmentClassifier).sort()).toEqual([
          "DefinitelyCommitted", "DefinitelyNotCommitted", "DefinitelyNotCommitted",
          "PossiblyCommitted", "PossiblyCommitted", "Unclassifiable"
        ].sort())
        expect(profile.contract.reconciliation.outcomes).toEqual([
          "MatchingCommit", "ProvenAbsent", "Inconclusive"
        ])
      }
    }
  })
})
