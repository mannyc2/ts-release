import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { decodeConfig } from "../../src/config/config.js"
import { CandidateNightly, nightlyDecision } from "../../src/recipes/nightly.js"

describe("nightly and custom publication policy", () => {
  test("nightly replacement is typed and unknown state stays manual", async () => {
    const policy = CandidateNightly.make({ replace: true, tag: "nightly" })
    expect(nightlyDecision(policy, "present")).toBe("replace")
    expect(nightlyDecision(policy, "absent")).toBe("create")
    expect(nightlyDecision(policy, "unknown")).toBe("manual")
    await expect(Effect.runPromise(decodeConfig({
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
      publish: { nightly: { replace: false, tag: "nightly" } }
    }))).rejects.toBeDefined()
  })
})
