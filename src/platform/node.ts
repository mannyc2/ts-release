import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient"
import * as NodePath from "@effect/platform-node/NodePath"
import * as Layer from "effect/Layer"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../api/runtime.js"
import { makeReleaseServicesLive, ReleaseServicesLive } from "./services.js"
import type { PreparedStoreSelector } from "./release-runtime.js"
import { SourceObserver } from "../release/context.js"
import { SourceObserverLive } from "./source-observer.js"

const provideNode = (services: import("./services.js").ReleaseServicesLayer): Layer.Layer<ReleaseRuntime> => services.pipe(Layer.provide(Layer.mergeAll(
    NodeChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))),
    NodeHttpClient.layerFetch,
    SourceObserverLive
  )))

export const makeNodeReleaseLayer = (preparedStore: PreparedStoreSelector): Layer.Layer<ReleaseRuntime> =>
  provideNode(makeReleaseServicesLive(preparedStore))

export const NodeReleaseLayer: Layer.Layer<ReleaseRuntime> = provideNode(ReleaseServicesLive)
