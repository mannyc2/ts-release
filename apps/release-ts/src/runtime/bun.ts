import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Layer from "effect/Layer"
import { LiveReleaseHttpLayer } from "../../../../src/host/http-live.js"
import { makePlatformCommandRunnerLayer } from "../../../../src/host/platform.js"
import type { PlatformCommandRunnerOptions } from "../../../../src/host/platform.js"
import { GitHubApiLiveLayer } from "../../../../src/targets/github-api.js"
import { LiveTargetRegistryLayer } from "../../../../src/targets/live.js"
import { LiveBunArtifactRecipeRegistryLayer } from "./bun-artifact-recipes.js"

export const makeBunCommandRuntimeLayer = (
  options: PlatformCommandRunnerOptions = {}
) =>
  makePlatformCommandRunnerLayer(options).pipe(
    Layer.provideMerge(BunServices.layer)
  )

export const makeBunReleaseWorkflowRuntimeLayer = (
  options: PlatformCommandRunnerOptions = {}
) =>
  Layer.mergeAll(
    makeBunCommandRuntimeLayer(options),
    Layer.mergeAll(
      Layer.provideMerge(GitHubApiLiveLayer, LiveReleaseHttpLayer),
      LiveTargetRegistryLayer
    ).pipe(
      Layer.provideMerge(BunHttpClient.layer),
      Layer.provideMerge(BunServices.layer)
    ),
    LiveBunArtifactRecipeRegistryLayer
  )

export const BunCommandRuntimeLayer = makeBunCommandRuntimeLayer()

export const BunReleaseWorkflowRuntimeLayer = makeBunReleaseWorkflowRuntimeLayer()

export {
  LiveBunArtifactRecipeRegistryLayer,
  liveBunExecutableBuild,
  makeBunArtifactRecipeAdapter,
  makeBunArtifactRecipeRegistryLayer
} from "./bun-artifact-recipes.js"

export type {
  BunExecutableBuild,
  BunExecutableBuildInput,
  BunExecutableBuildOutput
} from "./bun-artifact-recipes.js"
