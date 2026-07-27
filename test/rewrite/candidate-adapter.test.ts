import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import {
  runCandidateOracle
} from "./candidate-adapter.js"

describe("candidate behavior adapter", () => {
  test("is total for every current surface", async () => {
    const report = await Effect.runPromise(runCandidateOracle())
    expect(report.status).toBe("candidate-proven")
    expect(report.supportedRoster).toHaveLength(11)
    expect(report.pendingRoster).toEqual([])
    expect(report.behaviorMismatches).toBe(0)
    expect(report.cases.every((item) => item.behavior.outcome === "planned")).toBe(true)
  })

  test("supports focused current-surface groups", async () => {
    const report = await Effect.runPromise(runCandidateOracle("forge"))
    expect(report.group).toBe("forge")
    expect(report.supportedRoster).toEqual([
      "agent-plugin", "github-release", "multi-target", "portable-cli"
    ])
  })

  test("candidate projection is deterministic for every immutable case", async () => {
    const left = await Effect.runPromise(runCandidateOracle())
    const right = await Effect.runPromise(runCandidateOracle())
    expect(left.cases).toEqual(right.cases)
  })
})
