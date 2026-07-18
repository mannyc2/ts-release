import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Layer from "effect/Layer"
import { LiveReleaseHttpLayer } from "../../../../src/host/http-live.js"
import { makePlatformCommandRunnerLayer } from "../../../../src/host/platform.js"
import type { PlatformCommandRunnerOptions } from "../../../../src/host/platform.js"
import { makeArtifactStagerLayer, liveBunExecutableBuild } from "../../../../src/engine/stager.js"
import type { BunExecutableBuild } from "../../../../src/engine/stager.js"
import { GitHubApiLiveLayer } from "../../../../src/engine/github.js"

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
    Layer.provideMerge(GitHubApiLiveLayer, LiveReleaseHttpLayer).pipe(
      Layer.provideMerge(BunHttpClient.layer),
      Layer.provideMerge(BunServices.layer)
    ),
    makeArtifactStagerLayer().pipe(
      Layer.provideMerge(BunServices.layer)
    )
  )

export const BunCommandRuntimeLayer = makeBunCommandRuntimeLayer()

export const BunReleaseWorkflowRuntimeLayer = makeBunReleaseWorkflowRuntimeLayer()

export {
  liveBunExecutableBuild,
  makeArtifactStagerLayer
}

export type {
  BunExecutableBuild,
  BunExecutableBuildInput,
  BunExecutableBuildOutput
} from "../../../../src/engine/stager.js"
