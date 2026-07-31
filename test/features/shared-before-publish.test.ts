import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { operationEntries } from "../../src/model/validate.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"

describe("before-publish ordering", () => {
  test("lowers external checks into validation before publish review", async () => {
    const accepted = await Effect.runPromise(compilePlan({
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
      hooks: { beforePublish: [{ kind: "check", run: ["tool", "check"] }] },
      publish: {}
    }, Invocation.make({
      workspace: WorkspaceRoot.make("/candidate-parity"), commit: NonEmptyName.make("head"), snapshot: false
    })))
    const entry = operationEntries(accepted.plan).find(({ operation }) =>
      operation.id === "hook:before-publish:0")
    expect(entry?.stage).toBe("validate")
    expect(entry?.operation._tag).toBe("Exec")
  })
})
