import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { operationEntries } from "../../src/model/validate.js"
import { credentialedSigningProfile } from "../../src/recipes/supply-chain/signing-profiles.js"

const operations = async (rowId: string) => {
  const fixtures = await Bun.file("test/fixtures/parity/configs/supply-chain/configs.json").json()
  const config = fixtures.fixtures.find((item: any) => item.rowId === rowId).config
  const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
    workspace: WorkspaceRoot.make("/supply-signing"),
    commit: NonEmptyName.make("0123456789abcdef"), snapshot: false
  })))
  return operationEntries(accepted.plan).map(({ operation }) => operation)
}

describe("digest-bound supply-chain signing", () => {
  test("matches the frozen credentialed signing profile", async () => {
    const fixture = await Bun.file("test/fixtures/parity/contracts/supply-chain/profiles.json").json()
    const frozen = fixture.profiles.find((item: any) =>
      item.profileId === credentialedSigningProfile.profileId)
    expect(credentialedSigningProfile.contract).toEqual(frozen.contract)
  })

  test("keeps local and credentialed signing authority structurally separate", async () => {
    const c054 = await operations("C054")
    expect(c054.some((item) => item._tag === "Exec" &&
      item.contractFixtureId === "contract.supply.local-detached-sign.v1")).toBeTrue()
    const credentialed = c054.find((item) => item._tag === "SupplyChainPublish")
    expect(credentialed).toMatchObject({
      variant: "CredentialedArtifactSignature",
      profileId: "supply.credentialed-artifact-sign.v1"
    })
    expect((await operations("C056")).some((item) =>
      item._tag === "SupplyChainPublish" && item.variant === "RegistrySignature")).toBeTrue()
  })
})
