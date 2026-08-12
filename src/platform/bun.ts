import * as BunChildProcessSpawner from "@effect/platform-bun/BunChildProcessSpawner"
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunPath from "@effect/platform-bun/BunPath"
import * as Layer from "effect/Layer"
import { ReleaseRuntime } from "../api/runtime.js"
import { makeReleaseServicesLive, ReleaseServicesLive } from "./services.js"
import type { PreparedStoreSelector } from "./release-runtime.js"
import { SourceObserver } from "../release/context.js"
import { SourceObserverLive } from "./source-observer.js"

const provideBun = (services: import("./services.js").ReleaseServicesLayer): Layer.Layer<ReleaseRuntime> => services.pipe(Layer.provide(Layer.mergeAll(
    BunChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))),
    BunHttpClient.layer,
    SourceObserverLive
  )))

export const makeBunReleaseLayer = (preparedStore: PreparedStoreSelector): Layer.Layer<ReleaseRuntime> =>
  provideBun(makeReleaseServicesLive(preparedStore))

export const BunReleaseLayer: Layer.Layer<ReleaseRuntime> = provideBun(ReleaseServicesLive)
