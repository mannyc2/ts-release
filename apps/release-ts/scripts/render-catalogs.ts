#!/usr/bin/env bun

import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Command from "effect/unstable/cli/Command"
import * as Flag from "effect/unstable/cli/Flag"
import packageManifest from "../../../package.json" with { type: "json" }
import { renderEvidenceJson, renderReleaseFiles } from "../../../src/engine/engine.js"
import { optionalField } from "../../../src/pipeline/optional-field.js"
import { BunReleaseWorkflowRuntimeLayer } from "../src/runtime.js"

const renderCatalogs = Command.make("render-catalogs", {
  config: Flag.string("config").pipe(Flag.withDefault("apps/release-ts/release.config.json")),
  root: Flag.string("root").pipe(Flag.optional)
}, Effect.fn("scripts.renderCatalogs")(function*({ config, root }) {
  const result = yield* renderReleaseFiles({
    config,
    ...optionalField(Option.getOrUndefined(root), (workspace) => ({ workspace })),
    execute: true
  })
  yield* Console.log(renderEvidenceJson(result.evidence).trimEnd())
}))

Command.run(renderCatalogs, { version: packageManifest.version }).pipe(
  Effect.provide(BunReleaseWorkflowRuntimeLayer),
  BunRuntime.runMain
)
