#!/usr/bin/env bun

import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { renderEvidenceJson, renderReleaseFiles } from "../../../src/engine/engine.js"
import { BunReleaseWorkflowRuntimeLayer } from "../src/runtime/bun.js"

interface RenderCatalogsArgs {
  readonly configPath: string
  readonly root?: string | undefined
}

const parseArgs = (args: ReadonlyArray<string>): RenderCatalogsArgs => {
  let configPath = "apps/release-ts/release.config.json"
  let root: string | undefined
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]
    if (arg === "--config" && next !== undefined) {
      configPath = next
      index += 1
      continue
    }
    if (arg === "--root" && next !== undefined) {
      root = next
      index += 1
    }
  }
  return {
    configPath,
    ...(root === undefined ? {} : { root })
  }
}

const main = Effect.fn("scripts.renderCatalogs")(function*(args: RenderCatalogsArgs) {
  const result = yield* renderReleaseFiles({
    ...args,
    execute: true
  })
  yield* Console.log(renderEvidenceJson(result.evidence).trimEnd())
})

main(parseArgs(Bun.argv.slice(2))).pipe(
  Effect.provide(BunReleaseWorkflowRuntimeLayer),
  BunRuntime.runMain
)
