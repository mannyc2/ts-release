import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { decodeConfig } from "../../src/config/config.js"
import { mergeEnvironment, renderEnvironment } from "../../src/recipes/environment.js"

describe("reviewable root environment overlay", () => {
  test("has explicit precedence and structurally rejects credential inheritance", async () => {
    const merged = mergeEnvironment(
      { MODE: "default" },
      { MODE: "release", HOME_DIR: { inherit: "HOME" } },
      { MODE: "recipe" }
    )
    expect(merged.MODE).toBe("recipe")
    expect(renderEnvironment(merged.HOME_DIR!)).toBe("$HOME")
    await expect(Effect.runPromise(decodeConfig({
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
      environment: { AUTH: { inherit: "PUBLISH_TOKEN" } },
      publish: {}
    }))).rejects.toBeDefined()
  })
})
