import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { operationEntries } from "../../src/model/validate.js"
import { checkpointIds } from "../../src/apply/transition.js"
import { registryProfiles } from "../../src/recipes/supply-chain/registry-profiles.js"

describe("container publication lowering", () => {
  test("matches registry contracts and emits the frozen checkpoint topology", async () => {
    const contracts = await Bun.file("test/fixtures/parity/contracts/supply-chain/profiles.json").json()
    for (const profile of registryProfiles) expect(profile.contract).toEqual(
      contracts.profiles.find((item: any) => item.profileId === profile.profileId).contract)
    const fixtures = await Bun.file("test/fixtures/parity/configs/supply-chain/configs.json").json()
    const config = fixtures.fixtures.find((item: any) => item.rowId === "C046").config
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make("/supply-container"),
      commit: NonEmptyName.make("0123456789abcdef"), snapshot: false
    })))
    const remote = operationEntries(accepted.plan).map(({ operation }) => operation)
      .filter((item) => item._tag === "SupplyChainPublish")
    expect(remote.map((item) => item.variant)).toEqual(["RegistryImage", "RegistryManifest"])
    expect(remote.map((item) => checkpointIds(item).map(String))).toEqual([
      ["blobs", "manifest"], ["manifest"]
    ])
  })
})
