import * as BunChildProcessSpawner from "@effect/platform-bun/BunChildProcessSpawner"
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunPath from "@effect/platform-bun/BunPath"
import * as Layer from "effect/Layer"
import { ReleaseRuntime } from "../api/runtime.js"
import { ReleaseServicesLive } from "./services.js"
import { SourceObserver } from "../release/context.js"
import { SourceObserverLive } from "./source-observer.js"

export const BunReleaseLayer: Layer.Layer<ReleaseRuntime> = ReleaseServicesLive.pipe(Layer.provide(Layer.mergeAll(
    BunChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))),
    BunHttpClient.layer,
    SourceObserverLive
  )))
