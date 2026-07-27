import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { decodeConfig } from "../../src/config/config.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"

const fixtures = async () =>
  (await Bun.file("test/fixtures/parity/configs/supply-chain/configs.json").json()).fixtures
const invocation = Invocation.make({
  workspace: WorkspaceRoot.make("/supply-model"),
  commit: NonEmptyName.make("0123456789abcdef"), snapshot: false
})

describe("strict supply-chain config model", () => {
  test("decodes every complete public fixture and rejects operational injection", async () => {
    for (const item of await fixtures()) await Effect.runPromise(decodeConfig(item.config))
    const config = structuredClone((await fixtures())[0].config) as any
    config.supplyChain[0].endpoint = "https://injected.invalid"
    await expect(Effect.runPromise(decodeConfig(config))).rejects.toBeDefined()
  })

  test("rejects profile/target mismatches during pure lowering", async () => {
    const config = structuredClone((await fixtures()).find((item: any) => item.rowId === "C049").config)
    ;(config as any).supplyChain[0].target.extra = "injected"
    await expect(Effect.runPromise(compilePlan(config, invocation))).rejects.toBeDefined()
  })
})
