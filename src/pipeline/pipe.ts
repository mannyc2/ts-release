import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { Artifact } from "./artifact.js"
import type { Operation } from "./operation.js"
import type { PlanError } from "./errors.js"
import { PipeNotice, type ReleaseIdentity } from "./state.js"

export interface PlannerContext {
  readonly identity: ReleaseIdentity
  readonly artifacts: ReadonlyArray<Artifact>
}

export interface PipeContribution {
  readonly artifacts: ReadonlyArray<Artifact>
  readonly operations: ReadonlyArray<Operation>
  readonly notices: ReadonlyArray<PipeNotice>
}
type PipeContributionInput = Partial<PipeContribution>

export interface FeaturePlanner<Section> {
  (
    section: Section,
    context: PlannerContext
  ): Effect.Effect<PipeContribution, PlanError>
  readonly id: string
}

export type FeatureSchedule = readonly [FeaturePlanner<unknown>, Option.Option<unknown>]

export const emptyContribution: PipeContribution = {
  artifacts: [],
  operations: [],
  notices: []
}

export const featurePlanner = <Section>(
  id: string,
  plan: (section: Section, context: PlannerContext) => Effect.Effect<PipeContributionInput, PlanError>
): FeaturePlanner<Section> => Object.assign(
  (section: Section, context: PlannerContext) => plan(section, context).pipe(
    Effect.map((contribution) => ({ ...emptyContribution, ...contribution }))
  ),
  { id }
)

export const schedule = <Section>(planner: FeaturePlanner<Section>, section: Option.Option<Section>): FeatureSchedule =>
  [planner as FeaturePlanner<unknown>, section as Option.Option<unknown>]
