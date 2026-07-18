import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Artifact } from "../src/pipeline/artifact.js"
import { CheckFileAction, Operation } from "../src/pipeline/operation.js"
import { emptyContribution, schedule, type FeaturePlanner, type ScheduledPlanner } from "../src/pipeline/pipe.js"
import { emptyPlanAccumulator, runPipeline } from "../src/pipeline/runner.js"
import { makePipelineIdentity } from "./helpers.js"

const identity = makePipelineIdentity()
const artifact = (id: string, path: string) => Artifact.make({ id, kind: "file", path, producedBy: "planned" })
const operation = (id: string) => Operation.make({
  id, pipeId: "planned", phase: "build", risk: "read-only", description: id,
  action: CheckFileAction.make({ path: "dist/file" })
})
const planner = (
  id: string,
  artifacts: ReadonlyArray<Artifact> = [],
  operations: ReadonlyArray<Operation> = []
): ScheduledPlanner => schedule({
  id, plan: () => Effect.succeed({ ...emptyContribution, artifacts, operations })
}, Option.some(undefined))

describe("pipeline runner", () => {
  it.effect("merges contributions in order, exposes earlier artifacts, and records skipped planners", () =>
    Effect.gen(function*() {
      const skipped: FeaturePlanner<string> = { id: "skipped", plan: () => Effect.succeed(emptyContribution) }
      const second: FeaturePlanner<string> = {
        id: "second",
        plan: (_section, context) => {
          expect(context.artifacts.map(({ id }) => id)).toEqual(["first"])
          return Effect.succeed({
            ...emptyContribution,
            artifacts: [artifact("second", "dist/second")],
            operations: [operation("second:check")]
          })
        }
      }
      const state = yield* runPipeline(emptyPlanAccumulator(identity), [
        schedule(skipped, Option.none()),
        planner("first", [artifact("first", "dist/first")], [operation("first:check")]),
        schedule(second, Option.some("resolved"))
      ])
      expect(state.notices).toEqual([{
        pipeId: "skipped", severity: "info", reason: "Config section is absent; pipe skipped."
      }])
      expect(state.artifacts.map(({ id }) => id)).toEqual(["first", "second"])
      expect(state.operations.map(({ id }) => id)).toEqual(["first:check", "second:check"])
    }))

  it.effect("rejects artifact and operation collisions within and across contributions", () =>
    Effect.gen(function*() {
      const cases: ReadonlyArray<readonly [string, ReadonlyArray<ScheduledPlanner>]> = [
        ["artifacts.id", [planner("one", [artifact("same", "a/one"), artifact("same", "b/two")])]],
        ["artifacts.path", [planner("one", [artifact("one", "a/file"), artifact("two", "a/file")])]],
        ["artifacts.name", [planner("one", [artifact("one", "a/file"), artifact("two", "b/file")])]],
        ["operations.id", [planner("one", [], [operation("same"), operation("same")])]],
        ["artifacts.id", [planner("one", [artifact("same", "a/one")]), planner("two", [artifact("same", "b/two")])]],
        ["artifacts.path", [planner("one", [artifact("one", "a/file")]), planner("two", [artifact("two", "a/file")])]],
        ["artifacts.name", [planner("one", [artifact("one", "a/file")]), planner("two", [artifact("two", "b/file")])]],
        ["operations.id", [planner("one", [], [operation("same")]), planner("two", [], [operation("same")])]]
      ]
      for (const [field, planners] of cases) {
        const error = yield* runPipeline(emptyPlanAccumulator(identity), planners).pipe(Effect.flip)
        expect(error).toMatchObject({ _tag: "PlanError", field })
      }
    }))

  it.effect("allows distinct artifact paths, basenames, ids, and operation ids", () =>
    Effect.gen(function*() {
      const state = yield* runPipeline(emptyPlanAccumulator(identity), [
        planner("one", [artifact("first", "a/cli.exe")], [operation("first:check")]),
        planner("two", [artifact("second", "b/cli-arm64.exe")], [operation("second:check")])
      ])
      expect(state.artifacts.map(({ id }) => id)).toEqual(["first", "second"])
      expect(state.operations.map(({ id }) => id)).toEqual(["first:check", "second:check"])
    }))
})
