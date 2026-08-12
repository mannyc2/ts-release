import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient"
import * as NodePath from "@effect/platform-node/NodePath"
import * as Layer from "effect/Layer"
import { join } from "node:path"
import type { ReleaseApiLayer } from "../api/types.js"
import { SourceObserverLive } from "./source-observer.js"
import { makeReleaseServicesLive } from "./services.js"
import {
  makeLocalPreparedReleaseStore,
  type PreparedReleaseStoreShape
} from "../release/prepared-store.js"

const nodeHost = Layer.mergeAll(
  NodeChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(
    NodeFileSystem.layer,
    NodePath.layer
  ))),
  NodeHttpClient.layerFetch,
  SourceObserverLive
)

/** A custom Node host takes one already-selected durable store service. */
export const makeNodeReleaseLayer = (
  preparedStore: PreparedReleaseStoreShape
): ReleaseApiLayer => makeReleaseServicesLive(preparedStore).pipe(Layer.provide(nodeHost))

const defaultNodeStore = makeLocalPreparedReleaseStore(join(
  process.cwd(),
  ".release",
  "ts-release",
  "prepared"
))

export const NodeReleaseLayer: ReleaseApiLayer = makeNodeReleaseLayer(defaultNodeStore)
