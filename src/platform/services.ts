import * as Layer from "effect/Layer"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ReleaseRuntime } from "../api/runtime.js"
import { makeReleaseRuntimeLive, ReleaseRuntimeLive, type PreparedStoreSelector } from "./release-runtime.js"
import { SourceObserver } from "../release/context.js"

export type ReleaseServicesLayer = Layer.Layer<ReleaseRuntime, never, SourceObserver | ChildProcessSpawner | HttpClient.HttpClient>

export const ReleaseServicesLive: ReleaseServicesLayer = ReleaseRuntimeLive
export const makeReleaseServicesLive = (preparedStore: PreparedStoreSelector): ReleaseServicesLayer =>
  makeReleaseRuntimeLive(preparedStore)
