import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { operationEntries } from "../../src/model/validate.js"
import { notarizationProfiles } from "../../src/recipes/supply-chain/notarization-profiles.js"

describe("closed Apple notarization profiles", () => {
  test("match both independently frozen contracts", async () => {
    const fixture = await Bun.file("test/fixtures/parity/contracts/supply-chain/profiles.json").json()
    for (const profile of notarizationProfiles) {
      const frozen = fixture.profiles.find((item: any) => item.profileId === profile.profileId)
      expect(profile.contract).toEqual(frozen.contract)
    }
  })

  test("lower Quill and native Apple choices to the same closed variant", async () => {
    const fixture = await Bun.file("test/fixtures/parity/configs/supply-chain/configs.json").json()
    for (const rowId of ["C057", "P006"]) {
      const config = fixture.fixtures.find((item: any) => item.rowId === rowId).config
      const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
        workspace: WorkspaceRoot.make("/supply-notary"),
        commit: NonEmptyName.make("0123456789abcdef"), snapshot: false
      })))
      const operation = operationEntries(accepted.plan).map(({ operation }) => operation)
        .find((item) => item._tag === "SupplyChainPublish")
      expect(operation).toMatchObject({
        variant: "AppleNotarization",
        profileId: rowId === "C057"
          ? "supply.quill-notarization.v1" : "supply.apple-native-notarization.v1"
      })
    }
  })
})
