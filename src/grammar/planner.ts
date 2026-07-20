// Invariant: a configured feature contributes canonical data once and stamps its pipeId onto every operation.
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { Artifact } from "./artifact.js"
import { Operation } from "./operation.js"
import type { PlanError } from "./errors.js"
import type { ReleaseIdentity } from "./state.js"

export interface PlannerContext {
  readonly identity: ReleaseIdentity
  readonly artifacts: ReadonlyArray<Artifact>
}

export interface PipeContribution {
  readonly artifacts: ReadonlyArray<Artifact>
  readonly operations: ReadonlyArray<Operation>
}
type PipeContributionInput = Partial<PipeContribution>

export interface FeaturePlanner<Section> {
  (
    section: Section,
    context: PlannerContext
  ): Effect.Effect<PipeContribution, PlanError>
  readonly id: string
}

export interface FeatureSchedule {
  readonly id: string
  readonly run: (context: PlannerContext) => Effect.Effect<PipeContribution, PlanError>
}

export const emptyContribution: PipeContribution = {
  artifacts: [],
  operations: []
}

// pipeId is owned by the featurePlanner binding and stamped onto every
// contributed operation; feature code never spells its own pipe id.
export const featureOperation = (fields: Omit<Operation, "pipeId">): Operation =>
  Operation.make({ ...fields, pipeId: "" })

export const featurePlanner = <Section>(
  id: string,
  plan: (section: Section, context: PlannerContext) => Effect.Effect<PipeContributionInput, PlanError>
): FeaturePlanner<Section> => Object.assign(
  (section: Section, context: PlannerContext) => plan(section, context).pipe(
    Effect.map((contribution) => {
      const merged = { ...emptyContribution, ...contribution }
      return {
        ...merged,
        operations: merged.operations.map((operation) =>
          operation.pipeId === id ? operation : Operation.make({ ...operation, pipeId: id }))
      }
    })
  ),
  { id }
)

export const scheduled = <Section>(
  planner: FeaturePlanner<Section>,
  section: Option.Option<Section>
): ReadonlyArray<FeatureSchedule> => Option.match(section, {
  onNone: () => [],
  onSome: (value) => [{ id: planner.id, run: (context) => planner(value, context) }]
})
