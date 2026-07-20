import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Artifact, ImportedFileExtra, makeArtifact } from "../src/grammar/artifact.js"
import { CheckFileAction } from "../src/grammar/operation.js"
import {
  emptyContribution,
  featureOperation,
  featurePlanner,
  scheduled,
  type FeatureSchedule,
  type UnboundOperation
} from "../src/grammar/planner.js"
import { emptyPlanAccumulator, runPipeline } from "../src/grammar/accumulator.js"
import { makePipelineIdentity } from "./helpers.js"

const identity = makePipelineIdentity()
const artifact = (id: string, path: string) => makeArtifact({ id, path, producedBy: "planned",
  extra: ImportedFileExtra.make({ format: "file" }) })
const operation = (id: string) => featureOperation({
  id, phase: "build", risk: "read-only", description: id,
  action: CheckFileAction.make({ path: "dist/file" })
})
const planner = (
  id: string,
  artifacts: ReadonlyArray<Artifact> = [],
  operations: ReadonlyArray<UnboundOperation> = []
): FeatureSchedule => scheduled(featurePlanner(id,
  () => Effect.succeed({ ...emptyContribution, artifacts, operations })), Option.some(undefined))[0]!

describe("pipeline runner", () => {
  it.effect("merges configured contributions in order and ignores absent features", () =>
    Effect.gen(function*() {
      const skipped = featurePlanner<string>("skipped", () => Effect.succeed(emptyContribution))
      const second = featurePlanner<string>("second", (_section, context) => {
          expect(context.artifacts.map(({ id }) => id)).toEqual(["first"])
          return Effect.succeed({
            ...emptyContribution,
            artifacts: [artifact("second", "dist/second")],
            operations: [operation("second:check")]
          })
        })
      const state = yield* runPipeline(emptyPlanAccumulator(identity), [
        ...scheduled(skipped, Option.none()),
        planner("first", [artifact("first", "dist/first")], [operation("first:check")]),
        ...scheduled(second, Option.some("resolved"))
      ])
      expect(state.artifacts.map(({ id }) => id)).toEqual(["first", "second"])
      expect(state.operations.map(({ id }) => id)).toEqual(["first:check", "second:check"])
    }))

  it.effect("rejects artifact and operation collisions within and across contributions", () =>
    Effect.gen(function*() {
      const cases: ReadonlyArray<readonly [string, ReadonlyArray<FeatureSchedule>]> = [
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
