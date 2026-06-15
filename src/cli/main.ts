#!/usr/bin/env bun

import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { BunReleaseHostLayer } from "../host/bun.js"
import { LiveTargetRegistryLayer } from "../targets/live.js"
import { cli } from "./command.js"

const MainLayer = Layer.mergeAll(
  BunReleaseHostLayer,
  LiveTargetRegistryLayer,
  BunServices.layer
)

Command.run(cli, { version: "0.0.0" }).pipe(
  Effect.provide(MainLayer),
  BunRuntime.runMain
)
