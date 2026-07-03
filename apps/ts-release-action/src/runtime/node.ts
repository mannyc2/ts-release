import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Layer from "effect/Layer"
import { UnsupportedArtifactStagerLayer } from "../../../../src/engine/stager.js"
import { LiveReleaseHttpLayer } from "../../../../src/host/http-live.js"
import { makePlatformCommandRunnerLayer } from "../../../../src/host/platform.js"
import type { PlatformCommandRunnerOptions } from "../../../../src/host/platform.js"
import { GitHubApiLiveLayer } from "../../../../src/targets/github-api.js"
import { LiveTargetRegistryLayer } from "../../../../src/targets/live.js"

export const UnsupportedNodeArtifactStagerLayer = UnsupportedArtifactStagerLayer

export const makeNodeReleaseWorkflowRuntimeLayer = (
  options: PlatformCommandRunnerOptions = {}
) =>
  Layer.mergeAll(
    makePlatformCommandRunnerLayer(options).pipe(
      Layer.provideMerge(NodeServices.layer)
    ),
    Layer.mergeAll(
      Layer.provideMerge(GitHubApiLiveLayer, LiveReleaseHttpLayer),
      LiveTargetRegistryLayer
    ).pipe(
      Layer.provideMerge(NodeHttpClient.layerFetch),
      Layer.provideMerge(NodeServices.layer)
    ),
    UnsupportedNodeArtifactStagerLayer,
    NodeServices.layer
  )

export const NodeReleaseWorkflowRuntimeLayer = makeNodeReleaseWorkflowRuntimeLayer()
