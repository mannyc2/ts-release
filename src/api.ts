import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { ConfigReadError } from "./config/errors.js"
import { parseReleaseIntent } from "./config/load.js"
import { DEFAULT_CONFIG_PATH } from "./config/schema.js"
import { EvidenceBundle, ReleaseWorkflowEvidence } from "./domain/evidence.js"
import { ExecutionApproval } from "./domain/operation.js"
import { ReleasePlan } from "./domain/release.js"
import { createReleasePlan } from "./planner/create-release-plan.js"
import { executePlan, renderPlan, runApprovedReleaseWorkflow, validatePlan, verifyPlan } from "./planner/executor.js"
import { renderPlanJson, renderPlanText } from "./planner/render-plan.js"
import {
  ReleaseResumeOptions,
  renderReleaseStatusJson,
  renderReleaseStatusText,
  resumeApprovedReleaseWorkflow,
  statusReleasePlan
} from "./planner/status.js"
import { RELEASE_VERSION } from "./version.js"

export type * from "./types/effect-internal.js"

export { RELEASE_VERSION }

export const ReleasePlanFormat = Schema.Literals(["json", "text"])
export type ReleasePlanFormat = typeof ReleasePlanFormat.Type

export class ReleaseApiOptions extends Schema.Class<ReleaseApiOptions>("ReleaseApiOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String)
}) {}

export class PlanReleaseConfigOptions extends Schema.Class<PlanReleaseConfigOptions>("PlanReleaseConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleasePlanFormat)
}) {}

export class RenderReleaseConfigOptions extends Schema.Class<RenderReleaseConfigOptions>("RenderReleaseConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseExecutionOptions extends Schema.Class<ReleaseExecutionOptions>("ReleaseExecutionOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean),
  approveIrreversible: Schema.optionalKey(Schema.Boolean)
}) {}

export class ReleaseStatusOptions extends Schema.Class<ReleaseStatusOptions>("ReleaseStatusOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  format: Schema.optionalKey(ReleasePlanFormat)
}) {}

export class ReleaseResumeConfigOptions extends Schema.Class<ReleaseResumeConfigOptions>("ReleaseResumeConfigOptions")({
  root: Schema.optionalKey(Schema.String),
  configPath: Schema.optionalKey(Schema.String),
  execute: Schema.optionalKey(Schema.Boolean),
  approveIrreversible: Schema.optionalKey(Schema.Boolean)
}) {}

const apiRoot = (path: Path.Path, options: ReleaseApiOptions): string => {
  if (options.root !== undefined) {
    return options.root
  }
  if (options.configPath !== undefined && path.isAbsolute(options.configPath)) {
    return path.dirname(options.configPath)
  }
  return "."
}

const apiConfigPath = (options: ReleaseApiOptions): string =>
  options.configPath ?? DEFAULT_CONFIG_PATH

const apiConfigReadPath = (path: Path.Path, options: ReleaseApiOptions): string => {
  const configPath = apiConfigPath(options)
  return path.isAbsolute(configPath) ? configPath : path.resolve(apiRoot(path, options), configPath)
}

const approvalFromOptions = (options: ReleaseExecutionOptions): ExecutionApproval =>
  ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: options.approveIrreversible ?? false
  })

const resumeOptionsFromApiOptions = (options: ReleaseResumeConfigOptions): ReleaseResumeOptions =>
  ReleaseResumeOptions.make({
    execute: options.execute ?? false,
    approveIrreversible: options.approveIrreversible ?? false
  })

const renderApprovalFromOptions = (options: RenderReleaseConfigOptions): ExecutionApproval =>
  ExecutionApproval.make({
    execute: options.execute ?? false,
    approveIrreversible: false
  })

const readApiConfig = Effect.fn("api.readApiConfig")(function*(options: ReleaseApiOptions) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const configPath = apiConfigPath(options)
  const readPath = apiConfigReadPath(path, options)
  return yield* fs.readFileString(readPath).pipe(
    Effect.mapError((error) =>
      ConfigReadError.make({
        path: configPath,
        reason: error.message
      })
    )
  )
})

export const planReleaseConfig = Effect.fn("api.planReleaseConfig")(function*(
  options: PlanReleaseConfigOptions = PlanReleaseConfigOptions.make({})
) {
  const path = yield* Path.Path
  const configPath = apiConfigPath(options)
  const contents = yield* readApiConfig(options)
  const intent = yield* parseReleaseIntent(contents, configPath)
  return yield* createReleasePlan(intent, apiRoot(path, options), configPath)
})

export const renderReleaseConfigPlan = Effect.fn("api.renderReleaseConfigPlan")(function*(
  options: PlanReleaseConfigOptions = PlanReleaseConfigOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return (options.format ?? "text") === "json"
    ? renderPlanJson(plan)
    : renderPlanText(plan)
})

export const renderReleaseConfig = Effect.fn("api.renderReleaseConfig")(function*(
  options: RenderReleaseConfigOptions = RenderReleaseConfigOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* renderPlan(plan, renderApprovalFromOptions(options))
})

export const validateReleaseConfig = Effect.fn("api.validateReleaseConfig")(function*(
  options: ReleaseApiOptions = ReleaseApiOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* validatePlan(plan)
})

export const executeReleaseConfig = Effect.fn("api.executeReleaseConfig")(function*(
  options: ReleaseExecutionOptions = ReleaseExecutionOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* executePlan(plan, approvalFromOptions(options))
})

export const verifyReleaseConfig = Effect.fn("api.verifyReleaseConfig")(function*(
  options: ReleaseApiOptions = ReleaseApiOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* verifyPlan(plan)
})

export const runReleaseConfig = Effect.fn("api.runReleaseConfig")(function*(
  options: ReleaseExecutionOptions = ReleaseExecutionOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* runApprovedReleaseWorkflow(plan, approvalFromOptions(options))
})

export const statusReleaseConfig = Effect.fn("api.statusReleaseConfig")(function*(
  options: ReleaseStatusOptions = ReleaseStatusOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* statusReleasePlan(plan)
})

export const renderReleaseStatus = Effect.fn("api.renderReleaseStatus")(function*(
  options: ReleaseStatusOptions = ReleaseStatusOptions.make({})
) {
  const report = yield* statusReleaseConfig(options)
  return (options.format ?? "text") === "json"
    ? renderReleaseStatusJson(report)
    : renderReleaseStatusText(report)
})

export const resumeReleaseConfig = Effect.fn("api.resumeReleaseConfig")(function*(
  options: ReleaseResumeConfigOptions = ReleaseResumeConfigOptions.make({})
) {
  const plan = yield* planReleaseConfig(options)
  return yield* resumeApprovedReleaseWorkflow(plan, resumeOptionsFromApiOptions(options))
})
