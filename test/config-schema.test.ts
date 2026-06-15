import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import { minimalConfig } from "./helpers.js"

describe("config schema", () => {
  test("decodes a minimal release config", async () => {
    const intent = await Effect.runPromise(parseReleaseIntent(minimalConfig))
    expect(intent.identity.name).toBe("release")
    expect(intent.targets.map((target) => target._tag).sort()).toEqual([
      "GitHubReleaseTarget",
      "NpmRegistryTarget"
    ])
  })

  test("reports invalid JSON as a typed parse error", async () => {
    const exit = await Effect.runPromiseExit(parseReleaseIntent("{"))
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ConfigParseError")
    }
  })
})
