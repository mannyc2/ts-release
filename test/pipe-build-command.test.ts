import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { parseReleaseIntent } from "../src/config/load.js"
import { buildPlanner, resolveBuilds } from "../src/pipes/build.js"
import { emptyPlanAccumulator } from "../src/pipeline/runner.js"
import { makePipelineIdentity, releaseConfig } from "./helpers.js"

const identity = makePipelineIdentity()

const planBuild = (build: Record<string, unknown>) =>
  Effect.gen(function*() {
    const config = yield* parseReleaseIntent(releaseConfig({ artifacts: [], builds: [build] }))
    return yield* Option.match(resolveBuilds(config.builds), {
      onNone: () => Effect.die("Expected a resolved build section."),
      onSome: (section) => buildPlanner(section, emptyPlanAccumulator(identity))
    })
  })

describe("command build pipe", () => {
  it.effect("emits command operations with expanded templates", () =>
    Effect.gen(function*() {
      const contribution = yield* planBuild({
        builder: "command",
        targets: ["darwin-arm64"],
        run: ["make", "build-{os}-{arch}"],
        output: "dist/{binary}-{targetTriple}",
        binary: "release"
      })

      expect(contribution.artifacts[0]?.path).toBe("dist/release-darwin-arm64")
      expect(contribution.operations).toHaveLength(2)
      expect(contribution.operations[0]).toMatchObject({
        pipeId: "build",
        phase: "build",
        risk: "writes-local",
        action: {
          _tag: "command",
          command: {
            executable: "make",
            args: ["build-darwin-arm64"]
          }
        }
      })
      expect(contribution.operations[1]).toMatchObject({
        pipeId: "build",
        phase: "build",
        risk: "read-only",
        action: {
          _tag: "check-file",
          path: "dist/release-darwin-arm64"
        }
      })
    }))

  it.effect("rejects empty rendered command argv", () =>
    Effect.gen(function*() {
      const error = yield* planBuild({
          builder: "command",
          targets: ["darwin-arm64"],
          run: "   ",
          output: "dist/{binary}-{targetTriple}",
          binary: "release"
      }).pipe(Effect.flip)

      expect(error._tag).toBe("PlanError")
      if (error._tag === "PlanError") {
        expect(error.field).toBe("builds[].run")
      }
    }))

  it.effect("rejects traversal and Windows-rooted output paths introduced by template values", () =>
    Effect.gen(function*() {
      for (const binary of ["../escape", "\\escape"]) {
        const error = yield* planBuild({
          builder: "command", targets: ["linux-x64"], run: ["true"], output: "{binary}", binary
        }).pipe(Effect.flip)
        expect(error).toMatchObject({
          _tag: "PlanError", field: "builds[].output",
          reason: "Path must be non-empty, relative, and must not contain parent traversal."
        })
      }
    }))
})
