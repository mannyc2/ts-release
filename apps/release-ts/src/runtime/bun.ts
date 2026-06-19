import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Layer from "effect/Layer"
import { makePlatformCommandRunnerLayer } from "@mannyc1/ts-release/host/platform"
import type { PlatformCommandRunnerOptions } from "@mannyc1/ts-release/host/platform"
import { LiveReleaseWorkflowLayer } from "@mannyc1/ts-release/workflows/live"

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
    LiveReleaseWorkflowLayer.pipe(Layer.provideMerge(BunHttpClient.layer))
  )

export const BunCommandRuntimeLayer = makeBunCommandRuntimeLayer()

export const BunReleaseWorkflowRuntimeLayer = makeBunReleaseWorkflowRuntimeLayer()
