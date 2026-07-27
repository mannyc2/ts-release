import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { canonicalJsonHash } from "../../scripts/lib/canonical-json.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { reviewedTransformProfile } from "../../src/recipes/changelog-profile.js"

describe("reviewed note transformation", () => {
  test("planning declares one read-authority transform without executing it", async () => {
    const fixture = await Bun.file(
      "test/fixtures/parity/configs/changelog-announce/configs.json"
    ).json()
    const config = fixture.fixtures.find((item: any) => item.rowId === "P007").config
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make("/notes-ai"), commit: NonEmptyName.make("commit"), snapshot: false
    })))
    const operation = accepted.plan.stages.validate[0]!
    expect(operation._tag).toBe("ReviewedNoteTransform")
    if (operation._tag !== "ReviewedNoteTransform") return
    expect(operation.inputs.map(String)).toEqual(["release-notes"])
    expect(String(operation.outputs[0]?.id)).toBe("final-notes")
    expect(String(operation.credential.name)).toBe("NOTE_TRANSFORM_READ")
    const frozen = (await Bun.file(
      "parity/goreleaser-v2.17.0/contracts/changelog/profiles.json"
    ).json()).profiles[0]
    expect(canonicalJsonHash(reviewedTransformProfile.contract)).toBe(canonicalJsonHash(frozen.contract))
  })
})
