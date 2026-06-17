import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Command from "effect/unstable/cli/Command"
import { parseReleaseIntent } from "../config/load.js"
import { DEFAULT_CONFIG_PATH } from "../config/schema.js"
import { ReleasePlan } from "../domain/release.js"
import { makeBunReleaseHostLayer } from "../host/bun.js"
import { ReleaseHost } from "../host/host.js"
import { LiveReleaseHttpLayer } from "../host/http-live.js"
import { createReleasePlan } from "../planner/create-release-plan.js"
import { renderPlanJson, renderPlanText } from "../planner/render-plan.js"
import { LiveTargetRegistryLayer } from "../targets/live.js"
import { cli } from "./command.js"

export type * from "../types/effect-internal.js"

export const DEFAULT_RELEASE_CLI_VERSION = "0.0.1"

export const ReleasePlanFormat = Schema.Literals(["json", "text"])
export type ReleasePlanFormat = typeof ReleasePlanFormat.Type

export class ReleaseCliOptions extends Schema.Class<ReleaseCliOptions>("ReleaseCliOptions")({
  root: Schema.optionalKey(Schema.String),
  version: Schema.optionalKey(Schema.String)
}) {}

export class PlanReleaseConfigOptions extends Schema.Class<PlanReleaseConfigOptions>("PlanReleaseConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleasePlanFormat)
}) {}

const programmaticLayer = (root: string | undefined) => {
  const hostHttpClientLayer = Layer.mergeAll(
    makeBunReleaseHostLayer({ root }),
    BunHttpClient.layer
  )
  return Layer.mergeAll(
    LiveReleaseHttpLayer.pipe(Layer.provideMerge(hostHttpClientLayer)),
    LiveTargetRegistryLayer,
    BunServices.layer
  )
}

const loadPlanFromOptions = Effect.fn("cli.programmatic.loadPlanFromOptions")(function*(
  options: PlanReleaseConfigOptions
) {
  const root = options.root ?? "."
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH
  const host = yield* ReleaseHost
  const contents = yield* host.readFileString(configPath)
  const intent = yield* parseReleaseIntent(contents, configPath)
  return yield* createReleasePlan(intent, root, configPath)
})

export const planReleaseConfig = Effect.fn("planReleaseConfig")(function*(
  options: PlanReleaseConfigOptions = PlanReleaseConfigOptions.make({})
) {
  return yield* loadPlanFromOptions(options).pipe(
    Effect.provide(programmaticLayer(options.root))
  )
})

export const renderReleaseConfigPlan = Effect.fn("renderReleaseConfigPlan")(function*(
  options: PlanReleaseConfigOptions = PlanReleaseConfigOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return (options.format ?? "text") === "json"
    ? renderPlanJson(plan)
    : renderPlanText(plan)
})

export const runReleaseCli = Effect.fn("runReleaseCli")(function*(
  args: ReadonlyArray<string>,
  options: ReleaseCliOptions = ReleaseCliOptions.make({})
) {
  yield* Command.runWith(cli, { version: options.version ?? DEFAULT_RELEASE_CLI_VERSION })([...args]).pipe(
    Effect.provide(programmaticLayer(options.root))
  )
})

export type ProgrammaticReleasePlan = ReleasePlan
