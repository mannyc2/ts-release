#!/usr/bin/env bun

import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { BunReleaseHostLayer } from "../host/bun.js"
import { LiveReleaseHttpLayer } from "../host/http-live.js"
import { LiveTargetRegistryLayer } from "../targets/live.js"
import { cli } from "./command.js"

const HostHttpClientLayer = Layer.mergeAll(
  BunReleaseHostLayer,
  BunHttpClient.layer
)

const MainLayer = Layer.mergeAll(
  LiveReleaseHttpLayer.pipe(Layer.provideMerge(HostHttpClientLayer)),
  LiveTargetRegistryLayer,
  BunServices.layer
)

Command.run(cli, { version: "0.0.0" }).pipe(
  Effect.provide(MainLayer),
  BunRuntime.runMain
)
