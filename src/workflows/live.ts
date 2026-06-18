import * as Layer from "effect/Layer"
import * as HttpClient from "effect/unstable/http/HttpClient"
import { ReleaseHttp } from "../host/http.js"
import { LiveReleaseHttpLayer } from "../host/http-live.js"
import { LiveTargetRegistryLayer } from "../targets/live.js"
import { TargetRegistry } from "../targets/registry.js"

export type * from "../types/effect-internal.js"

export const LiveReleaseWorkflowLayer: Layer.Layer<
  ReleaseHttp | TargetRegistry,
  never,
  HttpClient.HttpClient
> = Layer.mergeAll(
  LiveReleaseHttpLayer,
  LiveTargetRegistryLayer
)
