import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { runCandidateOracle } from "./candidate-adapter.js"

describe("candidate behavior adapter", () => {
  test("is total for the supported Plan 174 roster", async () => {
    const report = await Effect.runPromise(runCandidateOracle())
    expect(report.status).toBe("candidate-partial")
    expect(report.supportedRoster).toEqual(["plan-v6/minimal"])
    expect(report.pendingRoster).toHaveLength(11)
    expect(report.behavior.outcome).toBe("planned")
    expect(report.behavior.outputs).toHaveLength(2)
  })
})
