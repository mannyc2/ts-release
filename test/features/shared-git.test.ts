import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { decodeConfig } from "../../src/config/config.js"
import { CandidateGitPolicy, GitPlanningFacts, selectTags } from "../../src/recipes/git-policy.js"

describe("sealed git planning policy", () => {
  test("filters and smart-sorts prerelease and stable tags deterministically", async () => {
    const policy = CandidateGitPolicy.make({
      tagPrefix: "v", tagSort: "smart-semver", include: ["v*"], exclude: ["v0*"]
    })
    expect(selectTags(GitPlanningFacts.make({
      head: "0123456789abcdef", tags: ["v2.0.0", "v1.0.0", "v2.0.0-rc.1", "v0.9.0"]
    }), policy)).toEqual(["v1.0.0", "v2.0.0-rc.1", "v2.0.0"])
    await expect(Effect.runPromise(decodeConfig({
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
      publish: {}, git: { tagSort: "shell-command" }
    }))).rejects.toBeDefined()
  })
})
