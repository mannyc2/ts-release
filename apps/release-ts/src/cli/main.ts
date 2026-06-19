#!/usr/bin/env bun

import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import { BunReleaseWorkflowRuntimeLayer } from "../runtime/bun.js"
import { RELEASE_VERSION } from "../version.js"
import { cli } from "./command.js"

Command.run(cli, { version: RELEASE_VERSION }).pipe(
  Effect.provide(BunReleaseWorkflowRuntimeLayer),
  BunRuntime.runMain
)
