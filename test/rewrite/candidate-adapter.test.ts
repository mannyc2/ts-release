import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { makeBunReleaseWorkflowRuntimeLayer } from "../../apps/release-ts/src/runtime.js"
import { planRelease } from "../../src/engine/engine.js"
import { runEffect } from "../helpers.js"
import {
  behaviorFromLegacyPlan,
  encodeBehaviorContract
} from "./behavior-contract.js"
import {
  behaviorFromCandidate,
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
      "agent-plugin",
      "github-release",
      "multi-target",
      "portable-cli"
    ])
    expect(report.cases.every((item) =>
      (item.groups as ReadonlyArray<string>).includes("forge"))).toBe(true)
  })

  test("has zero representation-neutral mismatches across the incumbent corpus", async () => {
    const root = process.cwd()
    const examples = readdirSync(join(root, "examples")).filter((name) =>
      name !== "README.md"
    ).sort()
    for (const name of examples) {
      const workspace = join(root, "examples", name)
      const config = JSON.parse(readFileSync(
        join(workspace, "release.config.json"),
        "utf8"
      ))
      const currentPlan = await runEffect(
        planRelease({ workspace, config: "release.config.json" }),
        makeBunReleaseWorkflowRuntimeLayer({ root: workspace })
      )
      const current = encodeBehaviorContract(behaviorFromLegacyPlan(currentPlan, workspace))
      const candidate = encodeBehaviorContract(await Effect.runPromise(
        behaviorFromCandidate(config, workspace)
      ))
      expect(candidate).toEqual(current)
    }
  })

  for (const name of ["command-builder", "prebuilt-builder"] as const) {
    test(`${name} matches its supplementary immutable golden`, async () => {
      const root = process.cwd()
      const config = JSON.parse(readFileSync(
        join(root, "test", "fixtures", "rewrite", "oracle", `${name}.json`),
        "utf8"
      ))
      const candidate = encodeBehaviorContract(await Effect.runPromise(
        behaviorFromCandidate(config, root)
      ))
      const golden = JSON.parse(readFileSync(
        join(root, "test", "fixtures", "golden", name, "behavior.json"),
        "utf8"
      ))
      expect(candidate).toEqual(golden)
    })
  }
})
