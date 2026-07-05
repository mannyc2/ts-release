import type * as Effect from "effect/Effect"
import type { Artifact } from "../pipeline/artifact.js"
import type { PlanError } from "../pipeline/errors.js"
import type { PipelineOperation } from "../pipeline/operation.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import type { PlatformTarget } from "../pipeline/platform.js"


export interface BuilderPlan {
  readonly operations: ReadonlyArray<PipelineOperation>
  readonly artifacts: ReadonlyArray<Artifact>
}

export interface Builder<Options extends { readonly builder: string }> {
  readonly id: Options["builder"]
  readonly supportedTargets: ReadonlyArray<PlatformTarget>
  readonly defaults: (options: Options, identity: ReleaseIdentity) => Options
  readonly plan: (
    options: Options,
    identity: ReleaseIdentity,
    target: PlatformTarget
  ) => Effect.Effect<BuilderPlan, PlanError>
}
