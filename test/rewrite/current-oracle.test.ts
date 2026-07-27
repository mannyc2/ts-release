import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { readFileSync } from "node:fs"
import { parseStrictJson } from "../../scripts/lib/strict-json.js"
import { runCandidateOracle } from "./candidate-adapter.js"

describe("sealed current behavior oracle", () => {
  test("Plan 176 certifies the incumbent-to-candidate comparison", () => {
    const report = parseStrictJson(readFileSync(
      "contracts/rewrite/reports/plan-176.json",
      "utf8"
    )) as {
      readonly reportHash: string
      readonly commands: ReadonlyArray<{
        readonly argv: ReadonlyArray<string>
        readonly summary?: { readonly value?: { readonly behaviorMismatches?: number } }
      }>
    }
    expect(report.reportHash).toBe(
      "984c350e1a4e7ecd71dae1edc3c976fe82aa7a303a89ce17d72a031ad9d6d2ad"
    )
    const oracle = report.commands.find((row) =>
      row.argv.join(" ") === "bun run test:oracle:candidate")
    expect(oracle?.summary?.value?.behaviorMismatches).toBe(0)
  })

  test("the permanent implementation remains total for all current cases", async () => {
    const report = await Effect.runPromise(runCandidateOracle())
    expect(report.behaviorMismatches).toBe(0)
    expect(report.supportedRoster).toHaveLength(11)
    expect(report.pendingRoster).toEqual([])
  })
})
