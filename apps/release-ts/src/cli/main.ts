#!/usr/bin/env bun
// Invariant: this executable provides the Bun layer once and runs exactly one decoded CLI command.

import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as Effect from "effect/Effect"
import * as Command from "effect/unstable/cli/Command"
import packageManifest from "../../../../package.json" with { type: "json" }
import { BunReleaseWorkflowRuntimeLayer } from "../runtime.js"
import { cli } from "./command.js"

Command.run(cli, { version: packageManifest.version }).pipe(
  Effect.provide(BunReleaseWorkflowRuntimeLayer),
  BunRuntime.runMain
)
