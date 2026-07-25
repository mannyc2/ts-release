// Invariant: the accumulator reports pipe-attributed duplicates using plan-rules' single uniqueness spelling.
import * as Effect from "effect/Effect"
import type { Artifact } from "./artifact.js"
import { PlanError } from "./errors.js"
import type { Operation } from "./operation.js"
import { duplicateArtifactBaseNames, duplicateValues } from "./plan-rules.js"
import type { FeatureSchedule, PipeContribution } from "./planner.js"
import type { ReleaseIdentity } from "./state.js"

export interface PlanAccumulator {
  readonly identity: ReleaseIdentity
  readonly artifacts: ReadonlyArray<Artifact>
  readonly operations: ReadonlyArray<Operation>
}

export const emptyPlanAccumulator = (identity: ReleaseIdentity): PlanAccumulator => ({
  identity, artifacts: [], operations: []
})

const requireUnique = (
  pipeId: string,
  field: string,
  label: string,
  existing: Iterable<string>,
  incoming: Iterable<string>
): Effect.Effect<void, PlanError> => {
  const duplicates = duplicateValues(existing, incoming)
  return duplicates.length === 0
    ? Effect.void
    : Effect.fail(PlanError.make({
      pipeId,
      field,
      reason: `Duplicate ${label}: ${duplicates.join(", ")}`
    }))
}

const requireUniqueArtifactNames = (
  pipeId: string,
  state: PlanAccumulator,
  artifacts: ReadonlyArray<Artifact>
): Effect.Effect<void, PlanError> => {
  const collisions = duplicateArtifactBaseNames(state.artifacts, artifacts)
  return collisions.length === 0
    ? Effect.void
    : Effect.fail(PlanError.make({
      pipeId,
      field: "artifacts.name",
      reason: `Duplicate artifact names: ${collisions.join(", ")}`
    }))
}

const appendContribution = Effect.fn("pipeline.appendContribution")(function*(
  state: PlanAccumulator,
  pipeId: string,
  contribution: PipeContribution
) {
  yield* requireUnique(pipeId, "artifacts.id", "artifact ids",
    state.artifacts.map(({ id }) => id), contribution.artifacts.map(({ id }) => id))
  yield* requireUnique(pipeId, "artifacts.path", "artifact paths",
    state.artifacts.map(({ path }) => path), contribution.artifacts.map(({ path }) => path))
  yield* requireUniqueArtifactNames(pipeId, state, contribution.artifacts)
  yield* requireUnique(pipeId, "operations.id", "operation ids",
    state.operations.map(({ id }) => id), contribution.operations.map(({ id }) => id))
  return {
    identity: state.identity,
    artifacts: [...state.artifacts, ...contribution.artifacts],
    operations: [...state.operations, ...contribution.operations]
  } satisfies PlanAccumulator
})

export const runPipeline = Effect.fn("pipeline.runPipeline")(function*(
  initialState: PlanAccumulator,
  planners: ReadonlyArray<FeatureSchedule>
) {
  let state = initialState
  for (const schedule of planners) {
    const contribution = yield* schedule.run({ identity: state.identity, artifacts: state.artifacts })
    state = yield* appendContribution(state, schedule.id, contribution)
  }
  return state
})
