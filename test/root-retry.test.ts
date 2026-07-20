import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { runEffect } from "./helpers.js"
import { createTestPlan } from "./plan-helpers.js"

const TestLayer = makeTestCommandRunnerLayer({ directories: new Set(["."]) })
const config = (retry?: unknown) => JSON.stringify({
  project: {
    name: "release",
    packageName: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  ...(retry === undefined ? {} : { retry }),
  publish: {
    npm: {
      registry: "https://registry.npmjs.org",
      packageName: "release",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN"
    },
    github: { repository: "owner/repo", tokenEnv: "GH_TOKEN", draft: true }
  },
  evidence: ".release/evidence"
})
const plan = (retry?: unknown) => createTestPlan(config(retry))
const rootRetry = { attempts: 3, delayMillis: 100 }

describe("root retry", () => {
  test("applies the root policy to GitHub verification", async () => {
    const release = await runEffect(plan(rootRetry), TestLayer)

    expect(release.operations.find(({ id }) => id === "github:github-release-verify-api")?.retry)
      .toEqual(rootRetry)
  })

  test("preserves npm's explicit verification policy", async () => {
    const release = await runEffect(plan(rootRetry), TestLayer)

    expect(release.operations.find(({ id }) => id === "npm:npm-version-verify")?.retry)
      .toEqual({ attempts: 11, delayMillis: 500 })
  })

  test("does not apply root retry outside verification", async () => {
    const release = await runEffect(plan(rootRetry), TestLayer)

    expect(release.operations.filter(({ phase }) => phase !== "verify").every(({ retry }) => retry === undefined))
      .toBe(true)
  })

  test("leaves GitHub verification unchanged when root retry is absent", async () => {
    const release = await runEffect(plan(), TestLayer)

    expect(release.operations.find(({ id }) => id === "github:github-release-verify-api")?.retry)
      .toBeUndefined()
  })

  test("requires delayMillis in the root retry policy", async () => {
    const error = await Effect.runPromise(parseReleaseIntent(config({ attempts: 3 })).pipe(Effect.flip))

    expect(error).toMatchObject({ _tag: "ConfigError" })
    expect(error.reason).toContain("delayMillis")
  })
})
