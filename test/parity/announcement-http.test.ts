import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"

describe("HTTP-like announcement lowering", () => {
  test("emits one reviewed-note-bound operation per channel", async () => {
    const fixtures = (await Bun.file(
      "test/fixtures/parity/configs/changelog-announce/configs.json"
    ).json()).fixtures.filter((item: any) =>
      item.rowId.startsWith("C") && !["C080", "C087", "C097"].includes(item.rowId))
    expect(fixtures).toHaveLength(13)
    for (const fixture of fixtures) {
      const accepted = await Effect.runPromise(compilePlan(fixture.config, Invocation.make({
        workspace: WorkspaceRoot.make("/announcement-http"),
        commit: NonEmptyName.make("commit"), snapshot: false
      })))
      const operation = accepted.plan.stages.announce[0]!
      expect(operation._tag).toBe("AnnouncementPublish")
      if (operation._tag !== "AnnouncementPublish") continue
      expect(operation.inputs.map(String)).toEqual(["release-notes"])
      expect(String(operation.profileId)).toBe(fixture.profileIds[0])
      expect(operation.target).toEqual({ destination: "fixture-channel" })
    }
  })
})
