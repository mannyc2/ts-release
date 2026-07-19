// Invariant: the accumulator is the sole uniqueness boundary for plan ids, paths, and names.
import * as Effect from "effect/Effect"
import { artifactPathBaseName, type Artifact } from "./artifact.js"
import { PlanError } from "./errors.js"
import type { Operation } from "./operation.js"
import { emptyContribution, type FeatureSchedule, type PipeContribution } from "./planner.js"
import * as Option from "effect/Option"
import { PipeNotice, type ReleaseIdentity } from "./state.js"

export interface PlanAccumulator {
  readonly identity: ReleaseIdentity
  readonly artifacts: ReadonlyArray<Artifact>
  readonly operations: ReadonlyArray<Operation>
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
    operations: [...state.operations, ...contribution.operations],
    notices: [...state.notices, ...contribution.notices]
  } satisfies PlanAccumulator
})

export const runPipeline = Effect.fn("pipeline.runPipeline")(function*(
  initialState: PlanAccumulator,
  planners: ReadonlyArray<FeatureSchedule>
) {
  let state = initialState
  for (const [planner, section] of planners) {
    const contribution = yield* Option.match(section, {
      onNone: () => Effect.succeed({ ...emptyContribution, notices: [PipeNotice.make({
        pipeId: planner.id, severity: "info", reason: "Config section is absent; pipe skipped."
      })] }),
      onSome: (value) => planner(value, { identity: state.identity, artifacts: state.artifacts })
    })
    state = yield* appendContribution(state, planner.id, contribution)
  }
  return state
})
