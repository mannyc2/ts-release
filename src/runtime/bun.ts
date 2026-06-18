import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Layer from "effect/Layer"
import { makePlatformCommandRunnerLayer } from "../host/platform.js"
import type { PlatformCommandRunnerOptions } from "../host/platform.js"
import { LiveReleaseWorkflowLayer } from "../workflows/live.js"

export type * from "../types/effect-internal.js"

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
