import type * as Effect from "effect/Effect"
import type { ReleaseConfig } from "../config/schema.js"
import type { Artifact } from "./artifact.js"
import type { PipelineOperation } from "./operation.js"
import type { PlanError } from "./errors.js"
import type { PipeNotice, ReleaseIdentity, ReleaseState } from "./state.js"

export type * from "../types/effect-internal.js"

export type PipePhase = "build" | "process" | "catalog" | "publish" | "verify"
export type PipelineStage = "identity" | "defaults" | PipePhase

export interface PipeContribution {
  readonly artifacts: ReadonlyArray<Artifact>
  readonly operations: ReadonlyArray<PipelineOperation>
  readonly notices: ReadonlyArray<PipeNotice>
}

export interface Pipe<Section> {
  readonly id: string
  readonly phase: PipePhase
  section(config: ReleaseConfig): Section | undefined
  defaults?(section: Section, identity: ReleaseIdentity): Section
  plan(
    section: Section,
    state: ReleaseState
  ): Effect.Effect<PipeContribution, PlanError>
}

export const emptyContribution: PipeContribution = {
  artifacts: [],
  operations: [],
  notices: []
}
