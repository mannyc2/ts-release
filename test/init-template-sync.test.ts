import { describe, expect, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { planReleaseInit, type ReleaseInitTemplateName } from "../apps/release-ts/src/cli/init.js"

const templates: ReadonlyArray<ReleaseInitTemplateName> = [
  "npm-only",
  "npm-github",
  "bun-cli-github",
  "portable-cli",
  "multi-target-homebrew",
  "multi-target-scoop"
]

describe("init template sync", () => {
  for (const template of templates) {
    test(`${template} defaults match the shipped template`, async () => {
      const plan = await Effect.runPromise(
        planReleaseInit({ template }).pipe(Effect.provide(BunServices.layer))
      )
      const config = plan.files.find((file) => file.path === "release.config.json")
      const expected = await readFile(join("templates", template, "release.config.json"), "utf8")

      expect(config?.contents).toBe(expected)
    })
  }
})
