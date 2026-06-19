import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Layer from "effect/Layer"
import { makePlatformCommandRunnerLayer } from "@mannyc1/ts-release/host/platform"
import type { PlatformCommandRunnerOptions } from "@mannyc1/ts-release/host/platform"
import { LiveReleaseWorkflowLayer } from "@mannyc1/ts-release/workflows/live"

export const makeNodeReleaseWorkflowRuntimeLayer = (
  options: PlatformCommandRunnerOptions = {}
) =>
  Layer.mergeAll(
    makePlatformCommandRunnerLayer(options).pipe(
      Layer.provideMerge(NodeServices.layer)
    ),
    LiveReleaseWorkflowLayer.pipe(Layer.provideMerge(NodeHttpClient.layerFetch)),
    NodeServices.layer
  )

export const NodeReleaseWorkflowRuntimeLayer = makeNodeReleaseWorkflowRuntimeLayer()
