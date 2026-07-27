import { describe, expect, test } from "bun:test"

const complete = (contract: any): boolean =>
  contract.authentication.credentialSlotPattern.length > 0 &&
  contract.request.pathTemplate.length > 0 &&
  contract.response.successStatuses.length > 0 &&
  contract.commitmentPoint.length > 0 &&
  contract.classification.responseLoss.length > 0 &&
  contract.reconciliation.method.length > 0 &&
  contract.redaction.length > 0

describe("frozen changelog and announcement contracts", () => {
  test("resolve all maintainer decisions before runtime profiles", async () => {
    const changelog = await Bun.file(
      "parity/goreleaser-v2.17.0/contracts/changelog/profiles.json"
    ).json()
    const announce = await Bun.file(
      "parity/goreleaser-v2.17.0/contracts/announce/profiles.json"
    ).json()
    const configs = await Bun.file(
      "test/fixtures/parity/configs/changelog-announce/configs.json"
    ).json()
    expect(changelog.profiles).toHaveLength(1)
    expect(announce.profiles).toHaveLength(14)
    expect(announce.profiles.filter((item: any) => item.contract.transport === "http")).toHaveLength(13)
    expect(announce.profiles.filter((item: any) => item.contract.transport === "smtp")).toHaveLength(1)
    expect(new Set(announce.profiles.map((item: any) => item.profileId)).size).toBe(14)
    expect([...changelog.profiles, ...announce.profiles].every((item: any) =>
      item.provenance === "maintainer-product-decision" && complete(item.contract))).toBeTrue()
    expect(configs.fixtures).toHaveLength(19)
    expect(new Set(configs.fixtures.map((item: any) => item.rowId)).size).toBe(19)
  })
})
