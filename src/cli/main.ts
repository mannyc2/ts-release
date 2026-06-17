#!/usr/bin/env bun

import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { LiveReleaseHttpLayer } from "../host/http-live.js"
import { PlatformCommandRunnerLayer } from "../host/platform.js"
import { LiveTargetRegistryLayer } from "../targets/live.js"
import { RELEASE_VERSION } from "../version.js"
import { cli } from "./command.js"

const PlatformLayer = PlatformCommandRunnerLayer.pipe(Layer.provideMerge(BunServices.layer))

const HostHttpClientLayer = Layer.mergeAll(
  PlatformLayer,
  BunHttpClient.layer
)

const MainLayer = Layer.mergeAll(
  LiveReleaseHttpLayer.pipe(Layer.provideMerge(HostHttpClientLayer)),
  LiveTargetRegistryLayer
)

Command.run(cli, { version: RELEASE_VERSION }).pipe(
  Effect.provide(MainLayer),
  BunRuntime.runMain
)
