import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ReleaseModel } from "../domain/release.js"
import { TargetConfig } from "../domain/target.js"
import { GitHubAdapter } from "./github.js"
import { HomebrewAdapter } from "./homebrew.js"
import { NpmAdapter } from "./npm.js"
import { TargetRegistry } from "./registry.js"

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
  }
}

export const LiveTargetRegistryLayer: Layer.Layer<TargetRegistry> = Layer.succeed(TargetRegistry)({
  targetCapabilities: liveTargetCapabilities,
  planTargetOperations: planLiveTargetOperations
})
