import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { providerProfiles } from "../../src/recipes/providers/index.js"

const fixture = async () => (await Bun.file(
  "test/fixtures/parity/configs/providers/configs.json"
).json()).fixtures.find((item: any) => item.rowId === "C081").config

describe("generic authenticated HTTP upload", () => {
  test("lowers only its reviewed endpoint/header/body surface", async () => {
    const accepted = await Effect.runPromise(compilePlan(await fixture(), Invocation.make({
      workspace: WorkspaceRoot.make("/provider-http"), commit: NonEmptyName.make("commit"), snapshot: false
    })))
    const operation = accepted.plan.stages.publish[0]!
    expect(operation._tag).toBe("ProviderPublish")
    if (operation._tag !== "ProviderPublish") return
    expect(operation.target).toEqual({ endpoint: "https://uploads.example.invalid/artifacts/fixture" })
    expect(operation.options).toEqual({
      method: "PUT", headerNames: "x-release-channel", bodyMapping: "raw-artifact"
    })
    expect(operation.dnsScope).toBe("PublicOnly")
    expect(providerProfiles.find((profile) =>
      profile.profileId === operation.profileId)?.contract.reconciliation.supported).toBeFalse()
  })
})
