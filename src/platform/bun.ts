import * as BunChildProcessSpawner from "@effect/platform-bun/BunChildProcessSpawner"
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunPath from "@effect/platform-bun/BunPath"
import * as Layer from "effect/Layer"
import { join } from "node:path"
import type { ReleaseApiLayer } from "../api/types.js"
import { SourceObserverLive } from "./source-observer.js"
import { makeReleaseServicesLive } from "./services.js"
import {
  makeLocalPreparedReleaseStore,
  type PreparedReleaseStoreShape
} from "../release/prepared-store.js"

const bunHost = Layer.mergeAll(
  BunChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(
    BunFileSystem.layer,
    BunPath.layer
  ))),
  BunHttpClient.layer,
  SourceObserverLive
)

/** A custom Bun host takes one already-selected durable store service. */
export const makeBunReleaseLayer = (
  preparedStore: PreparedReleaseStoreShape
): ReleaseApiLayer => makeReleaseServicesLive(preparedStore).pipe(Layer.provide(bunHost))

const defaultBunStore = makeLocalPreparedReleaseStore(join(
  process.cwd(),
  ".release",
  "ts-release",
  "prepared"
))

export const BunReleaseLayer: ReleaseApiLayer = makeBunReleaseLayer(defaultBunStore)
