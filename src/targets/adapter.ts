import * as Effect from "effect/Effect"
import { Operation } from "../domain/operation.js"
import { ReleaseModel } from "../domain/release.js"
import {
  GitHubReleaseTarget,
  HomebrewTapTarget,
  NpmRegistryTarget,
  PyPiRegistryTarget,
  ScoopBucketTarget,
  TargetCapabilities,
  TargetConfig
} from "../domain/target.js"
import { PlanConstructionError } from "../planner/errors.js"

export type * from "../types/effect-internal.js"

export interface TargetAdapter<Target extends TargetConfig> {
  readonly targetTag: Target["_tag"]
  readonly capabilities: (target: Target) => TargetCapabilities
  readonly planOperations: (
    target: Target,
    model: ReleaseModel
  ) => Effect.Effect<ReadonlyArray<Operation>, PlanConstructionError>
}

export type NpmTargetAdapter = TargetAdapter<NpmRegistryTarget>
export type GitHubTargetAdapter = TargetAdapter<GitHubReleaseTarget>
export type HomebrewTargetAdapter = TargetAdapter<HomebrewTapTarget>
export type PyPiTargetAdapter = TargetAdapter<PyPiRegistryTarget>
export type ScoopTargetAdapter = TargetAdapter<ScoopBucketTarget>
