import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import { npmPackPlanner } from "../src/features/build/npm-pack.js"
import { emptyPlanAccumulator } from "../src/grammar/accumulator.js"
import { makePipelineIdentity, releaseConfig, releaseIdentity } from "./helpers.js"

const identity = makePipelineIdentity({ name: "@scope/release", normalizedName: "scope-release" })

describe("npm pack build pipe", () => {
  it.effect("emits a package artifact for npm pack inputs", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(releaseConfig({
        identity: releaseIdentity({ name: "@scope/release" }),
        artifacts: [],
        npmPackage: { path: "packages/cli" }
      }))
      const contribution = yield* npmPackPlanner(config.npmPackage as Exclude<typeof config.npmPackage, boolean | undefined>,
        emptyPlanAccumulator(identity))

      expect(contribution.artifacts[0]).toMatchObject({
        id: "npm-package",
        kind: "package",
        path: "packages/cli",
        producedBy: "build:npm-pack"
      })
    }))
})
