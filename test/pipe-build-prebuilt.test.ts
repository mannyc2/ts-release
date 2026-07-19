import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { parseReleaseIntent } from "../src/config/load.js"
import { buildPlanner, resolveBuilds } from "../src/pipes/build.js"
import { emptyPlanAccumulator } from "../src/pipeline/runner.js"
import { makePipelineIdentity, releaseConfig } from "./helpers.js"

const identity = makePipelineIdentity()

describe("prebuilt build pipe", () => {
  it.effect("emits read-only existence checks", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(releaseConfig({
        artifacts: [],
        builds: [{
          builder: "prebuilt",
          targets: ["windows-x64"],
          output: "dist/{binary}-{targetTriple}.exe",
          binary: "release"
        }]
      }))
      const contribution = yield* Option.match(resolveBuilds(config.builds), {
        onNone: () => Effect.die("Expected a resolved build section."),
        onSome: (section) => buildPlanner(section, emptyPlanAccumulator(identity))
      })

      expect(contribution.artifacts[0]?.path).toBe("dist/release-windows-x64.exe")
      expect(contribution.operations[0]).toMatchObject({
        pipeId: "build",
        phase: "build",
        risk: "read-only",
        action: {
          _tag: "check-file",
          path: "dist/release-windows-x64.exe"
        }
      })
    }))
})
