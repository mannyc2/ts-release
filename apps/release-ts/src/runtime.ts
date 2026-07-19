import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Layer from "effect/Layer"
import { makeArtifactStagerLayer, liveBunExecutableBuild } from "../../../src/engine/stager.js"
import { GitHubApiLiveLayer } from "../../../src/engine/github.js"
import { LiveReleaseHttpLayer } from "../../../src/host/http-live.js"
import { makePlatformCommandRunnerLayer, type PlatformCommandRunnerOptions } from "../../../src/host/platform.js"

export const makeBunCommandRuntimeLayer = (options: PlatformCommandRunnerOptions = {}) =>
  makePlatformCommandRunnerLayer(options).pipe(Layer.provideMerge(BunServices.layer))

export const makeBunReleaseWorkflowRuntimeLayer = (options: PlatformCommandRunnerOptions = {}) =>
  Layer.mergeAll(
    makeBunCommandRuntimeLayer(options),
    Layer.provideMerge(GitHubApiLiveLayer, LiveReleaseHttpLayer).pipe(
      Layer.provideMerge(BunHttpClient.layer),
      Layer.provideMerge(BunServices.layer)
    ),
    makeArtifactStagerLayer().pipe(Layer.provideMerge(BunServices.layer))
  )

export const BunReleaseWorkflowRuntimeLayer = makeBunReleaseWorkflowRuntimeLayer()
export { liveBunExecutableBuild, makeArtifactStagerLayer }
export type { BunExecutableBuild, BunExecutableBuildInput } from "../../../src/engine/stager.js"
