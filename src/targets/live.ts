import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ReleaseModel } from "../domain/release.js"
import { TargetConfig } from "../domain/target.js"
import { GitHubAdapter } from "./github.js"
import { HomebrewAdapter } from "./homebrew.js"
import { NpmAdapter } from "./npm.js"
import { PyPiAdapter } from "./pypi.js"
import { TargetRegistry } from "./registry.js"
import { ScoopAdapter } from "./scoop.js"

export type * from "../types/effect-internal.js"

const planLiveTargetOperations = Effect.fn("planLiveTargetOperations")(function*(
  target: TargetConfig,
  model: ReleaseModel
) {
  switch (target._tag) {
    case "NpmRegistryTarget":
      return yield* NpmAdapter.planOperations(target, model)
    case "GitHubReleaseTarget":
      return yield* GitHubAdapter.planOperations(target, model)
    case "HomebrewTapTarget":
      return yield* HomebrewAdapter.planOperations(target, model)
    case "PyPiRegistryTarget":
      return yield* PyPiAdapter.planOperations(target, model)
    case "ScoopBucketTarget":
      return yield* ScoopAdapter.planOperations(target, model)
  }
})

const liveTargetCapabilities = (target: TargetConfig) => {
  switch (target._tag) {
    case "NpmRegistryTarget":
      return NpmAdapter.capabilities(target)
    case "GitHubReleaseTarget":
      return GitHubAdapter.capabilities(target)
    case "HomebrewTapTarget":
      return HomebrewAdapter.capabilities(target)
    case "PyPiRegistryTarget":
      return PyPiAdapter.capabilities(target)
    case "ScoopBucketTarget":
      return ScoopAdapter.capabilities(target)
  }
}

export const LiveTargetRegistryLayer: Layer.Layer<TargetRegistry> = Layer.succeed(TargetRegistry)({
  targetCapabilities: liveTargetCapabilities,
  planTargetOperations: planLiveTargetOperations
})
