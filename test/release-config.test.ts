import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { readFileSync } from "node:fs"
import { parseReleaseIntent } from "../src/config/load.js"
import { makeTestReleaseHostLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { runEffect } from "./helpers.js"

const config = readFileSync("release.config.json", "utf8")

const TestLayer = Layer.mergeAll(
  makeTestReleaseHostLayer({
    directories: new Set(["."]),
    files: new Map([
      [".release/artifacts/cjpher-ts-release-0.0.0.tgz", "package tarball fixture\n"]
    ]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  }),
  LiveTargetRegistryLayer
)

describe("repository release config", () => {
  test("plans npm and GitHub publication as gated operations", async () => {
    const plan = await runEffect(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(config, "release.config.json")
        return yield* createReleasePlan(intent)
      }),
      TestLayer
    )

    expect(plan.identity.name).toBe("@cjpher/ts-release")
    expect(plan.targets.map((target) => target.id).sort()).toEqual(["github", "npm"])
    expect(plan.operations.map((operation) => operation.id)).toContain("npm:npm-publish")
    expect(plan.operations.map((operation) => operation.id)).toContain("github:gh-release-create")

    const publishOperations = plan.operations.filter((operation) => operation._tag === "PublishCommandOperation")
    expect(publishOperations.length).toBeGreaterThan(0)
    expect(publishOperations.every((operation) => operation.gate.requiresExecute)).toBe(true)
  })
})
