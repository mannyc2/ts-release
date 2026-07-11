import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import { Artifact } from "../src/pipeline/artifact.js"
import { emptyContribution, type Pipe } from "../src/pipeline/pipe.js"
import { runPipeline } from "../src/pipeline/runner.js"
import { emptyReleaseState } from "../src/pipeline/state.js"
import { makePipelineIdentity } from "./helpers.js"

const identity = makePipelineIdentity()

describe("pipeline runner", () => {
  it.effect("applies defaults, merges contributions, and records skipped pipes", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        publish: {}
      }))
      const skipped: Pipe<string> = {
        id: "skipped",
        phase: "build",
        section: () => undefined,
        plan: () => Effect.succeed(emptyContribution)
      }
      const planned: Pipe<string> = {
        id: "planned",
        phase: "build",
        section: () => "raw-defaulted",
        plan: (section) =>
          Effect.succeed({
            ...emptyContribution,
            artifacts: [
              Artifact.make({
                id: section,
                kind: "file",
                path: `dist/${section}`,
                producedBy: "planned"
              })
            ]
          })
      }

      const state = yield* runPipeline(emptyReleaseState(identity), config, [skipped, planned])

      expect(state.notices[0]).toMatchObject({
        pipeId: "skipped",
        severity: "info"
      })
      expect(state.artifacts.artifacts.map((artifact) => artifact.id)).toEqual(["raw-defaulted"])
    }))

  it.effect("rejects duplicate rendered artifact basenames", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        publish: {}
      }))
      const planned: Pipe<string> = {
        id: "planned",
        phase: "build",
        section: () => "raw",
        plan: () =>
          Effect.succeed({
            ...emptyContribution,
            artifacts: [
              Artifact.make({
                id: "first",
                kind: "file",
                path: "a/cli.exe",
                producedBy: "planned"
              }),
              Artifact.make({
                id: "second",
                kind: "file",
                path: "b/cli.exe",
                producedBy: "planned"
              })
            ]
          })
      }

      const error = yield* runPipeline(emptyReleaseState(identity), config, [planned]).pipe(Effect.flip)

      expect(error._tag).toBe("PlanError")
      if (error._tag === "PlanError") {
        expect(error.field).toBe("artifacts.name")
        expect(error.reason).toContain("cli.exe")
        expect(error.reason).toContain("first")
        expect(error.reason).toContain("second")
      }
    }))

  it.effect("allows distinct rendered artifact basenames", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        publish: {}
      }))
      const planned: Pipe<string> = {
        id: "planned",
        phase: "build",
        section: () => "raw",
        plan: () =>
          Effect.succeed({
            ...emptyContribution,
            artifacts: [
              Artifact.make({
                id: "first",
                kind: "file",
                path: "a/cli.exe",
                producedBy: "planned"
              }),
              Artifact.make({
                id: "second",
                kind: "file",
                path: "b/cli-arm64.exe",
                producedBy: "planned"
              })
            ]
          })
      }

      const state = yield* runPipeline(emptyReleaseState(identity), config, [planned])

      expect(state.artifacts.artifacts.map((artifact) => artifact.id)).toEqual(["first", "second"])
    }))
})
