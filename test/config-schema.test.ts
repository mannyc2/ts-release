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

  test("decodes structured npm trusted publishing config", async () => {
    const config = minimalConfig.replace(
      "\"tokenEnv\":\"NPM_TOKEN\",",
      "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true},"
    )
    const intent = await Effect.runPromise(parseReleaseIntent(config))
    const npm = intent.targets.find((target) => target.id === "npm")

    expect(npm?._tag).toBe("NpmRegistryTarget")
    if (npm?._tag === "NpmRegistryTarget") {
      expect(npm.trustedPublishing?.provider).toBe("github-actions")
      expect(npm.trustedPublishing?.workflow).toBe("release.yml")
      expect(npm.trustedPublishing?.packageExists).toBe(true)
    }
  })

  test("rejects bare trusted publishing boolean", async () => {
    const config = minimalConfig.replace(
      "\"tokenEnv\":\"NPM_TOKEN\",",
      "\"trustedPublishing\":true,"
    )
    const exit = await Effect.runPromiseExit(parseReleaseIntent(config))

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ConfigValidationError")
    }
  })

  test("requires trusted publishing package existence acknowledgement", async () => {
    const config = minimalConfig.replace(
      "\"tokenEnv\":\"NPM_TOKEN\",",
      "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":false},"
    )
    const exit = await Effect.runPromiseExit(parseReleaseIntent(config))

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ConfigValidationError")
    }
  })

  test("reports invalid JSON as a typed parse error", async () => {
    const exit = await Effect.runPromiseExit(parseReleaseIntent("{"))
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ConfigParseError")
    }
  })
})
