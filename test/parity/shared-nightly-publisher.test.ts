import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { decodeConfig } from "../../src/config/config.js"
import { operationEntries } from "../../src/model/validate.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
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

  test("expands custom publication once per selected artifact", async () => {
    const accepted = await Effect.runPromise(compilePlan({
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
      artifacts: [{ id: "binary", path: "dist/fixture", format: "binary" }],
      publish: { custom: [{
        id: "upload", ids: ["binary"], run: ["publisher", "{artifact.path}"], risk: "irreversible"
      }] }
    }, Invocation.make({
      workspace: WorkspaceRoot.make("/candidate-parity"), commit: NonEmptyName.make("head"), snapshot: false
    })))
    const custom = operationEntries(accepted.plan).find(({ operation }) =>
      operation.id === "publish:custom:upload:binary")?.operation
    expect(custom?._tag).toBe("OpaquePublish")
    expect(custom?.inputs.map(String)).toEqual(["binary"])
  })
})
