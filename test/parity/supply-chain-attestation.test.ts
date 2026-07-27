import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { operationEntries } from "../../src/model/validate.js"
import { attestationProfile } from "../../src/recipes/supply-chain/attestation-profile.js"

describe("digest-bound remote attestation", () => {
  test("matches the frozen protocol and lowers only the closed profile", async () => {
    const contracts = await Bun.file("test/fixtures/parity/contracts/supply-chain/profiles.json").json()
    const frozen = contracts.profiles.find((item: any) => item.profileId === attestationProfile.profileId)
    expect(attestationProfile.contract).toEqual(frozen.contract)
    const fixtures = await Bun.file("test/fixtures/parity/configs/supply-chain/configs.json").json()
    const config = fixtures.fixtures.find((item: any) => item.rowId === "C079").config
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make("/supply-attestation"),
      commit: NonEmptyName.make("0123456789abcdef"), snapshot: false
    })))
    const operation = operationEntries(accepted.plan).map(({ operation }) => operation)
      .find((item) => item._tag === "SupplyChainPublish")
    expect(operation).toMatchObject({
      variant: "RemoteAttestation", profileId: "supply.remote-attestation.v1",
      inputs: ["input"], target: { repository: "fixture/repository", workflow: "release.yml" }
    })
  })
})
