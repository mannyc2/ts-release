import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { Artifact } from "./artifact.js"
import type { PipelineOperation } from "./operation.js"
import type { PlanError } from "./errors.js"
import { PipeNotice, type ReleaseIdentity } from "./state.js"

interface PlannerContext {
  readonly identity: ReleaseIdentity
  readonly artifacts: ReadonlyArray<Artifact>
}

export interface PipeContribution {
  readonly artifacts: ReadonlyArray<Artifact>
  readonly operations: ReadonlyArray<PipelineOperation>
  readonly notices: ReadonlyArray<PipeNotice>
}

export interface FeaturePlanner<Section> {
  readonly id: string
  readonly plan: (
    section: Section,
    context: PlannerContext
  ) => Effect.Effect<PipeContribution, PlanError>
}

export interface ScheduledPlanner {
  readonly id: string
  readonly run: (context: PlannerContext) => Effect.Effect<PipeContribution, PlanError>
}

export const emptyContribution: PipeContribution = {
  artifacts: [],
  operations: [],
  notices: []
}

export const schedule = <Section>(
  planner: FeaturePlanner<Section>,
  section: Option.Option<Section>
): ScheduledPlanner => ({
  id: planner.id,
  run: (context) => Option.match(section, {
    onNone: () => Effect.succeed({
      ...emptyContribution,
      notices: [PipeNotice.make({
        pipeId: planner.id,
        severity: "info",
        reason: "Config section is absent; pipe skipped."
      })]
    }),
    onSome: (value) => planner.plan(value, context)
  })
})
