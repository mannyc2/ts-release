import * as Effect from "effect/Effect"
import { artifactPathBaseName, type Artifact } from "./artifact.js"
import { PlanError } from "./errors.js"
import type { PipelineOperation } from "./operation.js"
import type { PipeContribution, ScheduledPlanner } from "./pipe.js"
import type { PipeNotice, ReleaseIdentity } from "./state.js"

export interface PlanAccumulator {
  readonly identity: ReleaseIdentity
  readonly artifacts: ReadonlyArray<Artifact>
  readonly operations: ReadonlyArray<PipelineOperation>
  readonly notices: ReadonlyArray<PipeNotice>
}

export const emptyPlanAccumulator = (identity: ReleaseIdentity): PlanAccumulator => ({
  identity, artifacts: [], operations: [], notices: []
})

const duplicateValues = (
  existing: Iterable<string>,
  incoming: Iterable<string>
): ReadonlyArray<string> => {
  const seen = new Set(existing)
  const duplicates = new Set<string>()
  for (const value of incoming) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort()
}

const collision = (
  pipeId: string,
  field: string,
  reason: string
): Effect.Effect<void, PlanError> =>
  Effect.fail(PlanError.make({ pipeId, field, reason }))

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
    : collision(pipeId, field, `Duplicate ${label}: ${duplicates.join(", ")}`)
}

const requireUniqueArtifactNames = (
  pipeId: string,
  state: PlanAccumulator,
  artifacts: ReadonlyArray<Artifact>
): Effect.Effect<void, PlanError> => {
  const seen = new Map(state.artifacts.map((artifact) =>
    [artifactPathBaseName(artifact.path), artifact.id] as const))
  const collisions: Array<string> = []
  for (const artifact of artifacts) {
    const name = artifactPathBaseName(artifact.path)
    const firstId = seen.get(name)
    if (firstId === undefined) seen.set(name, artifact.id)
    else collisions.push(`${name} (${firstId}, ${artifact.id})`)
  }
  return collisions.length === 0
    ? Effect.void
    : collision(pipeId, "artifacts.name", `Duplicate artifact names: ${collisions.join(", ")}`)
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
    operations: [...state.operations, ...contribution.operations],
    notices: [...state.notices, ...contribution.notices]
  } satisfies PlanAccumulator
})

const runPlanner = Effect.fn("pipeline.runPlanner")(function*(
  state: PlanAccumulator,
  planner: ScheduledPlanner
) {
  const contribution = yield* planner.run({ identity: state.identity, artifacts: state.artifacts })
  return yield* appendContribution(state, planner.id, contribution)
})

export const runPipeline = Effect.fn("pipeline.runPipeline")(function*(
  initialState: PlanAccumulator,
  planners: ReadonlyArray<ScheduledPlanner>
) {
  let state = initialState
  for (const planner of planners) state = yield* runPlanner(state, planner)
  return state
})
