import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ReleaseModel } from "../domain/release.js"
import {
  GitHubReleaseTarget,
  HomebrewTapTarget,
  NpmRegistryTarget,
  PyPiRegistryTarget,
  ScoopBucketTarget,
  TargetConfig
} from "../domain/target.js"
import { GitHubAdapter } from "./github.js"
import { HomebrewAdapter } from "./homebrew.js"
import { NpmAdapter } from "./npm.js"
import { PyPiAdapter } from "./pypi.js"
import { TargetRegistry } from "./registry.js"
import { ScoopAdapter } from "./scoop.js"

export type * from "../types/effect-internal.js"

const liveTargetAdapters = {
  NpmRegistryTarget: NpmAdapter,
  GitHubReleaseTarget: GitHubAdapter,
  HomebrewTapTarget: HomebrewAdapter,
  PyPiRegistryTarget: PyPiAdapter,
  ScoopBucketTarget: ScoopAdapter
}

interface LiveTargetAdapterHandlers<A> {
  readonly NpmRegistryTarget: (adapter: typeof NpmAdapter, target: NpmRegistryTarget) => A
  readonly GitHubReleaseTarget: (adapter: typeof GitHubAdapter, target: GitHubReleaseTarget) => A
  readonly HomebrewTapTarget: (adapter: typeof HomebrewAdapter, target: HomebrewTapTarget) => A
  readonly PyPiRegistryTarget: (adapter: typeof PyPiAdapter, target: PyPiRegistryTarget) => A
  readonly ScoopBucketTarget: (adapter: typeof ScoopAdapter, target: ScoopBucketTarget) => A
}

const withLiveTargetAdapter = <A>(target: TargetConfig, handlers: LiveTargetAdapterHandlers<A>): A => {
  switch (target._tag) {
    case "NpmRegistryTarget":
      return handlers.NpmRegistryTarget(liveTargetAdapters.NpmRegistryTarget, target)
    case "GitHubReleaseTarget":
      return handlers.GitHubReleaseTarget(liveTargetAdapters.GitHubReleaseTarget, target)
    case "HomebrewTapTarget":
      return handlers.HomebrewTapTarget(liveTargetAdapters.HomebrewTapTarget, target)
    case "PyPiRegistryTarget":
      return handlers.PyPiRegistryTarget(liveTargetAdapters.PyPiRegistryTarget, target)
    case "ScoopBucketTarget":
      return handlers.ScoopBucketTarget(liveTargetAdapters.ScoopBucketTarget, target)
  }
}

const planLiveTargetOperations = Effect.fn("planLiveTargetOperations")(function*(
  target: TargetConfig,
  model: ReleaseModel
) {
  return yield* withLiveTargetAdapter(target, {
    NpmRegistryTarget: (adapter, target) => adapter.planOperations(target, model),
    GitHubReleaseTarget: (adapter, target) => adapter.planOperations(target, model),
    HomebrewTapTarget: (adapter, target) => adapter.planOperations(target, model),
    PyPiRegistryTarget: (adapter, target) => adapter.planOperations(target, model),
    ScoopBucketTarget: (adapter, target) => adapter.planOperations(target, model)
  })
})

const liveTargetCapabilities = (target: TargetConfig) =>
  withLiveTargetAdapter(target, {
    NpmRegistryTarget: (adapter, target) => adapter.capabilities(target),
    GitHubReleaseTarget: (adapter, target) => adapter.capabilities(target),
    HomebrewTapTarget: (adapter, target) => adapter.capabilities(target),
    PyPiRegistryTarget: (adapter, target) => adapter.capabilities(target),
    ScoopBucketTarget: (adapter, target) => adapter.capabilities(target)
  })

export const LiveTargetRegistryLayer: Layer.Layer<TargetRegistry> = Layer.succeed(TargetRegistry)({
  targetCapabilities: liveTargetCapabilities,
  planTargetOperations: planLiveTargetOperations
})
