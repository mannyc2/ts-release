// Invariant: concrete Node services are assembled only at the bundled Action runtime boundary.
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Layer from "effect/Layer"
import { UnsupportedArtifactStagerLayer } from "../../../../src/engine/stager.js"
import { LiveReleaseHttpLayer } from "../../../../src/host/http-live.js"
import { makePlatformCommandRunnerLayer, type PlatformCommandRunnerOptions } from "../../../../src/host/platform.js"
import { GitHubApiLiveLayer } from "../../../../src/engine/github.js"

export const makeNodeReleaseWorkflowRuntimeLayer = (
  options: PlatformCommandRunnerOptions = {}
) =>
  Layer.mergeAll(
    makePlatformCommandRunnerLayer(options).pipe(
      Layer.provideMerge(NodeServices.layer)
    ),
    Layer.provideMerge(GitHubApiLiveLayer, LiveReleaseHttpLayer).pipe(
      Layer.provideMerge(NodeHttpClient.layerFetch),
      Layer.provideMerge(NodeServices.layer)
    ),
    UnsupportedArtifactStagerLayer,
    NodeServices.layer
  )
