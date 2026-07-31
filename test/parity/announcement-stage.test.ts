import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"

describe("fixed announcement stage policy", () => {
  test("indexes C087 without dispatching a remote channel", async () => {
    const fixtures = (await Bun.file(
      "test/fixtures/parity/configs/changelog-announce/configs.json"
    ).json()).fixtures
    const config = fixtures.find((item: any) => item.rowId === "C087").config
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make("/announce"), commit: NonEmptyName.make("commit"), snapshot: false
    })))
    expect(accepted.plan.stages.announce).toEqual([])
    expect(accepted.outputs.some(({ output }) => output.id === "release-notes")).toBeTrue()
  })
})
