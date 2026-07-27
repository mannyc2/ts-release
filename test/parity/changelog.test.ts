import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"

describe("deterministic release notes", () => {
  test("lower to exact reviewed markdown bytes", async () => {
    const fixtures = (await Bun.file(
      "test/fixtures/parity/configs/changelog-announce/configs.json"
    ).json()).fixtures
    const config = fixtures.find((item: any) => item.rowId === "C080").config
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make("/notes"), commit: NonEmptyName.make("commit"), snapshot: false
    })))
    const operation = accepted.plan.stages.process.find((item) => item.id === "changelog:base")
    expect(operation?._tag).toBe("Write")
    if (operation?._tag === "Write")
      expect(operation.content).toBe("# fixture 1.0.0\n\nRelease v1.0.0.\n")
    expect(accepted.outputs.some(({ output }) => output.id === "release-notes")).toBeTrue()
  })
})
