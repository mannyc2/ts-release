import * as BunChildProcessSpawner from "@effect/platform-bun/BunChildProcessSpawner"
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunPath from "@effect/platform-bun/BunPath"
import * as Layer from "effect/Layer"
import type { ApprovalSigner } from "../apply/approval.js"
import type { RunStore } from "../apply/store.js"
import type { CredentialStore, DriverCatalog, WorkspaceStore } from "../drivers/services.js"
import { ReleaseServicesLive } from "./services.js"

// The Bun host boundary: spawn and HTTP closed with @effect/platform-bun.
// Reachable only as "@mannyc1/ts-release/bun", so importing the package root
// under Node never pulls a Bun module into the graph.
export const BunReleaseLayer: Layer.Layer<
  RunStore | WorkspaceStore | DriverCatalog | CredentialStore | ApprovalSigner
> = ReleaseServicesLive.pipe(Layer.provide(Layer.mergeAll(
  BunChildProcessSpawner.layer.pipe(
    Layer.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))
  ),
  BunHttpClient.layer
)))
