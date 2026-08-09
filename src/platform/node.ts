import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient"
import * as NodePath from "@effect/platform-node/NodePath"
import * as Layer from "effect/Layer"
import type { ApprovalSigner } from "../apply/approval.js"
import type { RunStore } from "../apply/store.js"
import type { CredentialStore, DriverCatalog, WorkspaceStore } from "../drivers/services.js"
import { ReleaseServicesLive } from "./services.js"
import { SourceObserver } from "../release/context.js"
import { SourceObserverLive } from "./source-observer.js"

// The Node host boundary: spawn and HTTP closed with @effect/platform-node.
// Reachable as "@mannyc1/ts-release/node" so a Node consumer never loads a Bun
// module, and correct under Bun too through its Node compatibility layer.
export const NodeReleaseLayer: Layer.Layer<
  RunStore | WorkspaceStore | DriverCatalog | CredentialStore | ApprovalSigner | SourceObserver
> = Layer.merge(ReleaseServicesLive.pipe(Layer.provide(Layer.mergeAll(
  NodeChildProcessSpawner.layer.pipe(
    Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
  ),
  NodeHttpClient.layerFetch
))), SourceObserverLive)
