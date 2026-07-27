import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { operationEntries } from "../../src/model/validate.js"
import { findLocalToolProfile } from "../../src/recipes/packages/profiles.js"
import { pythonBuilderProfiles } from "../../src/recipes/packages/python.js"
import { universalMachoProfile } from "../../src/recipes/packages/universal-macho.js"
import { archiveGeneratorProfiles } from "../../src/recipes/packages/archive-generators.js"

describe("immutable package recipe lowering", () => {
  test("matches and lowers the frozen Node SEA decision", async () => {
    const contracts = await Bun.file(
      "test/fixtures/parity/contracts/packages/profiles.json"
    ).json()
    const frozen = contracts.profiles.find((item: any) => item.profileId === "package.node-sea.v1")
    expect(findLocalToolProfile("package.node-sea.v1").contract).toEqual(frozen.contract)
    const configs = await Bun.file("test/fixtures/parity/configs/packages/configs.json").json()
    const config = configs.fixtures.find((item: any) => item.rowId === "C019").config
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make("/package-fixture"),
      commit: NonEmptyName.make("0123456789abcdef"), snapshot: false
    })))
    const operation = operationEntries(accepted.plan).find(({ operation }) =>
      operation.id === "build:profile:c019")?.operation
    if (operation?._tag !== "Exec") throw new Error("Node SEA did not lower to Exec.")
    expect(operation.contractFixtureId).toBe("contract.package.node-sea.v1")
    expect(operation.inputs.map(String)).toEqual(["input"])
    expect(operation.outputs.map(({ id }) => String(id))).toEqual(["c019-package"])
  })

  test("registers the frozen Python builder decisions", async () => {
    const contracts = await Bun.file("test/fixtures/parity/contracts/packages/profiles.json").json()
    for (const profile of pythonBuilderProfiles) {
      const frozen = contracts.profiles.find((item: any) => item.profileId === profile.profileId)
      expect(profile.contract).toEqual(frozen.contract)
      expect(findLocalToolProfile(profile.profileId)).toBe(profile)
    }
  })

  test("registers the frozen universal Mach-O decision", async () => {
    const contracts = await Bun.file("test/fixtures/parity/contracts/packages/profiles.json").json()
    const frozen = contracts.profiles.find((item: any) => item.profileId === universalMachoProfile.profileId)
    expect(universalMachoProfile.contract).toEqual(frozen.contract)
    expect(findLocalToolProfile(universalMachoProfile.profileId)).toBe(universalMachoProfile)
  })

  test("registers the frozen archive generator decisions", async () => {
    const contracts = await Bun.file("test/fixtures/parity/contracts/packages/profiles.json").json()
    for (const profile of archiveGeneratorProfiles) {
      const frozen = contracts.profiles.find((item: any) => item.profileId === profile.profileId)
      expect(profile.contract).toEqual(frozen.contract)
      expect(findLocalToolProfile(profile.profileId)).toBe(profile)
    }
  })
})
