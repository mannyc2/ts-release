import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient"
import * as NodePath from "@effect/platform-node/NodePath"
import * as Layer from "effect/Layer"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../api/runtime.js"
import { ReleaseServicesLive } from "./services.js"
import { SourceObserver } from "../release/context.js"
import { SourceObserverLive } from "./source-observer.js"

export const NodeReleaseLayer: Layer.Layer<ReleaseRuntime> = ReleaseServicesLive.pipe(Layer.provide(Layer.mergeAll(
    NodeChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))),
    NodeHttpClient.layerFetch,
    SourceObserverLive
  )))
